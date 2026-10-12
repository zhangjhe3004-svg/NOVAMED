"""多租户数据存储服务 —— 数据模型（账户 / 数据集合 / 数据记录）

隔离模型：每个账户即一个租户；集合与记录都带 account_id，
所有查询强制按 account_id 过滤，实现账户间数据相互隔离。
"""
import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index, UniqueConstraint, JSON

from ..core.storage_db import StorageBase


def _now():
    return datetime.datetime.utcnow()


class StorageAccount(StorageBase):
    """数据存储账户（租户）"""
    __tablename__ = "storage_accounts"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(128), default="")
    password_hash = Column(String(255), nullable=False)
    api_key_hash = Column(String(64), nullable=False, index=True)  # SHA256(api_key)
    status = Column(String(16), default="active", nullable=False)  # active / disabled
    max_collections = Column(Integer, default=100, nullable=False)
    max_records = Column(Integer, default=1000000, nullable=False)
    created_at = Column(DateTime, default=_now)


class StorageCollection(StorageBase):
    """数据集合（类似表 / collection）"""
    __tablename__ = "storage_collections"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("storage_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(64), nullable=False)
    schema_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (UniqueConstraint("account_id", "name", name="uq_storage_account_collection"),)


class StorageRecord(StorageBase):
    """数据记录（集合内的一条 JSON 文档）"""
    __tablename__ = "storage_records"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("storage_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    collection_id = Column(Integer, ForeignKey("storage_collections.id", ondelete="CASCADE"), nullable=False, index=True)
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    __table_args__ = (Index("ix_storage_record_account_collection", "account_id", "collection_id"),)
