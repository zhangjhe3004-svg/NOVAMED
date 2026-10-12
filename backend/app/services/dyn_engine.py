"""
动态集合引擎 —— 元数据建集合 + 物理建表 + 自动 CRUD（NocoBase 风格）

物理表命名规则：dyn_<collection_name>。
"""
import json
import re
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models.workspace import DynCollection


def _table_name(name: str) -> str:
    return f"dyn_{name}"


def list_collections(db: Session) -> List[dict]:
    """列出所有动态集合（含字段定义）"""
    rows = db.query(DynCollection).order_by(DynCollection.id.asc()).all()
    return [_collection_dict(c) for c in rows]


def get_collection(db: Session, name: str) -> Optional[dict]:
    c = db.query(DynCollection).filter(DynCollection.name == name).first()
    return _collection_dict(c) if c else None


def _collection_dict(c: DynCollection) -> dict:
    try:
        fields = json.loads(c.fields_json or "[]")
    except Exception:
        fields = []
    return {
        "id": c.id,
        "name": c.name,
        "title": c.title,
        "description": c.description,
        "fields": fields,
        "enabled": bool(c.enabled),
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def create_collection(db: Session, name: str, title: str,
                      fields: Optional[List[dict]] = None, description: str = "") -> dict:
    """创建集合元数据并物理建表（幂等）"""
    fields = fields or [{"name": "id", "type": "integer", "primary": True}]
    if not any(f.get("name") == "id" for f in fields):
        fields.insert(0, {"name": "id", "type": "integer", "primary": True})

    existing = db.query(DynCollection).filter(DynCollection.name == name).first()
    if existing:
        existing.title = title
        existing.description = description
        existing.fields_json = json.dumps(fields, ensure_ascii=False)
    else:
        existing = DynCollection(name=name, title=title, description=description,
                                 fields_json=json.dumps(fields, ensure_ascii=False))
        db.add(existing)
    db.commit()

    _create_table(db, name, fields)
    return _collection_dict(existing)


def _create_table(db: Session, name: str, fields: List[dict]):
    cols = []
    for f in fields:
        fname = f.get("name", "")
        ftype = (f.get("type") or "string").lower()
        if f.get("primary"):
            cols.append(f"{fname} INTEGER PRIMARY KEY AUTOINCREMENT")
        elif ftype in ("integer", "int", "number"):
            cols.append(f"{fname} INTEGER")
        elif ftype in ("float", "double"):
            cols.append(f"{fname} REAL")
        elif ftype in ("boolean", "bool"):
            cols.append(f"{fname} INTEGER DEFAULT 0")
        elif ftype in ("text", "longtext", "rich"):
            cols.append(f"{fname} TEXT")
        else:
            cols.append(f"{fname} TEXT")
    ddl = f"CREATE TABLE IF NOT EXISTS {_table_name(name)} ({', '.join(cols)})"
    db.execute(text(ddl))
    db.commit()
    # 已存在的物理表补齐新增列（幂等；CREATE TABLE IF NOT EXISTS 不会改旧表结构）
    try:
        existing_cols = {row[1] for row in
                         db.execute(text(f"PRAGMA table_info({_table_name(name)})")).fetchall()}
        for f in fields:
            fname = f.get("name", "")
            if fname and not f.get("primary") and fname not in existing_cols:
                _add_column(db, name, fname, f.get("type"))
    except Exception:
        db.rollback()


def drop_collection(db: Session, name: str):
    c = db.query(DynCollection).filter(DynCollection.name == name).first()
    if not c:
        return False
    db.execute(text(f"DROP TABLE IF EXISTS {_table_name(name)}"))
    db.delete(c)
    db.commit()
    return True


_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def list_rows(db: Session, name: str, page: int = 1, page_size: int = 20,
              filters: Optional[Dict[str, Any]] = None) -> dict:
    _ensure_exists(db, name)
    t = _table_name(name)
    params: Dict[str, Any] = {"l": page_size, "o": (page - 1) * page_size}
    where = ""
    if filters:
        conds = []
        for i, (k, v) in enumerate(filters.items()):
            # 字段名只允许合法标识符，值一律走绑定参数，防注入
            if not _IDENT_RE.match(str(k)):
                continue
            conds.append(f"{k} = :flt_{i}")
            params[f"flt_{i}"] = v
        if conds:
            where = " WHERE " + " AND ".join(conds)
    total = db.execute(text(f"SELECT COUNT(*) FROM {t}{where}"), params).scalar() or 0
    rows = db.execute(text(f"SELECT * FROM {t}{where} ORDER BY id DESC LIMIT :l OFFSET :o"),
                      params).mappings().all()
    return {"total": total, "items": [dict(r) for r in rows]}


def insert_row(db: Session, name: str, data: dict) -> dict:
    _ensure_exists(db, name)
    t = _table_name(name)
    cols = ", ".join(data.keys())
    placeholders = ", ".join(f":{k}" for k in data.keys())
    # 用 RETURNING id 原子取回新行主键（同一连接，不受连接池影响）。
    # 旧实现 commit 后再 SELECT last_insert_rowid() 会拿到 0/陈旧值，
    # 导致返回 id=0、工作流实例 row_id=0、审批结果无法回写动态行。
    try:
        row_id = db.execute(
            text(f"INSERT INTO {t} ({cols}) VALUES ({placeholders}) RETURNING id"), data
        ).scalar()
    except Exception:
        result = db.execute(text(f"INSERT INTO {t} ({cols}) VALUES ({placeholders})"), data)
        row_id = getattr(result, "lastrowid", None)
    row = db.execute(text(f"SELECT * FROM {t} WHERE id = :i"), {"i": row_id}).mappings().first()
    db.commit()
    return dict(row) if row else {"id": row_id}


def update_row(db: Session, name: str, row_id: int, data: dict) -> Optional[dict]:
    _ensure_exists(db, name)
    t = _table_name(name)
    sets = ", ".join(f"{k} = :{k}" for k in data.keys())
    db.execute(text(f"UPDATE {t} SET {sets} WHERE id = :_id"), {**data, "_id": row_id})
    db.commit()
    row = db.execute(text(f"SELECT * FROM {t} WHERE id = :i"), {"i": row_id}).mappings().first()
    return dict(row) if row else None


def delete_row(db: Session, name: str, row_id: int) -> bool:
    _ensure_exists(db, name)
    t = _table_name(name)
    db.execute(text(f"DELETE FROM {t} WHERE id = :i"), {"i": row_id})
    db.commit()
    return True


def _ensure_exists(db: Session, name: str):
    c = db.query(DynCollection).filter(DynCollection.name == name).first()
    if not c:
        raise KeyError(f"集合不存在: {name}")


def patch_collection(db: Session, name: str, payload: dict) -> dict:
    """更新集合元数据（标题/描述/启用状态/字段），并为新增字段加列。"""
    c = db.query(DynCollection).filter(DynCollection.name == name).first()
    if not c:
        raise KeyError(f"集合不存在: {name}")

    old_fields = []
    try:
        old_fields = json.loads(c.fields_json or "[]")
    except Exception:
        old_fields = []

    if "title" in payload:
        c.title = payload["title"]
    if "description" in payload:
        c.description = payload["description"]
    if "enabled" in payload:
        c.enabled = bool(payload["enabled"])

    new_fields = old_fields
    if "fields" in payload:
        new_fields = payload["fields"] or old_fields
        if not any(f.get("name") == "id" for f in new_fields):
            new_fields.insert(0, {"name": "id", "type": "integer", "primary": True})
        c.fields_json = json.dumps(new_fields, ensure_ascii=False)

    old_names = {f.get("name") for f in old_fields}
    for f in new_fields:
        fname = f.get("name", "")
        if not fname or fname in old_names or f.get("primary"):
            continue
        _add_column(db, name, fname, f.get("type"))

    db.commit()
    return _collection_dict(c)


def _add_column(db: Session, name: str, fname: str, ftype: str):
    ftype = (ftype or "string").lower()
    if ftype in ("integer", "int", "number"):
        col_type = "INTEGER"
    elif ftype in ("float", "double"):
        col_type = "REAL"
    elif ftype in ("boolean", "bool"):
        col_type = "INTEGER DEFAULT 0"
    else:
        col_type = "TEXT"
    db.execute(text(f"ALTER TABLE {_table_name(name)} ADD COLUMN {fname} {col_type}"))
