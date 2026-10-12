"""多租户数据存储服务 —— Pydantic 校验模式"""
from typing import Any, Optional

from pydantic import BaseModel, Field


class StorageAccountCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    email: Optional[str] = None
    password: str = Field(min_length=8, max_length=72)


class StorageAccountLogin(BaseModel):
    username: str
    password: str


class StorageAccountUpdate(BaseModel):
    email: Optional[str] = None


class StorageCollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    schema_json: Optional[dict[str, Any]] = None


class StorageCollectionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    schema_json: Optional[dict[str, Any]] = None


class StorageRecordCreate(BaseModel):
    data: dict[str, Any]


class StorageRecordUpdate(BaseModel):
    data: dict[str, Any]
