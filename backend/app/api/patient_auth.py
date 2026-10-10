"""
患者端认证 API —— /api/patient-auth（手机号 + 密码登录，患者档案/预约/就诊记录）
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.security import verify_password, create_access_token
from ..core.dependencies import get_current_patient
from ..models.models import PatientAccount, Patient, Appointment, MedicalRecord

router = APIRouter(prefix="/api/patient-auth", tags=["患者端"])


class PatientLogin(BaseModel):
    phone: str
    password: str


class PatientMeUpdate(BaseModel):
    name: str = ""
    address: str = ""
    phone: str = ""


@router.post("/login")
def patient_login(payload: PatientLogin, db: Session = Depends(get_db)):
    acct = db.query(PatientAccount).filter(PatientAccount.phone == payload.phone).first()
    if not acct or not acct.password_hash or not verify_password(payload.password, acct.password_hash):
        return {"detail": "手机号或密码错误"}
    token = create_access_token(data={"sub": str(acct.id), "patient": True, "phone": acct.phone})
    pat = db.query(Patient).filter(Patient.id == acct.patient_id).first()
    return {"access_token": token, "token_type": "bearer", "patient": {
        "id": acct.patient_id, "name": pat.name if pat else "", "phone": acct.phone,
        "gender": pat.gender.value if pat else "", "id_card": pat.id_card if pat else "",
    }}


@router.get("/me")
def patient_me(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    pat = db.query(Patient).filter(Patient.id == acct.patient_id).first()
    return {"id": acct.patient_id, "name": pat.name if pat else "", "phone": acct.phone,
            "gender": pat.gender.value if pat else "", "id_card": pat.id_card if pat else "",
            "address": pat.address if pat else ""}


@router.put("/me")
def update_patient_me(payload: PatientMeUpdate, acct=Depends(get_current_patient),
                      db: Session = Depends(get_db)):
    pat = db.query(Patient).filter(Patient.id == acct.patient_id).first()
    if pat:
        if payload.name:
            pat.name = payload.name
        if payload.address:
            pat.address = payload.address
        if payload.phone:
            pat.phone = payload.phone
            acct.phone = payload.phone
        db.commit()
    return {"detail": "ok"}


@router.get("/appointments")
def patient_appointments(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    items = db.query(Appointment).filter(Appointment.phone == acct.phone).order_by(Appointment.id.desc()).all()
    return {"items": [
        {"id": a.id, "doctor_id": a.doctor_id, "hospital": a.hospital, "department": a.department,
         "date": a.date, "time_slot": a.time_slot, "status": a.status, "symptoms": a.symptoms}
        for a in items
    ]}


@router.get("/records")
def patient_records(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    items = db.query(MedicalRecord).filter(MedicalRecord.patient_id == acct.patient_id).order_by(MedicalRecord.id.desc()).all()
    return {"items": [
        {"id": r.id, "symptoms": r.symptoms, "diagnosis": r.diagnosis, "prescription": r.prescription,
         "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in items
    ]}
