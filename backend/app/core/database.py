from pathlib import Path
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

DATA_DIR = Path(__file__).resolve().parents[2] / "data"  # backend/data


def _make_engine(url: str, fk: bool = True):
    if "sqlite" in url:
        e = create_engine(url, connect_args={"check_same_thread": False}, echo=settings.DEBUG)

        @event.listens_for(e, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys = ON" if fk else "PRAGMA foreign_keys = OFF")
            cursor.close()

        return e
    return create_engine(url, echo=settings.DEBUG)


# 患者域 / 员工域 独立库（backend/data/ 下一个文件夹，两个库文件并存）
PATIENT_DB_URL = f"sqlite:///{(DATA_DIR / 'patient.db')}"
EMPLOYEE_DB_URL = f"sqlite:///{(DATA_DIR / 'employee.db')}"

DATA_DIR.mkdir(parents=True, exist_ok=True)

# 患者库跨库引用员工 users（appointments.doctor_id -> users.id），因此关闭其外键校验；
# 员工库保留外键校验。
patient_engine = _make_engine(PATIENT_DB_URL, fk=False)
employee_engine = _make_engine(EMPLOYEE_DB_URL)

patient_session = sessionmaker(autocommit=False, autoflush=False, bind=patient_engine)
employee_session = sessionmaker(autocommit=False, autoflush=False, bind=employee_engine)


class Base(DeclarativeBase):
    """所有数据模型的基类"""
    pass


def get_db():
    """患者库会话（依赖注入）"""
    db = patient_session()
    try:
        yield db
    finally:
        db.close()


def get_employee_db():
    """员工库会话（依赖注入）"""
    db = employee_session()
    try:
        yield db
    finally:
        db.close()


# 表 -> 所属域
_PATIENT_TABLES = {"patients", "patient_accounts", "appointments", "medical_records", "knowledge_docs",
                   "record_comments", "doctor_schedules"}
_EMPLOYEE_TABLES = {"users", "messages", "notifications", "audit_logs", "token_usage", "conversations",
                    "user_preferences", "session_records",
                    # 员工域低代码引擎元数据表（动态集合/页面/ACL/业务工作流）
                    "dyn_collections", "page_schemas", "acl_rules", "wf_defs", "wf_instances"}


def init_db():
    """初始化双库：患者表建到 patient.db，员工表建到 employee.db，并做轻量迁移"""
    import app.models.models  # noqa: F401 - 注册核心模型
    import app.services.user_memory  # noqa: F401 - 注册用户记忆模型
    import app.models.workspace  # noqa: F401 - 注册员工域低代码元数据表

    def create_subset(engine, names):
        tables = [Base.metadata.tables[n] for n in names if n in Base.metadata.tables]
        if tables:
            Base.metadata.create_all(bind=engine, tables=tables)

    create_subset(patient_engine, _PATIENT_TABLES)
    create_subset(employee_engine, _EMPLOYEE_TABLES)
    _ensure_columns()


def _ensure_columns():
    """轻量迁移：对存在缺列的表执行 ALTER TABLE ADD COLUMN，按域分别处理"""
    if "sqlite" not in settings.DATABASE_URL and "sqlite" not in PATIENT_DB_URL:
        return
    plan = {
        employee_engine: {
            "users": {
                "id_number": "VARCHAR(50)", "employee_no": "VARCHAR(50)",
                "department": "VARCHAR(100)", "title": "VARCHAR(50)",
                "work_status": "VARCHAR(20) DEFAULT '在职'", "room": "VARCHAR(50)",
                "superior_id": "INTEGER",
                "id_type": "VARCHAR(50)", "surname": "VARCHAR(50)", "given_name": "VARCHAR(50)",
                "valid_until": "VARCHAR(30)", "issue_date": "VARCHAR(30)", "registered_place": "VARCHAR(100)",
            },
        },
        patient_engine: {
            "knowledge_docs": {"status": "VARCHAR(20) DEFAULT '草稿'", "approval_level": "INTEGER DEFAULT 1", "approvals": "TEXT"},
            "medical_records": {"room": "VARCHAR(50)"},
            "patient_accounts": {"patient_id": "INTEGER"},
        },
    }
    try:
        for engine, table_cols in plan.items():
            with engine.connect() as conn:
                for table, cols in table_cols.items():
                    existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()}
                    for col, coltype in cols.items():
                        if col not in existing:
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {coltype}"))
                conn.commit()
    except Exception:
        pass


# Docker Compose — 一键启动整个系统
# 使用方式：docker-compose up -d
# 访问地址：http://localhost
