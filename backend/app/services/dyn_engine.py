"""
动态集合引擎 —— 元数据建集合 + 物理建表 + 自动 CRUD（NocoBase 风格）

物理表命名规则：dyn_<collection_name>。
"""
import json
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


def drop_collection(db: Session, name: str):
    c = db.query(DynCollection).filter(DynCollection.name == name).first()
    if not c:
        return False
    db.execute(text(f"DROP TABLE IF EXISTS {_table_name(name)}"))
    db.delete(c)
    db.commit()
    return True


def list_rows(db: Session, name: str, page: int = 1, page_size: int = 20) -> dict:
    _ensure_exists(db, name)
    t = _table_name(name)
    total = db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar() or 0
    rows = db.execute(text(f"SELECT * FROM {t} ORDER BY id DESC LIMIT :l OFFSET :o"),
                      {"l": page_size, "o": (page - 1) * page_size}).mappings().all()
    return {"total": total, "items": [dict(r) for r in rows]}


def insert_row(db: Session, name: str, data: dict) -> dict:
    _ensure_exists(db, name)
    t = _table_name(name)
    cols = ", ".join(data.keys())
    placeholders = ", ".join(f":{k}" for k in data.keys())
    db.execute(text(f"INSERT INTO {t} ({cols}) VALUES ({placeholders})"), data)
    db.commit()
    row_id = db.execute(text("SELECT last_insert_rowid()")).scalar()
    row = db.execute(text(f"SELECT * FROM {t} WHERE id = :i"), {"i": row_id}).mappings().first()
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
