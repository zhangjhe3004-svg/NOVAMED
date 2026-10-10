"""
AI 会话管理 API —— /api/conversations
"""
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import get_current_user
from ..models.models import Conversation, User

router = APIRouter(prefix="/api/conversations", tags=["会话管理"])


@router.get("")
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    items = db.query(Conversation).filter(Conversation.user_id == user.id).order_by(Conversation.id.desc()).all()
    return {"items": [
        {"id": c.id, "title": c.title, "created_at": c.created_at.isoformat() if c.created_at else None}
        for c in items
    ]}


@router.post("")
def create_conversation(title: str = "", user: User = Depends(get_current_user),
                        db: Session = Depends(get_employee_db)):
    c = Conversation(user_id=user.id, title=title or "新会话", messages="[]")
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "title": c.title}


@router.get("/{cid}")
def get_conversation(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    c = db.query(Conversation).filter(Conversation.id == cid, Conversation.user_id == user.id).first()
    if not c:
        return {"detail": "会话不存在"}
    return {"id": c.id, "title": c.title, "messages": __import__("json").loads(c.messages or "[]")}


@router.delete("/{cid}")
def delete_conversation(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    c = db.query(Conversation).filter(Conversation.id == cid, Conversation.user_id == user.id).first()
    if c:
        db.delete(c)
        db.commit()
    return {"detail": "ok"}
