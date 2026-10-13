"""
岗位管理 API —— /api/posts（对齐 scaffold Posts.vue：岗位 CRUD + 阶梯/表格数据源）

约定：
- sys_posts 表在 employee.db；post_code 唯一。
- user_count 统计 users 中 title == 岗位名 的在岗人数。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.models import SysPost, User

router = APIRouter(prefix="/api/posts", tags=["岗位管理"])

# 内置岗位种子（医院岗位，user_count 由 title 匹配）
_SEED = [
    ("chief", "主任医师", 1, 1, "科室学科带头人"),
    ("deputy_chief", "副主任医师", 2, 1, "科室诊疗骨干"),
    ("attending", "主治医师", 3, 1, "独立接诊与病房管理"),
    ("resident", "住院医师", 4, 1, "轮转培养岗位"),
    ("head_nurse", "主管护师", 5, 1, "病区护理管理"),
    ("nurse", "护士", 6, 1, "临床护理执行"),
    ("pharmacist", "药师", 7, 1, "药品调剂与用药指导"),
    ("technician", "技师", 8, 1, "检验影像等医技操作"),
    ("admin_staff", "行政专员", 9, 1, "行政后勤事务"),
]


def _ensure_seeded(db: Session) -> None:
    if db.query(func.count(SysPost.id)).scalar():
        return
    for code, name, sort, status, remark in _SEED:
        db.add(SysPost(post_code=code, post_name=name, sort=sort, status=status, remark=remark))
    db.commit()


def _user_counts(db: Session) -> dict:
    rows = db.query(User.title, func.count(User.id)).filter(User.title != "").group_by(User.title).all()
    return {t or "": c for t, c in rows}


def _dict(p: SysPost, counts: dict) -> dict:
    return {
        "id": p.id, "post_code": p.post_code, "post_name": p.post_name,
        "sort": p.sort, "status": p.status, "remark": p.remark or "",
        "user_count": counts.get(p.post_name, 0),
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("")
def list_posts(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
               keyword: str = None, status: str = None,
               _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    q = db.query(SysPost)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(SysPost.post_name.like(like), SysPost.post_code.like(like)))
    if status not in (None, ""):
        q = q.filter(SysPost.status == int(status))
    total = q.count()
    rows = q.order_by(SysPost.sort.asc(), SysPost.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
    counts = _user_counts(db)
    return {"total": total, "items": [_dict(p, counts) for p in rows]}


@router.post("")
def create_post(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    name = (payload.get("post_name") or "").strip()
    code = (payload.get("post_code") or "").strip()
    if not name or not code:
        raise HTTPException(422, "岗位名称与编码必填")
    if db.query(SysPost).filter(SysPost.post_code == code).first():
        raise HTTPException(422, f"岗位编码 {code} 已存在")
    p = SysPost(post_code=code, post_name=name, sort=int(payload.get("sort") or 0),
                status=int(payload.get("status", 1)), remark=(payload.get("remark") or "")[:500])
    db.add(p)
    db.commit()
    return {"id": p.id}


@router.put("/{post_id}")
def update_post(post_id: int, payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    p = db.query(SysPost).filter(SysPost.id == post_id).first()
    if not p:
        raise HTTPException(404, "岗位不存在")
    if "post_name" in payload:
        p.post_name = (payload.get("post_name") or p.post_name).strip()[:100]
    if "post_code" in payload:
        code = (payload.get("post_code") or p.post_code).strip()
        dup = db.query(SysPost).filter(SysPost.post_code == code, SysPost.id != post_id).first()
        if dup:
            raise HTTPException(422, f"岗位编码 {code} 已存在")
        p.post_code = code
    if "sort" in payload:
        p.sort = int(payload.get("sort") or 0)
    if "status" in payload:
        p.status = int(payload.get("status", p.status))
    if "remark" in payload:
        p.remark = (payload.get("remark") or "")[:500]
    db.commit()
    return {"ok": True}


@router.delete("/{post_id}")
def remove_post(post_id: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    p = db.query(SysPost).filter(SysPost.id == post_id).first()
    if not p:
        raise HTTPException(404, "岗位不存在")
    db.delete(p)
    db.commit()
    return {"ok": True}
