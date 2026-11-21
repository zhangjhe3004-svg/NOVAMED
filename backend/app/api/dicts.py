"""
字典管理 API —— /api/dict-types、/api/dict-data、/api/dict-options（对齐 scaffold Dict.vue）

约定：
- sys_dict_types / sys_dict_data 表在 employee.db。
- 字典类型：分页 + 关键字（名称/编码）+ 状态过滤 + CSV 导出。
- 字典数据：按 dict_type 取全部（数量少不分页），按 sort 升序；含 tone（标签色调）与 is_default（默认项）。
- /dict-options/{dict_type} 供业务下拉复用，仅返回启用项（对齐 scaffold /system/dict/options）。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.models import SysDictType, SysDictData

router = APIRouter(tags=["字典管理"])

# 内置字典种子（对齐 scaffold V2__seed_data.sql：3 类型 + 7 数据）
_SEED_TYPES = [
    (1, "用户性别", "sys_user_sex", 1, "用户性别列表"),
    (2, "系统开关", "sys_normal_disable", 1, "系统正常 / 停用状态"),
    (3, "是否", "sys_yes_no", 1, "通用是 / 否选项"),
]
_SEED_DATA = [
    (1, "sys_user_sex", "男", "0", 1, 1, "info", 1),
    (2, "sys_user_sex", "女", "1", 2, 1, "purple", 0),
    (3, "sys_user_sex", "未知", "2", 3, 1, "neutral", 0),
    (4, "sys_normal_disable", "正常", "1", 1, 1, "ok", 1),
    (5, "sys_normal_disable", "停用", "0", 2, 1, "danger", 0),
    (6, "sys_yes_no", "是", "Y", 1, 1, "ok", 1),
    (7, "sys_yes_no", "否", "N", 2, 1, "neutral", 0),
]


def _csv_cell(value) -> str:
    text = "" if value is None else str(value)
    if '"' in text:
        text = text.replace('"', '""')
    if "," in text or '"' in text or "\n" in text or "\r" in text:
        return f'"{text}"'
    return text


def _ensure_seeded(db: Session) -> None:
    if not db.query(func.count(SysDictType.id)).scalar():
        for _id, name, code, status, remark in _SEED_TYPES:
            db.add(SysDictType(id=_id, dict_name=name, dict_type=code, status=status, remark=remark))
        db.commit()
    if not db.query(func.count(SysDictData.id)).scalar():
        for _id, code, label, value, sort, status, tone, default in _SEED_DATA:
            db.add(SysDictData(id=_id, dict_type=code, dict_label=label, dict_value=value,
                               sort=sort, status=status, tone=tone, is_default=default))
        db.commit()


def _type_dict(t: SysDictType) -> dict:
    return {
        "id": t.id, "dict_name": t.dict_name, "dict_type": t.dict_type,
        "status": t.status, "remark": t.remark or "",
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "create_time": t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else None,
    }


def _data_dict(d: SysDictData) -> dict:
    return {
        "id": d.id, "dict_type": d.dict_type,
        "label": d.dict_label, "value": d.dict_value,
        "sort": d.sort, "status": d.status,
        "tone": d.tone or "", "def": bool(d.is_default), "remark": d.remark or "",
    }


# ───────────────────────── 字典类型 ─────────────────────────

@router.get("/api/dict-types")
def list_types(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
               keyword: str = None, status: str = None,
               _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    q = db.query(SysDictType)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(SysDictType.dict_name.like(like), SysDictType.dict_type.like(like)))
    if status not in (None, ""):
        q = q.filter(SysDictType.status == int(status))
    total = q.count()
    rows = q.order_by(SysDictType.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_type_dict(t) for t in rows]}


@router.get("/api/dict-types/export")
def export_types(keyword: str = None, status: str = None,
                 _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    """字典类型导出 CSV（对齐 scaffold：字典名称/字典类型/状态/备注/创建时间）。"""
    _ensure_seeded(db)
    q = db.query(SysDictType)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(SysDictType.dict_name.like(like), SysDictType.dict_type.like(like)))
    if status not in (None, ""):
        q = q.filter(SysDictType.status == int(status))
    rows = q.order_by(SysDictType.id.asc()).all()
    lines = ["字典名称,字典类型,状态,备注,创建时间"]
    for t in rows:
        lines.append(",".join(_csv_cell(c) for c in [
            t.dict_name, t.dict_type, "正常" if t.status == 1 else "停用", t.remark or "",
            t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "",
        ]))
    return Response(content="\n".join(lines), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="dict-types.csv"'})


def _validate_type(payload: dict, *, partial: bool = False) -> dict:
    data: dict = {}
    name = (payload.get("dict_name") or "").strip()
    code = (payload.get("dict_type") or "").strip()
    if not name and not partial:
        raise HTTPException(422, "字典名称必填")
    if not code and not partial:
        raise HTTPException(422, "字典类型必填")
    if code:
        import re
        if not re.match(r"^[a-z][a-z0-9_]*$", code):
            raise HTTPException(422, "字典类型须以小写字母开头，仅含小写字母、数字、下划线")
        data["dict_type"] = code[:100]
    if name:
        data["dict_name"] = name[:100]
    for f in ("status",):
        if f in payload and payload[f] is not None:
            data[f] = int(payload[f])
    if "remark" in payload:
        data["remark"] = (payload.get("remark") or "").strip()[:500]
    return data


@router.post("/api/dict-types")
def create_type(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    data = _validate_type(payload)
    if db.query(SysDictType).filter(SysDictType.dict_type == data["dict_type"]).first():
        raise HTTPException(422, "字典类型编码已存在")
    t = SysDictType(**data)
    db.add(t)
    db.commit()
    return {"id": t.id}


@router.put("/api/dict-types/{type_id}")
def update_type(type_id: int, payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    t = db.query(SysDictType).filter(SysDictType.id == type_id).first()
    if not t:
        raise HTTPException(404, "字典类型不存在")
    data = _validate_type(payload, partial=True)
    if "dict_type" in data and data["dict_type"] != t.dict_type:
        if db.query(SysDictType).filter(SysDictType.dict_type == data["dict_type"]).first():
            raise HTTPException(422, "字典类型编码已存在")
        # 同步修改该类型下所有字典数据的外键编码
        db.query(SysDictData).filter(SysDictData.dict_type == t.dict_type).update(
            {SysDictData.dict_type: data["dict_type"]})
    for f, v in data.items():
        setattr(t, f, v)
    db.commit()
    return {"ok": True}


@router.delete("/api/dict-types/{type_id}")
def remove_type(type_id: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    t = db.query(SysDictType).filter(SysDictType.id == type_id).first()
    if not t:
        raise HTTPException(404, "字典类型不存在")
    db.query(SysDictData).filter(SysDictData.dict_type == t.dict_type).delete(synchronize_session=False)
    db.delete(t)
    db.commit()
    return {"ok": True}


# ───────────────────────── 字典数据 ─────────────────────────

@router.get("/api/dict-data/{dict_type}")
def list_data(dict_type: str, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_seeded(db)
    rows = (db.query(SysDictData).filter(SysDictData.dict_type == dict_type)
            .order_by(SysDictData.sort.asc(), SysDictData.id.asc()).all())
    return [_data_dict(d) for d in rows]


def _validate_data(payload: dict) -> dict:
    label = (payload.get("label") or "").strip()
    value = (payload.get("value") or "").strip()
    if not label:
        raise HTTPException(422, "标签必填")
    if not value:
        raise HTTPException(422, "键值必填")
    return {
        "dict_type": (payload.get("dict_type") or "").strip()[:100],
        "dict_label": label[:100],
        "dict_value": value[:100],
        "sort": int(payload.get("sort") or 0),
        "status": int(payload.get("status") or 1),
        "tone": (payload.get("tone") or "neutral").strip()[:32],
        "is_default": 1 if payload.get("def") else 0,
        "remark": (payload.get("remark") or "").strip()[:500],
    }


@router.post("/api/dict-data")
def create_data(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    data = _validate_data(payload)
    if not data["dict_type"]:
        raise HTTPException(422, "字典类型缺失")
    if data["is_default"]:
        db.query(SysDictData).filter(SysDictData.dict_type == data["dict_type"]).update(
            {SysDictData.is_default: 0})
    d = SysDictData(**data)
    db.add(d)
    db.commit()
    return {"id": d.id}


@router.put("/api/dict-data/{data_id}")
def update_data(data_id: int, payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    d = db.query(SysDictData).filter(SysDictData.id == data_id).first()
    if not d:
        raise HTTPException(404, "字典数据不存在")
    data = _validate_data(payload)
    if not data["dict_type"]:
        data["dict_type"] = d.dict_type
    if data["is_default"]:
        db.query(SysDictData).filter(SysDictData.dict_type == data["dict_type"]).update(
            {SysDictData.is_default: 0})
    for f, v in data.items():
        setattr(d, f, v)
    db.commit()
    return {"ok": True}


@router.delete("/api/dict-data/{data_id}")
def remove_data(data_id: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    d = db.query(SysDictData).filter(SysDictData.id == data_id).first()
    if not d:
        raise HTTPException(404, "字典数据不存在")
    db.delete(d)
    db.commit()
    return {"ok": True}


# ───────────────────────── 业务选项 ─────────────────────────

@router.get("/api/dict-options/{dict_type}")
def dict_options(dict_type: str, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    """业务下拉选项：仅返回启用项（对齐 scaffold /system/dict/options/{dictType}）。"""
    _ensure_seeded(db)
    rows = (db.query(SysDictData).filter(SysDictData.dict_type == dict_type, SysDictData.status == 1)
            .order_by(SysDictData.sort.asc(), SysDictData.id.asc()).all())
    return [{"label": d.dict_label, "value": d.dict_value, "tone": d.tone or ""} for d in rows]
