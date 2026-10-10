"""
通用业务工作流引擎 —— 对齐 NocoBase 的工作流编排（非 AI 诊断专用）

概念：
├── wf_defs        流程定义：key / trigger_collection / status_field / meta_json(节点+状态)
├── wf_instances   流程实例：当前节点 / 当前审批人 / 流转历史 / 关联动态行
├── 触发：新建命中 trigger_collection 的集合行 → 自动创建实例并置「审批中」
└── 流转：任一审批人 approve / reject → 推进到下一节点或终态，并回写动态行状态字段

节点：
{ "name": "上级审批", "assign_type": "superior|role", "assign_value": "admin" }
审批人解析：superior → 发起人的上级(superior_id)；role → 该角色所有启用用户；两者都取不到 → 管理员兜底。
"""
import datetime
import json
from typing import List, Optional

from sqlalchemy.orm import Session

from ..models.workspace import WorkflowDef, WorkflowInstance
from ..models.models import User, UserRole

DEFAULT_RUNNING = "审批中"
DEFAULT_DONE = "已批准"
DEFAULT_REJECT = "已驳回"


class WFError(Exception):
    status_code = 400

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _now() -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def def_meta(defn: WorkflowDef) -> dict:
    """解析 nodes_json：兼容 {nodes:[...], running_status...} 或 [node,...] 两种形态"""
    raw = defn.nodes_json or "[]"
    try:
        obj = json.loads(raw)
    except Exception:
        obj = []
    if isinstance(obj, dict):
        nodes = obj.get("nodes") or []
        return {
            "nodes": nodes,
            "running_status": obj.get("running_status", DEFAULT_RUNNING),
            "done_status": obj.get("done_status", DEFAULT_DONE),
            "reject_status": obj.get("reject_status", DEFAULT_REJECT),
        }
    return {"nodes": obj, "running_status": DEFAULT_RUNNING,
            "done_status": DEFAULT_DONE, "reject_status": DEFAULT_REJECT}


# ---------------------------------------------------------------- 定义

def list_defs(db: Session) -> List[dict]:
    defs = db.query(WorkflowDef).order_by(WorkflowDef.id.asc()).all()
    return [_def_dict(d) for d in defs]


def _def_dict(d: WorkflowDef) -> dict:
    meta = def_meta(d)
    return {
        "id": d.id, "key": d.key, "title": d.title,
        "trigger_collection": d.trigger_collection,
        "status_field": d.status_field,
        "enabled": bool(d.enabled),
        "nodes": meta["nodes"],
        "running_status": meta["running_status"],
        "done_status": meta["done_status"],
        "reject_status": meta["reject_status"],
        "created_at": d.created_at, "updated_at": d.updated_at,
    }


def get_def(db: Session, key: str) -> Optional[WorkflowDef]:
    return db.query(WorkflowDef).filter(WorkflowDef.key == key).first()


def upsert_def(db: Session, key: str, title: str, trigger_collection: Optional[str],
               status_field: Optional[str], nodes: List[dict],
               running_status: str = DEFAULT_RUNNING, done_status: str = DEFAULT_DONE,
               reject_status: str = DEFAULT_REJECT, enabled: bool = True) -> dict:
    d = get_def(db, key)
    meta = json.dumps({
        "nodes": nodes or [],
        "running_status": running_status, "done_status": done_status, "reject_status": reject_status,
    }, ensure_ascii=False)
    if not d:
        d = WorkflowDef(key=key, title=title, trigger_collection=trigger_collection,
                        status_field=status_field, nodes_json=meta, enabled=1 if enabled else 0)
        db.add(d)
    else:
        d.title = title
        d.trigger_collection = trigger_collection
        d.status_field = status_field
        d.nodes_json = meta
        d.enabled = 1 if enabled else 0
    db.commit()
    return _def_dict(d)


def set_def_enabled(db: Session, key: str, enabled: bool) -> dict:
    d = get_def(db, key)
    if not d:
        raise WFError("流程不存在", 404)
    d.enabled = 1 if enabled else 0
    db.commit()
    return _def_dict(d)


def delete_def(db: Session, key: str) -> None:
    d = get_def(db, key)
    if not d:
        raise WFError("流程不存在", 404)
    db.delete(d)
    db.commit()


