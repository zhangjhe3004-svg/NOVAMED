"""
扫描文档归档 API —— /api/documents

员工拍照/上传纸质病历、处方、检验单等扫描件，前端 tesseract.js 本地 OCR 识别后，
把图片（base64，已压缩）与识别文本一并归档，并可关联到患者 / 就诊记录 / 检查检验。

- 列表接口只回元数据与图片张数（不回大图），详情接口回完整 images 与 ocr_text。
- OCR 在本项目前端本地完成，后端仅负责归档与检索，不调用外部 OCR 服务。
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.models import ScannedDocument, User

router = APIRouter(prefix="/api/documents", tags=["扫描文档"])


class DocumentCreate(BaseModel):
    title: str = ""
    category: str = "病历"
    patient_id: Optional[int] = None
    record_id: Optional[int] = None
    labtest_id: Optional[int] = None
    images: list[str] = []       # base64 图片数组（前端已压缩）
    ocr_text: str = ""


def _images(obj) -> list[str]:
    try:
        return json.loads(obj.images or "[]")
    except Exception:
        return []


def _meta(obj) -> dict:
    return {
        "id": obj.id,
        "title": obj.title,
        "category": obj.category,
        "patient_id": obj.patient_id,
        "record_id": obj.record_id,
        "labtest_id": obj.labtest_id,
        "image_count": len(_images(obj)),
        "ocr_preview": (obj.ocr_text or "")[:160],
        "created_by": obj.created_by,
        "created_by_name": obj.created_by_name,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
    }


@router.post("")
def create_document(payload: DocumentCreate, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    doc = ScannedDocument(
        title=payload.title or f"扫描文档",
        category=payload.category or "病历",
        patient_id=payload.patient_id,
        record_id=payload.record_id,
        labtest_id=payload.labtest_id,
        images=json.dumps(payload.images or [], ensure_ascii=False),
        ocr_text=payload.ocr_text or "",
        created_by=user.id,
        created_by_name=user.real_name or user.username,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"document": _meta(doc)}


@router.get("")
def list_documents(patient_id: Optional[int] = None, record_id: Optional[int] = None,
                   labtest_id: Optional[int] = None,
                   _=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(ScannedDocument)
    if patient_id is not None:
        q = q.filter(ScannedDocument.patient_id == patient_id)
    if record_id is not None:
        q = q.filter(ScannedDocument.record_id == record_id)
    if labtest_id is not None:
        q = q.filter(ScannedDocument.labtest_id == labtest_id)
    items = q.order_by(ScannedDocument.id.desc()).all()
    return {"total": len(items), "items": [_meta(d) for d in items]}


@router.get("/{did}")
def get_document(did: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.query(ScannedDocument).filter(ScannedDocument.id == did).first()
    if not d:
        return {"detail": "文档不存在"}
    return {"document": {**_meta(d), "images": _images(d), "ocr_text": d.ocr_text or ""}}


@router.delete("/{did}")
def delete_document(did: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.query(ScannedDocument).filter(ScannedDocument.id == did).first()
    if not d:
        return {"detail": "文档不存在"}
    db.delete(d)
    db.commit()
    return {"detail": "ok"}
