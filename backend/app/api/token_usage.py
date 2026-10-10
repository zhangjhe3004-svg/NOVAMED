"""
AI Token 用量统计 API —— /api/token-usage
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.models import TokenUsage, User

router = APIRouter(prefix="/api/token-usage", tags=["用量统计"])


@router.get("/stats")
def token_stats(_=Depends(require_admin), db: Session = Depends(get_employee_db)):
    rows = db.query(TokenUsage).all()
    by_provider = {}; by_model = {}
    pt = ct = tt = 0
    for r in rows:
        pt += r.prompt_tokens; ct += r.completion_tokens; tt += r.total_tokens
        by_provider[r.provider] = by_provider.get(r.provider, 0) + r.total_tokens
        by_model[r.model] = by_model.get(r.model, 0) + r.total_tokens
    return {"total_tokens": tt, "prompt_tokens": pt, "completion_tokens": ct,
            "by_provider": by_provider, "by_model": by_model}



@router.get("")
def list_usage(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
               user: str = None, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    q = db.query(TokenUsage)
    if user:
        q = q.join(User, TokenUsage.user_id == User.id).filter(User.username.like(f"%{user}%"))
    total = q.count()
    items = q.order_by(TokenUsage.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [
        {"id": u.id, "user_id": u.user_id, "provider": u.provider, "model": u.model,
         "prompt_tokens": u.prompt_tokens, "completion_tokens": u.completion_tokens,
         "total_tokens": u.total_tokens, "created_at": u.created_at.isoformat() if u.created_at else None}
        for u in items
    ]}
