"""
患者端认证 API —— /api/patient-auth（手机号 + 密码登录，患者档案/预约/就诊记录）
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..core.database import get_db, employee_session
from ..core.security import verify_password, create_access_token, hash_password
from ..core.dependencies import get_current_patient
from ..models.models import (
    PatientAccount, Patient, Appointment, MedicalRecord, DoctorSchedule, User, RecordComment,
    LabTest, FamilyHistory, PatientNotification,
)

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


class FamilyHistoryPayload(BaseModel):
    relation: str = ""
    disease: str = ""
    onset_age: str = ""
    note: str = ""


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
    # 与 Web 患者端下单写入的字段对齐：patient_id（挂号时传入）为主，phone 兜底，
    # 保证手机端与 Web 客户端看到同一份真实预约数据。
    items = db.query(Appointment).filter(
        or_(Appointment.patient_id == acct.patient_id, Appointment.phone == acct.phone)
    ).order_by(Appointment.id.desc()).all()
    return {"items": [
        {"id": a.id, "doctor_id": a.doctor_id, "doctor_name": _doctor_name(a.doctor_id),
         "patient_name": a.patient_name,
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


# ============================================================ 报告查询（患者范围）
def _lab_patient_dict(t: LabTest) -> dict:
    return {
        "id": t.id, "test_no": t.test_no, "item_name": t.item_name,
        "category": t.category, "status": t.status, "department": t.department,
        "result": t.result, "reference": t.reference, "doctor_name": t.doctor_name,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/lab-tests")
def patient_lab_tests(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    items = db.query(LabTest).filter(LabTest.patient_id == acct.patient_id) \
        .order_by(LabTest.id.desc()).all()
    return {"items": [_lab_patient_dict(t) for t in items]}


@router.get("/lab-tests/{tid}")
def patient_lab_test_detail(tid: int, acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    t = db.query(LabTest).filter(LabTest.id == tid, LabTest.patient_id == acct.patient_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="报告不存在")
    return _lab_patient_dict(t)


# ============================================================ 消息通知中心（患者范围）
def _pnotif_dict(n: PatientNotification) -> dict:
    return {
        "id": n.id, "title": n.title, "content": n.content,
        "is_read": n.is_read, "level": n.level, "kind": n.kind,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("/notifications")
def patient_notifications(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    items = db.query(PatientNotification).filter(PatientNotification.patient_id == acct.patient_id) \
        .order_by(PatientNotification.id.desc()).limit(50).all()
    unread = db.query(PatientNotification).filter(
        PatientNotification.patient_id == acct.patient_id,
        PatientNotification.is_read == False).count()
    return {"items": [_pnotif_dict(n) for n in items], "unread": unread}


@router.post("/notifications/read-all")
def patient_notifications_read_all(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    db.query(PatientNotification).filter(
        PatientNotification.patient_id == acct.patient_id,
        PatientNotification.is_read == False).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"detail": "ok"}


@router.post("/notifications/{nid}/read")
def patient_notification_read(nid: int, acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    n = db.query(PatientNotification).filter(
        PatientNotification.id == nid, PatientNotification.patient_id == acct.patient_id).first()
    if n:
        n.is_read = True
        db.commit()
    return {"detail": "ok"}


# ============================================================ 家族病史 CRUD（患者范围）
def _family_dict(f: FamilyHistory) -> dict:
    return {
        "id": f.id, "relation": f.relation, "disease": f.disease,
        "onset_age": f.onset_age, "note": f.note,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


@router.get("/family-history")
def patient_family_history(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    items = db.query(FamilyHistory).filter(FamilyHistory.patient_id == acct.patient_id) \
        .order_by(FamilyHistory.id.asc()).all()
    return {"items": [_family_dict(f) for f in items]}


@router.post("/family-history")
def create_family_history(payload: FamilyHistoryPayload, acct=Depends(get_current_patient),
                          db: Session = Depends(get_db)):
    if not payload.relation.strip() or not payload.disease.strip():
        raise HTTPException(status_code=400, detail="亲属关系与疾病名称不能为空")
    f = FamilyHistory(patient_id=acct.patient_id, relation=payload.relation.strip(),
                      disease=payload.disease.strip(), onset_age=payload.onset_age.strip(),
                      note=payload.note.strip())
    db.add(f)
    db.commit()
    db.refresh(f)
    return _family_dict(f)


@router.put("/family-history/{fid}")
def update_family_history(fid: int, payload: FamilyHistoryPayload, acct=Depends(get_current_patient),
                          db: Session = Depends(get_db)):
    f = db.query(FamilyHistory).filter(FamilyHistory.id == fid,
                                       FamilyHistory.patient_id == acct.patient_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="记录不存在")
    f.relation = payload.relation.strip()
    f.disease = payload.disease.strip()
    f.onset_age = payload.onset_age.strip()
    f.note = payload.note.strip()
    db.commit()
    db.refresh(f)
    return _family_dict(f)


@router.delete("/family-history/{fid}")
def delete_family_history(fid: int, acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    f = db.query(FamilyHistory).filter(FamilyHistory.id == fid,
                                       FamilyHistory.patient_id == acct.patient_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="记录不存在")
    db.delete(f)
    db.commit()
    return {"deleted": fid}


# ============================================================ 首页概览（仪器化聚合）
@router.get("/overview")
def patient_overview(acct=Depends(get_current_patient), db: Session = Depends(get_db)):
    pid = acct.patient_id
    appts = db.query(Appointment).filter(
        or_(Appointment.patient_id == pid, Appointment.phone == acct.phone)
    ).all()
    upcoming = sum(1 for a in appts if a.status in ("待就诊", "已报到"))
    records = db.query(MedicalRecord).filter(MedicalRecord.patient_id == pid).all()
    done = sum(1 for r in records if r.review_status in ("已审核", "已完成"))
    labs = db.query(LabTest).filter(LabTest.patient_id == pid).all()
    lab_done = sum(1 for t in labs if t.status == "已出报告")
    lab_pending = sum(1 for t in labs if t.status in ("待检查", "已采样", "检查中"))
    unread = db.query(PatientNotification).filter(
        PatientNotification.patient_id == pid, PatientNotification.is_read == False).count()
    return {
        "upcoming": upcoming,
        "record_count": len(records),
        "done_count": done,
        "lab_count": len(labs),
        "lab_done": lab_done,
        "lab_pending": lab_pending,
        "unread": unread,
    }
