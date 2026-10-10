"""
数据权限服务 —— 角色 × 集合 × 动作 × 行范围
"""
from typing import Optional

from sqlalchemy.orm import Session

from ..models.workspace import AclRule


def effective(db: Session, role: str, collection: str, action: str = "read") -> Optional[str]:
    """返回该角色对集合某动作的行范围：all / own / none；未配置返回 None"""
    rule = (
        db.query(AclRule)
        .filter(AclRule.role == role, AclRule.collection == collection, AclRule.action == action, AclRule.enabled == True)  # noqa: E712
        .first()
    )
    return rule.row_scope if rule else None


def allowed(db: Session, role: str, collection: str, action: str = "read") -> bool:
    scope = effective(db, role, collection, action)
    return scope != "none"
