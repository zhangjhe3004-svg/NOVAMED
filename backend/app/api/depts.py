"""
部门管理 API —— /api/depts（对齐 scaffold Depts.vue：组织架构树 CRUD + 画布/表格数据源）

约定：
- sys_depts 表在 employee.db；parent_id=0 表示顶级部门。
- member_count 统计 users 中 department == 该部门名 的直属人数（含下级由前端累加）。
- 有下级部门时禁止删除；上级不能选自己或其子孙。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.models import SysDept, User

router = APIRouter(prefix="/api/depts", tags=["部门管理"])

# 内置部门种子（id 显式，与前端画布根节点「MediCode 智慧医疗」对应）
_SEED = [
    # (id, parent_id, name, leader, phone, email, sort, status)
    (1, 0, "MediCode 智慧医疗", "周明远", "", "hq@example.com", 1, 1),
    (2, 1, "临床科室", "", "", "clinical@example.com", 1, 1),
    (3, 2, "内科", "张伟", "", "im@example.com", 1, 1),
    (4, 2, "外科", "李芳", "", "surgery@example.com", 2, 1),
    (5, 2, "妇产科", "", "", "obgyn@example.com", 3, 1),
    (6, 1, "医技科室", "", "", "tech@example.com", 2, 1),
    (7, 6, "检验科", "", "", "lab@example.com", 1, 1),
    (8, 6, "影像科", "", "", "radiology@example.com", 2, 1),
    (9, 1, "行政后勤", "", "", "admin@example.com", 3, 1),
    (10, 9, "医院系统部门", "admin", "", "sys@example.com", 1, 1),
    (11, 9, "药房", "赵敏", "", "pharmacy@example.com", 2, 1),
]


def _ensure_seeded(db: Session) -> None:
    if db.query(func.count(SysDept.id)).scalar():
        return
    for _id, parent_id, name, leader, phone, email, sort, status in _SEED:
        db.add(SysDept(id=_id, parent_id=parent_id, name=name, leader=leader,
                       phone=phone, email=email, sort=sort, status=status))
    db.commit()


def _member_counts(db: Session) -> dict:
    rows = db.query(User.department, func.count(User.id)).group_by(User.department).all()
    return {name or "": c for name, c in rows}


def _dict(d: SysDept, counts: dict) -> dict:
    return {
        "id": d.id, "parent_id": d.parent_id, "name": d.name,
        "leader": d.leader or "", "phone": d.phone or "", "email": d.email or "",
        "sort": d.sort, "status": d.status,
        "member_count": counts.get(d.name, 0),
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


@router.get("/tree")
def dept_tree(keyword: str = None, status: str = None,
              _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    rows = db.query(SysDept).order_by(SysDept.sort.asc(), SysDept.id.asc()).all()
    counts = _member_counts(db)
    by_id = {d.id: d for d in rows}
    children: dict[int, list] = {}
    for d in rows:
        children.setdefault(d.parent_id, []).append(d)

    keep: set[int] | None = None
    if keyword:
        kw = keyword.strip().lower()
        keep = set()
        for d in rows:
            if kw in d.name.lower() or kw in (d.leader or "").lower():
                keep.add(d.id)
                cur = d
                while cur.parent_id and cur.parent_id in by_id:
                    cur = by_id[cur.parent_id]
                    keep.add(cur.id)
    if status not in (None, ""):
        st = int(status)
        s_keep: set[int] = set()
        for d in rows:
            if d.status == st:
                s_keep.add(d.id)
                cur = d
                while cur.parent_id and cur.parent_id in by_id:
                    cur = by_id[cur.parent_id]
                    s_keep.add(cur.id)
        keep = s_keep if keep is None else (keep & s_keep)

    def build(pid: int) -> list:
        out = []
        for d in children.get(pid, []):
            if keep is not None and d.id not in keep:
                continue
            node = _dict(d, counts)
            kids = build(d.id)
            if kids:
                node["children"] = kids
            out.append(node)
        return out

    return {"items": build(0), "total": len(rows)}


def _validate(payload: dict, *, partial: bool = False) -> dict:
    data: dict = {}
    name = (payload.get("name") or "").strip()
    if not name and not partial:
        raise HTTPException(422, "部门名称必填")
    if name:
        data["name"] = name[:100]
    for f, lim in (("leader", 64), ("phone", 32), ("email", 128)):
        if f in payload:
            data[f] = (payload.get(f) or "").strip()[:lim]
    for f in ("parent_id", "sort", "status"):
        if f in payload and payload[f] is not None:
            data[f] = int(payload[f])
    return data


def _collect_ids(db: Session, dept_id: int) -> set:
    ids = {dept_id}
    frontier = [dept_id]
    while frontier:
        nxt = []
        for pid in frontier:
            for cid in [r[0] for r in db.query(SysDept.id).filter(SysDept.parent_id == pid).all()]:
                if cid not in ids:
                    ids.add(cid)
                    nxt.append(cid)
        frontier = nxt
    return ids


@router.post("")
def create_dept(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    data = _validate(payload)
    parent_id = data.get("parent_id", 0)
    if parent_id:
        if not db.query(SysDept).filter(SysDept.id == parent_id).first():
            raise HTTPException(422, "上级部门不存在")
    d = SysDept(parent_id=parent_id, **data)
    db.add(d)
    db.commit()
    return {"id": d.id}


@router.put("/{dept_id}")
def update_dept(dept_id: int, payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    d = db.query(SysDept).filter(SysDept.id == dept_id).first()
    if not d:
        raise HTTPException(404, "部门不存在")
    data = _validate(payload, partial=True)
    if "parent_id" in data and data["parent_id"] != d.parent_id:
        new_parent = data["parent_id"]
        if new_parent:
            if new_parent == d.id:
                raise HTTPException(422, "上级部门不能是自己")
            if new_parent in _collect_ids(db, d.id):
                raise HTTPException(422, "上级部门不能是自己的下级")
            if not db.query(SysDept).filter(SysDept.id == new_parent).first():
                raise HTTPException(422, "上级部门不存在")
        d.parent_id = new_parent
    for f, v in data.items():
        if f != "parent_id":
            setattr(d, f, v)
    db.commit()
    return {"ok": True}


@router.delete("/{dept_id}")
def remove_dept(dept_id: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    d = db.query(SysDept).filter(SysDept.id == dept_id).first()
    if not d:
        raise HTTPException(404, "部门不存在")
    kids = db.query(func.count(SysDept.id)).filter(SysDept.parent_id == dept_id).scalar()
    if kids:
        raise HTTPException(400, f"「{d.name}」下还有 {kids} 个下级部门，请先调整或删除下级部门")
    db.delete(d)
    db.commit()
    return {"ok": True}
