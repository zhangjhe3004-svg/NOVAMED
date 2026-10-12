"""
下级审阅分配 API —— /api/supervision

核心规则：只有被上级「分配」后的下级医生（User.superior_id = 当前上级），
才会出现在上级的「下级审阅」页面中，其就诊记录才可被上级审阅。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.database import get_db, employee_session
from ..core.dependencies import get_current_user, require_doctor
from ..models.models import MedicalRecord, Patient, User, UserRole

router = APIRouter(prefix="/api/supervision", tags=["下级审阅"])


def _mask(v: str | None) -> str:
    """脱敏：保留首字符，其余用 * 替代"""
    if not v:
        return ""
    return v[0] + "*" * max(len(v) - 1, 0)


def _assignee_dict(u: User, pending: int = 0, total: int = 0) -> dict:
    return {
        "id": u.id,
        "real_name": u.real_name or u.username,
        "username": u.username,
        "title": u.title or "",
        "department": u.department or "",
        "role": u.role.value if isinstance(u.role, UserRole) else str(u.role),
        "pending_count": pending,
        "total_count": total,
    }


def _subordinate_ids(user_id: int) -> list[int]:
    s = employee_session()
    try:
        rows = s.query(User.id).filter(User.superior_id == user_id, User.is_active == True).all()
        return [r[0] for r in rows]
    finally:
        s.close()


@router.get("/assignees")
def my_assignees(user: User = Depends(require_doctor), db: Session = Depends(get_db)):
    """我（上级）已分配的下级医生列表，附各自待审阅 / 记录总数"""
    s = employee_session()
    try:
        subs = s.query(User).filter(User.superior_id == user.id, User.is_active == True).all()
    finally:
        s.close()
    items = []
    for u in subs:
        recs = db.query(MedicalRecord).filter(MedicalRecord.doctor_id == u.id).all()
        pending = sum(1 for r in recs if not getattr(r, "admin_reviewed", 0))
        items.append(_assignee_dict(u, pending=pending, total=len(recs)))
    items.sort(key=lambda x: (-x["pending_count"], -x["total_count"]))
    return {"items": items}


@router.get("/candidates")
def assign_candidates(keyword: str = None, user: User = Depends(require_doctor)):
    """可分配对象：在职非管理员的员工，标注当前归属（我 / 其他上级 / 未分配）"""
    s = employee_session()
    try:
        q = s.query(User).filter(User.role != UserRole.ADMIN, User.is_active == True)
        rows = q.all()
        names = {u.id: (u.real_name or u.username) for u in rows}
    finally:
        s.close()
    items = []
    for u in rows:
        if keyword and keyword not in (u.real_name or "") and keyword not in (u.username or "") \
                and keyword not in (u.department or ""):
            continue
        superior = ""
        if u.superior_id:
            if u.superior_id == user.id:
                superior = "我"
            else:
                ss = employee_session()
                try:
                    sup = ss.query(User).filter(User.id == u.superior_id).first()
                finally:
                    ss.close()
                superior = sup.real_name if sup else f"#{u.superior_id}"
        items.append({
            **_assignee_dict(u),
            "superior_id": u.superior_id,
            "superior_name": superior,
            "assigned_to_me": u.superior_id == user.id,
        })
    items.sort(key=lambda x: (not x["assigned_to_me"], x["real_name"]))
    return {"items": items}


@router.post("/assign")
def assign_subordinate(payload: dict, user: User = Depends(require_doctor)):
    """上级分配下级：把指定员工的 superior_id 设为当前用户（转入我的责任链）"""
    uid = payload.get("user_id")
    if not uid:
        raise HTTPException(status_code=400, detail="缺少 user_id")
    if int(uid) == user.id:
        raise HTTPException(status_code=400, detail="不能把自己分配给自己")
    s = employee_session()
    try:
        u = s.query(User).filter(User.id == int(uid), User.is_active == True).first()
        if not u:
            raise HTTPException(status_code=404, detail="员工不存在或已离职")
        if u.role == UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="不能分配系统管理员为下级")
        u.superior_id = user.id
        s.commit()
        return {"detail": "ok", "user_id": u.id, "real_name": u.real_name or u.username}
    finally:
        s.close()


@router.post("/unassign")
def unassign_subordinate(payload: dict, user: User = Depends(require_doctor)):
    """取消分配：该医生从我的下级列表移除（superior_id 置空）"""
    uid = payload.get("user_id")
    if not uid:
        raise HTTPException(status_code=400, detail="缺少 user_id")
    s = employee_session()
    try:
        u = s.query(User).filter(User.id == int(uid)).first()
        if not u or u.superior_id != user.id:
            raise HTTPException(status_code=404, detail="该医生不在你的下级列表中")
        u.superior_id = None
        s.commit()
        return {"detail": "ok"}
    finally:
        s.close()


@router.get("/records")
def subordinate_records(doctor_id: int = None, limit: int = Query(100, le=200),
                        user: User = Depends(require_doctor), db: Session = Depends(get_db)):
    """我名下所有下级（或指定下级）的就诊记录（患者信息脱敏），供审阅"""
    subs = _subordinate_ids(user.id)
    if doctor_id:
        if doctor_id not in subs:
            raise HTTPException(status_code=403, detail="该医生未分配给你，无权查看其记录")
        subs = [doctor_id]
    if not subs:
        return {"items": []}
    records = (
        db.query(MedicalRecord)
        .filter(MedicalRecord.doctor_id.in_(subs))
        .order_by(MedicalRecord.id.desc())
        .limit(limit)
        .all()
    )
    items = []
    for r in records:
        p = db.query(Patient).filter(Patient.id == r.patient_id).first()
        doc = None
        s = employee_session()
        try:
            doc = s.query(User).filter(User.id == r.doctor_id).first()
        finally:
            s.close()
        items.append({
            "record_id": r.id,
            "doctor_id": r.doctor_id,
            "symptoms": r.symptoms,
            "diagnosis": r.diagnosis,
            "prescription": r.prescription,
            "doctor_name": doc.real_name if doc else "",
            "doctor_title": doc.title if doc else "",
            "department": doc.department if doc else "",
            "ai_reviewed": getattr(r, "ai_reviewed", 0),
            "admin_reviewed": getattr(r, "admin_reviewed", 0),
            "visit_date": r.created_at.date().isoformat() if r.created_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "patient": {
                "name": _mask(p.name) if p else "",
                "id_card": _mask(p.id_card) if p else "",
                "phone": _mask(p.phone) if p else "",
                "gender": p.gender.value if p else "",
                "address": _mask(p.address) if p else "",
            },
        })
    return {"items": items}
