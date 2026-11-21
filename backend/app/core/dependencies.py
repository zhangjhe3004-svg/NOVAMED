"""
FastAPI 依赖注入：JWT 认证 / 角色鉴权 / 患者认证
"""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import get_employee_db, get_db
from .security import decode_access_token
from .rbac import has_role
from ..models.models import User, UserRole, PatientAccount

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_employee_db),
) -> User:
    """解析 Bearer 令牌并返回当前员工用户"""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未提供认证令牌")
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="令牌无效或已过期")
    # 修复身份域隔离：明确拒绝患者令牌访问员工端
    if payload.get("type") == "patient" or payload.get("patient") is True:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="令牌类型错误")
    user_id = int(payload.get("sub", 0))
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已禁用")
    return user


def require_admin(user: User = Depends(get_current_user),
                  db: Session = Depends(get_employee_db)) -> User:
    """仅管理员/超级管理员可访问（多角色：sys_user_role 权威）。"""
    if not has_role(db, user, "admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return user


def require_doctor(user: User = Depends(get_current_user),
                   db: Session = Depends(get_employee_db)) -> User:
    """仅医生/高级职称/管理员可访问（多角色）。"""
    if not has_role(db, user, "doctor", "senior", "admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要医生权限")
    return user


def get_current_patient(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> PatientAccount:
    """患者端认证：患者令牌 payload 里带 patient: true"""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未提供认证令牌")
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="令牌无效或已过期")
    if payload.get("type") == "staff":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="令牌类型错误")
    if not (payload.get("patient") is True or payload.get("type") == "patient"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="患者认证失败")
    acct_id = int(payload.get("sub", 0))
    acct = db.query(PatientAccount).filter(PatientAccount.id == acct_id).first()
    if not acct:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="患者账号不存在")
    return acct
