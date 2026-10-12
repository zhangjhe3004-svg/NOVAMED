"""
业务工作流 API —— /api/workflow
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import get_current_user, require_admin
from ..models.models import User
from ..services import biz_workflow as wf

router = APIRouter(prefix="/api/workflow", tags=["业务工作流"])


@router.get("/defs")
def list_defs(_=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return {"items": wf.list_defs(db)}


@router.post("/defs")
def upsert_def(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return wf.upsert_def(db, payload.get("key"), payload.get("title", ""),
                         payload.get("trigger_collection"), payload.get("status_field"),
                         payload.get("nodes", []), payload.get("running_status", "审批中"),
                         payload.get("done_status", "已批准"), payload.get("reject_status", "已驳回"),
                         bool(payload.get("enabled", True)))


@router.post("/defs/{key}/toggle")
def toggle_def(key: str, enabled: bool, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return wf.set_def_enabled(db, key, enabled)


@router.delete("/defs/{key}")
def delete_def(key: str, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    wf.delete_def(db, key)
    return {"detail": "ok"}


@router.get("/instances")
def list_instances(def_key: str = None, status: str = None, _=Depends(require_admin),
                   db: Session = Depends(get_employee_db)):
    return {"items": wf.list_instances(db, def_key, status)}


@router.post("/instances/{iid}/approve")
def approve(iid: int, comment: str = "", user: User = Depends(get_current_user),
            db: Session = Depends(get_employee_db)):
    return wf.approve(db, iid, user.id, comment)


@router.post("/instances/{iid}/reject")
def reject(iid: int, comment: str = "", user: User = Depends(get_current_user),
           db: Session = Depends(get_employee_db)):
    return wf.reject(db, iid, user.id, comment)


@router.post("/cancel-by-row")
def cancel_by_row(payload: dict, user: User = Depends(get_current_user),
                  db: Session = Depends(get_employee_db)):
    """申请人撤回自己的申请：按 def_key + row_id 定位实例（管理员可撤任意实例）"""
    inst = wf.cancel_by_row(db, payload.get("def_key", ""), int(payload.get("row_id", 0)),
                            user.id, is_admin=(user.role == "admin"),
                            comment=payload.get("comment", ""))
    return inst or {"detail": "no-instance"}
