"""
认证 API —— /api/auth（登录/注册/重置/卡片登录） 与 /api/users（管理员用户管理）
"""
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ..core.database import get_employee_db, get_db, patient_session
from ..core.dependencies import get_current_user, require_admin, _bearer
from ..core.security import create_access_token, decode_access_token
from ..core import session_archive
from ..models.models import (User, UserRole, AuditLog, LoginLog, MedicalRecord, Appointment,
    Message, Notification, SessionRecord, UserPreference, Conversation, TokenUsage, DoctorSchedule)
from ..schemas import (LoginRequest, CardLoginRequest, Token, UserCreate, UserUpdate,
                       UserInfo, PasswordChange, PasswordReset)
from ..services.auth import (login as svc_login, create_user, list_users,
                             update_user, reset_user_password, change_password)
from ..core.stats_db import ensure_stats_table, save_user_stats

router = APIRouter(prefix="/api/auth", tags=["认证"])
admin_router = APIRouter(prefix="/api/users", tags=["用户管理"])


def _user_info(u: User) -> UserInfo:
    return UserInfo(
        id=u.id, username=u.username, real_name=u.real_name, role=u.role.value,
        phone=u.phone, email=u.email, id_number=u.id_number, id_type=u.id_type,
        surname=u.surname, given_name=u.given_name, valid_until=u.valid_until,
        issue_date=u.issue_date, registered_place=u.registered_place,
        employee_no=u.employee_no, department=u.department, title=u.title,
        work_status=u.work_status or "在职",
        auth_level=u.auth_level or 1,
        superior_id=u.superior_id,
    )


@router.post("/login", response_model=Token)
def login_endpoint(payload: LoginRequest, request: Request, db: Session = Depends(get_employee_db)):
    ip = request.client.host if request.client else ""
    try:
        token = svc_login(db, payload.username, payload.password)
    except Exception:
        db.add(LoginLog(username=payload.username, ip=ip, status="失败"))
        db.commit()
        raise
    db.add(LoginLog(user_id=token.user.id, username=payload.username, ip=ip, status="成功"))
    db.commit()
    return token


@router.post("/card-login", response_model=Token)
def card_login(payload: CardLoginRequest, db: Session = Depends(get_employee_db)):
    u = db.query(User).filter((User.id_number == payload.card_no) | (User.employee_no == payload.card_no)).first()
    if not u or not u.is_active:
        return svc_login(db, "", "___invalid___")  # 会抛 401
    sid = session_archive.start_session(u)
    token = create_access_token(data={"sub": str(u.id), "username": u.username, "role": u.role.value, "sid": sid})
    return Token(access_token=token, expires_in=480, user=_user_info(u))


@router.get("/me", response_model=UserInfo)
def me(user: User = Depends(get_current_user)):
    return _user_info(user)


@router.put("/me", response_model=UserInfo)
def update_me(payload: dict, user: User = Depends(get_current_user),
              db: Session = Depends(get_employee_db)):
    """当前用户修改个人资料 / 在岗状态"""
    allowed = ("real_name", "phone", "email", "department", "title", "work_status")
    for field in allowed:
        if field in payload and payload[field] is not None:
            setattr(user, field, str(payload[field]))
    db.commit()
    db.refresh(user)
    return _user_info(user)


@router.put("/password")
def update_password(payload: dict, user: User = Depends(get_current_user),
                    db: Session = Depends(get_employee_db)):
    """当前用户修改密码（需校验原密码）"""
    old = payload.get("old_password") or ""
    new = payload.get("new_password") or ""
    if not new or len(new) < 6:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="新密码至少 6 位")
    change_password(db, user, old, new)
    return {"detail": "密码修改成功"}


@router.post("/logout")
def logout_endpoint(
    user: User = Depends(get_current_user),
    credentials=Depends(_bearer),
    db: Session = Depends(get_employee_db),
    pdb: Session = Depends(get_db),
):
    """退出登录：将本次会话（审计动作 + 每日诊断 + 每日预约）生成「时间+员工姓名.sql」归档。"""
    payload = decode_access_token(credentials.credentials) if credentials else {}
    sid = payload.get("sid") if payload else None
    actions = collect_session_actions(db, user)
    diagnoses = collect_diagnoses(pdb, user)
    appointments = collect_appointments(pdb, user)
    filename = session_archive.finish_session(user, sid, actions, diagnoses, appointments)
    return {"detail": "已退出", "archive": filename}


def collect_session_actions(db, user):
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user.id)
        .order_by(AuditLog.id.desc())
        .limit(200)
        .all()
    )
    return [{
        "action": a.action,
        "detail": a.detail or a.resource or "",
        "logged_at": a.created_at.strftime("%Y-%m-%d %H:%M:%S") if a.created_at else "",
    } for a in logs]


def collect_diagnoses(db, user):
    rows = (
        db.query(MedicalRecord)
        .filter(MedicalRecord.doctor_id == user.id)
        .order_by(MedicalRecord.id.desc())
        .limit(500)
        .all()
    )
    return [{
        "id": r.id, "patient_id": r.patient_id,
        "symptoms": r.symptoms or "", "diagnosis": r.diagnosis or "",
        "prescription": r.prescription or "", "notes": r.notes or "",
        "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
    } for r in rows]


