"""
患者管理 API —— /api/patients
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.models import Patient, MedicalRecord, Gender, Appointment, PatientAccount, RecordComment
from ..schemas import PatientCreate

router = APIRouter(prefix="/api/patients", tags=["患者管理"])


def _patient_dict(p: Patient) -> dict:
    return {
        "id": p.id, "name": p.name, "gender": p.gender.value, "phone": p.phone,
        "id_card": p.id_card, "birth_date": p.birth_date, "address": p.address,
        "medical_history": p.medical_history,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("")
def list_patients(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  keyword: str = None, _=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Patient)
    if keyword:
        q = q.filter(or_(Patient.name.like(f"%{keyword}%"), Patient.phone.like(f"%{keyword}%"),
                         Patient.id_card.like(f"%{keyword}%")))
    total = q.count()
    items = q.order_by(Patient.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_patient_dict(p) for p in items]}


@router.post("")
def create_patient(payload: PatientCreate, _=Depends(get_current_user), db: Session = Depends(get_db)):
    p = Patient(name=payload.name, gender=Gender(payload.gender), phone=payload.phone,
                id_card=payload.id_card, birth_date=payload.birth_date,
                address=payload.address, medical_history=payload.medical_history)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _patient_dict(p)


@router.get("/{pid}")
def get_patient(pid: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == pid).first()
    if not p:
        return {"detail": "患者不存在"}
    records = db.query(MedicalRecord).filter(MedicalRecord.patient_id == pid).order_by(MedicalRecord.id.desc()).all()
    return {"patient": _patient_dict(p), "records": [
        {"id": r.id, "symptoms": r.symptoms, "diagnosis": r.diagnosis,
         "prescription": r.prescription, "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in records
    ]}


@router.put("/{pid}")
def update_patient(pid: int, payload: PatientCreate, _=Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == pid).first()
    if not p:
        return {"detail": "患者不存在"}
    p.name = payload.name
    p.gender = Gender(payload.gender)
    p.phone = payload.phone
    p.id_card = payload.id_card
    p.birth_date = payload.birth_date
    p.address = payload.address
    p.medical_history = payload.medical_history
    db.commit()
    return _patient_dict(p)


@router.delete("/{pid}")
def delete_patient(pid: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == pid).first()
    if not p:
        return {"detail": "患者不存在"}
    rec_ids = [r.id for r in db.query(MedicalRecord).filter(MedicalRecord.patient_id == pid).all()]
    if rec_ids:
        db.query(RecordComment).filter(RecordComment.record_id.in_(rec_ids)).delete(synchronize_session=False)
    db.query(MedicalRecord).filter(MedicalRecord.patient_id == pid).delete(synchronize_session=False)
    db.query(Appointment).filter(Appointment.patient_id == pid).delete(synchronize_session=False)
    if p.phone:
        db.query(Appointment).filter(Appointment.phone == p.phone).delete(synchronize_session=False)
    db.query(PatientAccount).filter(PatientAccount.patient_id == pid).delete(synchronize_session=False)
    db.delete(p)
    db.commit()
    return {"deleted": pid}
