"""
代码生成 API —— /api/generator（对齐 scaffold /tool/generator：三步流水线代码生成器）

能力：
- 从当前 SQLite 员工库（employee.db）内省真实数据表（sqlite_master + PRAGMA table_info）。
- 导入表 → 生成表配置（gen_tables）+ 字段映射（gen_table_columns）。
- 表信息 / 字段映射 / 代码预览 三步流水线；预览 7 个文件（后端 model/api/schemas、
  前端 api/page/style、菜单 SQL），按 scaffold 目录结构组织。
- 生成并下载 ZIP。

约定：
- gen_tables / gen_table_columns 在 employee.db。
- 全部接口 require_admin（对齐 scaffold 权限码 tool:gen:list）。
- 生成代码适配 NOVAMED 技术栈（Python/FastAPI + React/TSX），对应 scaffold 的
  Java/Spring + Vue 四层骨架，字段语义一致（数据库字段 → 模型字段 → 页面呈现）。
"""
import io
import re
import zipfile
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import require_admin
from ..models.models import GenTable, GenTableColumn, User

router = APIRouter(prefix="/api/generator", tags=["代码生成"])

_TABLE_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")
_MODULE_DEFAULT = "system"

# SQLite 声明类型 → (Python 类型, 表单控件类型, SQLAlchemy 列类型)
_TYPE_MAP = {
    "int": ("int", "数字框", "Integer"),
    "integer": ("int", "数字框", "Integer"),
    "bigint": ("int", "数字框", "Integer"),
    "smallint": ("int", "数字框", "Integer"),
    "tinyint": ("int", "数字框", "Integer"),
    "real": ("float", "数字框", "Float"),
    "float": ("float", "数字框", "Float"),
    "double": ("float", "数字框", "Float"),
    "decimal": ("float", "数字框", "Float"),
    "numeric": ("float", "数字框", "Float"),
    "bool": ("bool", "开关", "Boolean"),
    "boolean": ("bool", "开关", "Boolean"),
    "datetime": ("datetime", "日期框", "DateTime"),
    "timestamp": ("datetime", "日期框", "DateTime"),
    "date": ("datetime", "日期框", "DateTime"),
    "time": ("datetime", "日期框", "DateTime"),
    "blob": ("bytes", "文本框", "LargeBinary"),
    "text": ("str", "文本域", "Text"),
    "longtext": ("str", "文本域", "Text"),
    "mediumtext": ("str", "文本域", "Text"),
    "clob": ("str", "文本域", "Text"),
}


# ============================================================ 命名规则（对齐 scaffold GeneratorService）


def _split_parts(table_name: str) -> List[str]:
    return [p for p in table_name.split("_") if p]


def _upper_camel(value: str) -> str:
    parts = _split_parts(value)
    if not parts:
        return value or "Table"
    return "".join(p[0].upper() + p[1:] for p in parts)


def _lower_camel(value: str) -> str:
    parts = _split_parts(value)
    if not parts:
        return value
    return parts[0] + "".join(p[0].upper() + p[1:] for p in parts[1:])


def _module_name(table_name: str) -> str:
    parts = _split_parts(table_name)
    module = parts[0] if parts else _MODULE_DEFAULT
    return "system" if module == "sys" else module


def _business_name(table_name: str) -> str:
    parts = _split_parts(table_name)
    raw = "_".join(parts[1:]) if len(parts) > 1 else table_name
    return _lower_camel(raw) if "_" in raw else raw


def _query_field(column_name: str) -> bool:
    lower = column_name.lower()
    return any(k in lower for k in ("name", "code", "status", "type", "title", "phone", "email"))


def _norm_type(declared: str) -> str:
    """取 SQLite 声明类型的首段并小写（如 VARCHAR(50) → varchar）。"""
    if not declared:
        return "text"
    first = declared.strip().split("(")[0].split(" ")[0].lower()
    return first or "text"


# ============================================================ SQLite 内省


def _list_db_tables(db: Session) -> List[str]:
    rows = db.execute(text(
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )).fetchall()
    return [r[0] for r in rows]


