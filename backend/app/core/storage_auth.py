"""多租户数据存储服务 —— 账户认证依赖（Bearer JWT 或 X-API-Key）"""
import hashlib
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .security import decode_access_token
from .storage_db import get_storage_db
from ..models.storage import StorageAccount

_bearer = HTTPBearer(auto_error=False)


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def get_current_storage_account(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    db: Session = Depends(get_storage_db),
) -> StorageAccount:
    account = None
    if x_api_key:
        account = db.query(StorageAccount).filter(
            StorageAccount.api_key_hash == hash_api_key(x_api_key)
        ).first()
    elif credentials is not None:
        payload = decode_access_token(credentials.credentials)
        if payload and payload.get("type") == "storage":
            account = db.query(StorageAccount).filter(
                StorageAccount.id == int(payload.get("sub", 0))
            ).first()
    if not account:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "存储账户认证失败")
    if account.status != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "账户已禁用")
    return account
