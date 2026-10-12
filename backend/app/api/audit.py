"""
审计日志 API —— /api/audit-logs
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.models import AuditLog

router = APIRouter(prefix="/api/audit-logs", tags=["审计日志"])


@router.get("/overview")
def audit_overview(_=Depends(require_admin), db: Session = Depends(get_employee_db)):
    """概览：总数 / 活跃账号 / 今日 / 近 14 日逐日计数（供趋势图）"""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    total = db.query(func.count(AuditLog.id)).scalar() or 0
    active_users = db.query(func.count(distinct(AuditLog.username))).scalar() or 0
    today_count = db.query(func.count(AuditLog.id)).filter(AuditLog.created_at >= today).scalar() or 0
    per_day = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        cnt = db.query(func.count(AuditLog.id)).filter(
            AuditLog.created_at >= d, AuditLog.created_at < d + timedelta(days=1)
        ).scalar() or 0
        per_day.append({"date": d.strftime("%m-%d"), "count": cnt})
    return {"total": total, "active_users": active_users, "today": today_count, "per_day": per_day}


@router.get("")
def list_audit_logs(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                    action: str = None, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    total = q.count()
    items = q.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [
        {"id": a.id, "user_id": a.user_id, "username": a.username, "action": a.action,
         "resource": a.resource, "detail": a.detail, "ip": a.ip,
         "created_at": a.created_at.isoformat() if a.created_at else None}
        for a in items
    ]}
