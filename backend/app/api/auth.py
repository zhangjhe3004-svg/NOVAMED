"""
认证 API —— /api/auth（登录/注册/重置/卡片登录） 与 /api/users（管理员用户管理）
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import get_current_user, require_admin
from ..core.security import create_access_token
from ..models.models import User, UserRole
from ..schemas import (LoginRequest, CardLoginRequest, Token, UserCreate, UserUpdate,
                       UserInfo, PasswordChange, PasswordReset)
from ..services.auth import (login as svc_login, create_user, list_users,
                             update_user, reset_user_password, change_password)

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
    )


@router.post("/login", response_model=Token)
def login_endpoint(payload: LoginRequest, db: Session = Depends(get_employee_db)):
    return svc_login(db, payload.username, payload.password)


@router.post("/card-login", response_model=Token)
def card_login(payload: CardLoginRequest, db: Session = Depends(get_employee_db)):
    u = db.query(User).filter((User.id_number == payload.card_no) | (User.employee_no == payload.card_no)).first()
    if not u or not u.is_active:
        return svc_login(db, "", "___invalid___")  # 会抛 401
    token = create_access_token(data={"sub": str(u.id), "username": u.username, "role": u.role.value})
    return Token(access_token=token, expires_in=480, user=_user_info(u))


@router.get("/me", response_model=UserInfo)
def me(user: User = Depends(get_current_user)):
    return _user_info(user)


@router.post("/change-password")
def change_password_endpoint(payload: PasswordChange, user: User = Depends(get_current_user),
                             db: Session = Depends(get_employee_db)):
    change_password(db, user, payload.old_password, payload.new_password)
    return {"detail": "密码已修改"}


# ---- 管理员用户管理 ----

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
    if u:
        db.delete(u)
        db.commit()
    return {"detail": "ok"}
