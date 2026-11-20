from pathlib import Path
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

DATA_DIR = Path(__file__).resolve().parents[2] / "db"  # backend/data


def _make_engine(url: str, fk: bool = True):
    if "sqlite" in url:
        # 并发友好：check_same_thread=False 允许多线程；busy_timeout 缓解写锁竞争
        e = create_engine(
            url,
            connect_args={"check_same_thread": False, "timeout": 30},
            pool_size=10,
            max_overflow=20,
            pool_timeout=30,
            echo=settings.DEBUG,
        )

        @event.listens_for(e, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            # WAL 模式：读写不互斥，支持多机/多线程并发读写
            cursor.execute("PRAGMA journal_mode = WAL")
            cursor.execute("PRAGMA busy_timeout = 30000")
            cursor.execute("PRAGMA synchronous = NORMAL")
            cursor.execute("PRAGMA foreign_keys = ON" if fk else "PRAGMA foreign_keys = OFF")
            cursor.close()

        return e
    return create_engine(
        url,
        echo=settings.DEBUG,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )


# 开发环境仍用两份 SQLite；生产环境将患者域和员工域表放入同一个 PostgreSQL 数据库。
if "sqlite" in settings.DATABASE_URL.lower():
    PATIENT_DB_URL = f"sqlite:///{(DATA_DIR / 'patient.db')}"
    EMPLOYEE_DB_URL = f"sqlite:///{(DATA_DIR / 'employee.db')}"
else:
    PATIENT_DB_URL = settings.DATABASE_URL
    EMPLOYEE_DB_URL = settings.DATABASE_URL

DATA_DIR.mkdir(parents=True, exist_ok=True)

# 患者域与员工域在开发环境使用独立 SQLite 文件；生产环境使用同一 PostgreSQL 数据库，
# 因历史模型存在跨域引用，不在患者库引擎上启用 SQLite 外键校验。
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
                   "record_comments", "doctor_schedules", "medicines", "billing_records", "lab_tests"}
_EMPLOYEE_TABLES = {"users", "messages", "notifications", "audit_logs", "login_logs", "token_usage", "conversations",
                    "user_preferences", "session_records", "scheduled_tasks", "nearby_files",
                    # 员工域低代码引擎元数据表（动态集合/页面/ACL/业务工作流）
                    "dyn_collections", "page_schemas", "acl_rules", "wf_defs", "wf_instances", "permission_levels", "nearby_transfers", "nearby_connections",
                    # 角色管理（sys_roles + 角色菜单授权 + 用户角色关联）
                    "sys_roles", "sys_role_menus", "sys_user_role",
                    # 菜单管理（目录/页面/按钮三级菜单树）
                    "menu_items",
                    # 部门管理（组织架构树）/ 岗位管理
                    "sys_depts", "sys_posts"}


def init_db():
    """初始化双库：患者表建到 patient.db，员工表建到 employee.db，并做轻量迁移"""
    import app.models.models  # noqa: F401 - 注册核心模型
    import app.services.user_memory  # noqa: F401 - 注册用户记忆模型
    import app.models.workspace  # noqa: F401 - 注册员工域低代码元数据表
    import app.models.nearby  # noqa: F401 - 注册附近协作与数字权限模型

    def create_subset(engine, names):
        tables = [Base.metadata.tables[n] for n in names if n in Base.metadata.tables]
        if tables:
            Base.metadata.create_all(bind=engine, tables=tables)

    create_subset(patient_engine, _PATIENT_TABLES)
    create_subset(employee_engine, _EMPLOYEE_TABLES)
    _ensure_columns()


def _ensure_columns():
    """轻量迁移：对存在缺列的表执行 ALTER TABLE ADD COLUMN，按域分别处理"""
    if "sqlite" not in PATIENT_DB_URL.lower() or "sqlite" not in EMPLOYEE_DB_URL.lower():
        return
    plan = {
        employee_engine: {
            "users": {
                "id_number": "VARCHAR(50)", "employee_no": "VARCHAR(50)",
                "department": "VARCHAR(100)", "title": "VARCHAR(50)",
                "work_status": "VARCHAR(20) DEFAULT '在职'", "room": "VARCHAR(50)",
                "superior_id": "INTEGER",
                "auth_level": "INTEGER DEFAULT 1",
                "id_type": "VARCHAR(50)", "surname": "VARCHAR(50)", "given_name": "VARCHAR(50)",
                "valid_until": "VARCHAR(30)", "issue_date": "VARCHAR(30)", "registered_place": "VARCHAR(100)",
            },
            "wf_instances": {"creator_id": "INTEGER"},
            "messages": {
                "deleted_by": "VARCHAR(200) DEFAULT ''",
                "recalled": "BOOLEAN DEFAULT 0",
                "quote_id": "INTEGER",
                "quote_preview": "VARCHAR(200) DEFAULT ''",
            },
        },
        patient_engine: {
            "knowledge_docs": {"status": "VARCHAR(20) DEFAULT '草稿'", "approval_level": "INTEGER DEFAULT 1", "approvals": "TEXT"},
            "medical_records": {"room": "VARCHAR(50)", "ai_suggestion": "TEXT", "ai_confidence": "VARCHAR(20)", "ai_reviewed": "INTEGER DEFAULT 0", "admin_reviewed": "INTEGER DEFAULT 0", "admin_name": "VARCHAR(100)"},
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