# ---------------------------------------------------------------- 审批人解析

def _resolve_assignees(db: Session, node: dict, creator_id: Optional[int]) -> List[int]:
    assign_type = node.get("assign_type", "role")
    assign_value = node.get("assign_value", "admin")
    ids: List[int] = []

    if assign_type == "superior":
        if creator_id:
            creator = db.query(User).filter(User.id == creator_id).first()
            if creator and getattr(creator, "superior_id", None):
                ids.append(creator.superior_id)
    else:
        q = db.query(User).filter(User.is_active == True)  # noqa: E712
        try:
            role = UserRole(assign_value)
            q = q.filter(User.role == role)
        except ValueError:
            pass
        ids = [u.id for u in q.all()]

    if not ids:
        admins = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active == True).all()  # noqa: E712
        ids = [u.id for u in admins]

    return ids


# ---------------------------------------------------------------- 实例触发与流转

def trigger(db: Session, key: str, row_id: Optional[int], creator_id: Optional[int] = None) -> Optional[dict]:
    """集合行新建时触发：命中流程定义则创建实例并置「审批中」"""
    d = get_def(db, key)
    if not d or not d.enabled:
        return None
    meta = def_meta(d)
    nodes = meta["nodes"]
    if not nodes:
        return None
    first = nodes[0]
    assignees = _resolve_assignees(db, first, creator_id)
    inst = WorkflowInstance(
        def_id=d.id, row_id=row_id,
        current_index=0,
        assignees_json=json.dumps(assignees, ensure_ascii=False),
        history_json=json.dumps([], ensure_ascii=False),
        status=meta["running_status"],
    )
    db.add(inst)
    db.commit()
    return _instance_dict(db, inst)


def approve(db: Session, instance_id: int, actor_id: int, comment: str = "") -> Optional[dict]:
    return _transit(db, instance_id, actor_id, comment, approve=True)


def reject(db: Session, instance_id: int, actor_id: int, comment: str = "") -> Optional[dict]:
    return _transit(db, instance_id, actor_id, comment, approve=False)


def _transit(db: Session, instance_id: int, actor_id: int, comment: str, approve: bool):
    inst = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
    if not inst:
        raise WFError("实例不存在", 404)
    d = db.query(WorkflowDef).filter(WorkflowDef.id == inst.def_id).first()
    meta = def_meta(d)
    nodes = meta["nodes"]
    history = json.loads(inst.history_json or "[]")
    history.append({
        "node": nodes[inst.current_index].get("name") if inst.current_index < len(nodes) else "",
        "actor_id": actor_id, "action": "approve" if approve else "reject",
        "comment": comment, "at": _now(),
    })
    inst.history_json = json.dumps(history, ensure_ascii=False)

    if not approve:
        inst.status = meta["reject_status"]
        inst.assignees_json = "[]"
    else:
        nxt = inst.current_index + 1
        if nxt >= len(nodes):
            inst.status = meta["done_status"]
            inst.assignees_json = "[]"
            inst.current_index = nxt
        else:
            inst.current_index = nxt
            assignees = _resolve_assignees(db, nodes[nxt], None)
            inst.assignees_json = json.dumps(assignees, ensure_ascii=False)
    db.commit()
    return _instance_dict(db, inst)


def list_instances(db: Session, def_key: Optional[str] = None, status: Optional[str] = None) -> List[dict]:
    q = db.query(WorkflowInstance)
    if def_key:
        d = get_def(db, def_key)
        if d:
            q = q.filter(WorkflowInstance.def_id == d.id)
    if status:
        q = q.filter(WorkflowInstance.status == status)
    return [_instance_dict(db, i) for i in q.order_by(WorkflowInstance.id.desc()).all()]


def _instance_dict(db: Session, i: WorkflowInstance) -> dict:
    d = db.query(WorkflowDef).filter(WorkflowDef.id == i.def_id).first()
    return {
        "id": i.id,
        "def_key": d.key if d else "",
        "def_title": d.title if d else "",
        "row_id": i.row_id,
        "current_index": i.current_index,
        "assignees": json.loads(i.assignees_json or "[]"),
        "history": json.loads(i.history_json or "[]"),
        "status": i.status,
        "created_at": i.created_at,
        "updated_at": i.updated_at,
    }
