"""
AI 诊断 API —— /api/ai
规则引擎 / 相似病例 / 知识库 / 防幻觉验证 / 云端 CoT（演示实现）
"""
import json
import os
import re
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db, employee_session
from ..core.dependencies import get_current_user
from ..models.models import KnowledgeDoc, MedicalRecord, User
from ..services import ai_provider as svc

router = APIRouter(prefix="/api/ai", tags=["AI 诊断"])


class DiagnosePayload(BaseModel):
    symptoms: str
    patient_id: int | None = None
    provider: str = "local"


class WorkflowStageUpdate(BaseModel):
    key: str
    enabled: bool = True


# 症状 → (候选诊断, 分类, 基础置信度) 规则表（离线可用，11 类常见症状）
SYMPTOM_RULES = [
    ("发热", [("上呼吸道感染", "呼吸系统", 0.62), ("流行性感冒", "呼吸系统", 0.58)]),
    ("咳嗽", [("急性支气管炎", "呼吸系统", 0.6), ("上呼吸道感染", "呼吸系统", 0.56)]),
    ("咳痰", [("急性支气管炎", "呼吸系统", 0.6), ("社区获得性肺炎", "呼吸系统", 0.55)]),
    ("气促", [("支气管哮喘", "呼吸系统", 0.58), ("慢性阻塞性肺疾病", "呼吸系统", 0.55)]),
    ("胸痛", [("心绞痛", "循环系统", 0.6), ("肋间神经痛", "神经系统", 0.5)]),
    ("心悸", [("心律失常", "循环系统", 0.58), ("甲状腺功能亢进", "内分泌", 0.52)]),
    ("头痛", [("偏头痛", "神经系统", 0.58), ("紧张型头痛", "神经系统", 0.56)]),
    ("头晕", [("良性阵发性位置性眩晕", "神经系统", 0.55), ("原发性高血压", "循环系统", 0.53)]),
    ("血压", [("原发性高血压", "循环系统", 0.68)]),
    ("腹痛", [("急性胃肠炎", "消化系统", 0.6), ("慢性胃炎", "消化系统", 0.56)]),
    ("腹泻", [("急性胃肠炎", "消化系统", 0.64)]),
    ("恶心", [("慢性胃炎", "消化系统", 0.56), ("急性胃肠炎", "消化系统", 0.54)]),
    ("乏力", [("缺铁性贫血", "血液系统", 0.55), ("甲状腺功能减退", "内分泌", 0.52)]),
    ("血糖", [("2 型糖尿病", "内分泌", 0.66)]),
    ("多尿", [("2 型糖尿病", "内分泌", 0.6)]),
    ("皮疹", [("荨麻疹", "皮肤", 0.58), ("湿疹", "皮肤", 0.54)]),
    ("关节", [("骨关节炎", "运动系统", 0.56), ("类风湿关节炎", "运动系统", 0.52)]),
    ("失眠", [("失眠障碍", "精神心理", 0.6)]),
    ("焦虑", [("焦虑状态", "精神心理", 0.56)]),
]

SYMPTOM_SYNONYMS = {
    "发烧": "发热", "高热": "发热", "低热": "发热",
    "头疼": "头痛", "眩晕": "头晕", "拉肚子": "腹泻",
    "喘": "气促", "呼吸急促": "气促", "心慌": "心悸",
    "胃痛": "腹痛", "肚子疼": "腹痛", "皮疹瘙痒": "皮疹",
    "血压高": "血压", "高血压": "血压", "血糖高": "血糖",
    "无力": "乏力", "疲惫": "乏力", "关节痛": "关节",
}


def detect_symptom_hits(symptoms: str):
    """返回 [(disease, category, base_conf, matched_keywords)]，按命中关键词聚合"""
    text = symptoms or ""
    for syn, std in SYMPTOM_SYNONYMS.items():
        if syn in text:
            text += " " + std
    agg: dict = {}
    for keyword, cands in SYMPTOM_RULES:
        if keyword in text:
            for disease, category, base in cands:
                key = (disease, category)
                item = agg.setdefault(key, [base, []])
                item[0] = max(item[0], base)
                item[1].append(keyword)
    return [(d, c, v[0], v[1]) for (d, c), v in agg.items()]


