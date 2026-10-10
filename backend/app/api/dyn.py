"""
动态数据源 API —— /api/dyn（集合管理 + 自动 CRUD）
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..services import dyn_engine

router = APIRouter(prefix="/api/dyn", tags=["动态数据源"])


@router.get("/collections")
def list_collections(_=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return {"items": dyn_engine.list_collections(db)}


@router.post("/collections")
def create_collection(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return dyn_engine.create_collection(db, payload.get("name"), payload.get("title", ""),
                                        payload.get("fields"), payload.get("description", ""))


@router.delete("/collections/{name}")
def drop_collection(name: str, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return {"deleted": dyn_engine.drop_collection(db, name)}


@router.get("/collections/{name}/rows")
def list_rows(name: str, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
              _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return dyn_engine.list_rows(db, name, page, page_size)


@router.post("/collections/{name}/rows")
def insert_row(name: str, data: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return dyn_engine.insert_row(db, name, data)


@router.put("/collections/{name}/rows/{row_id}")
def update_row(name: str, row_id: int, data: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return dyn_engine.update_row(db, name, row_id, data)


@router.delete("/collections/{name}/rows/{row_id}")
def delete_row(name: str, row_id: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return {"deleted": dyn_engine.delete_row(db, name, row_id)}
