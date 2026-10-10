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


@router.get("")
def list_knowledge(keyword: str = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                   _=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(KnowledgeDoc)
    if keyword:
        q = q.filter(KnowledgeDoc.title.like(f"%{keyword}%"))
    total = q.count()
    items = q.order_by(KnowledgeDoc.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [
        {"id": d.id, "title": d.title, "category": d.category, "tags": d.tags,
         "content": d.content, "created_at": d.created_at.isoformat() if d.created_at else None}
        for d in items
    ]}


@router.post("")
def create_knowledge(payload: KnowledgeCreate, _=Depends(get_current_user), db: Session = Depends(get_db)):
    d = KnowledgeDoc(title=payload.title, category=payload.category, tags=payload.tags, content=payload.content)
    db.add(d)
    db.commit()
    db.refresh(d)
    return {"id": d.id}


@router.get("/stats")
def knowledge_stats(_=Depends(get_current_user), db: Session = Depends(get_db)):
    total = db.query(KnowledgeDoc).count()
    return {"total": total}
