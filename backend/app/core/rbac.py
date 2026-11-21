"""
RBAC 助手 —— 多角色授权（对齐 scaffold sys_user_role）与授权粒度迁移（menu_key → menu_id）。

设计约定（2026-10 RBAC 迁移，用户选择 B 方案）：
- sys_user_role（user_id, role_id 复合主键）是用户角色的**唯一权威来源**，支持多角色叠加。
- users.role 枚举**保留**作为「主角色」提示：向后兼容 21 个后端文件与 30+ 前端文件里
  对 `user.role === "admin"` 之类的单角色判断；由 sync_user_primary_role 在角色变更时
  按 ROLE_PRIORITY 同步为最高优先级的可枚举角色（super_admin 映射回 ADMIN）。
- sys_role_menus.menu_id（整数，指向 menu_items.id，含 dir/menu/btn 三级）是角色授权的
  权威粒度；legacy 的 menu_key（字符串导航 key）由 migrate_role_menus 一次性迁移到 menu_id。
"""
from typing import List

from sqlalchemy.orm import Session

from ..models.models import User, UserRole, SysRole, SysRoleMenu, SysUserRole, MenuItem

# 主角色优先级：排前面的角色被选为 users.role（super_admin 会映射回 ADMIN）
ROLE_PRIORITY = ["super_admin", "admin", "senior", "doctor", "nurse", "pharmacist", "maintainer", "staff"]

# 标准角色的静态可见分组（对齐前端 config/nav.tsx 的 ROLE_LABELS.groups，供首次播种角色菜单授权）
ROLE_GROUPS: dict[str, list[str]] = {
    "doctor": ["工作空间", "诊疗", "日常办公", "智能辅助"],
    "nurse": ["工作空间", "诊疗", "日常办公"],
    "pharmacist": ["工作空间", "诊疗", "日常办公"],
    "senior": ["工作空间", "诊疗", "日常办公", "智能辅助"],
    "maintainer": ["工作空间", "智能辅助", "系统管理"],
    "staff": ["工作空间", "日常办公"],
}


def _legacy_code(user: User) -> str:
    return user.role.value if isinstance(user.role, UserRole) else str(user.role or "")


def get_user_role_codes(db: Session, user: User) -> List[str]:
    """用户持有的全部角色编码（sys_user_role 权威；空则回退 users.role 兼容旧数据）。"""
    rows = (
        db.query(SysRole.code)
        .join(SysUserRole, SysUserRole.role_id == SysRole.id)
        .filter(SysUserRole.user_id == user.id)
        .all()
    )
    codes = [r[0] for r in rows if r[0]]
    if not codes:
        c = _legacy_code(user)
        if c:
            codes = [c]
    return codes


def get_user_roles(db: Session, user: User) -> List[SysRole]:
    codes = get_user_role_codes(db, user)
    if not codes:
        return []
    return db.query(SysRole).filter(SysRole.code.in_(codes)).all()


def primary_role_code(db: Session, user: User) -> str:
    codes = get_user_role_codes(db, user)
    for p in ROLE_PRIORITY:
        if p in codes:
            return p
    return codes[0] if codes else (_legacy_code(user) or "staff")


def _to_enum(code: str):
    if code == "super_admin":
        return UserRole.ADMIN
    try:
        return UserRole(code)
    except ValueError:
        return None


def has_role(db: Session, user: User, *codes: str) -> bool:
    return bool(set(get_user_role_codes(db, user)) & set(codes))


def sync_user_primary_role(db: Session, user: User) -> None:
    """将 users.role 同步为最高优先级主角色（仅当可映射到枚举时）。"""
    pc = primary_role_code(db, user)
    e = _to_enum(pc)
    if e is not None and user.role != e:
        user.role = e


def set_user_roles(db: Session, user: User, role_codes: List[str]) -> None:
    """替换用户角色（sys_user_role），并同步主角色。

    主角色直接从传入的 codes 计算（不依赖查询可见性），避免 autoflush=False 下
    delete+add 未提交时 re-query 读不到新关联导致的「主角色不同步」。
    """
    db.query(SysUserRole).filter(SysUserRole.user_id == user.id).delete(synchronize_session=False)
    codes: List[str] = []
    for code in role_codes:
        code = (code or "").strip()
        if not code or code in codes:
            continue
        role = db.query(SysRole).filter(SysRole.code == code).first()
        if role:
            codes.append(code)
            db.add(SysUserRole(user_id=user.id, role_id=role.id))
    pc = next((p for p in ROLE_PRIORITY if p in codes), (codes[0] if codes else _legacy_code(user)))
    e = _to_enum(pc)
    if e is not None and user.role != e:
        user.role = e


def ensure_user_roles_backfill(db: Session) -> int:
    """幂等回填：仅对「完全没有 sys_user_role 行」的用户按 users.role 建立关联。

    已有角色关联的用户不重加 legacy 角色（避免与 set_user_roles 的增删互相打架），
    只做主角色同步。
    """
    role_by_code = {r.code: r for r in db.query(SysRole).all()}
    added = 0
    dirty = False
    for u in db.query(User).all():
        has_any = db.query(SysUserRole).filter(SysUserRole.user_id == u.id).first()
        if has_any:
            before = u.role
            sync_user_primary_role(db, u)
            if u.role != before:
                dirty = True
            continue
        code = _legacy_code(u)
        role = role_by_code.get(code)
        if not role:
            continue
        db.add(SysUserRole(user_id=u.id, role_id=role.id))
        added += 1
        dirty = True
        sync_user_primary_role(db, u)
    if dirty:
        db.commit()
    return added


def role_menu_ids(db: Session, role_id: int) -> List[int]:
    return [
        m.menu_id
        for m in db.query(SysRoleMenu).filter(SysRoleMenu.role_id == role_id).all()
        if m.menu_id is not None
    ]


def migrate_role_menus(db: Session) -> int:
    """一次性迁移：把 legacy 的 sys_role_menus.menu_key（导航 key）解析为 menu_id 整数。"""
    legacy = db.query(SysRoleMenu).filter(
        SysRoleMenu.menu_key.isnot(None), SysRoleMenu.menu_key != ""
    ).all()
    if not legacy:
        return 0
    perm_to_id = {
        m.permission: m.id
        for m in db.query(MenuItem).filter(MenuItem.type == "menu", MenuItem.permission != "").all()
    }
    converted = 0
    for row in legacy:
        mid = perm_to_id.get(row.menu_key)
        if mid is None:
            db.delete(row)  # 无法解析的旧 key 直接丢弃
            continue
        exists = db.query(SysRoleMenu).filter(
            SysRoleMenu.role_id == row.role_id, SysRoleMenu.menu_id == mid
        ).first()
        if not exists:
            db.add(SysRoleMenu(role_id=row.role_id, menu_id=mid, menu_key=""))
            converted += 1
        db.delete(row)
    db.commit()
    return converted
