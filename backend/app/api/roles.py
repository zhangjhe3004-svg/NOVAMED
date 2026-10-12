"""
角色管理 API —— /api/roles（复刻 scaffold Roles.vue 能力：角色 CRUD + 菜单授权 + 权限矩阵数据源）

约定：
- sys_roles / sys_role_menus 表在 employee.db；menu_key 对应前端导航项 key（config/nav.ts）。
- 角色无任何授权行时，/my-menus 返回 menus=null —— 前端回退到静态分组配置；
  管理员在矩阵/抽屉里保存过一次授权后，DB 授权即生效。
- builtin 角色（admin）只读：不可编辑/删除/改授权。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin, get_current_user
from ..models.models import SysRole, SysRoleMenu, User, UserRole

router = APIRouter(prefix="/api/roles", tags=["角色管理"])

SCOPES = {"ALL", "DEPT_AND_CHILD", "DEPT", "SELF", "CUSTOM"}


def _ensure_seeded(db: Session) -> None:
    """首次访问时播种内置角色（幂等）。"""
    if db.query(func.count(SysRole.id)).scalar():
        return
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
    db.commit()


def _user_count(db: Session, code: str) -> int:
    try:
        enum_val = getattr(UserRole, code.upper())
    except AttributeError:
        return 0
    return db.query(func.count(User.id)).filter(User.role == enum_val).scalar() or 0


def _menu_ids(db: Session, role_id: int) -> list:
    return [m.menu_key for m in db.query(SysRoleMenu).filter(SysRoleMenu.role_id == role_id).all()]


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
        "sort": r.sort, "status": r.status, "builtin": bool(r.builtin), "remark": r.remark or "",
        "user_count": _user_count(db, r.code), "created_at": r.created_at.isoformat() if r.created_at else None,
        "menu_ids": _menu_ids(db, r.id),
    } for r in rows]
    return {"total": total, "items": items}


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
    keys = [str(k) for k in menu_ids if isinstance(k, (str, int))]
    db.query(SysRoleMenu).filter(SysRoleMenu.role_id == role_id).delete()
    for k in dict.fromkeys(keys):  # 去重保序
        db.add(SysRoleMenu(role_id=role_id, menu_key=k))
    db.commit()
    return {"ok": True, "count": len(dict.fromkeys(keys))}


@router.get("/my-menus")
def my_menus(current_user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    """当前登录账号的菜单授权：未配置（无授权行）返回 null，前端回退静态分组。"""
    code = current_user.role.value if isinstance(current_user.role, UserRole) else str(current_user.role)
    r = db.query(SysRole).filter(SysRole.code == code).first()
    if not r:
        return {"role": code, "menus": None}
    ids = _menu_ids(db, r.id)
    return {"role": code, "menus": ids if ids else None}
