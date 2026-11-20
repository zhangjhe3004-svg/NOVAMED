"""多租户数据存储服务 —— 独立数据库引擎与会话工厂

开发环境默认 SQLite（backend/data/storage.db）；
生产环境通过 STORAGE_DATABASE_URL 切换到 PostgreSQL，配合连接池与 pgbouncer 承载 1 万并发。
"""
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

DATA_DIR = Path(__file__).resolve().parents[2] / "db"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_URL = f"sqlite:///{(DATA_DIR / 'storage.db')}"
STORAGE_URL = settings.STORAGE_DATABASE_URL or (
    settings.DATABASE_URL if "sqlite" not in settings.DATABASE_URL.lower() else DEFAULT_URL
)


def _make_storage_engine(url: str):
    kwargs = {"echo": settings.DEBUG, "pool_pre_ping": True}
    if "sqlite" in url:
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # PostgreSQL 等关系库：显式连接池，配合 pgbouncer 水平扩展承载高并发
        kwargs["pool_size"] = settings.STORAGE_POOL_SIZE
        kwargs["max_overflow"] = settings.STORAGE_MAX_OVERFLOW
        kwargs["pool_timeout"] = settings.STORAGE_POOL_TIMEOUT
    return create_engine(url, **kwargs)


storage_engine = _make_storage_engine(STORAGE_URL)
StorageSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=storage_engine)


class StorageBase(DeclarativeBase):
    """多租户数据存储服务的模型基类"""
    pass


def get_storage_db():
    db = StorageSessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_storage_db():
    import app.models.storage  # noqa: F401 - 注册存储模型
    StorageBase.metadata.create_all(bind=storage_engine)
