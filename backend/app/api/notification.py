"""
通知 API —— /api/notifications
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import get_current_user
from ..models.models import Notification, User

router = APIRouter(prefix="/api/notifications", tags=["通知"])


@router.get("")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    items = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(50).all()
    return {"items": [
        {"id": n.id, "title": n.title, "content": n.content, "is_read": n.is_read, "level": n.level,
         "created_at": n.created_at.isoformat() if n.created_at else None}
        for n in items
    ]}


@router.post("/{nid}/read")
def mark_read(nid: int, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    n = db.query(Notification).filter(Notification.id == nid, Notification.user_id == user.id).first()
    if n:
        n.is_read = True
        db.commit()
    return {"detail": "ok"}