def _table_columns(db: Session, table_name: str) -> List[dict]:
    """PRAGMA table_info 内省字段，映射为 scaffold information_schema.columns 语义。"""
    if not _TABLE_RE.match(table_name):
        raise HTTPException(422, "非法表名")
    rows = db.execute(text(f'PRAGMA table_info("{table_name}")')).fetchall()
    cols: List[dict] = []
    for row in rows:
        # PRAGMA table_info: cid, name, type, notnull, dflt_value, pk
        declared = _norm_type(row[2] if row[2] else "text")
        py_type, form_type, _ = _TYPE_MAP.get(declared, ("str", "文本框", "String"))
        name = row[1]
        cols.append({
            "column_name": name,
            "data_type": declared,
            "nullable": "NO" if row[3] else "YES",
            "sort": row[0] + 1,
            "py_type": py_type,
            "form_type": form_type,
        })
    return cols


# ============================================================ 序列化


def _table_dict(t: GenTable) -> dict:
    return {
        "id": t.id,
        "tableName": t.table_name,
        "tableComment": t.table_comment or "",
        "className": t.class_name,
        "module": t.module_name,
        "businessName": t.business_name,
        "synced": bool(t.synced),
        "createTime": t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else None,
    }


def _column_dict(c: GenTableColumn) -> dict:
    return {
        "id": c.id,
        "col": c.column_name,
        "comment": c.column_comment or "",
        "field": c.field_name,
        "type": c.py_type,
        "dbType": c.db_type,
        "insert": bool(c.is_insert),
        "edit": bool(c.is_edit),
        "list": bool(c.is_list),
        "query": bool(c.is_query),
        "queryType": c.query_type,
        "formType": c.form_type,
        "required": bool(c.required),
    }


def _ensure_table(db: Session, table_id: int) -> GenTable:
    t = db.query(GenTable).filter(GenTable.id == table_id).first()
    if not t:
        raise HTTPException(404, "代码生成表不存在")
    return t


# ============================================================ 列表 / 导入


@router.get("/tables")
def list_tables(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                keyword: str = None,
                _: User = Depends(require_admin), db: Session = Depends(get_employee_db)):
    q = db.query(GenTable)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(
            GenTable.table_name.like(like)
            | GenTable.table_comment.like(like)
            | GenTable.class_name.like(like)
        )
    total = q.count()
    rows = q.order_by(GenTable.updated_at.desc(), GenTable.id.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_table_dict(t) for t in rows]}


@router.get("/importable-tables")
def importable_tables(keyword: str = None,
                      _: User = Depends(require_admin), db: Session = Depends(get_employee_db)):
    imported = {t.table_name for t in db.query(GenTable.table_name).all()}
    items = []
    for name in _list_db_tables(db):
        if keyword and keyword.lower() not in name.lower():
            continue
        items.append({"tableName": name, "tableComment": "", "imported": name in imported})
    return items


@router.post("/import")
def import_tables(payload: dict,
                  user: User = Depends(require_admin), db: Session = Depends(get_employee_db)):
    table_names = payload.get("tableNames") or []
    if not table_names:
        raise HTTPException(422, "请选择要导入的数据库表")
    ids: List[int] = []
    for name in table_names:
        if not _TABLE_RE.match(name):
            raise HTTPException(422, f"非法表名：{name}")
        existing = db.query(GenTable).filter(GenTable.table_name == name).first()
        if existing:
            ids.append(existing.id)
            continue
        if name not in _list_db_tables(db):
            raise HTTPException(422, f"数据库表不存在：{name}")
        cols = _table_columns(db, name)
        t = GenTable(
            table_name=name,
            table_comment="",
            class_name=_upper_camel(name),
            module_name=_module_name(name),
            business_name=_business_name(name),
            synced=True,
        )
        db.add(t)
        db.flush()
        for c in cols:
            primary_like = c["column_name"] == "id"
            q = _query_field(c["column_name"])
            db.add(GenTableColumn(
                table_id=t.id,
                column_name=c["column_name"],
                field_name=c["column_name"],
                py_type=c["py_type"],
                db_type=c["data_type"],
                column_comment="",
                is_insert=not primary_like,
                is_edit=not primary_like,
                is_list=not primary_like,
                is_query=q,
                query_type="LIKE" if q else "=",
                form_type=c["form_type"],
                required=(c["nullable"] == "NO" and not primary_like),
                sort=c["sort"],
            ))
        ids.append(t.id)
    db.commit()
    return {"imported": len(ids), "ids": ids}


