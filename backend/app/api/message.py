"""
员工消息 API —— /api/messages

支持微信式的双向会话：发送 / 撤回 / 删除（单方隐藏）/ 引用 / 标记已读。
消息按 sender-receiver 成对会话组织，会话列表返回「与我相关的所有会话」。
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_employee_db
from ..core.dependencies import get_current_user
from ..models.models import Message, User

router = APIRouter(prefix="/api/messages", tags=["员工消息"])


class MessageCreate(BaseModel):
    receiver_id: int
    title: str = ""
    content: str = ""
    quote_id: int | None = None


def _msg_dict(m: Message, user_id: int) -> dict:
    """序列化一条消息（对当前用户视角处理删除/撤回）"""
    deleted = m.deleted_by and str(user_id) in [x.strip() for x in m.deleted_by.split(",") if x.strip()]
    content = m.content or ""
    if m.recalled:
        content = ""
    return {
        "id": m.id,
        "sender_id": m.sender_id,
        "receiver_id": m.receiver_id,
        "title": m.title,
        "content": content,
        "is_read": m.is_read,
        "message_type": m.message_type,
        "recalled": bool(m.recalled),
        "deleted": deleted,
        "quote_id": m.quote_id,
        "quote_preview": m.quote_preview or "",
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _serialize(msg: Message, user_id: int, sender_names: dict) -> dict:
    d = _msg_dict(msg, user_id)
    d["sender_name"] = sender_names.get(msg.sender_id, "") if msg.sender_id else "系统"
    d["receiver_name"] = sender_names.get(msg.receiver_id, "")
    return d


@router.get("")
def list_messages(peer_id: int = None, user: User = Depends(get_current_user),
                  db: Session = Depends(get_employee_db)):
    """会话列表：与我相关的所有消息（去重成会话），或与某同事的完整对话（peer_id）"""
    q = db.query(Message)
    if peer_id:
        q = q.filter(
            ((Message.sender_id == user.id) & (Message.receiver_id == peer_id))
            | ((Message.sender_id == peer_id) & (Message.receiver_id == user.id))
        )
    else:
        q = q.filter(
            (Message.sender_id == user.id) | (Message.receiver_id == user.id)
        )
    rows = q.order_by(Message.id.asc()).all()

    # 收集涉及的用户名
    ids = {r.sender_id for r in rows if r.sender_id} | {r.receiver_id for r in rows if r.receiver_id}
    ids.discard(None)
    names = {}
    if ids:
        for u in db.query(User).filter(User.id.in_(ids)).all():
            names[u.id] = u.real_name or u.username

    if peer_id:
        # 过滤对当前用户已删除的消息
        return {"items": [_serialize(m, user.id, names) for m in rows if not _msg_dict(m, user.id)["deleted"]]}

    # 会话聚合：按对方 user_id 分组，返回最后一条消息摘要
    conv = {}
    for m in rows:
        md = _msg_dict(m, user.id)
        if md["deleted"]:
            continue
        other = m.sender_id if m.sender_id != user.id else m.receiver_id
        if other == user.id or other is None:
            continue
        key = other
        prev = conv.get(key)
        last_text = "已撤回" if m.recalled else (m.content or m.title or "")
        unread = (prev["unread"] + 1) if (prev and m.receiver_id == user.id and not m.is_read) else (1 if m.receiver_id == user.id and not m.is_read else 0)
        if prev and m.id > prev["last_id"]:
            conv[key] = {
                **prev,
                "last_id": m.id,
                "last_text": last_text,
                "last_at": m.created_at.isoformat() if m.created_at else None,
                "last_is_me": m.sender_id == user.id,
                "unread": prev["unread"] + (1 if m.receiver_id == user.id and not m.is_read else 0),
                "last_recalled": bool(m.recalled),
            }
        elif not prev:
            conv[key] = {
                "peer_id": other,
                "peer_name": names.get(other, ""),
                "last_id": m.id,
                "last_text": last_text,
                "last_at": m.created_at.isoformat() if m.created_at else None,
                "last_is_me": m.sender_id == user.id,
                "unread": 1 if m.receiver_id == user.id and not m.is_read else 0,
                "last_recalled": bool(m.recalled),
            }
    items = sorted(conv.values(), key=lambda x: x["last_at"] or "", reverse=True)
    return {"items": items}


@router.post("")
def send_message(payload: MessageCreate, user: User = Depends(get_current_user),
                 db: Session = Depends(get_employee_db)):
    if payload.receiver_id == user.id:
        raise HTTPException(status_code=400, detail="不能给自己发消息")
    receiver = db.query(User).filter(User.id == payload.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="接收人不存在")
    quote_preview = ""
    if payload.quote_id:
        qm = db.query(Message).filter(Message.id == payload.quote_id).first()
        if qm:
            quote_preview = (qm.content or qm.title or "")[:60]
    m = Message(sender_id=user.id, receiver_id=payload.receiver_id,
                title=payload.title, content=payload.content,
                quote_id=payload.quote_id, quote_preview=quote_preview)
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "created_at": m.created_at.isoformat() if m.created_at else None}


@router.post("/{mid}/recall")
def recall_message(mid: int, user: User = Depends(get_current_user),
                   db: Session = Depends(get_employee_db)):
    """撤回：仅发送者本人，且 2 分钟内可撤回（微信式时限）"""
    m = db.query(Message).filter(Message.id == mid).first()
    if not m:
        raise HTTPException(status_code=404, detail="消息不存在")
    if m.sender_id != user.id:
        raise HTTPException(status_code=403, detail="只能撤回自己发送的消息")
    if m.created_at and (datetime.now() - m.created_at) > timedelta(minutes=2):
        raise HTTPException(status_code=400, detail="超过 2 分钟，无法撤回")
    m.recalled = True
    db.commit()
    return {"detail": "ok"}


@router.post("/{mid}/delete")
def delete_message(mid: int, user: User = Depends(get_current_user),
                   db: Session = Depends(get_employee_db)):
    """删除：仅对当前用户隐藏（单方删除，对方不受影响）"""
    m = db.query(Message).filter(Message.id == mid).first()
    if not m:
        raise HTTPException(status_code=404, detail="消息不存在")
    if user.id not in (m.sender_id, m.receiver_id):
        raise HTTPException(status_code=403, detail="无权操作该消息")
    cur = [x.strip() for x in (m.deleted_by or "").split(",") if x.strip()]
    if str(user.id) not in cur:
        cur.append(str(user.id))
    m.deleted_by = ",".join(cur)
    db.commit()
    return {"detail": "ok"}


@router.post("/{mid}/read")
def mark_read(mid: int, user: User = Depends(get_current_user),
              db: Session = Depends(get_employee_db)):
    """标记已读（接收者）"""
    m = db.query(Message).filter(Message.id == mid).first()
    if not m:
        raise HTTPException(status_code=404, detail="消息不存在")
    if m.receiver_id != user.id:
        raise HTTPException(status_code=403, detail="无权操作该消息")
    m.is_read = True
    db.commit()
    return {"detail": "ok"}


@router.post("/peer/{peer_id}/read")
def mark_peer_read(peer_id: int, user: User = Depends(get_current_user),
                   db: Session = Depends(get_employee_db)):
    """标记与某同事的全部消息已读（接收者）"""
    rows = db.query(Message).filter(
        Message.receiver_id == user.id,
        Message.sender_id == peer_id,
        Message.is_read == False,
    ).all()
    for m in rows:
        m.is_read = True
    db.commit()
    return {"detail": "ok", "count": len(rows)}
