"""
附近协作 API —— /api/nearby

├── 管理员：数字权限级别 CRUD（1-9 级）
├── 员工：责任链内同事列表（上级 + 下级）
├── 员工：数据互传（发送 / 请求 / 处理 / 任意格式文件上传入库）
└── 员工：可传输的就诊记录
"""
import json
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..core.database import get_employee_db, get_db
from ..core.dependencies import get_current_user, require_admin
from ..models.models import User
from ..models.nearby import PermissionLevel, NearbyFile
from ..services import nearby_service

router = APIRouter(prefix="/api/nearby", tags=["附近协作"])

# 附件磁盘存储目录（backend/db/nearby_files）
_FILE_DIR = Path(__file__).resolve().parents[2] / "db" / "nearby_files"


def _level_dict(l: PermissionLevel) -> dict:
    return {
        "id": l.id, "level": l.level, "name": l.name, "description": l.description,
        "permissions": json.loads(l.permissions or "[]"), "enabled": bool(l.enabled),
    }


# ---------- 数字权限级别（仅管理员） ----------

@router.get("/levels")
def list_levels(_=Depends(require_admin), db: Session = Depends(get_employee_db)):
    items = db.query(PermissionLevel).order_by(PermissionLevel.level.asc()).all()
    return {"items": [_level_dict(x) for x in items]}


