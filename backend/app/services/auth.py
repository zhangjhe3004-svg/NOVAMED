"""
认证相关的业务逻辑
"""
import datetime
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from ..models.models import User, UserRole
from ..core.security import hash_password, verify_password, create_access_token
from ..schemas import UserCreate, Token, UserInfo


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """验证用户名和密码，返回用户或None"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def login(db: Session, username: str, password: str) -> Token:
    """登录，返回JWT令牌"""
    user = authenticate_user(db, username, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role.value}
    )

    return Token(
        access_token=access_token,
        expires_in=480,
        user=UserInfo(
            id=user.id,
            username=user.username,
            real_name=user.real_name,
            role=user.role.value,
            phone=user.phone,
            email=user.email,
            id_number=user.id_number,
            id_type=user.id_type,
            surname=user.surname,
            given_name=user.given_name,
            valid_until=user.valid_until,
            issue_date=user.issue_date,
            registered_place=user.registered_place,
            employee_no=user.employee_no,
            department=user.department,
            title=user.title,
            work_status=user.work_status or "在职",
        ),
    )


def create_user(db: Session, user_data: UserCreate) -> User:
    """创建新用户"""
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在",
        )

    full_name = user_data.real_name or f"{user_data.surname or ''}{user_data.given_name or ''}"

    user = User(
        username=user_data.username,
        hashed_password=hash_password(user_data.password),
        real_name=full_name,
        role=UserRole(user_data.role),
        phone=user_data.phone,
        email=user_data.email,
        id_number=user_data.id_number,
        id_type=user_data.id_type,
        surname=user_data.surname,
        given_name=user_data.given_name,
        valid_until=user_data.valid_until,
        issue_date=user_data.issue_date,
        registered_place=user_data.registered_place,
        employee_no=user_data.employee_no,
        department=user_data.department,
        title=user_data.title,
        work_status=(user_data.work_status or "在职"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, old_password: str, new_password: str) -> None:
    """修改密码"""
    if not verify_password(old_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="原密码错误",
        )
    user.hashed_password = hash_password(new_password)
    db.commit()


def get_current_user(db: Session, token_payload: dict) -> User:
    """根据JWT中的信息获取当前用户"""
    user_id = int(token_payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或已禁用",
        )
    return user


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "real_name": u.real_name,
        "role": u.role.value,
        "phone": u.phone,
        "email": u.email,
        "id_number": u.id_number,
        "id_type": u.id_type,
        "surname": u.surname,
        "given_name": u.given_name,
        "valid_until": u.valid_until,
        "issue_date": u.issue_date,
        "registered_place": u.registered_place,
        "employee_no": u.employee_no,
        "department": u.department,
        "title": u.title,
        "work_status": u.work_status or "在职",
        "is_active": bool(u.is_active),
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


# ======== 用户管理（仅管理员） ========

def list_users(db: Session, page: int = 1, page_size: int = 20,
               role: str = None, keyword: str = None) -> dict:
    """管理员：用户列表（分页+筛选）"""
    from sqlalchemy import desc

    query = db.query(User)

    if role:
        roles = [r.strip() for r in role.split(",") if r.strip()]
        if roles:
            query = query.filter(User.role.in_(roles))
    if keyword:
        query = query.filter(or_(
            User.username.like(f"%{keyword}%"),
            User.real_name.like(f"%{keyword}%"),
            User.phone.like(f"%{keyword}%"),
            User.employee_no.like(f"%{keyword}%"),
        ))

    total = query.count()
    items = (
        query.order_by(desc(User.id))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "items": [_user_dict(u) for u in items]}


def update_user(db: Session, user_id: int, payload: dict) -> User:
    """管理员：更新用户角色/信息/启停"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    if "role" in payload and payload["role"] is not None:
        user.role = UserRole(payload["role"])
    for field in ("real_name", "phone", "email", "id_number", "id_type", "surname",
                  "given_name", "valid_until", "issue_date", "registered_place",
                  "employee_no", "department", "title", "work_status"):
        if field in payload and payload[field] is not None:
            setattr(user, field, payload[field])
    if "is_active" in payload and payload["is_active"] is not None:
        user.is_active = bool(payload["is_active"])
    db.commit()
    db.refresh(user)
    return user


def reset_user_password(db: Session, user_id: int, new_password: str) -> None:
    """管理员：重置用户密码"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    user.hashed_password = hash_password(new_password)
    db.commit()
