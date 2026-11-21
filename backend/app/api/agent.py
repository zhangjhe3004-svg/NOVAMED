"""
智能体问答接口 —— /api/agent

把「问系统」问答坞升级成小智能体：本地规则引擎（utils/ask.ts）命不中的问题，
转发到已配置的模型服务商回答。Key 复用 data/ai_keys.json（管理员在「设置 → API 密钥」配置），
本接口对任意登录用户开放（只读问答，不暴露 Key）。

自 cc-switch 迁移后：供应商选择走路由服务（激活供应商 + 个人偏好覆盖 + 故障转移），
模型与系统提示词支持注入；请求体可选显式指定 provider / model 覆盖默认。
"""
import json
import logging
import urllib.error
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..core.dependencies import get_current_user
from ..services import ai_provider as svc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["智能问答"])

# 与 ai_keys.py 共用同一份 Key 文件
_KEYS_FILE = Path(__file__).resolve().parents[2] / "data" / "ai_keys.json"

# 向后兼容导出（ai.py 等曾 from .agent import _pick_provider, _chat, _load_keys）
PROVIDER_META = svc.PROVIDER_META
_pick_provider = svc._pick_provider
_chat = svc._chat
_parse_sse = svc._parse_sse
_load_keys = svc.load_keys

SYSTEM_PROMPT = """你是 NOVAMED「医码合一智慧医疗系统」的内置智能助手（小智能体），负责回答员工关于本系统的操作、权限、数据、配置等问题。

【回答要求】
- 用简体中文，简洁、准确、口语化，控制在 220 字以内；需要分点时用「-」短横线，不要用 Markdown 标题、加粗、代码块或表格。
- 优先依据下面【数据快照】里的真实信息回答，禁止编造快照里没有的账号、角色、菜单或数字。
- 快照覆盖不到的信息，明确说「系统里暂未提供该数据」，并给出可以去哪个页面查看。
- 涉及医疗诊断/用药建议时，提醒以执业医师意见为准。
- 只回答关于本系统与医疗信息化的问题；无关或越界的问题礼貌拒绝。

【系统背景】
NOVAMED 是面向医院的智慧医疗后台（Python/FastAPI + React），模块包括：患者管理、就诊记录、AI 辅助诊断、药房/收费/检验、运营数据看板、角色权限（RBAC）、参数配置、字典管理、代码生成器等。角色分 super_admin/admin/senior/doctor/nurse/pharmacist/maintainer/staff，授权粒度到菜单与按钮。

【数据快照】
{context}"""


class AgentAskPayload(BaseModel):
    question: str
    context: Optional[str] = ""
    # 模型注入/供应商覆盖：显式指定时优先于系统默认与个人偏好
    provider: Optional[str] = None
    model: Optional[str] = None


@router.post("/ask")
def agent_ask(payload: AgentAskPayload, user=Depends(get_current_user)):
    question = (payload.question or "").strip()
    if not question:
        return {"available": False, "hint": "问题不能为空。"}

    if not svc.resolve_provider(user_id=user.id):
        return {
            "available": False,
            "hint": "还没有配置可用的模型服务商。请管理员在「设置 → API 密钥」里添加 OpenAI / DeepSeek / 千问等 Key 后，我就能回答更多问题。",
        }

    # 系统提示词注入：默认按场景 agent，管理员可在路由配置覆盖（支持 {context} 占位符）
    system_prompt = svc.get_system_prompt("agent", SYSTEM_PROMPT).format(
        context=(payload.context or "").strip() or "（无快照）")

    messages = [{"role": "user", "content": question}]
    result = svc.chat_with_failover(
        messages,
        user_id=user.id,
        requested_provider=payload.provider,
        requested_model=payload.model,
        system_prompt=system_prompt,
    )

    if not result.get("available"):
        return {"available": False, "error": result.get("error") or "调用失败",
                "provider": result.get("provider") or ""}

    return {
        "available": True,
        "answer": result["content"],
        "provider": result["provider"],
        "model": result["model"],
    }