def collect_appointments(db, user):
    rows = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == user.id)
        .order_by(Appointment.id.desc())
        .limit(500)
        .all()
    )
    return [{
        "id": r.id, "patient_name": r.patient_name or "",
        "department": r.department or "", "date": r.date or "",
        "time_slot": r.time_slot or "", "symptoms": r.symptoms or "",
        "status": r.status or "",
        "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
    } for r in rows]


@admin_router.get("")
def admin_list_users(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                     role: str = None, keyword: str = None,
                     _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    return list_users(db, page, page_size, role, keyword)


@admin_router.post("")
def admin_create_user(payload: UserCreate, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    u = create_user(db, payload)
    return _user_info(u)


@admin_router.put("/{uid}")
def admin_update_user(uid: int, payload: UserUpdate, _=Depends(require_admin),
                      db: Session = Depends(get_employee_db)):
    u = update_user(db, uid, payload.model_dump(exclude_none=True))
    return _user_info(u)


@admin_router.post("/{uid}/reset-password")
def admin_reset_password(uid: int, payload: PasswordReset, _=Depends(require_admin),
                         db: Session = Depends(get_employee_db)):
    reset_user_password(db, uid, payload.new_password)
    return {"detail": "密码已重置"}


@admin_router.delete("/{uid}")
def admin_delete_user(uid: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    u = db.query(User).filter(User.id == uid).first()
    if not u:
        return {"detail": "用户不存在"}
    # 防止删除最后一个系统管理员
    if u.role == UserRole.ADMIN:
        admin_count = db.query(User).filter(User.role == UserRole.ADMIN).count()
        if admin_count <= 1:
            return {"detail": "至少保留一个系统管理员"}

    # 员工域级联清理（消息/通知/会话/偏好/对话/用量/审计/上级引用）
    db.query(Message).filter((Message.sender_id == uid) | (Message.receiver_id == uid)).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == uid).delete(synchronize_session=False)
    db.query(SessionRecord).filter(SessionRecord.user_id == uid).delete(synchronize_session=False)
    db.query(UserPreference).filter(UserPreference.user_id == uid).delete(synchronize_session=False)
    db.query(Conversation).filter(Conversation.user_id == uid).delete(synchronize_session=False)
    db.query(TokenUsage).filter(TokenUsage.user_id == uid).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.user_id == uid).delete(synchronize_session=False)
    db.query(User).filter(User.superior_id == uid).update({User.superior_id: None}, synchronize_session=False)
    db.delete(u)
    db.commit()

    # 患者域同步：删除该员工的号源排班，避免残留不可预约数据
    ps = patient_session()
    try:
        ps.query(DoctorSchedule).filter(DoctorSchedule.doctor_id == uid).delete(synchronize_session=False)
        ps.commit()
    finally:
        ps.close()

    return {"deleted": uid}


@admin_router.get("/stats")
def user_stats(_=Depends(require_admin), db: Session = Depends(get_employee_db)):
    """用户管理看板实时统计：从 employee.db / patient.db 计算，并写入 stats.db 快照。"""
    from datetime import datetime, timedelta
    from sqlalchemy import func
    from ..core.database import patient_session

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    total_staff = db.query(User).filter(User.work_status == "在职").count()
    doctor_count = db.query(User).filter(User.role == UserRole.DOCTOR).count()
    admin_count = db.query(User).filter(User.role == UserRole.ADMIN).count()
    inactive_count = db.query(User).filter(User.is_active == False).count()
    this_month_joined = db.query(User).filter(User.created_at >= month_start).count()
    on_leave = db.query(User).filter(User.work_status == "离岗").count()
    resting = db.query(User).filter(User.work_status == "休息").count()
    residents = db.query(User).filter(User.title.like("%规培%")).count()
    super_admins = db.query(User).filter(
        User.role == UserRole.ADMIN, User.auth_level == 9
    ).count()
    admin_dept_rows = (
        db.query(User.department)
        .filter(User.role == UserRole.ADMIN, User.department.isnot(None), User.department != "")
        .distinct()
        .all()
    )
    admin_departments = " / ".join(sorted({r[0] for r in admin_dept_rows})) or "—"
    last_7_days_created = db.query(User).filter(User.created_at >= week_ago).count()

    pdb = patient_session()
    try:
        scheduled_doctor_ids = {
            r[0] for r in pdb.query(DoctorSchedule.doctor_id).distinct().all() if r[0]
        }
        available_doctors = len(scheduled_doctor_ids)
    finally:
        pdb.close()

    stats = {
        "total_staff": total_staff,
        "doctor_count": doctor_count,
        "admin_count": admin_count,
        "inactive_count": inactive_count,
        "this_month_joined": this_month_joined,
        "on_leave": on_leave,
        "resting": resting,
        "available_doctors": available_doctors,
        "residents": residents,
        "super_admins": super_admins,
        "admin_departments": admin_departments,
        "last_7_days_created": last_7_days_created,
        "need_password_change": inactive_count,
    }

    ensure_stats_table()
    save_user_stats(stats)

    return stats
