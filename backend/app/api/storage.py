"""多租户数据存储服务 —— API（账户管理 + 数据管理，全部按账户隔离）"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.storage_db import get_storage_db
from ..core.storage_auth import get_current_storage_account
from ..models.storage import StorageAccount
from ..schemas import storage as sch
from ..services import storage_service as svc

router = APIRouter(prefix="/api/storage", tags=["数据存储服务"])


# ---------------- 账户管理 ----------------

@router.post("/accounts/register")
def register(payload: sch.StorageAccountCreate, db: Session = Depends(get_storage_db)):
    account, api_key, token = svc.register_account(db, payload.username, payload.email, payload.password)
    return {"account": svc.account_dict(account), "api_key": api_key, "access_token": token, "token_type": "bearer"}


@router.post("/accounts/login")
def login(payload: sch.StorageAccountLogin, db: Session = Depends(get_storage_db)):
    token = svc.login_account(db, payload.username, payload.password)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/accounts/me")
def me(account: StorageAccount = Depends(get_current_storage_account)):
    return svc.account_dict(account)


@router.put("/accounts/me")
def update_me(payload: sch.StorageAccountUpdate, account: StorageAccount = Depends(get_current_storage_account),
              db: Session = Depends(get_storage_db)):
    return svc.update_account(db, account.id, payload.email)


@router.post("/accounts/me/password")
def change_password(payload: dict, account: StorageAccount = Depends(get_current_storage_account),
                    db: Session = Depends(get_storage_db)):
    svc.change_password(db, account.id, payload.get("old_password", ""), payload.get("new_password", ""))
    return {"ok": True}


@router.post("/accounts/me/api-key")
def rotate_api_key(account: StorageAccount = Depends(get_current_storage_account),
                   db: Session = Depends(get_storage_db)):
    key = svc.rotate_api_key(db, account.id)
    return {"api_key": key}


# ---------------- 数据集合管理 ----------------

@router.post("/collections")
def create_collection(payload: sch.StorageCollectionCreate, account: StorageAccount = Depends(get_current_storage_account),
                      db: Session = Depends(get_storage_db)):
    return svc.create_collection(db, account.id, payload.name, payload.schema_json)


@router.get("/collections")
def list_collections(account: StorageAccount = Depends(get_current_storage_account), db: Session = Depends(get_storage_db)):
    return {"items": svc.list_collections(db, account.id)}


@router.get("/collections/{cid}")
def get_collection(cid: int, account: StorageAccount = Depends(get_current_storage_account), db: Session = Depends(get_storage_db)):
    return svc.get_collection(db, account.id, cid)


@router.put("/collections/{cid}")
def update_collection(cid: int, payload: sch.StorageCollectionUpdate,
                      account: StorageAccount = Depends(get_current_storage_account), db: Session = Depends(get_storage_db)):
    return svc.update_collection(db, account.id, cid, payload.name, payload.schema_json)


@router.delete("/collections/{cid}")
def delete_collection(cid: int, account: StorageAccount = Depends(get_current_storage_account), db: Session = Depends(get_storage_db)):
    svc.delete_collection(db, account.id, cid)
    return {"ok": True}


# ---------------- 数据记录管理 ----------------

@router.post("/collections/{cid}/records")
def create_record(cid: int, payload: sch.StorageRecordCreate, account: StorageAccount = Depends(get_current_storage_account),
                  db: Session = Depends(get_storage_db)):
    return svc.create_record(db, account.id, cid, payload.data)


@router.get("/collections/{cid}/records")
def list_records(cid: int, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
                 q: Optional[str] = None, account: StorageAccount = Depends(get_current_storage_account),
                 db: Session = Depends(get_storage_db)):
    return svc.list_records(db, account.id, cid, page, page_size, q)


@router.get("/records/{rid}")
def get_record(rid: int, account: StorageAccount = Depends(get_current_storage_account), db: Session = Depends(get_storage_db)):
    return svc.get_record(db, account.id, rid)


@router.put("/records/{rid}")
def update_record(rid: int, payload: sch.StorageRecordUpdate, account: StorageAccount = Depends(get_current_storage_account),
                  db: Session = Depends(get_storage_db)):
    return svc.update_record(db, account.id, rid, payload.data)


@router.delete("/records/{rid}")
def delete_record(rid: int, account: StorageAccount = Depends(get_current_storage_account), db: Session = Depends(get_storage_db)):
    svc.delete_record(db, account.id, rid)
    return {"ok": True}
