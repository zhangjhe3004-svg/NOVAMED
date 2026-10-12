"""
检查检验 API —— /api/labtest
检查项目 CRUD + 状态流转 + 结果录入 + 统计
"""
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.models import LabTest, Patient

router = APIRouter(prefix="/api/labtest", tags=["检查检验"])


class LabTestPayload(BaseModel):
    patient_id: int | None = None
    patient_name: str = ""
    department: str = ""
    item_name: str
    category: str = "检验"
    status: str = "待检查"
    result: str = ""
    reference: str = ""
    doctor_id: int | None = None
    doctor_name: str = ""
    operator: str = ""
    remark: str = ""


# 状态流转：允许从当前状态迁移到下一批状态
STATUS_FLOW = {
    "待检查": ["已采样", "已取消"],
    "已采样": ["检查中", "已取消"],
    "检查中": ["已出报告", "已取消"],
    "已出报告": [],
    "已取消": [],
}


def _lab_dict(t: LabTest) -> dict:
    return {
        "id": t.id, "test_no": t.test_no, "patient_id": t.patient_id,
        "patient_name": t.patient_name, "department": t.department,
        "item_name": t.item_name, "category": t.category, "status": t.status,
        "result": t.result, "reference": t.reference,
        "doctor_id": t.doctor_id, "doctor_name": t.doctor_name,
        "operator": t.operator, "remark": t.remark,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _gen_test_no() -> str:
    return "JC" + datetime.now().strftime("%Y%m%d%H%M%S") + str(datetime.now().microsecond % 1000).zfill(3)


@router.get("")
def list_lab_tests(keyword: str = None, category: str = None, status: str = None,
                   page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                   _=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(LabTest)
    if keyword:
        q = q.filter(
            (LabTest.test_no.like(f"%{keyword}%")) |
            (LabTest.patient_name.like(f"%{keyword}%")) |
            (LabTest.item_name.like(f"%{keyword}%"))
        )
    if category:
        q = q.filter(LabTest.category == category)
    if status:
        q = q.filter(LabTest.status == status)
    total = q.count()
    items = q.order_by(LabTest.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_lab_dict(t) for t in items]}


@router.get("/stats")
def labtest_stats(_=Depends(get_current_user), db: Session = Depends(get_db)):
    all_tests = db.query(LabTest).all()
    total = len(all_tests)
    done = sum(1 for t in all_tests if t.status == "已出报告")
    pending = sum(1 for t in all_tests if t.status in ("待检查", "已采样", "检查中"))
    cancelled = sum(1 for t in all_tests if t.status == "已取消")
    return {
        "total": total,
        "done": done,
        "pending": pending,
        "cancelled": cancelled,
        "categories": sorted({t.category for t in all_tests if t.category}),
    }


@router.post("")
def create_lab_test(payload: LabTestPayload, user=Depends(get_current_user), db: Session = Depends(get_db)):
    patient_name = payload.patient_name
    if payload.patient_id and not patient_name:
        p = db.query(Patient).filter(Patient.id == payload.patient_id).first()
        patient_name = p.name if p else ""
    t = LabTest(
        test_no=_gen_test_no(),
        patient_id=payload.patient_id,
        patient_name=patient_name,
        department=payload.department,
        item_name=payload.item_name,
        category=payload.category,
        status=payload.status,
        result=payload.result,
        reference=payload.reference,
        doctor_id=payload.doctor_id or getattr(user, "id", None),
        doctor_name=payload.doctor_name or (getattr(user, "real_name", "") or getattr(user, "username", "")),
        operator=payload.operator,
        remark=payload.remark,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _lab_dict(t)


@router.put("/{tid}")
def update_lab_test(tid: int, payload: LabTestPayload, _=Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(LabTest).filter(LabTest.id == tid).first()
    if not t:
        return {"detail": "检查单不存在"}
    for k, v in payload.model_dump().items():
        if k in ("patient_id", "patient_name", "department", "item_name", "category",
                 "status", "result", "reference", "doctor_id", "doctor_name", "operator", "remark"):
            setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return _lab_dict(t)


@router.post("/{tid}/status")
def change_status(tid: int, payload: dict, _=Depends(get_current_user), db: Session = Depends(get_db)):
    """状态流转（payload.status 为目标状态，payload.result 可同时写结果）"""
    t = db.query(LabTest).filter(LabTest.id == tid).first()
    if not t:
        return {"detail": "检查单不存在"}
    target = payload.get("status", "")
    allowed = STATUS_FLOW.get(t.status, [])
    if target not in allowed:
        return {"detail": f"不允许从「{t.status}」变更为「{target}」", "allowed": allowed}
    t.status = target
    if "result" in payload:
        t.result = payload["result"]
    if "reference" in payload:
        t.reference = payload["reference"]
    if "operator" in payload:
        t.operator = payload["operator"]
    db.commit()
    db.refresh(t)
    return _lab_dict(t)


@router.delete("/{tid}")
def delete_lab_test(tid: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(LabTest).filter(LabTest.id == tid).first()
    if not t:
        return {"detail": "检查单不存在"}
    db.delete(t)
    db.commit()
    return {"deleted": tid}
