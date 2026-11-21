"""
参数管理 API —— /api/configs（对齐 scaffold Configs.vue：面板 + 表格双视图数据源）

约定：
- sys_configs 表在 employee.db。
- 参数：分页 + 关键字（名称/键名）+ CSV 导出。
- builtin=True 为系统内置参数：不可删除、键名不可改（前端面板只读，锁图标）。
- config_type：Y 系统内置 / N 自定义。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.models import SysConfig

router = APIRouter(prefix="/api/configs", tags=["参数配置"])

# 内置参数种子（对齐 scaffold V2__seed_data.sql：3 参数）
_SEED = [
    (1, "用户管理-账号初始密码", "sys.user.initPassword", "Yy@123456", "Y", True, "初始化密码"),
    (2, "账号自助-验证码开关", "sys.account.captchaEnabled", "true", "Y", True, "是否开启登录验证码"),
    (3, "主框架-默认外观", "sys.index.appearance", "light", "N", False, "可选 light / dark / auto"),
]


def _csv_cell(value) -> str:
    text = "" if value is None else str(value)
    if '"' in text:
        text = text.replace('"', '""')
    if "," in text or '"' in text or "\n" in text or "\r" in text:
        return f'"{text}"'
    return text


def _ensure_seeded(db: Session) -> None:
    if db.query(SysConfig).first():
        return
    for _id, name, key, value, ctype, builtin, remark in _SEED:
        db.add(SysConfig(id=_id, config_name=name, config_key=key, config_value=value,
                         config_type=ctype, builtin=builtin, remark=remark))
    db.commit()


def _dict(c: SysConfig) -> dict:
    return {
        "id": c.id, "name": c.config_name, "key": c.config_key,
        "value": c.config_value, "type": c.config_type,
        "builtin": bool(c.builtin), "remark": c.remark or "",
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "create_time": c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else None,
    }


@router.get("")
def list_configs(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                 keyword: str = None,
                 _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    q = db.query(SysConfig)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(SysConfig.config_name.like(like), SysConfig.config_key.like(like)))
    total = q.count()
    rows = q.order_by(SysConfig.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_dict(c) for c in rows]}


@router.get("/export")
def export_configs(keyword: str = None,
                   _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    """参数导出 CSV（对齐 scaffold：参数名称/键名/键值/类型/备注）。"""
    _ensure_seeded(db)
    q = db.query(SysConfig)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(SysConfig.config_name.like(like), SysConfig.config_key.like(like)))
    rows = q.order_by(SysConfig.id.asc()).all()
    lines = ["参数名称,参数键名,参数值,类型,备注"]
    for c in rows:
        lines.append(",".join(_csv_cell(x) for x in [
            c.config_name, c.config_key, c.config_value,
            "系统内置" if c.builtin else "自定义", c.remark or "",
        ]))
    return Response(content="\n".join(lines), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="configs.csv"'})


def _validate(payload: dict, *, partial: bool = False) -> dict:
    import re
    data: dict = {}
    name = (payload.get("name") or "").strip()
    key = (payload.get("key") or "").strip()
    value = (payload.get("value") or "").strip()
    if not name and not partial:
        raise HTTPException(422, "参数名称必填")
    if not key and not partial:
        raise HTTPException(422, "参数键名必填")
    if not value and not partial:
        raise HTTPException(422, "参数值必填")
    if key and not re.match(r"^[A-Za-z][\w.\-]*$", key):
        raise HTTPException(422, "键名须以字母开头，仅含字母、数字、点、下划线、连字符")
    if name:
        data["config_name"] = name[:100]
    if key:
        data["config_key"] = key[:100]
    if "value" in payload:
        data["config_value"] = (payload.get("value") or "")[:500]
    if "builtin" in payload:
        data["builtin"] = bool(payload.get("builtin"))
        data["config_type"] = "Y" if data["builtin"] else "N"
    if "remark" in payload:
        data["remark"] = (payload.get("remark") or "").strip()[:500]
    return data


@router.post("")
def create_config(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    data = _validate(payload)
    if db.query(SysConfig).filter(SysConfig.config_key == data["config_key"]).first():
        raise HTTPException(422, "参数键名已存在")
    data.setdefault("config_type", "N")
    data.setdefault("builtin", False)
    c = SysConfig(**data)
    db.add(c)
    db.commit()
    return {"id": c.id}


@router.put("/{config_id}")
def update_config(config_id: int, payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    c = db.query(SysConfig).filter(SysConfig.id == config_id).first()
    if not c:
        raise HTTPException(404, "参数不存在")
    data = _validate(payload, partial=True)
    # 内置参数键名不可改
    if "config_key" in data and data["config_key"] != c.config_key and c.builtin:
        raise HTTPException(422, "内置参数键名不可修改")
    if "config_key" in data and data["config_key"] != c.config_key:
        if db.query(SysConfig).filter(SysConfig.config_key == data["config_key"]).first():
            raise HTTPException(422, "参数键名已存在")
    for f, v in data.items():
        setattr(c, f, v)
    db.commit()
    return {"ok": True}


@router.delete("/{config_id}")
def remove_config(config_id: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    c = db.query(SysConfig).filter(SysConfig.id == config_id).first()
    if not c:
        raise HTTPException(404, "参数不存在")
    if c.builtin:
        raise HTTPException(400, "内置参数不可删除")
    db.delete(c)
    db.commit()
    return {"ok": True}
