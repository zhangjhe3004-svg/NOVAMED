"""
员工消息 API —— /api/messages
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import get_current_user
from ..models.models import Message, User

router = APIRouter(prefix="/api/messages", tags=["员工消息"])


class MessageCreate(BaseModel):
    receiver_id: int
    title: str = ""
    content: str = ""


@router.get("")
def list_messages(user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    items = db.query(Message).filter(Message.receiver_id == user.id).order_by(Message.id.desc()).limit(100).all()
    return {"items": [
        {"id": m.id, "sender_id": m.sender_id, "title": m.title, "content": m.content,
         "is_read": m.is_read, "message_type": m.message_type,
         "created_at": m.created_at.isoformat() if m.created_at else None}
        for m in items
    ]}


@router.post("")
def send_message(payload: MessageCreate, user: User = Depends(get_current_user),
                 db: Session = Depends(get_employee_db)):
    m = Message(sender_id=user.id, receiver_id=payload.receiver_id,
                title=payload.title, content=payload.content)
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id}
