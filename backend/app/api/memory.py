"""
用户记忆 API —— /api/memory
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import get_current_user
from ..models.models import User
from ..services.user_memory import get_preferences, set_preferences, recent_actions

router = APIRouter(prefix="/api/memory", tags=["用户记忆"])


@router.get("/preferences")
def read_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    return get_preferences(db, user.id)


@router.post("/preferences")
def write_preferences(preferences: dict, user: User = Depends(get_current_user),
                      db: Session = Depends(get_employee_db)):
    return set_preferences(db, user.id, preferences)


@router.get("/actions")
def read_actions(limit: int = 20, user: User = Depends(get_current_user),
                 db: Session = Depends(get_employee_db)):
    return {"items": recent_actions(db, user.id, limit)}