# ============================================================ 配置 / 预览 / 生成


@router.get("/tables/{table_id}/columns")
def table_columns(table_id: int,
                  _: User = Depends(require_admin), db: Session = Depends(get_employee_db)):
    _ensure_table(db, table_id)
    rows = db.query(GenTableColumn).filter(GenTableColumn.table_id == table_id) \
        .order_by(GenTableColumn.sort, GenTableColumn.id).all()
    return [_column_dict(c) for c in rows]


@router.put("/tables/{table_id}")
def update_table(table_id: int, payload: dict,
                 _: User = Depends(require_admin), db: Session = Depends(get_employee_db)):
    t = _ensure_table(db, table_id)
    if "tableComment" in payload:
        t.table_comment = (payload.get("tableComment") or "")[:200]
    if "synced" in payload:
        t.synced = bool(payload.get("synced"))
    db.commit()
    return {"ok": True}


@router.get("/tables/{table_id}/preview")
def preview_table(table_id: int,
                  _: User = Depends(require_admin), db: Session = Depends(get_employee_db)):
    t = _ensure_table(db, table_id)
    cols = db.query(GenTableColumn).filter(GenTableColumn.table_id == table_id) \
        .order_by(GenTableColumn.sort, GenTableColumn.id).all()
    files, active_file = _render_files(t, [_column_dict(c) for c in cols])
    active_code = next((f["code"] for f in files if f["path"] == active_file), "")
    return {"files": files, "activeFile": active_file, "code": active_code}


@router.post("/tables/{table_id}/generate")
def generate_table(table_id: int,
                   _: User = Depends(require_admin), db: Session = Depends(get_employee_db)):
    t = _ensure_table(db, table_id)
    return {"tableName": t.table_name, "message": "代码压缩包已准备就绪"}


@router.get("/tables/{table_id}/download")
def download_table(table_id: int,
                   _: User = Depends(require_admin), db: Session = Depends(get_employee_db)):
    t = _ensure_table(db, table_id)
    cols = db.query(GenTableColumn).filter(GenTableColumn.table_id == table_id) \
        .order_by(GenTableColumn.sort, GenTableColumn.id).all()
    files, _ = _render_files(t, [_column_dict(c) for c in cols])
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            zf.writestr(f["path"], f["code"])
    buf.seek(0)
    filename = f"{t.class_name}.zip"
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================ 代码模板（7 文件）


def _render_files(t: GenTable, cols: List[dict]):
    table_name = t.table_name
    class_name = t.class_name
    module = t.module_name
    resource = table_name
    comment = t.table_comment or table_name

    files = [
        _model_file(module, class_name, table_name, comment, cols),
        _api_file(module, class_name, resource, t.business_name, comment, cols),
        _schema_file(module, class_name, resource, comment, cols),
        _front_api_file(resource, class_name, comment, cols),
        _page_file(resource, class_name, comment, cols),
        _style_file(resource, class_name, comment),
        _menu_sql_file(table_name, class_name, module, resource),
    ]
    active_file = f"backend/app/api/{resource}.py"
    return files, active_file


def _sqlalchemy_col_type(c: dict) -> str:
    _, _, satype = _TYPE_MAP.get(c["dbType"], ("str", "文本框", "String"))
    if satype == "Integer" and c["field"] == "id":
        return "Integer, primary_key=True, index=True"
    return satype


