"""
知识库 API —— /api/knowledge
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.models import KnowledgeDoc

router = APIRouter(prefix="/api/knowledge", tags=["知识库"])


class KnowledgeCreate(BaseModel):
    title: str
    category: str = ""
    tags: str = ""
    content: str = ""


class KnowledgeUpdate(BaseModel):
    title: str = ""
    category: str = ""
    tags: str = ""
    content: str = ""


def _doc_dict(d: KnowledgeDoc) -> dict:
    return {"id": d.id, "title": d.title, "category": d.category, "tags": d.tags,
            "content": d.content, "created_at": d.created_at.isoformat() if d.created_at else None}


@router.get("")
def list_knowledge(keyword: str = None, category: str = None,
                   page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                   _=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(KnowledgeDoc)
    if keyword:
        q = q.filter(KnowledgeDoc.title.like(f"%{keyword}%"))
    if category:
        q = q.filter(KnowledgeDoc.category == category)
    total = q.count()
    items = q.order_by(KnowledgeDoc.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_doc_dict(d) for d in items]}


@router.get("/stats")
def knowledge_stats(_=Depends(get_current_user), db: Session = Depends(get_db)):
    total = db.query(KnowledgeDoc).count()
    return {"total": total}


@router.get("/categories")
def knowledge_categories(_=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(KnowledgeDoc.category).distinct().all()
    return {"categories": [r[0] for r in rows if r[0]]}


@router.post("")
def create_knowledge(payload: KnowledgeCreate, _=Depends(get_current_user), db: Session = Depends(get_db)):
    d = KnowledgeDoc(title=payload.title, category=payload.category, tags=payload.tags, content=payload.content)
    db.add(d)
    db.commit()
    db.refresh(d)
    return _doc_dict(d)


@router.get("/{doc_id}")
def get_knowledge(doc_id: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not d:
        return {"detail": "文档不存在"}
    return _doc_dict(d)


@router.put("/{doc_id}")
def update_knowledge(doc_id: int, payload: KnowledgeUpdate, _=Depends(get_current_user),
                     db: Session = Depends(get_db)):
    d = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not d:
        return {"detail": "文档不存在"}
    if payload.title:
        d.title = payload.title
    if payload.category is not None:
        d.category = payload.category
    if payload.tags is not None:
        d.tags = payload.tags
    if payload.content is not None:
        d.content = payload.content
    db.commit()
    return _doc_dict(d)


@router.delete("/{doc_id}")
def delete_knowledge(doc_id: int, _=Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not d:
        return {"detail": "文档不存在"}
    db.delete(d)
    db.commit()
    return {"detail": "ok"}