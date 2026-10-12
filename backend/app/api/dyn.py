"""
动态数据源 API —— /api/dyn（集合管理 + 自动 CRUD）
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin, get_current_user
from ..services import dyn_engine

router = APIRouter(prefix="/api/dyn", tags=["动态数据源"])


def _extract_filters(request: Request) -> Optional[dict]:
    """从查询串提取等值过滤：f_<field>=<value>，或 filters=<json 对象>"""
    out = {}
    for k, v in request.query_params.items():
        if k.startswith("f_") and k != "f_page":
            out[k[2:]] = v
    raw = request.query_params.get("filters")
    if raw:
        try:
            obj = json.loads(raw)
            if isinstance(obj, dict):
                out.update({str(k): v for k, v in obj.items()})
        except Exception:
            pass
    return out or None


@router.get("/collections")
def list_collections(_=Depends(get_current_user), db: Session = Depends(get_employee_db)):
    return {"items": dyn_engine.list_collections(db)}


@router.post("/collections")
def create_collection(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return dyn_engine.create_collection(db, payload.get("name"), payload.get("title", ""),
                                        payload.get("fields"), payload.get("description", ""))


@router.delete("/collections/{name}")
def drop_collection(name: str, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return {"deleted": dyn_engine.drop_collection(db, name)}


@router.get("/collections/{name}/rows")
def list_rows(name: str, request: Request, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
              _=Depends(get_current_user), db: Session = Depends(get_employee_db)):
    return dyn_engine.list_rows(db, name, page, page_size, _extract_filters(request))


@router.post("/collections/{name}/rows")
def insert_row(name: str, data: dict, user=Depends(get_current_user), db: Session = Depends(get_employee_db)):
    row = dyn_engine.insert_row(db, name, data)
    _trigger_workflows(db, name, row, user)
    return row


def _trigger_workflows(db: Session, name: str, row: dict, user) -> None:
    """新建集合行后触发命中该集合的已启用工作流：创建实例并把状态字段置为「审批中」"""
    from ..services import biz_workflow as wf
    try:
        for d in wf.list_defs(db):
            if d.get("trigger_collection") == name and d.get("enabled"):
                inst = wf.trigger(db, d["key"], row.get("id"), getattr(user, "id", None))
                if inst and d.get("status_field") and row.get("id") is not None:
                    dyn_engine.update_row(db, name, row["id"], {d["status_field"]: inst["status"]})
    except Exception:
        db.rollback()


@router.put("/collections/{name}/rows/{row_id}")
def update_row(name: str, row_id: int, data: dict, _=Depends(get_current_user), db: Session = Depends(get_employee_db)):
    return dyn_engine.update_row(db, name, row_id, data)


@router.delete("/collections/{name}/rows/{row_id}")
def delete_row(name: str, row_id: int, _=Depends(get_current_user), db: Session = Depends(get_employee_db)):
    return {"deleted": dyn_engine.delete_row(db, name, row_id)}


@router.patch("/collections/{name}")
def patch_collection(name: str, payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return dyn_engine.patch_collection(db, name, payload)
