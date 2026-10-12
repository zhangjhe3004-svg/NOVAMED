"""
附近协作服务：责任链计算 + 数据互传访问控制 + 数字权限级别播种
"""
import json
from typing import List, Dict

from sqlalchemy.orm import Session

from ..models.models import User, MedicalRecord, Notification
from ..models.nearby import PermissionLevel, NearbyTransfer, NearbyConnection

# 默认 1-9 级数字权限（按数字对身份权限分类，级别越高权限越大）
DEFAULT_LEVELS = [
    (1, "一级·访客", "仅可查看公告与本人提交的工单"),
    (2, "二级·普通员工", "查看本科室基础数据"),
    (3, "三级·专员", "读写本科室业务数据"),
    (4, "四级·高级专员", "跨科室只读协作"),
    (5, "五级·主管", "管理本组下级并审批"),
    (6, "六级·经理", "管理科室数据与人员"),
    (7, "七级·总监", "全院数据分析"),
    (8, "八级·院领导", "全院数据读写与策略"),
    (9, "九级·超级管理员", "系统全权限与安全审计"),
]


def _user_brief(u: User, relation: str) -> dict:
    return {
        "id": u.id,
        "real_name": u.real_name or u.username,
        "username": u.username,
        "role": u.role.value,
        "auth_level": u.auth_level or 1,
        "department": u.department or "",
        "title": u.title or "",
        "phone": u.phone or "",
        "relation": relation,
        "superior_id": u.superior_id,
    }


def responsibility_peers(db: Session, user: User) -> List[dict]:
    """返回当前员工责任链内可互传的同事：向上所有上级 + 向下所有下级（去重、排除自己）。"""
    peers: Dict[int, dict] = {}
    visited = {user.id}

    # 向上：沿 superior_id 追溯所有上级
    cur_id = user.superior_id
    while cur_id and cur_id not in visited:
        visited.add(cur_id)
        sup = db.query(User).filter(User.id == cur_id).first()
        if not sup:
            break
        peers[sup.id] = _user_brief(sup, "上级")
        cur_id = sup.superior_id

    # 向下：广度优先遍历所有下级
    frontier = [user.id]
    while frontier:
        subs = db.query(User).filter(User.superior_id.in_(frontier)).all()
        frontier = []
        for s in subs:
            if s.id not in visited:
                visited.add(s.id)
                peers[s.id] = _user_brief(s, "下级")
                frontier.append(s.id)

    return list(peers.values())


def can_reach(db: Session, user: User, target_id: int) -> bool:
    """校验目标是否在当前员工的责任链内。"""
    return any(p["id"] == target_id for p in responsibility_peers(db, user))


# ---------- 连接（互传授权） ----------

def _notify(db: Session, user_id: int, title: str, content: str, level: str = "info"):
    db.add(Notification(user_id=user_id, title=title, content=content, level=level))


