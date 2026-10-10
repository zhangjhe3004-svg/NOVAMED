"""
低代码页面 API —— /api/pages（页面 Schema 构建器）
"""
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.workspace import PageSchemaModel

router = APIRouter(prefix="/api/pages", tags=["低代码页面"])


@router.get("")
def list_pages(_=Depends(require_admin), db: Session = Depends(get_employee_db)):
    items = db.query(PageSchemaModel).order_by(PageSchemaModel.id.asc()).all()
    return {"items": [
        {"id": p.id, "name": p.name, "title": p.title, "schema": json.loads(p.schema_json or "{}"),
         "enabled": bool(p.enabled)} for p in items
    ]}


@router.post("")
def save_page(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    name = payload.get("name")
    p = db.query(PageSchemaModel).filter(PageSchemaModel.name == name).first()
    if not p:
        p = PageSchemaModel(name=name, title=payload.get("title", name))
        db.add(p)
    else:
        p.title = payload.get("title", p.title)
    p.schema_json = json.dumps(payload.get("schema", {}), ensure_ascii=False)
    p.enabled = bool(payload.get("enabled", True))
    db.commit()
    return {"name": name, "saved": True}


@router.delete("/{name}")
def delete_page(name: str, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    p = db.query(PageSchemaModel).filter(PageSchemaModel.name == name).first()
    if p:
        db.delete(p)
        db.commit()
    return {"detail": "ok"}
