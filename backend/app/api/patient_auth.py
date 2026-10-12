"""
患者端认证 API —— /api/patient-auth（手机号 + 密码登录，患者档案/预约/就诊记录）
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db, employee_session
from ..core.security import verify_password, create_access_token, hash_password
from ..core.dependencies import get_current_patient
from ..models.models import PatientAccount, Patient, Appointment, MedicalRecord, DoctorSchedule, User, RecordComment

router = APIRouter(prefix="/api/patient-auth", tags=["患者端"])


class PatientLogin(BaseModel):
    phone: str
    password: str


class PatientMeUpdate(BaseModel):
    name: str = ""
    gender: str = ""
    phone: str = ""
    address: str = ""
    birth_date: str = ""
    medical_history: str = ""
    registered_place: str = ""


class ChangePassword(BaseModel):
    old_password: str
    new_password: str


def _patient_profile(acct, pat):
    return {
        "id": acct.patient_id,
        "name": pat.name if pat else "",
        "gender": pat.gender.value if pat and pat.gender else "其他",
        "phone": acct.phone,
        "id_card": pat.id_card if pat else "",
        "address": pat.address if pat else "",
        "birth_date": pat.birth_date if pat else "",
        "medical_history": pat.medical_history if pat else "",
        "id_type": acct.id_type,
        "id_number": acct.id_number,
        "surname": acct.surname,
        "given_name": acct.given_name,
        "registered_place": acct.registered_place,
        "status": acct.status,
    }


def _doctor_name(doctor_id):
    if not doctor_id:
        return ""
    s = employee_session()
    try:
        u = s.query(User).filter(User.id == doctor_id).first()
        return u.real_name if u else ""
    finally:
        s.close()


@router.post("/login")
def patient_login(payload: PatientLogin, db: Session = Depends(get_db)):
    acct = db.query(PatientAccount).filter(PatientAccount.phone == payload.phone).first()
    if not acct or not acct.password_hash or not verify_password(payload.password, acct.password_hash):
        return {"detail": "手机号或密码错误"}
    token = create_access_token(data={"sub": str(acct.id), "patient": True, "phone": acct.phone}, token_type="patient")
    pat = db.query(Patient).filter(Patient.id == acct.patient_id).first()
    return {"access_token": token, "token_type": "bearer", "patient": _patient_profile(acct, pat)}


@router.get("/me")
def patient_me(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    pat = db.query(Patient).filter(Patient.id == acct.patient_id).first()
    return _patient_profile(acct, pat)


@router.put("/me")
def update_patient_me(payload: PatientMeUpdate, acct=Depends(get_current_patient),
                      db: Session = Depends(get_db)):
    pat = db.query(Patient).filter(Patient.id == acct.patient_id).first()
    if pat:
        if payload.name:
            pat.name = payload.name
        if payload.gender:
            from ..models.models import Gender
            try:
                pat.gender = Gender(payload.gender)
            except ValueError:
                pass
        if payload.address:
            pat.address = payload.address
        if payload.birth_date:
            pat.birth_date = payload.birth_date
        if payload.medical_history:
            pat.medical_history = payload.medical_history
        if payload.phone and payload.phone != acct.phone:
            pat.phone = payload.phone
            acct.phone = payload.phone
        db.commit()
    if payload.registered_place:
        acct.registered_place = payload.registered_place
        db.commit()
    return _patient_profile(acct, pat)


@router.post("/change-password")
def change_password(payload: ChangePassword, acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    if not acct.password_hash or not verify_password(payload.old_password, acct.password_hash):
        raise HTTPException(status_code=400, detail="原密码错误")
    acct.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"detail": "密码已修改"}


@router.get("/appointments")
def patient_appointments(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    items = db.query(Appointment).filter(Appointment.phone == acct.phone).order_by(Appointment.id.desc()).all()
    return {"items": [
        {"id": a.id, "doctor_id": a.doctor_id, "doctor_name": _doctor_name(a.doctor_id),
         "hospital": a.hospital, "department": a.department,
         "date": a.date, "time_slot": a.time_slot, "status": a.status, "symptoms": a.symptoms}
        for a in items
    ]}


@router.post("/appointments/{aid}/cancel")
def cancel_appointment(aid: int, acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    a = db.query(Appointment).filter(Appointment.id == aid, Appointment.phone == acct.phone).first()
    if not a:
        raise HTTPException(status_code=404, detail="预约不存在")
    if a.status in ("已完成", "已取消"):
        raise HTTPException(status_code=400, detail="当前状态不可取消")
    a.status = "已取消"
    db.commit()
    # 归还号源
    s = db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id == a.doctor_id,
        DoctorSchedule.date == a.date,
        DoctorSchedule.time_slot == a.time_slot,
    ).first()
    if s:
        s.remaining = min((s.total or 0), (s.remaining or 0) + 1)
        db.commit()
    return {"detail": "已取消"}


@router.get("/records")
def patient_records(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    items = db.query(MedicalRecord).filter(MedicalRecord.patient_id == acct.patient_id).order_by(MedicalRecord.id.desc()).all()
    return {"items": [
        {"id": r.id, "record_id": r.id, "doctor_id": r.doctor_id, "doctor_name": _doctor_name(r.doctor_id),
         "symptoms": r.symptoms, "diagnosis": r.diagnosis, "prescription": r.prescription,
         "notes": r.notes, "review_status": r.review_status,
         "visit_date": r.created_at.isoformat() if r.created_at else None,
         "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in items
    ]}


@router.delete("/records/{rid}")
def delete_patient_record(rid: int, acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    rec = db.query(MedicalRecord).filter(MedicalRecord.id == rid,
                                         MedicalRecord.patient_id == acct.patient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="就诊记录不存在")
    db.query(RecordComment).filter(RecordComment.record_id == rid).delete(synchronize_session=False)
    db.delete(rec)
    db.commit()
    return {"deleted": rid}


@router.delete("/me")
def delete_my_account(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    pid = acct.patient_id
    if pid:
        rec_ids = [r.id for r in db.query(MedicalRecord).filter(MedicalRecord.patient_id == pid).all()]
        if rec_ids:
            db.query(RecordComment).filter(RecordComment.record_id.in_(rec_ids)).delete(synchronize_session=False)
        db.query(MedicalRecord).filter(MedicalRecord.patient_id == pid).delete(synchronize_session=False)
        db.query(Appointment).filter((Appointment.patient_id == pid) | (Appointment.phone == acct.phone)).delete(synchronize_session=False)
        db.query(Patient).filter(Patient.id == pid).delete(synchronize_session=False)
    db.delete(acct)
    db.commit()
    return {"deleted": acct.id}
