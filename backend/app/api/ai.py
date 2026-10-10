"""
AI 诊断 API —— /api/ai
规则引擎 / 相似病例 / 知识库 / 防幻觉验证 / 云端 CoT（演示实现）
"""
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.models import KnowledgeDoc, MedicalRecord

router = APIRouter(prefix="/api/ai", tags=["AI 诊断"])


class DiagnosePayload(BaseModel):
    symptoms: str


class WorkflowStageUpdate(BaseModel):
    key: str
    enabled: bool = True


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


@router.get("/config")
def get_ai_config(_=Depends(get_current_user)):
    return {
        "role": "医学辅助诊断助手",
        "generation_parameters": {"temperature": 0.3, "top_p": 0.9, "repetition_penalty": 1.1, "min_p": 0.05, "seed": 42},
        "evidence_tiers": {"A": "随机对照试验/系统综述", "B": "队列/病例对照研究", "C": "专家共识/个案"},
    }


@router.post("/diagnose")
def diagnose(payload: DiagnosePayload, _=Depends(get_current_user), db: Session = Depends(get_db)):
    # 演示：返回规则命中 + 相似病例 + 知识库片段
    symptoms = payload.symptoms
    records = db.query(MedicalRecord).filter(MedicalRecord.symptoms.like(f"%{symptoms[:4]}%")).limit(3).all()
    docs = db.query(KnowledgeDoc).limit(3).all()
    return {
        "diagnosis": "根据症状初步分析，建议进一步检查确认。",
        "confidence": 0.72,
        "similar_cases": [
            {"id": r.id, "diagnosis": r.diagnosis, "symptoms": r.symptoms}
            for r in records
        ],
        "evidence": [
            {"title": d.title, "category": d.category, "tier": "B"} for d in docs
        ],
        "hallucination_check": {"passed": True, "grounded": True},
    }


@router.get("/vector-stats")
def vector_stats(_=Depends(get_current_user)):
    return {"indexed": 0, "dimension": 32, "available": False}


@router.post("/analyze")
def ai_analyze(payload: dict, _=Depends(get_current_user)):
    return {"summary": "（演示）已完成医学文本分析。", "tokens": 0}
