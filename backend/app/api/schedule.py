"""
号源排班 API —— /api/schedule

规则：科室挂号只能挂「员工系统中除系统管理员之外」的员工，
即 doctor_id 必须是 role != admin 的在职员工；系统管理员不可被患者挂号。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.database import get_db, employee_session
from ..core.dependencies import require_admin, get_current_user
from ..models.models import DoctorSchedule, User, UserRole

router = APIRouter(prefix="/api/schedule", tags=["号源排班"])

# 同步时每个班次默认放出的号源数量
DEFAULT_SYNC_TOTAL = 20


def _doctor_names(ids):
    """按 doctor_id 批量取员工姓名（员工库）"""
    ids = {i for i in ids if i}
    if not ids:
        return {}
    s = employee_session()
    try:
        return {u.id: (u.real_name or "") for u in s.query(User).filter(User.id.in_(ids)).all()}
    finally:
        s.close()


def _doctor_fees(ids):
    """按 doctor_id 批量取挂号费（分，员工库 reg_fee；0=未设定）"""
    ids = {i for i in ids if i}
    if not ids:
        return {}
    s = employee_session()
    try:
        return {u.id: (u.reg_fee or 0) for u in s.query(User).filter(User.id.in_(ids)).all()}
    finally:
        s.close()


def _non_admin_ids(ids):
    """返回非管理员员工 id 集合（系统管理员不可被挂号）"""
    ids = {i for i in ids if i}
    if not ids:
        return set()
    s = employee_session()
    try:
        rows = s.query(User.id, User.role).filter(User.id.in_(ids)).all()
        return {uid for uid, role in rows if role == UserRole.DOCTOR}
    finally:
        s.close()


def _serialize(x, names, fees=None):
    remaining = x.remaining or 0
    total = x.total or 0
    fee = (fees or {}).get(x.doctor_id, 0)
    return {
        "id": x.id,
        "doctor_id": x.doctor_id,
        "doctor_name": names.get(x.doctor_id, ""),
        "date": x.date,
        "time_slot": x.time_slot,
        "department": x.department,
        "total": total,
        "remaining": remaining,
        "remain": remaining,
        "booked": max(0, total - remaining),
        "fee": fee,  # 分；0=未设定
    }


@router.get("/doctors")
def bookable_doctors(_=Depends(require_admin)):
    """可被挂号的在职医生（仅 DOCTOR 角色）"""
    s = employee_session()
    try:
        users = s.query(User).filter(User.role == UserRole.DOCTOR, User.is_active == True).all()
        return {"items": [
            {"id": u.id, "real_name": u.real_name or u.username, "department": u.department or "",
             "title": u.title or "", "role": u.role.value if isinstance(u.role, UserRole) else str(u.role)}
            for u in users
        ]}
    finally:
        s.close()


@router.get("/staff-doctors")
def staff_doctors(_=Depends(get_current_user)):
    """排班表用：医生列表（仅需登录，无需管理员权限）。

    返回全部在职、非系统管理员的员工（含医生），供排班表「员工」字段下拉选择，
    避免排班表页面（医生/护士/职员也可访问）因 /api/users 需管理员权限而无法加载医生。
    """
    s = employee_session()
    try:
        users = s.query(User).filter(
            User.role != UserRole.ADMIN, User.is_active == True
        ).order_by(User.id.asc()).all()
        return {"items": [
            {"id": u.id, "real_name": u.real_name or u.username, "username": u.username or "",
             "department": u.department or "", "title": u.title or "",
             "role": u.role.value if isinstance(u.role, UserRole) else str(u.role)}
            for u in users
        ]}
    finally:
        s.close()


@router.get("/public-departments")
def public_department_list():
    """患者端公开：科室列表（自动同步自员工系统中「在岗、非系统管理员」的医生账号）。

    只要给某个医生账号分配了科室，该科室就会自动出现在患者端挂号页，
    无需管理员再单独维护科室字典。每个科室附带可挂号医生数。
    """
    s = employee_session()
    try:
        rows = s.query(User.department, User.id).filter(
            User.role == UserRole.DOCTOR,
            User.is_active == True,
            User.department != "",
        ).all()
    finally:
        s.close()
    agg = {}
    for dept, _uid in rows:
        agg[dept] = agg.get(dept, 0) + 1
    return {"items": [{"department": d, "doctor_count": c} for d, c in sorted(agg.items())]}


@router.get("/public-doctors")
def public_doctor_list(department: str = Query(default=None)):
    """患者端公开：按科室返回可挂号医生（患者选完科室后调用）。

    不传 department 时返回全部可挂号医生；传入时只返回该科室下的医生，
    从而保证「先选科室，再在科室里找医生」的联动约束。
    """
    s = employee_session()
    try:
        q = s.query(User).filter(User.role == UserRole.DOCTOR, User.is_active == True)
        if department:
            q = q.filter(User.department == department)
        users = q.order_by(User.id.asc()).all()
        return {"items": [
            {"id": u.id, "real_name": u.real_name or u.username,
             "department": u.department or "", "title": u.title or "",
             "role": u.role.value if isinstance(u.role, UserRole) else str(u.role)}
            for u in users
        ]}
    finally:
        s.close()


@router.get("/public")
def public_schedules(date: str = None, department: str = None, db: Session = Depends(get_db)):
    q = db.query(DoctorSchedule)
    if date:
        q = q.filter(DoctorSchedule.date == date)
    if department:
        q = q.filter(DoctorSchedule.department == department)
    rows = q.order_by(DoctorSchedule.id.desc()).all()
    valid = _non_admin_ids([x.doctor_id for x in rows])
    rows = [x for x in rows if x.doctor_id in valid]
    names = _doctor_names([x.doctor_id for x in rows])
    fees = _doctor_fees([x.doctor_id for x in rows])
    return {"items": [_serialize(x, names, fees) for x in rows]}


@router.get("")
def list_schedules(date: str = None, doctor_id: int = None, _=Depends(require_admin),
                   db: Session = Depends(get_db)):
    q = db.query(DoctorSchedule)
    if date:
        q = q.filter(DoctorSchedule.date == date)
    if doctor_id:
        q = q.filter(DoctorSchedule.doctor_id == doctor_id)
    rows = q.order_by(DoctorSchedule.id.desc()).all()
    valid = _non_admin_ids([x.doctor_id for x in rows])
    rows = [x for x in rows if x.doctor_id in valid]
    names = _doctor_names([x.doctor_id for x in rows])
    fees = _doctor_fees([x.doctor_id for x in rows])
    return {"items": [_serialize(x, names, fees) for x in rows]}


@router.post("")
def upsert_schedule(payload: dict, _=Depends(require_admin), db: Session = Depends(get_db)):
    doctor_id = payload.get("doctor_id")
    s = employee_session()
    try:
        doctor = s.query(User).filter(User.id == doctor_id, User.role == UserRole.DOCTOR).first()
    finally:
        s.close()
    if not doctor:
        raise HTTPException(status_code=400, detail="只能为「非系统管理员」的在职员工创建号源")

    sch = db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id == doctor_id,
        DoctorSchedule.date == payload.get("date"),
        DoctorSchedule.time_slot == payload.get("time_slot"),
    ).first()
    if not sch:
        sch = DoctorSchedule(doctor_id=doctor_id, date=payload.get("date"),
                             time_slot=payload.get("time_slot"), department=payload.get("department", ""))
        db.add(sch)
    sch.total = payload.get("total", sch.total or 0)
    sch.remaining = payload.get("remaining", sch.total)
    db.commit()
    db.refresh(sch)
    return {"id": sch.id, "remaining": sch.remaining}


@router.delete("/{sid}")
def delete_schedule(sid: int, _=Depends(require_admin), db: Session = Depends(get_db)):
    sch = db.query(DoctorSchedule).filter(DoctorSchedule.id == sid).first()
    if not sch:
        raise HTTPException(status_code=404, detail="号源不存在")
    db.delete(sch)
    db.commit()
    return {"deleted": sid}


@router.put("/{sid}")
def update_schedule(sid: int, payload: dict, _=Depends(require_admin), db: Session = Depends(get_db)):
    sch = db.query(DoctorSchedule).filter(DoctorSchedule.id == sid).first()
    if not sch:
        raise HTTPException(status_code=404, detail="号源不存在")
    if payload.get("doctor_id") is not None:
        doctor_id = payload.get("doctor_id")
        ss = employee_session()
        try:
            doctor = ss.query(User).filter(User.id == doctor_id, User.role == UserRole.DOCTOR).first()
        finally:
            ss.close()
        if not doctor:
            raise HTTPException(status_code=400, detail="只能为「非系统管理员」的在职员工创建号源")
        sch.doctor_id = doctor_id
    for f in ("department", "date", "time_slot"):
        if payload.get(f) is not None:
            setattr(sch, f, payload.get(f))
    if payload.get("total") is not None:
        sch.total = int(payload.get("total"))
    if payload.get("remaining") is not None:
        sch.remaining = int(payload.get("remaining"))
    db.commit()
    db.refresh(sch)
    return {"id": sch.id, "remaining": sch.remaining}


@router.post("/sync-from-staff")
def sync_from_staff(payload: dict = None, _=Depends(require_admin), db: Session = Depends(get_db)):
    """将「排班表」（staff_schedules）中的医生班次同步为号源。

    逻辑：
    1. 读取员工排班集合 dyn_staff_schedules（employee + date + shift）。
    2. shift 形如 "08:00-10:00|早班|08-10|科室"，取第 1 段作为号源 time_slot。
    3. 用 employee 姓名匹配在职员工（real_name 或 username），得到 doctor_id 与科室。
    4. 仅同步「非系统管理员」的员工，避免管理员被挂号。
    5. 对 (doctor_id, date, time_slot) 做 upsert：已有号源则跳过，缺失则新建并放出默认号源。
    返回新建/跳过数量统计。
    """
    payload = payload or {}
    default_total = int(payload.get("total") or DEFAULT_SYNC_TOTAL)

    # 1) 读取排班表
    s = employee_session()
    try:
        sched_rows = s.execute(
            text("SELECT employee, date, shift FROM dyn_staff_schedules")
        ).mappings().all()
        # 在职员工（非管理员）：id -> (real_name, username, department)
        users = s.query(User).filter(User.role != UserRole.ADMIN, User.is_active == True).all()
        by_name = {}
        for u in users:
            if u.real_name:
                by_name[u.real_name] = u
            if u.username:
                by_name.setdefault(u.username, u)
    finally:
        s.close()

    created = 0
    skipped = 0
    unmatched = 0

    for row in sched_rows:
        employee = (row.get("employee") or "").strip()
        date = (row.get("date") or "").strip()
        shift = (row.get("shift") or "").strip()
        if not employee or not date or not shift:
            unmatched += 1
            continue

        # 提取 time_slot（shift 第 1 段，如 "08:00-10:00"）
        slot = shift.split("|")[0].strip()
        # 兼容未带 | 的简单格式（如 "早班 08:00-16:00"）
        if "|" not in shift and "-" not in slot:
            slot = ""

        user = by_name.get(employee)
        if not user:
            unmatched += 1
            continue

        if not slot:
            unmatched += 1
            continue

        # 2) upsert 号源
        existing = db.query(DoctorSchedule).filter(
            DoctorSchedule.doctor_id == user.id,
            DoctorSchedule.date == date,
            DoctorSchedule.time_slot == slot,
        ).first()
        if existing:
            skipped += 1
            continue

        sch = DoctorSchedule(
            doctor_id=user.id,
            date=date,
            time_slot=slot,
            department=user.department or "",
            total=default_total,
            remaining=default_total,
        )
        db.add(sch)
        created += 1

    db.commit()
    return {
        "created": created,
        "skipped": skipped,
        "unmatched": unmatched,
        "total_slots": default_total,
    }


@router.get("/reg-fees")
def list_reg_fees(_=Depends(require_admin)):
    """管理员：全部在职医生的挂号费设定（分；0=未设定）"""
    s = employee_session()
    try:
        users = s.query(User).filter(User.role == UserRole.DOCTOR, User.is_active == True).order_by(User.id.asc()).all()
        return {"items": [
            {"id": u.id, "real_name": u.real_name or u.username, "department": u.department or "",
             "title": u.title or "", "reg_fee": u.reg_fee or 0}
            for u in users
        ]}
    finally:
        s.close()


@router.put("/reg-fees/{doctor_id}")
def set_reg_fee(doctor_id: int, payload: dict, _=Depends(require_admin)):
    """管理员：设定某医生的挂号费（payload.fee 单位为「元」，内部 ×100 存「分」）"""
    fee_yuan = payload.get("fee")
    if fee_yuan is None:
        raise HTTPException(status_code=400, detail="缺少 fee 字段（单位：元）")
    try:
        fee_cents = int(round(float(fee_yuan) * 100))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="fee 必须是数字")
    if fee_cents < 0:
        raise HTTPException(status_code=400, detail="挂号费不能为负")
    s = employee_session()
    try:
        u = s.query(User).filter(User.id == doctor_id, User.role == UserRole.DOCTOR).first()
        if not u:
            raise HTTPException(status_code=404, detail="医生不存在")
        u.reg_fee = fee_cents
        s.commit()
        return {"id": doctor_id, "reg_fee": fee_cents}
    finally:
        s.close()
