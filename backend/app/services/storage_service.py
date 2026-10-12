"""多租户数据存储服务 —— 业务逻辑（账户管理 + 数据管理，全程按账户隔离）"""
import datetime
import hashlib
import secrets
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import cast, String
from sqlalchemy.orm import Session

from ..core.security import hash_password, verify_password, create_access_token
from ..models.storage import StorageAccount, StorageCollection, StorageRecord


def _hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def account_dict(a: StorageAccount, include_api_key: Optional[str] = None) -> dict:
    d = {
        "id": a.id, "username": a.username, "email": a.email, "status": a.status,
        "max_collections": a.max_collections, "max_records": a.max_records,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }
    if include_api_key:
        d["api_key"] = include_api_key  # 仅创建/轮换时返回一次
    return d


def collection_dict(c: StorageCollection) -> dict:
    return {
        "id": c.id, "name": c.name, "schema_json": c.schema_json or {},
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def record_dict(r: StorageRecord) -> dict:
    return {
        "id": r.id, "collection_id": r.collection_id, "data": r.data or {},
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


# ---------------- 账户管理 ----------------

def register_account(db: Session, username: str, email: Optional[str], password: str):
    if db.query(StorageAccount).filter(StorageAccount.username == username).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "用户名已存在")
    api_key = secrets.token_urlsafe(32)
    account = StorageAccount(
        username=username, email=email or "",
        password_hash=hash_password(password),
        api_key_hash=_hash_api_key(api_key),
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    token = _issue_token(account)
    return account, api_key, token


def login_account(db: Session, username: str, password: str) -> str:
    account = db.query(StorageAccount).filter(StorageAccount.username == username).first()
    if not account or not verify_password(password, account.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")
    if account.status != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "账户已禁用")
    return _issue_token(account)


def _issue_token(account: StorageAccount) -> str:
    return create_access_token(
        data={"sub": str(account.id), "username": account.username},
        token_type="storage",
    )


def update_account(db: Session, account_id: int, email: Optional[str]) -> dict:
    account = _get_account(db, account_id)
    if email is not None:
        account.email = email
    db.commit()
    db.refresh(account)
    return account_dict(account)


def change_password(db: Session, account_id: int, old: str, new: str) -> None:
    account = _get_account(db, account_id)
    if not verify_password(old, account.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "原密码错误")
    account.password_hash = hash_password(new)
    db.commit()


def rotate_api_key(db: Session, account_id: int) -> str:
    account = _get_account(db, account_id)
    api_key = secrets.token_urlsafe(32)
    account.api_key_hash = _hash_api_key(api_key)
    db.commit()
    return api_key


def _get_account(db: Session, account_id: int) -> StorageAccount:
    account = db.query(StorageAccount).filter(StorageAccount.id == account_id).first()
    if not account:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "账户不存在")
    return account


# ---------------- 数据集合管理（隔离） ----------------

def create_collection(db: Session, account_id: int, name: str, schema_json: Optional[dict]) -> dict:
    if db.query(StorageCollection).filter(
        StorageCollection.account_id == account_id, StorageCollection.name == name
    ).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "集合名已存在")
    col = StorageCollection(account_id=account_id, name=name, schema_json=schema_json or {})
    db.add(col)
    db.commit()
    db.refresh(col)
    return collection_dict(col)


def list_collections(db: Session, account_id: int) -> list:
    cols = db.query(StorageCollection).filter(StorageCollection.account_id == account_id).all()
    return [collection_dict(c) for c in cols]


def get_collection(db: Session, account_id: int, cid: int) -> dict:
    return collection_dict(_get_collection(db, account_id, cid))


def update_collection(db: Session, account_id: int, cid: int, name: Optional[str], schema_json: Optional[dict]) -> dict:
    col = _get_collection(db, account_id, cid)
    if name is not None:
        col.name = name
    if schema_json is not None:
        col.schema_json = schema_json
    db.commit()
    db.refresh(col)
    return collection_dict(col)


def delete_collection(db: Session, account_id: int, cid: int) -> None:
    col = _get_collection(db, account_id, cid)
    db.query(StorageRecord).filter(StorageRecord.collection_id == col.id).delete(synchronize_session=False)
    db.delete(col)
    db.commit()


def _get_collection(db: Session, account_id: int, cid: int) -> StorageCollection:
    col = db.query(StorageCollection).filter(
        StorageCollection.id == cid, StorageCollection.account_id == account_id
    ).first()
    if not col:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "集合不存在")
    return col


# ---------------- 数据记录管理（隔离） ----------------

def create_record(db: Session, account_id: int, collection_id: int, data: dict) -> dict:
    _get_collection(db, account_id, collection_id)  # 校验集合归属
    rec = StorageRecord(account_id=account_id, collection_id=collection_id, data=data)
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return record_dict(rec)


def list_records(db: Session, account_id: int, collection_id: int, page: int, page_size: int, q: Optional[str]) -> dict:
    _get_collection(db, account_id, collection_id)
    query = db.query(StorageRecord).filter(
        StorageRecord.account_id == account_id, StorageRecord.collection_id == collection_id
    )
    if q:
        query = query.filter(cast(StorageRecord.data, String).like(f"%{q}%"))
    total = query.count()
    items = query.order_by(StorageRecord.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "page_size": page_size, "items": [record_dict(r) for r in items]}


def get_record(db: Session, account_id: int, rid: int) -> dict:
    return record_dict(_get_record(db, account_id, rid))


def update_record(db: Session, account_id: int, rid: int, data: dict) -> dict:
    rec = _get_record(db, account_id, rid)
    rec.data = data
    rec.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(rec)
    return record_dict(rec)


def delete_record(db: Session, account_id: int, rid: int) -> None:
    rec = _get_record(db, account_id, rid)
    db.delete(rec)
    db.commit()


def _get_record(db: Session, account_id: int, rid: int) -> StorageRecord:
    rec = db.query(StorageRecord).filter(
        StorageRecord.id == rid, StorageRecord.account_id == account_id
    ).first()
    if not rec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "记录不存在")
    return rec