def _connection_dict(c: NearbyConnection, users: dict[int, User]) -> dict:
    return {
        "id": c.id,
        "requester_id": c.requester_id,
        "target_id": c.target_id,
        "requester_name": users[c.requester_id].real_name if c.requester_id in users else "?",
        "target_name": users[c.target_id].real_name if c.target_id in users else "?",
        "requester_level": users[c.requester_id].auth_level if c.requester_id in users else 1,
        "target_level": users[c.target_id].auth_level if c.target_id in users else 1,
        "status": c.status,
        "note": c.note or "",
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def connected_peer_ids(db: Session, user_id: int) -> List[int]:
    """与某员工已建立连接（accepted）的全部对方 id。"""
    rows = db.query(NearbyConnection).filter(
        NearbyConnection.status == "accepted",
        (NearbyConnection.requester_id == user_id) | (NearbyConnection.target_id == user_id),
    ).all()
    return [c.target_id if c.requester_id == user_id else c.requester_id for c in rows]


def request_connection(db: Session, requester: User, target_id: int, note: str = "") -> NearbyConnection:
    """发起连接申请：低权限 → 高权限需审批；同级或高 → 低自动通过。"""
    target = db.query(User).filter(User.id == target_id).first()
    if not target:
        raise KeyError("目标用户不存在")
    if target.id == requester.id:
        raise PermissionError("不能与自己建立连接")
    if not can_reach(db, requester, target_id):
        raise PermissionError("只能与责任链内的同事建立连接")
    # 已有 accepted 连接则直接返回
    existing = db.query(NearbyConnection).filter(
        NearbyConnection.status == "accepted",
        ((NearbyConnection.requester_id == requester.id) & (NearbyConnection.target_id == target_id))
        | ((NearbyConnection.requester_id == target_id) & (NearbyConnection.target_id == requester.id)),
    ).first()
    if existing:
        return existing
    # 有历史 rejected 记录则复活该记录，否则新建
    pending = db.query(NearbyConnection).filter(
        ((NearbyConnection.requester_id == requester.id) & (NearbyConnection.target_id == target_id))
        | ((NearbyConnection.requester_id == target_id) & (NearbyConnection.target_id == requester.id)),
        NearbyConnection.status.in_(["pending", "rejected"]),
    ).order_by(NearbyConnection.id.desc()).first()
    rq_level = requester.auth_level or 1
    tg_level = target.auth_level or 1
    need_approval = rq_level < tg_level  # 低 → 高：需审批
    if pending:
        c = pending
        c.requester_id = requester.id
        c.target_id = target.id
        c.note = note or ""
    else:
        c = NearbyConnection(requester_id=requester.id, target_id=target.id, note=note or "")
        db.add(c)
    if need_approval:
        c.status = "pending"
        db.commit(); db.refresh(c)
        _notify(db, target.id, "收到连接申请",
                f"{requester.real_name or requester.username}（L{rq_level}）请求与你建立附近互传连接"
                + (f"：{note}" if note else ""))
    else:
        c.status = "accepted"
        db.commit(); db.refresh(c)
        _notify(db, target.id, "新的互传连接",
                f"{requester.real_name or requester.username}（L{rq_level}）已与你建立附近互传连接")
    db.commit()
    return c


def request_connection_pair(db: Session, actor: User, a_id: int, b_id: int, note: str = "") -> NearbyConnection:
    """为责任链内任意两名成员发起连接申请（3D 场景点选两节点场景）。

    权限级别低的一方作为申请方：低 → 高需高者审批；同级或高 → 低自动通过。
    actor 必须是管理员，或 a、b 均在 actor 的责任链内。
    """
    if a_id == b_id:
        raise PermissionError("不能与同一人建立连接")
    a = db.query(User).filter(User.id == a_id).first()
    b = db.query(User).filter(User.id == b_id).first()
    if not a or not b:
        raise KeyError("目标用户不存在")
    # 权限校验：管理员可直接操作；否则两人都必须在 actor 的责任链内
    if (actor.role or "").value != "admin":
        if not (can_reach(db, actor, a_id) and can_reach(db, actor, b_id)):
            raise PermissionError("只能为责任链内的同事建立连接")

    # 已有 accepted 连接则直接返回
    existing = db.query(NearbyConnection).filter(
        NearbyConnection.status == "accepted",
        ((NearbyConnection.requester_id == a_id) & (NearbyConnection.target_id == b_id))
        | ((NearbyConnection.requester_id == b_id) & (NearbyConnection.target_id == a_id)),
    ).first()
    if existing:
        return existing

    # 低权限一方作为申请方；同级时 a 为申请方
    a_level = a.auth_level or 1
    b_level = b.auth_level or 1
    if a_level <= b_level:
        requester, target = a, b
    else:
        requester, target = b, a
    rq_level = requester.auth_level or 1
    tg_level = target.auth_level or 1
    need_approval = rq_level < tg_level  # 低 → 高：需审批

    pending = db.query(NearbyConnection).filter(
        ((NearbyConnection.requester_id == requester.id) & (NearbyConnection.target_id == target.id))
        | ((NearbyConnection.requester_id == target.id) & (NearbyConnection.target_id == requester.id)),
        NearbyConnection.status.in_(["pending", "rejected"]),
    ).order_by(NearbyConnection.id.desc()).first()
    if pending:
        c = pending
        c.requester_id = requester.id
        c.target_id = target.id
        c.note = note or ""
    else:
        c = NearbyConnection(requester_id=requester.id, target_id=target.id, note=note or "")
        db.add(c)

    actor_name = actor.real_name or actor.username
    if need_approval:
        c.status = "pending"
        db.commit(); db.refresh(c)
        _notify(db, target.id, "收到连接申请",
                f"{actor_name} 代 {requester.real_name or requester.username}（L{rq_level}）"
                f"向你发起附近互传连接申请" + (f"：{note}" if note else ""))
        _notify(db, requester.id, "连接申请已提交",
                f"{actor_name} 已替你向 {target.real_name or target.username}（L{tg_level}）发起连接申请，等待对方审批")
    else:
        c.status = "accepted"
        db.commit(); db.refresh(c)
        _notify(db, target.id, "新的互传连接",
                f"{actor_name} 已为你们建立附近互传连接：{requester.real_name or requester.username}（L{rq_level}）↔ {target.real_name or target.username}（L{tg_level}）")
        _notify(db, requester.id, "新的互传连接",
                f"{actor_name} 已为你与 {target.real_name or target.username}（L{tg_level}）建立附近互传连接")
    db.commit()
    return c


def respond_connection(db: Session, user: User, connection_id: int, accept: bool) -> NearbyConnection:
    """审批方处理连接申请。"""
    c = db.query(NearbyConnection).filter(NearbyConnection.id == connection_id).first()
    if not c:
        raise KeyError("连接申请不存在")
    if c.target_id != user.id:
        raise PermissionError("只有申请的接收方才能审批")
    if c.status != "pending":
        raise PermissionError("该申请已处理")
    users = {u.id: u for u in db.query(User).filter(User.id.in_([c.requester_id, c.target_id])).all()}
    requester = users.get(c.requester_id)
    c.status = "accepted" if accept else "rejected"
    if accept and requester:
        _notify(db, c.requester_id, "连接申请已通过",
                f"{user.real_name or user.username} 已通过你的连接申请，现在可以互相传输文件")
    elif requester:
        _notify(db, c.requester_id, "连接申请被拒绝",
                f"{user.real_name or user.username} 拒绝了你的连接申请", level="warning")
    db.commit(); db.refresh(c)
    return c


def cancel_connection(db: Session, user: User, peer_id: int) -> dict:
    """取消（断开）与某同事的连接；待审批申请也可撤回。双方任一方均可断开。"""
    c = db.query(NearbyConnection).filter(
        ((NearbyConnection.requester_id == user.id) & (NearbyConnection.target_id == peer_id))
        | ((NearbyConnection.requester_id == peer_id) & (NearbyConnection.target_id == user.id)),
        NearbyConnection.status.in_(["accepted", "pending"]),
    ).order_by(NearbyConnection.id.desc()).first()
    if not c:
        raise KeyError("连接不存在")
    was_accepted = c.status == "accepted"
    c.status = "rejected"
    db.commit()
    other_id = peer_id
    users = {u.id: u for u in db.query(User).filter(User.id.in_([user.id, other_id])).all()}
    other = users.get(other_id)
    if other and was_accepted:
        _notify(db, other_id, "互传连接已断开",
                f"{user.real_name or user.username} 断开了与你的附近互传连接", level="warning")
    return {"detail": "ok", "peer_id": peer_id}


def list_connection_items(db: Session, user: User) -> dict:
    """我的连接数据：已连接对方 id 列表 + 待我审批的申请 + 我发出的申请状态。"""
    users = {u.id: u for u in db.query(User).all()}
    rows = db.query(NearbyConnection).filter(
        (NearbyConnection.requester_id == user.id) | (NearbyConnection.target_id == user.id),
    ).order_by(NearbyConnection.id.desc()).all()
    return {
        "connected_ids": connected_peer_ids(db, user.id),
        "incoming_pending": [_connection_dict(c, users) for c in rows
                             if c.target_id == user.id and c.status == "pending"],
        "outgoing": [_connection_dict(c, users) for c in rows
                     if c.requester_id == user.id and c.status in ("pending", "rejected")],
    }


def create_transfer(db: Session, sender: User, receiver_id: int, direction: str,
                    item_type: str, item_title: str, payload: dict, note: str = "") -> NearbyTransfer:
    """创建互传记录；需在责任链内且已建立连接（accepted）。"""
    if not can_reach(db, sender, receiver_id):
        raise PermissionError("只能与责任链内的上级或下级进行数据互传")
    if receiver_id not in connected_peer_ids(db, sender.id):
        raise PermissionError("尚未与对方建立连接（低权限需先向对方申请，审批通过后才能传输）")
    t = NearbyTransfer(
        sender_id=sender.id,
        receiver_id=receiver_id,
        direction=direction if direction in ("send", "request") else "send",
        item_type=item_type,
        item_title=item_title,
        payload=json.dumps(payload, ensure_ascii=False),
        note=note,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def list_transfers(db: Session, user: User) -> List[dict]:
    """当前员工作为发送方或接收方的全部互传记录。"""
    items = (
        db.query(NearbyTransfer)
        .filter((NearbyTransfer.sender_id == user.id) | (NearbyTransfer.receiver_id == user.id))
        .order_by(NearbyTransfer.id.desc())
        .all()
    )
    users = {u.id: u for u in db.query(User).all()}
    out = []
    for t in items:
        out.append({
            "id": t.id,
            "sender_id": t.sender_id,
            "receiver_id": t.receiver_id,
            "sender_name": (users[t.sender_id].real_name if t.sender_id in users else "?"),
            "receiver_name": (users[t.receiver_id].real_name if t.receiver_id in users else "?"),
            "direction": t.direction,
            "item_type": t.item_type,
            "item_title": t.item_title,
            "payload": json.loads(t.payload or "{}"),
            "status": t.status,
            "note": t.note,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })
    return out


def respond_transfer(db: Session, user: User, transfer_id: int, accept: bool) -> NearbyTransfer:
    """接收方处理互传记录。"""
    t = db.query(NearbyTransfer).filter(NearbyTransfer.id == transfer_id).first()
    if not t:
        raise KeyError("互传记录不存在")
    if t.receiver_id != user.id:
        raise PermissionError("只有接收方才能处理该记录")
    t.status = "已接收" if accept else "已拒绝"
    db.commit()
    db.refresh(t)
    return t


def transferable_records(db: Session, user: User) -> List[dict]:
    """可传输的就诊记录：仅限本人负责（doctor_id == 本人）的记录。"""
    rows = (
        db.query(MedicalRecord)
        .filter(MedicalRecord.doctor_id == user.id)
        .order_by(MedicalRecord.id.desc())
        .all()
    )
    return [{
        "id": r.id, "patient_id": r.patient_id, "diagnosis": r.diagnosis or "",
        "symptoms": r.symptoms or "", "prescription": r.prescription or "",
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]


def seed_permission_levels():
    """幂等播种默认 1-9 级数字权限（由 main 启动时调用）。"""
    from ..core.database import employee_session
    db = employee_session()
    try:
        for level, name, desc in DEFAULT_LEVELS:
            if not db.query(PermissionLevel).filter(PermissionLevel.level == level).first():
                db.add(PermissionLevel(level=level, name=name, description=desc, permissions="[]", enabled=True))
        db.commit()
    finally:
        db.close()
