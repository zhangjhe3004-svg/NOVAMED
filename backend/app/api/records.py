"""
就诊记录 API —— /api/records
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user, require_doctor
from ..models.models import MedicalRecord, Patient, RecordComment, User
from ..schemas import MedicalRecordCreate

router = APIRouter(prefix="/api/records", tags=["就诊记录"])


@router.get("")
def list_records(keyword: str = None, review_status: str = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                 _=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(MedicalRecord)
    if review_status:
        q = q.filter(MedicalRecord.review_status == review_status)
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
    d = db.query(User).filter(User.id == r.doctor_id).first()
    return {
        "id": r.id, "patient_id": r.patient_id, "doctor_id": r.doctor_id,
        "patient_name": p.name if p else "", "doctor_name": d.real_name if d else "",
        "symptoms": r.symptoms, "diagnosis": r.diagnosis, "prescription": r.prescription,
        "notes": r.notes, "review_status": r.review_status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("/{rid}/review")
def review_record(rid: int, payload: dict, _=Depends(get_current_user), db: Session = Depends(get_db)):
    rec = db.query(MedicalRecord).filter(MedicalRecord.id == rid).first()
    if not rec:
        return {"detail": "记录不存在"}
    rec.review_status = payload.get("review_status", "已审核")
    db.add(RecordComment(record_id=rid, author=payload.get("author", "AI"), content=payload.get("comment", ""), kind="ai_review"))
    db.commit()
    return {"detail": "ok"}


@router.get("/{rid}/similar")
def similar_records(rid: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    rec = db.query(MedicalRecord).filter(MedicalRecord.id == rid).first()
    if not rec:
        return {"items": []}
    items = db.query(MedicalRecord).filter(MedicalRecord.symptoms.like(f"%{rec.symptoms[:4]}%")).limit(5).all()
    return {"items": [_record_dict(db, x) for x in items]}
