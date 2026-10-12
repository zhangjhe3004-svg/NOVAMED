"""
药房管理 API —— /api/pharmacy
药品库存 CRUD + 库存预警 + 统计
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.models import Medicine

router = APIRouter(prefix="/api/pharmacy", tags=["药房管理"])


class MedicinePayload(BaseModel):
    name: str
    spec: str = ""
    category: str = ""
    manufacturer: str = ""
    unit: str = "盒"
    price: int = 0
    stock: int = 0
    stock_warning: int = 10
    approval_no: str = ""


def _med_dict(m: Medicine) -> dict:
    return {
        "id": m.id, "name": m.name, "spec": m.spec, "category": m.category,
        "manufacturer": m.manufacturer, "unit": m.unit,
        "price": m.price, "price_yuan": round(m.price / 100, 2),
        "stock": m.stock, "stock_warning": m.stock_warning,
        "approval_no": m.approval_no,
        "low_stock": m.stock <= m.stock_warning,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


@router.get("")
def list_medicines(keyword: str = None, category: str = None, low_stock: bool = None,
                   page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                   _=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Medicine)
    if keyword:
        q = q.filter(Medicine.name.like(f"%{keyword}%"))
    if category:
        q = q.filter(Medicine.category == category)
    rows = q.order_by(Medicine.id.desc()).all()
    if low_stock:
        rows = [r for r in rows if r.stock <= r.stock_warning]
    total = len(rows)
    start = (page - 1) * page_size
    return {"total": total, "items": [_med_dict(m) for m in rows[start:start + page_size]]}


@router.get("/stats")
def pharmacy_stats(_=Depends(get_current_user), db: Session = Depends(get_db)):
    all_meds = db.query(Medicine).all()
    total = len(all_meds)
    low = sum(1 for m in all_meds if m.stock <= m.stock_warning)
    stock_value = sum(m.price * m.stock for m in all_meds)
    return {
        "total_medicines": total,
        "low_stock_count": low,
        "stock_value": stock_value,
        "stock_value_yuan": round(stock_value / 100, 2),
        "categories": sorted({m.category for m in all_meds if m.category}),
    }


@router.post("")
def create_medicine(payload: MedicinePayload, _=Depends(get_current_user), db: Session = Depends(get_db)):
    m = Medicine(**payload.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return _med_dict(m)


@router.put("/{mid}")
def update_medicine(mid: int, payload: MedicinePayload, _=Depends(get_current_user), db: Session = Depends(get_db)):
    m = db.query(Medicine).filter(Medicine.id == mid).first()
    if not m:
        return {"detail": "药品不存在"}
    for k, v in payload.model_dump().items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return _med_dict(m)


@router.post("/{mid}/stock")
def adjust_stock(mid: int, payload: dict, _=Depends(get_current_user), db: Session = Depends(get_db)):
    """调整库存（payload.delta 可为正负）"""
    m = db.query(Medicine).filter(Medicine.id == mid).first()
    if not m:
        return {"detail": "药品不存在"}
    delta = int(payload.get("delta", 0))
    m.stock = max(0, m.stock + delta)
    db.commit()
    db.refresh(m)
    return _med_dict(m)


@router.delete("/{mid}")
def delete_medicine(mid: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    m = db.query(Medicine).filter(Medicine.id == mid).first()
    if not m:
        return {"detail": "药品不存在"}
    db.delete(m)
    db.commit()
    return {"deleted": mid}
