"""
统计快照库 —— backend/db/stats.db
用途：用户管理看板等页面实时统计结果的持久化缓存。

重要：本库不在 main.py 启动生命周期中初始化；
      表由 /api/users/stats 接口在首次被调用时惰性创建，
      因此应用重启不会清空或重置其中的数据。
"""
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, Column, Integer, String, DateTime, inspect
from sqlalchemy.orm import DeclarativeBase, sessionmaker


DATA_DIR = Path(__file__).resolve().parents[2] / "db"
DATA_DIR.mkdir(parents=True, exist_ok=True)

STATS_DB_URL = f"sqlite:///{DATA_DIR / 'stats.db'}"

engine = create_engine(
    STATS_DB_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class StatsBase(DeclarativeBase):
    pass


class UserStatsSnapshot(StatsBase):
    __tablename__ = "user_stats_snapshot"

    id = Column(Integer, primary_key=True)
    total_staff = Column(Integer, default=0)
    doctor_count = Column(Integer, default=0)
    admin_count = Column(Integer, default=0)
    inactive_count = Column(Integer, default=0)
    this_month_joined = Column(Integer, default=0)
    on_leave = Column(Integer, default=0)
    resting = Column(Integer, default=0)
    available_doctors = Column(Integer, default=0)
    residents = Column(Integer, default=0)
    super_admins = Column(Integer, default=0)
    admin_departments = Column(String(200), default="")
    last_7_days_created = Column(Integer, default=0)
    need_password_change = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def ensure_stats_table() -> None:
    """惰性建表：仅当表不存在时创建，不会删除已有数据。"""
    if not inspect(engine).has_table(UserStatsSnapshot.__tablename__):
        StatsBase.metadata.create_all(bind=engine, tables=[UserStatsSnapshot.__table__])


def save_user_stats(stats: dict) -> None:
    """将最新统计写入快照表（id=1 单行覆盖）。"""
    ensure_stats_table()
    db = SessionLocal()
    try:
        row = db.query(UserStatsSnapshot).filter(UserStatsSnapshot.id == 1).first()
        if row is None:
            row = UserStatsSnapshot(id=1, **stats)
            db.add(row)
        else:
            for key, value in stats.items():
                setattr(row, key, value)
            row.updated_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()
