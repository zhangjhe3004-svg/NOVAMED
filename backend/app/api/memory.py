"""
用户记忆 API —— /api/memory
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import get_current_user
from ..models.models import User
from ..services.user_memory import get_preferences, set_preferences, recent_actions, record_behavior

router = APIRouter(prefix="/api/memory", tags=["用户记忆"])


@router.get("/preferences")
def read_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    return get_preferences(db, user.id)


@router.post("/preferences")
def write_preferences(preferences: dict, user: User = Depends(get_current_user),
                      db: Session = Depends(get_employee_db)):
    return set_preferences(db, user.id, preferences)


@router.get("/actions")
def read_actions(limit: int = 20, action: str = None, user: User = Depends(get_current_user),
                 db: Session = Depends(get_employee_db)):
    items = recent_actions(db, user.id, limit if not action else max(limit, 100))
    if action:
        # 支持前缀匹配，如 action=ai_ 返回全部 AI 相关行为
        items = [x for x in items if str(x.get("action", "")).startswith(action)]
        items = items[:limit]
    return {"items": items}


@router.post("/actions")
def write_action(payload: dict, user: User = Depends(get_current_user),
                 db: Session = Depends(get_employee_db)):
    """记录一次用户行为（用于 AI 分析历史、采纳/驳回反馈等）"""
    act = (payload.get("action") or "").strip()
    if not act:
        return {"detail": "action 不能为空"}
    rec = record_behavior(db, user.id, act, payload.get("payload") or {})
    return {"id": rec.id, "action": act}
