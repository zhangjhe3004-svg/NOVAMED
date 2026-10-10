"""
用户记忆服务 —— 记录用户行为、偏好，提供个性化推荐

说明：本模块同时负责「注册用户记忆模型」（database.init_db 会 import 本模块）。
"""
import json
import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from ..models.models import UserPreference, SessionRecord


def record_behavior(db: Session, user_id: int, action: str, payload: Optional[dict] = None):
    """记录一次用户行为"""
    rec = SessionRecord(user_id=user_id, action=action, payload=json.dumps(payload or {}, ensure_ascii=False))
    db.add(rec)
    db.commit()
    return rec


def get_preferences(db: Session, user_id: int) -> dict:
    pref = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
    if not pref:
        return {}
    try:
        return json.loads(pref.preferences or "{}")
    except Exception:
        return {}


def set_preferences(db: Session, user_id: int, preferences: dict) -> dict:
    pref = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
    if not pref:
        pref = UserPreference(user_id=user_id, preferences=json.dumps(preferences, ensure_ascii=False))
        db.add(pref)
    else:
        pref.preferences = json.dumps(preferences, ensure_ascii=False)
    db.commit()
    return preferences


def recent_actions(db: Session, user_id: int, limit: int = 20) -> List[dict]:
    recs = (
        db.query(SessionRecord)
        .filter(SessionRecord.user_id == user_id)
        .order_by(SessionRecord.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {"action": r.action, "payload": json.loads(r.payload or "{}"), "at": r.created_at.isoformat() if r.created_at else None}
        for r in recs
    ]
