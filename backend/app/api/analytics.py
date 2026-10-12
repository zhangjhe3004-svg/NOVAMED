"""
运营数据分析 API —— /api/analytics
聚合患者/就诊/预约/收费/检查等维度的运营指标，供运营数据看板使用。
"""
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db, employee_session
from ..core.dependencies import get_current_user
from ..models.models import Patient, MedicalRecord, Appointment, BillingRecord, LabTest, User

router = APIRouter(prefix="/api/analytics", tags=["运营数据"])


def _fmt_date(d: datetime) -> str:
    return d.strftime("%m-%d")


@router.get("/overview")
def overview(_=Depends(get_current_user), db: Session = Depends(get_db)):
    """核心指标总览"""
    patients = db.query(Patient).all()
    records = db.query(MedicalRecord).all()
    appointments = db.query(Appointment).all()
    billings = db.query(BillingRecord).all()
    labtests = db.query(LabTest).all()

    paid = [b for b in billings if b.status == "已收费"]
    revenue = sum(b.total_amount for b in paid)

    return {
        "patient_total": len(patients),
        "record_total": len(records),
        "appointment_total": len(appointments),
        "billing_total": len(billings),
        "revenue": revenue,
        "revenue_yuan": round(revenue / 100, 2),
        "labtest_total": len(labtests),
        "labtest_done": sum(1 for t in labtests if t.status == "已出报告"),
    }


@router.get("/trends")
def trends(days: int = 14, _=Depends(get_current_user), db: Session = Depends(get_db)):
    """近 N 日就诊/预约/收费/检查趋势"""
    days = max(1, min(days, 90))
    today = datetime.now().date()

    def key_of(dt):
        return dt.strftime("%m-%d")

    buckets = {}
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        buckets[d.strftime("%Y-%m-%d")] = {"label": key_of(d), "records": 0, "appointments": 0, "billing": 0, "labtests": 0}

    def count_by(col_attr, model):
        rows = db.query(model).all()
        for r in rows:
            ca = getattr(r, "created_at", None)
            if ca is None:
                continue
            dkey = ca.strftime("%Y-%m-%d") if hasattr(ca, "strftime") else ca.isoformat()[:10]
            if dkey in buckets:
                buckets[dkey][col_attr] += 1

    count_by("records", MedicalRecord)
    count_by("appointments", Appointment)
    count_by("billing", BillingRecord)
    count_by("labtests", LabTest)

    return {"days": days, "items": list(buckets.values())}


@router.get("/departments")
def department_dist(_=Depends(get_current_user), db: Session = Depends(get_db)):
    """科室分布：按预约与收费记录的科室聚合"""
    counter: dict[str, int] = defaultdict(int)
    appointments = db.query(Appointment).all()
    for a in appointments:
        if a.department:
            counter[a.department] += 1
    # 收费记录的 department 也纳入
    billings = db.query(BillingRecord).all()
    for b in billings:
        if b.department:
            counter[b.department] += 1
    items = sorted(({"name": k, "value": v} for k, v in counter.items()), key=lambda x: -x["value"])
    return {"items": items}


@router.get("/doctors")
def doctor_dist(_=Depends(get_current_user), db: Session = Depends(get_db)):
    """医生接诊量排行（跨库查医生姓名）"""
    records = db.query(MedicalRecord).all()
    counter: dict[int, int] = defaultdict(int)
    for r in records:
        if r.doctor_id:
            counter[r.doctor_id] += 1

    ids = list(counter.keys())
    name_map: dict[int, str] = {}
    if ids:
        with employee_session() as edb:
            users = edb.query(User).filter(User.id.in_(ids)).all()
            name_map = {u.id: (u.real_name or u.username) for u in users}

    items = sorted(
        ({"id": did, "name": name_map.get(did, f"医生#{did}"), "value": cnt}
         for did, cnt in counter.items()),
        key=lambda x: -x["value"],
    )
    return {"items": items}


@router.get("/record-status")
def record_status(_=Depends(get_current_user), db: Session = Depends(get_db)):
    """就诊记录审核状态分布"""
    records = db.query(MedicalRecord).all()
    pending = sum(1 for r in records if r.ai_reviewed == 0)
    confirmed = sum(1 for r in records if r.ai_reviewed == 1)
    rejected = sum(1 for r in records if r.ai_reviewed == 2)
    return {"items": [
        {"name": "待审核", "value": pending},
        {"name": "已确认", "value": confirmed},
        {"name": "已驳回", "value": rejected},
    ]}