@router.post("/levels")
def save_level(payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    level = int(payload.get("level", 0))
    if not 1 <= level <= 9:
        raise HTTPException(400, "级别必须是 1-9 的数字")
    if db.query(PermissionLevel).filter(PermissionLevel.level == level).first():
        raise HTTPException(400, "该数字级别已存在")
    l = PermissionLevel(
        level=level,
        name=payload.get("name", "级别 %d" % level),
        description=payload.get("description", ""),
        permissions=json.dumps(payload.get("permissions", []), ensure_ascii=False),
        enabled=bool(payload.get("enabled", True)),
    )
    db.add(l); db.commit(); db.refresh(l)
    return _level_dict(l)


@router.put("/levels/{level_id}")
def update_level(level_id: int, payload: dict, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    l = db.query(PermissionLevel).filter(PermissionLevel.id == level_id).first()
    if not l:
        raise HTTPException(404, "级别不存在")
    if "level" in payload and payload["level"] is not None:
        l.level = int(payload["level"])
    for key in ("name", "description"):
        if key in payload and payload[key] is not None:
            setattr(l, key, payload[key])
    if "permissions" in payload and payload["permissions"] is not None:
        l.permissions = json.dumps(payload["permissions"], ensure_ascii=False)
    if "enabled" in payload and payload["enabled"] is not None:
        l.enabled = bool(payload["enabled"])
    db.commit(); db.refresh(l)
    return _level_dict(l)


@router.delete("/levels/{level_id}")
def delete_level(level_id: int, _=Depends(require_admin), db: Session = Depends(get_employee_db)):
    l = db.query(PermissionLevel).filter(PermissionLevel.id == level_id).first()
    if l:
        db.delete(l); db.commit()
    return {"detail": "ok"}


# ---------- 责任链同事 ----------

@router.get("/peers")
def list_peers(user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    return {"items": nearby_service.responsibility_peers(db, user)}


# ---------- 连接（互传授权：低权限申请 → 高权限审批） ----------

@router.get("/connections")
def get_connections(user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    """我的连接数据：已连接对方 id + 待我审批的申请 + 我发出的申请状态。"""
    return nearby_service.list_connection_items(db, user)


@router.post("/connect/request")
def connect_request(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    """发起连接申请：低权限→高权限需对方审批；同级或高→低自动通过。"""
    try:
        c = nearby_service.request_connection(db, user, int(payload.get("target_id", 0)), payload.get("note", ""))
    except KeyError:
        raise HTTPException(404, "目标用户不存在")
    except PermissionError as e:
        raise HTTPException(403, str(e))
    return {"id": c.id, "status": c.status}


@router.post("/connect/request-pair")
def connect_request_pair(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    """为责任链内两名成员发起连接申请（3D 场景点选两节点）。

    a_id / b_id 二选一可为当前用户自己（等价于 /connect/request）。
    低权限一方作为申请方：低→高需高者审批；同级或高→低自动通过。
    """
    try:
        c = nearby_service.request_connection_pair(
            db, user,
            int(payload.get("a_id", 0)),
            int(payload.get("b_id", 0)),
            payload.get("note", ""),
        )
    except KeyError:
        raise HTTPException(404, "目标用户不存在")
    except PermissionError as e:
        raise HTTPException(403, str(e))
    return {"id": c.id, "status": c.status}


@router.post("/connect/{connection_id}/respond")
def connect_respond(connection_id: int, payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    """审批方通过 / 拒绝连接申请。"""
    try:
        c = nearby_service.respond_connection(db, user, connection_id, bool(payload.get("accept", True)))
    except KeyError:
        raise HTTPException(404, "连接申请不存在")
    except PermissionError as e:
        raise HTTPException(403, str(e))
    return {"id": c.id, "status": c.status}


@router.delete("/connect/{peer_id}")
def connect_cancel(peer_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    """取消（断开）与某同事的连接；待审批申请也会撤回。"""
    try:
        return nearby_service.cancel_connection(db, user, peer_id)
    except KeyError:
        raise HTTPException(404, "连接不存在")


# ---------- 数据互传 ----------

@router.post("/transfer")
def create_transfer(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    try:
        t = nearby_service.create_transfer(
            db, user,
            receiver_id=int(payload.get("receiver_id", 0)),
            direction=payload.get("direction", "send"),
            item_type=payload.get("item_type", "message"),
            item_title=payload.get("item_title", ""),
            payload=payload.get("payload", {}),
            note=payload.get("note", ""),
        )
    except PermissionError as e:
        raise HTTPException(403, str(e))
    return {"id": t.id, "status": t.status}


@router.get("/transfers")
def list_transfers(user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    items = nearby_service.list_transfers(db, user)
    # 为文件类互传附带附件列表（含下载 id）
    file_tids = [i["id"] for i in items if i.get("item_type") == "file"]
    if file_tids:
        rows = db.query(NearbyFile).filter(NearbyFile.transfer_id.in_(file_tids)).all()
        files_by_tid: dict[int, list] = {}
        for r in rows:
            files_by_tid.setdefault(r.transfer_id, []).append(_file_dict(r))
        for i in items:
            if i.get("item_type") == "file":
                i["files"] = files_by_tid.get(i["id"], [])
    return {"items": items}


@router.post("/transfers/{transfer_id}/respond")
def respond(transfer_id: int, payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    try:
        t = nearby_service.respond_transfer(db, user, transfer_id, bool(payload.get("accept", True)))
    except KeyError:
        raise HTTPException(404, "互传记录不存在")
    except PermissionError as e:
        raise HTTPException(403, str(e))
    return {"id": t.id, "status": t.status}


@router.get("/records")
def list_records(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"items": nearby_service.transferable_records(db, user)}


# ---------- 任意格式文件传输 ----------

@router.post("/transfer-file")
async def transfer_file(
    receiver_id: int = Form(...),
    note: str = Form(""),
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_employee_db),
):
    """上传任意格式文件并发起互传：文件落盘 + 元数据入库（nearby_files）。"""
    if not files:
        raise HTTPException(400, "请至少选择一个文件")
    try:
        t = nearby_service.create_transfer(
            db, user, receiver_id=receiver_id, direction="send",
            item_type="file", item_title=f"{len(files)} 个文件",
            payload={"file_count": len(files)}, note=note,
        )
    except PermissionError as e:
        raise HTTPException(403, str(e))

    _FILE_DIR.mkdir(parents=True, exist_ok=True)
    saved = []
    total = 0
    for f in files:
        ext = Path(f.filename or "file").suffix
        stored_name = f"{uuid.uuid4().hex}{ext}"
        dest = _FILE_DIR / stored_name
        with dest.open("wb") as out:
            shutil.copyfileobj(f.file, out)
        size = dest.stat().st_size
        total += size
        rec = NearbyFile(
            transfer_id=t.id, file_name=f.filename or stored_name,
            file_size=size, content_type=f.content_type or "",
            stored_path=stored_name, uploader_id=user.id,
        )
        db.add(rec)
        saved.append(rec)
    t.item_title = f"{len(files)} 个文件 · 共 {round(total / 1024, 1)} KB"
    db.commit()
    return {"id": t.id, "status": t.status, "files": [
        {"id": r.id, "file_name": r.file_name, "file_size": r.file_size} for r in saved
    ]}


def _file_dict(r: NearbyFile) -> dict:
    return {"id": r.id, "file_name": r.file_name, "file_size": r.file_size,
            "content_type": r.content_type}


@router.get("/files/{fid}/download")
def download_file(fid: int, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    """下载互传附件（发送方 / 接收方均可）。"""
    r = db.query(NearbyFile).filter(NearbyFile.id == fid).first()
    if not r:
        raise HTTPException(404, "文件不存在")
    t = nearby_service.NearbyTransfer
    tr = db.query(t).filter(t.id == r.transfer_id).first()
    if not tr or user.id not in (tr.sender_id, tr.receiver_id):
        raise HTTPException(403, "无权访问该文件")
    path = _FILE_DIR / r.stored_path
    if not path.exists():
        raise HTTPException(404, "文件已丢失")
    return FileResponse(path, filename=r.file_name, media_type=r.content_type or "application/octet-stream")


@router.get("/assignees/{uid}")
def team_of(uid: int, user: User = Depends(get_current_user), db: Session = Depends(get_employee_db)):
    """查看某位同事负责的人员（其直接下级）。"""
    target = db.query(User).filter(User.id == uid).first()
    if not target:
        raise HTTPException(404, "用户不存在")
    subs = db.query(User).filter(User.superior_id == uid, User.is_active == True).all()  # noqa: E712
    return {
        "user": {"id": target.id, "real_name": target.real_name, "department": target.department,
                 "title": target.title, "auth_level": target.auth_level},
        "items": [{"id": s.id, "real_name": s.real_name, "department": s.department,
                   "title": s.title, "auth_level": s.auth_level, "role": s.role.value} for s in subs],
    }
