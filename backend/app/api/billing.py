"""
财务收费 API —— /api/billing
收费记录 CRUD + 统计 + 退费
"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.models import BillingRecord, Patient

router = APIRouter(prefix="/api/billing", tags=["财务收费"])


class BillingItem(BaseModel):
    name: str
    quantity: int = 1
    price: int = 0  # 分


class BillingPayload(BaseModel):
    patient_id: int | None = None
    patient_name: str = ""
    department: str = ""
    items: list[BillingItem] = []
    payment_method: str = "现金"
    remark: str = ""


def _bill_dict(b: BillingRecord) -> dict:
    try:
        items = json.loads(b.items or "[]")
    except Exception:
        items = []
    return {
        "id": b.id, "bill_no": b.bill_no, "patient_id": b.patient_id,
        "patient_name": b.patient_name, "department": b.department,
        "items": items, "total_amount": b.total_amount,
        "total_yuan": round(b.total_amount / 100, 2),
        "payment_method": b.payment_method, "status": b.status,
        "operator": b.operator, "remark": b.remark,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


def _gen_bill_no() -> str:
    return "RC" + datetime.now().strftime("%Y%m%d%H%M%S") + str(datetime.now().microsecond % 1000).zfill(3)


@router.get("")
def list_billings(keyword: str = None, status: str = None,
                  page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  _=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(BillingRecord)
    if keyword:
        q = q.filter(
            (BillingRecord.bill_no.like(f"%{keyword}%")) |
            (BillingRecord.patient_name.like(f"%{keyword}%"))
        )
    if status:
        q = q.filter(BillingRecord.status == status)
    total = q.count()
    items = q.order_by(BillingRecord.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_bill_dict(b) for b in items]}


@router.get("/stats")
def billing_stats(_=Depends(get_current_user), db: Session = Depends(get_db)):
    all_bills = db.query(BillingRecord).all()
    paid = [b for b in all_bills if b.status == "已收费"]
    total_amount = sum(b.total_amount for b in paid)
    return {
        "total_count": len(all_bills),
        "paid_count": len(paid),
        "total_amount": total_amount,
        "total_yuan": round(total_amount / 100, 2),
        "refund_count": sum(1 for b in all_bills if b.status == "已退费"),
    }


@router.post("")
def create_billing(payload: BillingPayload, user=Depends(get_current_user), db: Session = Depends(get_db)):
    total = sum(i.price * i.quantity for i in payload.items)
    # 若传了 patient_id，回填患者姓名
    patient_name = payload.patient_name
    if payload.patient_id and not patient_name:
        p = db.query(Patient).filter(Patient.id == payload.patient_id).first()
        patient_name = p.name if p else ""
    b = BillingRecord(
        bill_no=_gen_bill_no(),
        patient_id=payload.patient_id,
        patient_name=patient_name,
        department=payload.department,
        items=json.dumps([i.model_dump() for i in payload.items], ensure_ascii=False),
        total_amount=total,
        payment_method=payload.payment_method,
        status="已收费",
        operator=user.real_name or user.username,
        remark=payload.remark,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return _bill_dict(b)


@router.post("/{bid}/refund")
def refund_billing(bid: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(BillingRecord).filter(BillingRecord.id == bid).first()
    if not b:
        return {"detail": "收费记录不存在"}
    b.status = "已退费"
    db.commit()
    db.refresh(b)
    return _bill_dict(b)


@router.delete("/{bid}")
def delete_billing(bid: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(BillingRecord).filter(BillingRecord.id == bid).first()
    if not b:
        return {"detail": "收费记录不存在"}
    db.delete(b)
    db.commit()
    return {"deleted": bid}
