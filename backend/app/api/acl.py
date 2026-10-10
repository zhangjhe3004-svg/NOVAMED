"""
数据权限 API —— /api/acl
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.workspace import AclRule

router = APIRouter(prefix="/api/acl", tags=["数据权限"])


@router.get("")
def list_rules(_=Depends(require_admin), db: Session = Depends(get_employee_db)):
    items = db.query(AclRule).order_by(AclRule.id.asc()).all()
    return {"items": [
        {"id": r.id, "role": r.role, "collection": r.collection, "action": r.action,
         "row_scope": r.row_scope, "enabled": bool(r.enabled)} for r in items
    ]}


@router.post("")
def save_rule(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    r = AclRule(role=payload.get("role", ""), collection=payload.get("collection", ""),
                action=payload.get("action", "read"), row_scope=payload.get("row_scope", "all"),
                enabled=bool(payload.get("enabled", True)))
    db.add(r)
    db.commit()
    return {"id": r.id}
