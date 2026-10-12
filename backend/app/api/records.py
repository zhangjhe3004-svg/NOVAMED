"""
就诊记录 API —— /api/records
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.database import get_db, employee_session
from ..core.dependencies import get_current_user, require_doctor
from ..models.models import MedicalRecord, Patient, RecordComment, User
from ..schemas import MedicalRecordCreate

router = APIRouter(prefix="/api/records", tags=["就诊记录"])


@router.get("")
def list_records(keyword: str = None, review_status: str = None,
                 patient_id: int = None, doctor_id: int = None,
                 ai_reviewed: str = None, admin_reviewed: str = None,
                 page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                 _=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(MedicalRecord)
    if review_status:
        q = q.filter(MedicalRecord.review_status == review_status)
    if patient_id:
        q = q.filter(MedicalRecord.patient_id == patient_id)
    if doctor_id:
        q = q.filter(MedicalRecord.doctor_id == doctor_id)
    if ai_reviewed:
        q = q.filter(MedicalRecord.ai_reviewed.in_([int(x) for x in str(ai_reviewed).split(",") if x]))
    if admin_reviewed:
        q = q.filter(MedicalRecord.admin_reviewed.in_([int(x) for x in str(admin_reviewed).split(",") if x]))
    if keyword:
        q = q.join(Patient, MedicalRecord.patient_id == Patient.id).filter(
            or_(Patient.name.like(f"%{keyword}%"), MedicalRecord.diagnosis.like(f"%{keyword}%")))
    total = q.count()
    items = q.order_by(MedicalRecord.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_record_dict(db, r) for r in items]}


@router.post("")
def create_record(payload: MedicalRecordCreate, user: User = Depends(require_doctor),
                  db: Session = Depends(get_db)):
    r = MedicalRecord(patient_id=payload.patient_id, doctor_id=user.id,
                      symptoms=payload.symptoms, diagnosis=payload.diagnosis,
                      prescription=payload.prescription, notes=payload.notes)
    db.add(r)
    db.commit()
    db.refresh(r)
    return _record_dict(db, r)


@router.get("/{rid}")
def get_record(rid: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.query(MedicalRecord).filter(MedicalRecord.id == rid).first()
    if not r:
        return {"detail": "记录不存在"}
    comments = db.query(RecordComment).filter(RecordComment.record_id == rid).all()
    return {"record": _record_dict(db, r), "comments": [
        {"id": c.id, "author": c.author, "content": c.content, "kind": c.kind,
         "created_at": c.created_at.isoformat() if c.created_at else None}
        for c in comments
    ]}


def _record_dict(db: Session, r: MedicalRecord) -> dict:
    p = db.query(Patient).filter(Patient.id == r.patient_id).first()
    # 医生在员工库（employee.db），须用 employee_session 跨库查询
    doctor_name = ""
    if r.doctor_id:
        s = employee_session()
        try:
            d = s.query(User).filter(User.id == r.doctor_id).first()
            doctor_name = d.real_name if d else ""
        finally:
            s.close()
    return {
        "id": r.id, "patient_id": r.patient_id, "doctor_id": r.doctor_id,
        "patient_name": p.name if p else "", "doctor_name": doctor_name,
        "symptoms": r.symptoms, "diagnosis": r.diagnosis, "prescription": r.prescription,
        "notes": r.notes, "review_status": r.review_status,
        "ai_suggestion": getattr(r, "ai_suggestion", ""),
        "ai_confidence": getattr(r, "ai_confidence", ""),
        "ai_reviewed": getattr(r, "ai_reviewed", 0),
        "admin_reviewed": getattr(r, "admin_reviewed", 0),
        "admin_name": getattr(r, "admin_name", ""),
        "room": getattr(r, "room", ""),
        # 就诊日期 / 挂号时间：记录创建时间即本次就诊与挂号时刻
        "visit_date": r.created_at.date().isoformat() if r.created_at else None,
        "registration_time": r.created_at.isoformat() if r.created_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("/{rid}/review")
def review_record(rid: int, payload: dict, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    rec = db.query(MedicalRecord).filter(MedicalRecord.id == rid).first()
    if not rec:
        return {"detail": "记录不存在"}
    kind = payload.get("kind", "ai")
    if kind == "admin":
        rec.admin_reviewed = int(payload.get("admin_reviewed", 1))
        rec.admin_name = user.real_name or user.username
        rec.review_status = "已审核" if rec.admin_reviewed != 0 else "待审核"
        comment = payload.get("comment", "管理员审核")
        author = "管理员"
    else:
        rec.ai_reviewed = int(payload.get("ai_reviewed", 1))
        rec.review_status = "已审核" if rec.ai_reviewed != 2 else "待审核"
        comment = payload.get("comment", "AI 审核")
        author = "AI"
    db.add(RecordComment(record_id=rid, author=author, content=comment, kind="ai_review"))
    db.commit()
    return {"detail": "ok"}


@router.put("/{rid}")
def update_record(rid: int, payload: dict, _=Depends(get_current_user), db: Session = Depends(get_db)):
    rec = db.query(MedicalRecord).filter(MedicalRecord.id == rid).first()
    if not rec:
        return {"detail": "记录不存在"}
    for field in ("symptoms", "diagnosis", "prescription", "notes", "doctor_id", "room"):
        if field in payload and payload[field] is not None:
            setattr(rec, field, payload[field])
    db.commit()
    return _record_dict(db, rec)


@router.get("/{rid}/similar")
def similar_records(rid: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    rec = db.query(MedicalRecord).filter(MedicalRecord.id == rid).first()
    if not rec:
        return {"results": []}
    items = db.query(MedicalRecord).filter(
        MedicalRecord.id != rid,
        MedicalRecord.symptoms.like(f"%{rec.symptoms[:4]}%")
    ).limit(5).all()
    return {"results": [_record_dict(db, x) for x in items]}