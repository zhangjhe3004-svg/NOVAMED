"""
菜单管理 API —— /api/menus（对齐 scaffold Menus.vue：目录/页面/按钮三级菜单树 CRUD）

约定：
- menu_items 表在 employee.db；页面的 permission 存前端导航 key（与 sys_role_menus.menu_key 同源，
  角色授权数据无缝对接）；按钮的 permission 为 medicode:<key>:<action>。
- 首次访问播种内置菜单树（5 目录 + 31 页面 + 每页 4 个标准按钮），与前端导航配置一致。
- 内置页面/目录 builtin=True：可编辑（改名/排序/显隐）但删除按钮级不受限；目录删除需先清空子项。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.models import MenuItem

router = APIRouter(prefix="/api/menus", tags=["菜单管理"])

TYPES = ("dir", "menu", "btn")

# 内置菜单树种子（与前端 config/nav.tsx 的 buildNavGroups 同源）
_SEED_DIRS = [
    ("工作空间", "dashboard-group", "/dashboard", 1, False, [
        ("dashboard", "总览控制台", "/dashboard"),
        ("messages", "消息", "/messages"),
        ("tasks", "定时任务", "/tasks"),
        ("hub", "专家·技能·连接器", "/hub"),
    ]),
    ("诊疗", "clinical-group", "/doctor-workbench", 2, False, [
        ("workbench", "医生工作台", "/doctor-workbench"),
        ("patients", "患者档案", "/patients"),
        ("records", "就诊记录", "/records"),
        ("supervise", "下级审阅", "/supervise-records"),
        ("slots", "号源排班", "/schedule-source"),
        ("pharmacy", "药房管理", "/pharmacy"),
        ("labTest", "检查检验", "/labtest"),
        ("billing", "财务收费", "/billing"),
    ]),
    ("日常办公", "office-group", "/lcp/staff-schedule", 3, False, [
        ("schedule", "排班表", "/lcp/staff-schedule"),
        ("announcement", "院内公告", "/lcp/staff-announcement"),
        ("leave", "请假审批", "/lcp/staff-leave"),
        ("departments", "科室组织", "/lcp/staff-departments"),
        ("orgCanvas", "组织画布", "/org-canvas"),
        ("nearby", "附近互传", "/nearby"),
    ]),
    ("智能辅助", "intelligence-group", "/ai-assistant", 4, False, [
        ("ai", "AI 辅助诊断", "/ai-assistant"),
        ("knowledge", "医学知识库", "/knowledge"),
        ("analytics", "运营数据", "/analytics"),
    ]),
    ("系统管理", "admin-group", "/users", 5, True, [
        ("adminReview", "管理员审核", "/admin-review"),
        ("users", "用户管理", "/users"),
        ("trace", "角色管理", "/role-trace"),
        ("menuStar", "菜单管理", "/menu-star"),
        ("ladder", "岗位阶梯", "/post-ladder"),
        ("chain", "权限链路", "/permission-chain"),
        ("loginLog", "登录日志", "/login-log"),
        ("operLog", "操作日志", "/oper-log"),
        ("patientAccounts", "患者账号", "/patient-accounts"),
        ("settings", "个人设置", "/settings"),
    ]),
]

# 每个页面挂的标准按钮（对齐 scaffold 的按钮级权限四件套）
_BTN_TEMPLATES = [("list", "查询"), ("add", "新增"), ("edit", "编辑"), ("remove", "删除")]


def _ensure_seeded(db: Session) -> None:
    """首次访问播种内置菜单树（幂等）。"""
    if db.query(MenuItem.id).count():
        return
    for dir_name, _key, path, sort, admin_only, pages in _SEED_DIRS:
        d = MenuItem(parent_id=0, type="dir", name=dir_name, icon="", path=path,
                     component="", permission="", sort=sort, visible=1, status=1,
                     builtin=True)
        db.add(d)
        db.flush()
        for pi, (key, name, ppath) in enumerate(pages):
            m = MenuItem(parent_id=d.id, type="menu", name=name, icon="", path=ppath,
                         component=f"pages/{key}/index", permission=key,
                         sort=pi + 1, visible=1, status=1, builtin=True)
            db.add(m)
            db.flush()
            for act, act_name in _BTN_TEMPLATES:
                db.add(MenuItem(parent_id=m.id, type="btn", name=act_name, icon="",
                                path="", component="", permission=f"medicode:{key}:{act}",
                                sort=_BTN_TEMPLATES.index((act, act_name)) + 1,
                                visible=1, status=1, builtin=True))
    db.commit()


def _dict(m: MenuItem) -> dict:
    return {
        "id": m.id, "parent_id": m.parent_id, "type": m.type, "name": m.name,
        "icon": m.icon or "", "path": m.path or "", "component": m.component or "",
        "permission": m.permission or "", "sort": m.sort, "visible": m.visible,
        "status": m.status, "builtin": bool(m.builtin),
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _validate_payload(payload: dict, *, partial: bool = False) -> dict:
    data: dict = {}
    if "type" in payload or not partial:
        t = payload.get("type") or "menu"
        if t not in TYPES:
            raise HTTPException(422, "菜单类型必须是 dir / menu / btn")
        data["type"] = t
    name = (payload.get("name") or "").strip()
    if not name and not partial:
        raise HTTPException(422, "菜单名称必填")
    if name:
        data["name"] = name[:50]
    for f, lim in (("icon", 50), ("path", 120), ("component", 120), ("permission", 80)):
        if f in payload:
            data[f] = (payload.get(f) or "").strip()[:lim]
    for f in ("parent_id", "sort", "visible", "status"):
        if f in payload and payload[f] is not None:
            data[f] = int(payload[f])
    if data.get("type") == "btn":
        data["path"] = ""
        data["component"] = ""
        if not partial and not data.get("permission"):
            raise HTTPException(422, "按钮必须填写权限标识")
    if data.get("type") == "menu" and not partial and not data.get("component"):
        raise HTTPException(422, "页面必须填写组件路径")
    if data.get("type") == "menu" and not partial and not (data.get("path") or "").startswith("/"):
        raise HTTPException(422, "路由路径以 / 开头")
    return data


@router.get("/tree")
def menu_tree(keyword: str = None, status: str = None,
             _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    """完整菜单树；keyword 匹配名称/权限标识（保留命中项的祖先链），status 过滤。"""
    _ensure_seeded(db)
    rows = db.query(MenuItem).order_by(MenuItem.sort.asc(), MenuItem.id.asc()).all()
    by_id = {m.id: m for m in rows}
    children: dict[int, list] = {}
    for m in rows:
        children.setdefault(m.parent_id, []).append(m)

    keep: set[int] | None = None
    if keyword:
        kw = keyword.strip().lower()
        keep = set()
        for m in rows:
            if kw in m.name.lower() or kw in (m.permission or "").lower():
                keep.add(m.id)
                cur = m
                while cur.parent_id and cur.parent_id in by_id:
                    cur = by_id[cur.parent_id]
                    keep.add(cur.id)
    if status not in (None, ""):
        st = int(status)
        s_keep: set[int] = set()
        for m in rows:
            if m.status == st:
                s_keep.add(m.id)
                cur = m
                while cur.parent_id and cur.parent_id in by_id:
                    cur = by_id[cur.parent_id]
                    s_keep.add(cur.id)
        keep = s_keep if keep is None else (keep & s_keep)

    def build(pid: int) -> list:
        out = []
        for m in children.get(pid, []):
            if keep is not None and m.id not in keep:
                continue
            d = _dict(m)
            kids = build(m.id)
            if kids:
                d["children"] = kids
            out.append(d)
        return out

    return {"items": build(0), "total": len(rows)}


@router.post("")
def create_menu(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    data = _validate_payload(payload)
    parent_id = data.get("parent_id", 0)
    if parent_id:
        parent = db.query(MenuItem).filter(MenuItem.id == parent_id).first()
        if not parent:
            raise HTTPException(422, "上级菜单不存在")
        if parent.type == "btn":
            raise HTTPException(422, "按钮下不能挂子项")
        if data.get("type") == "dir":
            raise HTTPException(422, "目录只能挂在顶级")
    m = MenuItem(builtin=False, **data)
    db.add(m)
    db.commit()
    return {"id": m.id}


@router.put("/{menu_id}")
def update_menu(menu_id: int, payload: dict,
                _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    m = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not m:
        raise HTTPException(404, "菜单不存在")
    data = _validate_payload(payload, partial=True)
    if "parent_id" in data and data["parent_id"] != m.parent_id:
        new_parent = data["parent_id"]
        if new_parent:
            if new_parent == m.id:
                raise HTTPException(422, "上级菜单不能是自己")
            parent = db.query(MenuItem).filter(MenuItem.id == new_parent).first()
            if not parent:
                raise HTTPException(422, "上级菜单不存在")
            if parent.type == "btn":
                raise HTTPException(422, "按钮下不能挂子项")
            # 不能移到自己子孙名下
            cur = parent
            while cur.parent_id:
                if cur.parent_id == m.id:
                    raise HTTPException(422, "上级菜单不能是自己的子项")
                cur = db.query(MenuItem).filter(MenuItem.id == cur.parent_id).first()
        m.parent_id = new_parent
    for f, v in data.items():
        if f != "parent_id":
            setattr(m, f, v)
    db.commit()
    return {"ok": True}


@router.delete("/{menu_id}")
def remove_menu(menu_id: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    m = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not m:
        raise HTTPException(404, "菜单不存在")
    kids = db.query(MenuItem.id).filter(MenuItem.parent_id == menu_id).count()
    if kids:
        raise HTTPException(400, f"「{m.name}」下还有 {kids} 个子项，需先删除子项")
    db.delete(m)
    db.commit()
    return {"ok": True}
