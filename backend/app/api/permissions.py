"""
权限关系图 API —— /api/permissions/graph（对齐 scaffold /system/permissions/graph）

返回用户-角色-菜单三层聚合数据，供溯源视图、菜单星图与问答规则在前端组合：
- users:     { id, username, nickname, deptName, status }
- roles:     { id, name, code, dataScope, status, builtin, userCount, menuIds }
- menus:     { id, parentId, name, type, icon, path, permission, sort, visible, status }
- userRoles: [[userId, roleId], ...]
- usersVisible: boolean（管理员恒为 true）

约定：menuIds 为 menu_items.id（整数，含 dir/menu/btn，sys_role_menus.menu_id 权威）；
用户-角色关联来自 sys_user_role（多角色权威源）。
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..core.rbac import role_menu_ids
from ..models.models import SysRole, MenuItem, User, SysUserRole

router = APIRouter(prefix="/api/permissions", tags=["权限图"])


def _role_user_count(db: Session, role_id: int) -> int:
    return db.query(func.count(SysUserRole.user_id)).filter(SysUserRole.role_id == role_id).scalar() or 0


@router.get("/graph")
def permission_graph(_=Depends(require_admin), db: Session = Depends(get_employee_db)):
    from .roles import _ensure_seeded as _ensure_roles_seeded
    _ensure_roles_seeded(db)

    # 角色节点：menuIds 直接取 sys_role_menus.menu_id（整数）
    roles = []
    for r in db.query(SysRole).order_by(SysRole.sort.asc(), SysRole.id.asc()).all():
        roles.append({
            "id": r.id, "name": r.name, "code": r.code, "dataScope": r.data_scope,
            "status": r.status, "builtin": bool(r.builtin),
            "userCount": _role_user_count(db, r.id), "menuIds": role_menu_ids(db, r.id),
        })

    menus = [{
        "id": m.id, "parentId": m.parent_id, "name": m.name, "type": m.type,
        "icon": m.icon or None, "path": m.path or None, "permission": m.permission or None,
        "sort": m.sort, "visible": m.visible, "status": m.status,
    } for m in db.query(MenuItem).order_by(MenuItem.sort.asc(), MenuItem.id.asc()).all()]

    users = [{
        "id": u.id, "username": u.username, "nickname": u.real_name or u.username,
        "deptName": u.department or None, "status": 1 if u.is_active else 0,
    } for u in db.query(User).order_by(User.id.asc()).all()]

    user_roles = [[ur.user_id, ur.role_id] for ur in db.query(SysUserRole).order_by(
        SysUserRole.user_id.asc(), SysUserRole.role_id.asc()).all()]

    return {
        "users": users,
        "roles": roles,
        "menus": menus,
        "userRoles": user_roles,
        "usersVisible": True,
    }
