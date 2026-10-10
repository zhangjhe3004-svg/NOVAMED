"""
审计日志 API —— /api/audit-logs
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.models import AuditLog

router = APIRouter(prefix="/api/audit-logs", tags=["审计日志"])


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
