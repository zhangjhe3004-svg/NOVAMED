"""
预约挂号 / 医生接诊 / 上级查看下级(脱敏) API（系统级，始终挂载）
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user, require_doctor
from ..models.models import (Appointment, MedicalRecord, Patient, PatientAccount,
                             User, UserRole, DoctorSchedule)

router = APIRouter(prefix="/api", tags=["预约挂号"])


class AppointmentCreate(BaseModel):
    doctor_id: int
    hospital: str = ""
    department: str = ""
    date: str = ""
    time_slot: str = ""
    symptoms: str = ""
    patient_name: str = ""
    phone: str = ""


class CompletePayload(BaseModel):
    diagnosis: str = ""
    prescription: str = ""
    notes: str = ""


@router.post("/appointments")
def create_appointment(payload: AppointmentCreate, db: Session = Depends(get_db)):
    a = Appointment(
        doctor_id=payload.doctor_id, hospital=payload.hospital, department=payload.department,
        date=payload.date, time_slot=payload.time_slot, symptoms=payload.symptoms,
        patient_name=payload.patient_name, phone=payload.phone, status="待就诊",
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    # 有号源时扣号
    _deduct_schedule(db, payload.doctor_id, payload.date, payload.time_slot)
    return {"id": a.id, "status": a.status}


def _deduct_schedule(db: Session, doctor_id: int, date: str, time_slot: str):
    s = db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id == doctor_id,
        DoctorSchedule.date == date,
        DoctorSchedule.time_slot == time_slot,
    ).first()
    if s and s.remaining and s.remaining > 0:
        s.remaining -= 1
        db.commit()


@router.get("/appointments/query")
def query_appointments(phone: str = Query(...), db: Session = Depends(get_db)):
    items = db.query(Appointment).filter(Appointment.phone == phone).order_by(Appointment.id.desc()).all()
    return {"items": [_appointment_dict(a) for a in items]}


@router.post("/appointments/{aid}/checkin")
def checkin_appointment(aid: int, db: Session = Depends(get_db)):
    a = db.query(Appointment).filter(Appointment.id == aid).first()
    if not a:
        return {"detail": "预约不存在"}
    a.status = "已报到"
    db.commit()
    return _appointment_dict(a)


@router.get("/doctors/appointments")
def my_appointments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(Appointment).filter(Appointment.doctor_id == user.id).order_by(Appointment.id.desc()).all()
    return {"items": [_appointment_dict(a) for a in items]}


@router.post("/appointments/{aid}/complete")
def complete_appointment(aid: int, payload: CompletePayload,
                         user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.query(Appointment).filter(Appointment.id == aid).first()
    if not a:
        return {"detail": "预约不存在"}
    a.status = "已完成"
    a.diagnosis = payload.diagnosis
    a.prescription = payload.prescription
    a.notes = payload.notes
    # 完成后自动生成就诊记录
    if a.patient_id:
        rec = MedicalRecord(
            patient_id=a.patient_id, doctor_id=a.doctor_id, appointment_id=a.id,
            symptoms=a.symptoms, diagnosis=payload.diagnosis,
            prescription=payload.prescription, notes=payload.notes, review_status="待审核",
        )
        db.add(rec)
    db.commit()
    return _appointment_dict(a)


@router.get("/records/senior")
def senior_records(user: User = Depends(require_doctor), db: Session = Depends(get_db)):
    """上级查看下级诊断记录（患者信息脱敏）"""
    records = db.query(MedicalRecord).order_by(MedicalRecord.id.desc()).limit(100).all()
    items = []
    for r in records:
        p = db.query(Patient).filter(Patient.id == r.patient_id).first()
        doc = db.query(User).filter(User.id == r.doctor_id).first()
        items.append({
            "record_id": r.id,
            "symptoms": r.symptoms,
            "diagnosis": r.diagnosis,
            "prescription": r.prescription,
            "doctor_name": doc.real_name if doc else "",
            "doctor_title": doc.title if doc else "",
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "patient": {
                "name": _mask(p.name) if p else "",
                "id_card": _mask(p.id_card) if p else "",
                "phone": _mask(p.phone) if p else "",
                "gender": p.gender.value if p else "",
                "address": _mask(p.address) if p else "",
            },
        })
    return {"items": items}


@router.get("/patient-accounts")
def patient_accounts(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                     keyword: str = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(PatientAccount)
    if keyword:
        q = q.filter(PatientAccount.phone.like(f"%{keyword}%"))
    total = q.count()
    items = q.order_by(PatientAccount.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_account_dict(a) for a in items]}


def _appointment_dict(a: Appointment) -> dict:
    return {
        "id": a.id, "doctor_id": a.doctor_id, "patient_id": a.patient_id,
        "patient_name": a.patient_name, "phone": a.phone, "hospital": a.hospital,
        "department": a.department, "date": a.date, "time_slot": a.time_slot,
        "symptoms": a.symptoms, "status": a.status, "diagnosis": a.diagnosis,
        "prescription": a.prescription, "notes": a.notes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _account_dict(a: PatientAccount) -> dict:
    return {
        "id": a.id, "patient_id": a.patient_id, "id_type": a.id_type, "id_number": a.id_number,
        "surname": a.surname, "given_name": a.given_name, "valid_until": a.valid_until,
        "issue_date": a.issue_date, "registered_place": a.registered_place,
        "phone": a.phone, "status": a.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _mask(s: str) -> str:
    if not s:
        return ""
    if len(s) <= 2:
        return "*" * len(s)
    return s[:1] + "*" * (len(s) - 2) + s[-1:]