def _model_file(module, class_name, table_name, comment, cols):
    used = set(_sqlalchemy_col_type(c).split(",")[0].strip() for c in cols)
    imports = ", ".join(sorted(used)) if used else "Integer, String"
    lines = ['"""', f"{comment} —— 数据模型（由 NOVAMED 代码生成器生成）", "", "请补充关系、索引与业务校验。", '"""',
             "from sqlalchemy import Column, " + imports, "",
             "from app.core.database import Base", "", "",
             f"class {class_name}(Base):",
             f'    __tablename__ = "{table_name}"', ""]
    for c in cols:
        doc = c["comment"] or c["field"]
        lines.append(f"    # {doc}")
        lines.append(f"    {c['field']} = Column({_sqlalchemy_col_type(c)})")
        lines.append("")
    path = f"backend/app/models/{table_name}.py"
    return {"name": f"{table_name}.py", "path": path, "code": "\n".join(lines)}


def _api_file(module, class_name, resource, business_name, comment, cols):
    str_field = next((c["field"] for c in cols if c["type"] == "str" and c["field"] != "id"), "id")
    list_fields = [c for c in cols if c["list"]][:8]
    lines = ['"""', f"{comment} —— CRUD 接口（由 NOVAMED 代码生成器生成）", '"""',
             "from fastapi import APIRouter, Depends, HTTPException, Query",
             "from sqlalchemy.orm import Session", "",
             "from app.core.database import get_employee_db",
             "from app.core.dependencies import require_admin",
             f"from app.models.models import {class_name}", "",
             f'router = APIRouter(prefix="/api/{resource}", tags=["{business_name}"])', "",
             "@router.get(\"\")",
             f"def list_{resource}(",
             "    page: int = Query(1, ge=1),",
             "    page_size: int = Query(20, ge=1, le=100),",
             "    keyword: str = None,",
             "    _=Depends(require_admin),",
             "    db: Session = Depends(get_employee_db),",
             "):",
             f'    q = db.query({class_name})',
             "    if keyword:",
             f'        q = q.filter({class_name}.{str_field}.like(f"%{{keyword}}%"))',
             "    total = q.count()",
             "    rows = q.offset((page - 1) * page_size).limit(page_size).all()",
             "    return {\"total\": total, \"items\": [_to_dict(r) for r in rows]}", "", "",
             f"def _to_dict(row: {class_name}) -> dict:",
             "    return {", ]
    for c in list_fields:
        lines.append(f'        "{c["field"]}": getattr(row, "{c["field"]}"),')
    lines.append("    }")
    path = f"backend/app/api/{resource}.py"
    return {"name": f"{resource}.py", "path": path, "code": "\n".join(lines)}


def _schema_file(module, class_name, resource, comment, cols):
    py_map = {"int": "int", "float": "float", "bool": "bool", "datetime": "datetime", "bytes": "bytes", "str": "str"}
    need_dt = any(c["type"] == "datetime" for c in cols)
    lines = ['"""', f"{comment} —— Pydantic 校验模型（由 NOVAMED 代码生成器生成）", '"""',
             "from datetime import datetime" if need_dt else "",
             "from typing import Optional",
             "from pydantic import BaseModel", "", "",
             f"class {class_name}Create(BaseModel):"]
    for c in cols:
        if c["field"] == "id":
            continue
        t = py_map.get(c["type"], "str")
        opt = "Optional[" + t + "] = None" if not c["required"] else t
        lines.append(f"    {c['field']}: {opt}")
    lines.append("")
    lines.append("")
    lines.append(f"class {class_name}Out(BaseModel):")
    lines.append("    id: int")
    for c in cols:
        if c["field"] == "id":
            continue
        t = py_map.get(c["type"], "str")
        lines.append(f"    {c['field']}: {t}")
    lines.append("")
    lines.append("    class Config:")
    lines.append("        from_attributes = True")
    path = f"backend/app/schemas/{resource}.py"
    return {"name": f"{resource}.py", "path": path,
            "code": "\n".join([l for l in lines if l is not None])}


