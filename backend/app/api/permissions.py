"""
权限关系图 API —— /api/permissions/graph（对齐 scaffold /system/permissions/graph）

返回用户-角色-菜单三层聚合数据，供溯源视图、菜单星图与问答规则在前端组合：
- users:     { id, username, nickname, deptName, status }
- roles:     { id, name, code, dataScope, status, builtin, userCount, menuIds }
- menus:     { id, parentId, name, type, icon, path, permission, sort, visible, status }
- userRoles: [[userId, roleId], ...]
- usersVisible: boolean（管理员恒为 true）

约定：menuIds 为 menu_items.id（整数），由 sys_role_menus.menu_key（导航 key）经
menu_items.permission（页面 permission == 导航 key）解析而来；用户-角色关联由
users.role 枚举实时推导（与认证链路同源，避免镜像表漂移）。
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.models import SysRole, SysRoleMenu, MenuItem, User, UserRole

router = APIRouter(prefix="/api/permissions", tags=["权限图"])


def _role_code(u: User) -> str:
    """users.role 枚举 → 角色编码字符串。"""
    return u.role.value if isinstance(u.role, UserRole) else str(u.role)


def _role_user_count(db: Session, code: str) -> int:
    try:
        enum_val = getattr(UserRole, code.upper())
    except AttributeError:
        return 0
    return db.query(func.count(User.id)).filter(User.role == enum_val).scalar() or 0


@router.get("/graph")
def permission_graph(_=Depends(require_admin), db: Session = Depends(get_employee_db)):
    from .roles import _ensure_seeded as _ensure_roles_seeded
    from .menus import _ensure_seeded as _ensure_menus_seeded
    _ensure_roles_seeded(db)
    _ensure_menus_seeded(db)

    # 角色节点：menu_key → menu_items.id（页面 permission == 导航 key）
    roles = []
    for r in db.query(SysRole).order_by(SysRole.sort.asc(), SysRole.id.asc()).all():
        keys = [m.menu_key for m in db.query(SysRoleMenu).filter(SysRoleMenu.role_id == r.id).all()]
        menu_ids = ([m.id for m in db.query(MenuItem).filter(
            MenuItem.type == "menu", MenuItem.permission.in_(keys)).all()]
                    if keys else [])
        roles.append({
            "id": r.id, "name": r.name, "code": r.code, "dataScope": r.data_scope,
            "status": r.status, "builtin": bool(r.builtin),
            "userCount": _role_user_count(db, r.code), "menuIds": menu_ids,
        })

    menus = [{
        "id": m.id, "parentId": m.parent_id, "name": m.name, "type": m.type,
        "icon": m.icon or None, "path": m.path or None, "permission": m.permission or None,
        "sort": m.sort, "visible": m.visible, "status": m.status,
    } for m in db.query(MenuItem).order_by(MenuItem.sort.asc(), MenuItem.id.asc()).all()]

    users = []
    user_roles = []
    for u in db.query(User).order_by(User.id.asc()).all():
        users.append({
            "id": u.id, "username": u.username, "nickname": u.real_name or u.username,
            "deptName": u.department or None, "status": 1 if u.is_active else 0,
        })
        role = db.query(SysRole).filter(SysRole.code == _role_code(u)).first()
        if role:
            user_roles.append([u.id, role.id])

    return {
        "users": users,
        "roles": roles,
        "menus": menus,
        "userRoles": user_roles,
        "usersVisible": True,
    }
