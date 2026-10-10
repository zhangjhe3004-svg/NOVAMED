"""
号源排班 API —— /api/schedule
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import require_admin
from ..models.models import DoctorSchedule, User

router = APIRouter(prefix="/api/schedule", tags=["号源排班"])


@router.get("/public")
def public_schedules(date: str = None, db: Session = Depends(get_db)):
    q = db.query(DoctorSchedule)
    if date:
        q = q.filter(DoctorSchedule.date == date)
    return {"items": [
        {"id": x.id, "doctor_id": x.doctor_id, "date": x.date, "time_slot": x.time_slot,
         "department": x.department, "total": x.total, "remaining": x.remaining}
        for x in q.order_by(DoctorSchedule.id.desc()).all()
    ]}



@router.get("")
def list_schedules(date: str = None, doctor_id: int = None, _=Depends(require_admin),
                   db: Session = Depends(get_db)):
    q = db.query(DoctorSchedule)
    if date:
        q = q.filter(DoctorSchedule.date == date)
    if doctor_id:
        q = q.filter(DoctorSchedule.doctor_id == doctor_id)
    return {"items": [
        {"id": s.id, "doctor_id": s.doctor_id, "date": s.date, "time_slot": s.time_slot,
         "department": s.department, "total": s.total, "remaining": s.remaining}
        for s in q.order_by(DoctorSchedule.id.desc()).all()
    ]}


@router.post("")
def upsert_schedule(payload: dict, _=Depends(require_admin), db: Session = Depends(get_db)):
    s = db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id == payload.get("doctor_id"),
        DoctorSchedule.date == payload.get("date"),
        DoctorSchedule.time_slot == payload.get("time_slot"),
    ).first()
    if not s:
        s = DoctorSchedule(doctor_id=payload.get("doctor_id"), date=payload.get("date"),
                           time_slot=payload.get("time_slot"), department=payload.get("department", ""))
        db.add(s)
    s.total = payload.get("total", s.total or 0)
    s.remaining = payload.get("remaining", s.total)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "remaining": s.remaining}