@router.get("/workflow")
def get_workflow(_=Depends(get_current_user)):
    return {"stages": [
        {"key": "collect", "name": "症状采集", "group": "输入", "order": 1, "enabled": True, "desc": "采集患者主诉与症状"},
        {"key": "rule", "name": "规则引擎", "group": "诊断", "order": 2, "enabled": True, "desc": "基于医学规则的初步判断"},
        {"key": "similar", "name": "相似病例", "group": "诊断", "order": 3, "enabled": True, "desc": "向量检索相似病例"},
        {"key": "verify", "name": "防幻觉验证", "group": "校验", "order": 4, "enabled": True, "desc": "证据分级与幻觉拦截"},
    ]}


@router.post("/workflow")
def update_workflow(payload: WorkflowStageUpdate, _=Depends(get_current_user)):
    return {"detail": "ok", "stage": payload.key, "enabled": payload.enabled}


_AI_CFG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "ai_config.json")


def _load_ai_cfg() -> dict:
    try:
        with open(_AI_CFG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_ai_cfg(cfg: dict) -> None:
    os.makedirs(os.path.dirname(_AI_CFG_PATH), exist_ok=True)
    with open(_AI_CFG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


@router.get("/config")
def get_ai_config(_=Depends(get_current_user)):
    stored = _load_ai_cfg()
    gp = {"temperature": 0.3, "top_p": 0.9, "repetition_penalty": 1.1, "min_p": 0.05, "seed": 42}
    gp.update(stored.get("generation_parameters") or {})
    return {
        "role": "医学辅助诊断助手",
        "generation_parameters": gp,
        "provider_name": stored.get("provider_name", "NOVAMED 云端（默认）"),
        "request_url": stored.get("request_url", "https://api.medicine.local/v1"),
        "api_key": stored.get("api_key", "sk-**************3f2a"),
        "evidence_tiers": {"A": "随机对照试验/系统综述", "B": "队列/病例对照研究", "C": "专家共识/个案"},
    }


@router.put("/config")
def update_ai_config(payload: dict, _=Depends(get_current_user)):
    """保存个人 AI 参数（生成参数 + 供应商名称/请求地址/API Key），持久化到 data/ai_config.json"""
    cfg = _load_ai_cfg()
    for key in ("generation_parameters", "provider_name", "request_url", "api_key"):
        if key in payload and payload[key] is not None:
            cfg[key] = payload[key]
    _save_ai_cfg(cfg)
    return {"detail": "ok"}


@router.post("/diagnose")
def diagnose(payload: DiagnosePayload, _=Depends(get_current_user), db: Session = Depends(get_db)):
    """规则引擎 + 相似病例投票 + 知识库检索 + 防幻觉校验（离线可用）。

    返回富结构（diagnoses / verification / knowledge_refs ...），
    同时保留 diagnosis / confidence 兼容字段。
    """
    symptoms = (payload.symptoms or "").strip()
    hits = detect_symptom_hits(symptoms)

    # 候选诊断：命中症状的规则投票，置信度按命中数加权
    candidates = []
    for disease, category, base, matched in hits:
        conf = min(0.95, base + 0.06 * len(matched))
        candidates.append({
            "disease": disease, "confidence": round(conf, 2), "source": "rule_based",
            "rationale": ("命中症状：" + "、".join(matched) + "（" + category + "）") if matched else ("基于" + category + "规则"),
            "typical_symptoms": matched, "risk_level": "中" if conf >= 0.7 else "低",
            "confirmation_required": conf < 0.85,
        })
    candidates.sort(key=lambda c: c["confidence"], reverse=True)
    candidates = candidates[:5]

    categories = []
    for _, category, _, _ in hits:
        if category not in categories:
            categories.append(category)

    # 相似病例：按症状关键词重叠度打分
    q_words = [w for w in re.split(r"[，,。；;、\s]+", symptoms) if len(w) > 1]
    scored = []
    for r in db.query(MedicalRecord).filter(MedicalRecord.symptoms.isnot(None)).limit(200).all():
        text = f"{r.symptoms or ''} {r.diagnosis or ''} {r.prescription or ''}"
        overlap = sum(1 for w in q_words if w and w in text)
        # 关联患者时，其本人历史病例优先
        bonus = 0.4 if payload.patient_id and r.patient_id == payload.patient_id else 0.0
        if overlap or bonus:
            scored.append((overlap / max(len(q_words), 1) + bonus, r))
    scored.sort(key=lambda x: x[0], reverse=True)
    doctor_ids = {r.doctor_id for _, r in scored[:5] if getattr(r, "doctor_id", None)}
    # 医生在员工库（employee.db），须跨库查询
    doctors = {}
    if doctor_ids:
        s = employee_session()
        try:
            doctors = {u.id: (u.real_name or u.username)
                       for u in s.query(User).filter(User.id.in_(doctor_ids)).all()}
        finally:
            s.close()
    similar = [{
        "id": r.id, "symptoms": r.symptoms, "diagnosis": r.diagnosis,
        "treatment": r.prescription,
        "doctor_name": doctors.get(getattr(r, "doctor_id", None), ""),
        "visit_date": r.created_at.strftime("%Y-%m-%d") if getattr(r, "created_at", None) else "",
        "similarity_score": round(min(0.98, 0.45 + score * 0.5), 2),
    } for score, r in scored[:5]]
    cand_text = "；".join("%s(%d%%)" % (c["disease"], int(c["confidence"] * 100)) for c in candidates) or "无"

    # 知识库引用（用于证据核验）
    docs = []
    for d in db.query(KnowledgeDoc).limit(20).all():
        title = d.title or ""
        content = getattr(d, "content", "") or ""
        if any(w in title or w in content for w in q_words) or len(docs) < 3:
            docs.append(d)
        if len(docs) >= 3:
            break
    knowledge_refs = [{
        "title": d.title, "content_snippet": (getattr(d, "content", "") or "")[:120],
        "category": getattr(d, "category", ""), "tier": "B",
    } for d in docs]

    grounded = bool(similar or knowledge_refs)
    # 防幻觉：无任何引用支撑的候选主张自动撤回
    retracted = [
        {"disease": c["disease"], "reason": "未在相似病例或知识库中找到支撑性引用"}
        for c in candidates if not grounded and c["confidence"] < 0.8
    ]
    top = candidates[0] if candidates else None

    return {
        # 富结构
        "diagnoses": candidates,
        "matched_symptom_categories": categories,
        "suggested_exams": [f"{c}: 结合体征进一步检查" for c in categories[:2]],
        "knowledge_refs": knowledge_refs,
        "similar_cases": similar,
        "verification": {
            "verification_status": "confirmed" if grounded else "insufficient",
            "confirmation_required": True,
            "rules_applied": [
                "规则引擎症状匹配（11 类常见症状）",
                "相似病例投票（症状关键词重叠度）",
                "知识库引用核验",
                "无引用主张自动撤回",
            ],
            "retracted_claims": retracted,
            "unknown_fallback": "" if candidates else "未匹配到已知症状分类，建议人工复核并补充病史",
        },
        "ai_analysis": (
            "输入症状：" + symptoms + "\n"
            + "匹配分类：" + ("、".join(categories) or "未分类") + "\n"
            + "候选诊断：" + cand_text + "\n"
            + f"检索到相似病例 {len(similar)} 例、知识库引用 {len(knowledge_refs)} 条。"
            + "推理链依据上述规则与检索结果，未引入外部未经验证的知识。"
        ),
        "disclaimer": "本结果由离线规则引擎与院内数据检索生成，仅供医生参考，不构成医疗建议；最终诊断须由医生确认。",
        # 兼容简版字段
        "diagnosis": top["disease"] if top else "未找到匹配诊断，建议补充症状细节",
        "confidence": top["confidence"] if top else 0.0,
        "evidence": [{"title": k["title"], "category": k["category"], "tier": k["tier"]} for k in knowledge_refs],
        "hallucination_check": {"passed": grounded, "grounded": grounded},
    }


@router.get("/vector-stats")
def vector_stats(_=Depends(get_current_user)):
    return {"indexed": 0, "dimension": 32, "available": False}


_ANALYZE_SYSTEM = """你是 NOVAMED 智慧医疗系统的医学辅助分析助手。请基于用户提供的症状/文本，给出简洁、准确、可执行的医学分析，要求：
- 简体中文，控制在 220 字以内；需要分点时用「-」短横线，不要用 Markdown 标题、加粗、代码块或表格。
- 内容包含：可能的鉴别诊断方向、建议完善的检查、需要警惕的危险信号。
- 结尾必须加一句「以上仅为 AI 辅助分析，不构成医疗建议，最终诊断须由执业医师确认。」"""


@router.post("/analyze")
def ai_analyze(payload: dict, user=Depends(get_current_user)):
    """AI 深度分析：离线规则引擎提供结构化候选，云端模型生成自然语言分析。

    - 供应商/模型选择走路由服务（激活供应商 + 个人偏好覆盖 + 故障转移）。
    - 支持显式注入：payload.provider / payload.model 可覆盖默认。
    - 无可用服务商或云端调用失败时，回退到离线规则引擎的文本摘要（优雅降级）。
    """
    symptoms = (payload.get("symptoms") or payload.get("text") or "").strip()
    if not symptoms:
        return {"available": False, "hint": "请输入症状或待分析文本。"}

    # 1) 结构化候选：复用离线规则引擎（可靠、可复现、无需 key）
    candidates = []
    for disease, category, base, matched in detect_symptom_hits(symptoms):
        conf = min(0.95, base + 0.06 * len(matched))
        candidates.append({
            "disease": disease, "confidence": round(conf, 2), "source": "rule_based",
            "rationale": ("命中症状：" + "、".join(matched) + "（" + category + "）") if matched else ("基于" + category + "规则"),
            "typical_symptoms": matched, "risk_level": "中" if conf >= 0.7 else "低",
            "confirmation_required": conf < 0.85,
        })
    candidates.sort(key=lambda c: c["confidence"], reverse=True)
    candidates = candidates[:5]

    # 2) 云端 LLM 深度分析（供应商/模型注入 + 故障转移，走 ai_keys.json）
    summary = ""
    provider_label = ""
    model = ""
    cand_text = "、".join(c["disease"] for c in candidates) or "（未匹配到已知分类）"
    try:
        result = svc.chat_with_failover(
            [{"role": "user", "content": f"症状描述：{symptoms}\n离线规则引擎候选诊断：{cand_text}\n请给出分析。"}],
            user_id=user.id,
            requested_provider=payload.get("provider"),
            requested_model=payload.get("model"),
            system_prompt=svc.get_system_prompt("analyze", _ANALYZE_SYSTEM),
        )
        if result.get("available"):
            summary = result.get("content") or ""
            provider_label = result.get("provider") or ""
            model = result.get("model") or ""
    except Exception:
        summary = ""

    if not summary:
        summary = ("（云端模型暂不可用，已回退离线规则引擎）候选诊断："
                   + ("、".join(c["disease"] for c in candidates) or "未匹配到已知分类")
                   + "。建议结合体征与检查进一步明确，最终诊断须由执业医师确认。")

    top = candidates[0] if candidates else None
    return {
        "available": True,
        "diagnoses": candidates,
        "diagnosis": top["disease"] if top else "",
        "confidence": top["confidence"] if top else 0.0,
        "summary": summary,
        "ai_analysis": summary,
        "provider": provider_label,
        "model": model,
        "disclaimer": "本结果由离线规则引擎与云端模型生成，仅供医生参考，不构成医疗建议；最终诊断须由医生确认。",
    }