def _front_api_file(resource, class_name, comment, cols):
    ts_map = {"int": "number", "float": "number", "bool": "boolean", "datetime": "string", "bytes": "string", "str": "string"}
    lines = ['/**', f" * {comment} —— 接口客户端（由 NOVAMED 代码生成器生成）", ' */',
             'import api from "./client";', "",
             f"export interface {class_name}Item {{",
             "  id: number;"]
    for c in cols:
        if c["field"] == "id":
            continue
        lines.append(f"  {c['field']}: {ts_map.get(c['type'], 'string')};")
    lines.append("}")
    lines.append("")
    lines.append(f"export const {resource}Api = {{")
    lines.append(f"  list: (params?: {{ page?: number; page_size?: number; keyword?: string }}) =>")
    lines.append(f"    api.get(\"/{resource}\", {{ params }}).then((r) => r.data as {{ total: number; items: {class_name}Item[] }}),")
    lines.append(f"  create: (body: Record<string, unknown>) => api.post(\"/{resource}\", body).then((r) => r.data),")
    lines.append(f"  update: (id: number, body: Record<string, unknown>) => api.put(`/{resource}/${{id}}`, body).then((r) => r.data),")
    lines.append(f"  remove: (id: number) => api.delete(`/{resource}/${{id}}`).then((r) => r.data),")
    lines.append("};")
    path = f"frontend/src/api/{resource}.ts"
    return {"name": f"{resource}.ts", "path": path, "code": "\n".join(lines)}


def _page_file(resource, class_name, comment, cols):
    list_fields = [c for c in cols if c["list"] and c["field"] != "id"][:6]
    lines = ['/**', f" * {comment} —— 列表页（由 NOVAMED 代码生成器生成，请在业务开发中完善）", ' */',
             'import { useEffect, useState } from "react";',
             'import { Button, Table } from "antd";',
             'import { ReloadOutlined, PlusOutlined } from "@ant-design/icons";',
             f'import {{ {resource}Api, type {class_name}Item }} from "../api/{resource}";', "",
             "const columns = ["]
    for c in list_fields:
        lines.append(f'  {{ title: "{c["comment"] or c["field"]}", dataIndex: "{c["field"]}", key: "{c["field"]}" }},')
    lines.append("];")
    lines += ["",
              f"export default function {class_name}Page() {{",
              f"  const [rows, setRows] = useState<{class_name}Item[]>([]);",
              '  const [loading, setLoading] = useState(false);', "",
              "  const load = async () => {",
              "    setLoading(true);",
              "    try {",
              f"      const r = await {resource}Api.list();",
              "      setRows(r.items);",
              "    } finally {",
              "      setLoading(false);",
              "    }",
              "  };", "",
              "  useEffect(() => { load(); }, []);", "",
              "  return (",
              f'    <div className="lv-page {resource}-page">',
              '      <div className="lv-head">',
              f"        <h1>{comment}</h1>",
              '        <div className="lv-actions">',
              '          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>',
              '          <Button type="primary" icon={<PlusOutlined />}>新增</Button>',
              "        </div>",
              "      </div>",
              '      <div className="lv-panel">',
              '        <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} />',
              "      </div>",
              "    </div>",
              "  );",
              "}",
              ]
    path = f"frontend/src/pages/{class_name}.tsx"
    return {"name": f"{class_name}.tsx", "path": path, "code": "\n".join(lines)}


def _style_file(resource, class_name, comment):
    lines = ['/**', f" * {comment} —— 页面样式（由 NOVAMED 代码生成器生成）", ' */',
             f".{resource}-page {{", "  padding: 0 0 24px;", "}", ""]
    path = f"frontend/src/styles/{resource}.css"
    return {"name": f"{resource}.css", "path": path, "code": "\n".join(lines)}


def _menu_sql_file(table_name, class_name, module, resource):
    lines = [
        f"-- {table_name} 菜单权限（由 NOVAMED 代码生成器生成）",
        "INSERT INTO menu_items (id, parent_id, name, type, path, component, permission, sort, visible, status, builtin)",
        "SELECT COALESCE(MAX(id), 0) + 1, 0, '" + class_name + "管理', 'menu',",
        f"       '/{resource}', 'pages/{resource}/index', 'medicode:{resource}:list', 1, 1, 1, 1",
        "FROM menu_items;",
    ]
    path = f"sql/{table_name}_menu.sql"
    return {"name": f"{table_name}_menu.sql", "path": path, "code": "\n".join(lines)}
