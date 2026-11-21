"""
角色管理 API —— /api/roles（复刻 scaffold Roles.vue 能力：角色 CRUD + 菜单授权 + 权限矩阵数据源）

约定：
- sys_roles / sys_role_menus 表在 employee.db；sys_role_menus.menu_id（整数，含 dir/menu/btn）为权威授权粒度。
- 角色无任何授权行时，/my-menus 返回 menus=null —— 前端回退到静态分组配置；
  管理员在矩阵/抽屉里保存过一次授权后，DB 授权即生效。
- builtin 角色（admin/super_admin）只读：不可编辑/删除/改授权，自动拥有全部菜单。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin, get_current_user
from ..core.rbac import (
    get_user_roles, role_menu_ids, migrate_role_menus, ensure_user_roles_backfill,
)
from ..models.models import SysRole, SysRoleMenu, User, MenuItem, SysUserRole

router = APIRouter(prefix="/api/roles", tags=["角色管理"])

SCOPES = {"ALL", "DEPT_AND_CHILD", "DEPT", "SELF", "CUSTOM"}

# 数据权限中文文案（对齐 scaffold SystemManagementMapper 的 dataScope CASE WHEN）
SCOPE_TEXT = {
    "ALL": "全部数据权限",
    "DEPT_AND_CHILD": "本部门及以下",
    "DEPT": "本部门数据权限",
    "SELF": "仅本人数据权限",
    "CUSTOM": "自定义数据权限",
}


def _csv_cell(value) -> str:
    """CSV 单元格转义（对齐 scaffold csvCell：含逗号/引号/换行时加引号）。"""
    text = "" if value is None else str(value)
    if '"' in text:
        text = text.replace('"', '""')
    if "," in text or '"' in text or "\n" in text or "\r" in text:
        return f'"{text}"'
    return text


def _ensure_seeded(db: Session) -> None:
    """播种内置角色 + 菜单授权（幂等）；并执行 RBAC 迁移（menu_key→menu_id + 用户角色回填）。"""
    if db.query(func.count(SysRole.id)).scalar() == 0:
        seeds = [
            ("admin", "管理员", "ALL", 1, True),
            ("doctor", "医生", "DEPT_AND_CHILD", 2, False),
            ("nurse", "护士", "DEPT", 3, False),
            ("pharmacist", "药剂师", "DEPT", 4, False),
            ("senior", "高级职称", "DEPT_AND_CHILD", 5, False),
            ("maintainer", "运维", "CUSTOM", 6, False),
            ("staff", "员工", "SELF", 7, False),
        ]
        for code, name, scope, sort, builtin in seeds:
            db.add(SysRole(name=name, code=code, data_scope=scope, sort=sort, status=1,
                           builtin=builtin, remark=""))
    # super_admin：对齐 scaffold 内置角色（拥有全部权限，不可删除）
    if not db.query(SysRole).filter(SysRole.code == "super_admin").first():
        db.add(SysRole(name="超级管理员", code="super_admin", data_scope="ALL", sort=0,
                       status=1, builtin=True, remark="系统最高权限，不可删除"))
    db.commit()

    # 菜单树先就位，再做授权与迁移
    from .menus import _ensure_seeded as _ensure_menus_seeded
    _ensure_menus_seeded(db)

    _grant_super_admin_all(db)
    _seed_role_grants(db)
    migrate_role_menus(db)
    ensure_user_roles_backfill(db)


def _grant_super_admin_all(db: Session) -> None:
    """super_admin 拥有全部菜单授权（含 dir/menu/btn）。幂等：只补缺失项。"""
    r = db.query(SysRole).filter(SysRole.code == "super_admin").first()
    if not r:
        return
    all_ids = {m.id for m in db.query(MenuItem.id).all()}
    have = {m.menu_id for m in db.query(SysRoleMenu).filter(SysRoleMenu.role_id == r.id).all()}
    missing = all_ids - have
    for mid in sorted(missing):
        db.add(SysRoleMenu(role_id=r.id, menu_id=mid, menu_key=""))
    if missing:
        db.commit()


def _seed_role_grants(db: Session) -> None:
    """为未配置授权的标准角色播种其静态分组的全部菜单（对齐前端 ROLE_LABELS.groups）。幂等。"""
    from ..core.rbac import ROLE_GROUPS
    dirs = {d.name: d for d in db.query(MenuItem).filter(MenuItem.type == "dir").all()}

    def descendants(did: int) -> set:
        out = set()
        def walk(pid: int):
            for m in db.query(MenuItem).filter(MenuItem.parent_id == pid).all():
                out.add(m.id)
                walk(m.id)
        walk(did)
        return out

    for code, groups in ROLE_GROUPS.items():
        role = db.query(SysRole).filter(SysRole.code == code).first()
        if not role:
            continue
        if db.query(func.count(SysRoleMenu.id)).filter(
            SysRoleMenu.role_id == role.id, SysRoleMenu.menu_id.isnot(None)
        ).scalar():
            continue
        ids = set()
        for gname in groups:
            d = dirs.get(gname)
            if d:
                ids.add(d.id)
                ids |= descendants(d.id)
        for mid in sorted(ids):
            db.add(SysRoleMenu(role_id=role.id, menu_id=mid, menu_key=""))
    db.commit()


def _user_count(db: Session, code: str) -> int:
    role = db.query(SysRole).filter(SysRole.code == code).first()
    if not role:
        return 0
    return db.query(func.count(SysUserRole.user_id)).filter(SysUserRole.role_id == role.id).scalar() or 0


def _menu_ids(db: Session, role_id: int) -> list:
    return role_menu_ids(db, role_id)


def _get_role_or_404(db: Session, role_id: int) -> SysRole:
    r = db.query(SysRole).filter(SysRole.id == role_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="角色不存在")
    return r


def _forbid_builtin(r: SysRole) -> None:
    if r.builtin:
        raise HTTPException(status_code=400, detail="内置角色拥有全部权限，不可修改")


@router.get("")
def list_roles(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
               keyword: str = None, status: str = None,
               _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    q = db.query(SysRole)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(SysRole.name.like(like), SysRole.code.like(like)))
    if status not in (None, ""):
        q = q.filter(SysRole.status == int(status))
    total = q.count()
    rows = q.order_by(SysRole.sort.asc(), SysRole.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [{
        "id": r.id, "name": r.name, "code": r.code, "data_scope": r.data_scope,
        "data_scope_text": SCOPE_TEXT.get(r.data_scope, r.data_scope),
        "sort": r.sort, "status": r.status, "builtin": bool(r.builtin), "remark": r.remark or "",
        "user_count": _user_count(db, r.code),
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "create_time": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else None,
        "menu_ids": _menu_ids(db, r.id),
    } for r in rows]
    return {"total": total, "items": items}


@router.get("/export")
def export_roles(keyword: str = None, status: str = None,
                 _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    """角色导出 CSV（对齐 scaffold /roles/export：角色名称/权限字符/数据权限/状态/创建时间/备注）。"""
    _ensure_seeded(db)
    q = db.query(SysRole)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(SysRole.name.like(like), SysRole.code.like(like)))
    if status not in (None, ""):
        q = q.filter(SysRole.status == int(status))
    rows = q.order_by(SysRole.sort.asc(), SysRole.id.asc()).all()
    lines = ["角色名称,权限字符,数据权限,状态,创建时间,备注"]
    for r in rows:
        lines.append(",".join(_csv_cell(c) for c in [
            r.name, r.code, r.data_scope,
            "正常" if r.status == 1 else "停用",
            r.created_at.isoformat() if r.created_at else "",
            r.remark or "",
        ]))
    return Response(
        content="\n".join(lines),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="roles.csv"'},
    )


@router.post("")
def create_role(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    name = (payload.get("name") or "").strip()
    code = (payload.get("code") or "").strip()
    if not name or not code:
        raise HTTPException(status_code=422, detail="角色名称与编码必填")
    if db.query(SysRole).filter(SysRole.code == code).first():
        raise HTTPException(status_code=422, detail=f"角色编码 {code} 已存在")
    scope = payload.get("data_scope") or "SELF"
    if scope not in SCOPES:
        scope = "SELF"
    r = SysRole(name=name, code=code, data_scope=scope, sort=int(payload.get("sort") or 0),
                status=int(payload.get("status", 1)), builtin=False, remark=(payload.get("remark") or "")[:200])
    db.add(r)
    db.commit()
    return {"id": r.id}


@router.put("/{role_id}")
def update_role(role_id: int, payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    r = _get_role_or_404(db, role_id)
    _forbid_builtin(r)
    if "name" in payload:
        r.name = (payload.get("name") or r.name).strip()
    if "code" in payload:
        code = (payload.get("code") or r.code).strip()
        dup = db.query(SysRole).filter(SysRole.code == code, SysRole.id != role_id).first()
        if dup:
            raise HTTPException(status_code=422, detail=f"角色编码 {code} 已存在")
        r.code = code
    if "data_scope" in payload and payload["data_scope"] in SCOPES:
        r.data_scope = payload["data_scope"]
    if "sort" in payload:
        r.sort = int(payload.get("sort") or 0)
    if "status" in payload:
        r.status = int(payload.get("status", r.status))
    if "remark" in payload:
        r.remark = (payload.get("remark") or "")[:200]
    db.commit()
    return {"ok": True}


@router.delete("/{role_id}")
def remove_role(role_id: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    r = _get_role_or_404(db, role_id)
    _forbid_builtin(r)
    db.query(SysRoleMenu).filter(SysRoleMenu.role_id == role_id).delete()
    db.delete(r)
    db.commit()
    return {"ok": True}


@router.get("/{role_id}/menus")
def role_menus(role_id: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    r = _get_role_or_404(db, role_id)
    return {"role_id": r.id, "code": r.code, "menu_ids": _menu_ids(db, r.id)}


@router.put("/{role_id}/menus")
def save_role_menus(role_id: int, payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    r = _get_role_or_404(db, role_id)
    _forbid_builtin(r)
    menu_ids = payload.get("menu_ids")
    if not isinstance(menu_ids, list):
        raise HTTPException(status_code=422, detail="menu_ids 必须是数组")
    # 兼容：整数=menu_items.id；字符串=legacy 导航 key，解析为对应 menu id
    perm_to_id = {
        m.permission: m.id
        for m in db.query(MenuItem).filter(MenuItem.type == "menu", MenuItem.permission != "").all()
    }
    ids = set()
    for k in menu_ids:
        if isinstance(k, int):
            ids.add(k)
        elif isinstance(k, str):
            mid = perm_to_id.get(k)
            if mid is not None:
                ids.add(mid)
    db.query(SysRoleMenu).filter(SysRoleMenu.role_id == role_id).delete()
    for mid in ids:
        db.add(SysRoleMenu(role_id=role_id, menu_id=mid, menu_key=""))
    db.commit()
    return {"ok": True, "count": len(ids)}


@router.get("/my-menus")
def my_menus(current_user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    """当前登录账号的菜单授权（多角色并集，整数 menu_id + 权限码）。

    - 拥有内置角色（admin/super_admin）→ menus=null / permissions=null（前端视为全量）；
    - 无任何角色或授权 → menus=[] / permissions=[]（前端视为无权限）；
    - 否则返回各角色授权的 menu_id 并集，并解析为权限码（permission 字符串）并集。

    permissions 为按钮级权限码（如 medicode:users:add），供前端 PermissionButton 显隐控制；
    menu 页面的 permission 即导航 key，也一并返回（与 menus 同源）。
    """
    _ensure_seeded(db)
    from ..core.rbac import primary_role_code
    roles = get_user_roles(db, current_user)
    codes = [r.code for r in roles]
    if not roles:
        return {"role": primary_role_code(db, current_user), "roles": [], "menus": [], "permissions": []}
    if any(r.builtin for r in roles):
        return {"role": primary_role_code(db, current_user), "roles": codes, "menus": None, "permissions": None}
    ids: set[int] = set()
    for r in roles:
        ids |= set(role_menu_ids(db, r.id))
    perms: list[str] = []
    if ids:
        rows = db.query(MenuItem.id, MenuItem.permission).filter(MenuItem.id.in_(ids)).all()
        perms = sorted({p for _, p in rows if p})
    return {"role": primary_role_code(db, current_user), "roles": codes, "menus": sorted(ids), "permissions": perms}
