"""
员工域低代码引擎播种（幂等）—— 建集合/页面/权限/流程 + 演示数据
"""
import json

from sqlalchemy.orm import Session

from ..core.database import employee_session
from ..models.workspace import DynCollection, PageSchemaModel, AclRule, WorkflowDef
from .dyn_engine import create_collection, insert_row


def seed_lowcode():
    """应用启动时调用：初始化员工域低代码元数据与演示数据（幂等）"""
    db: Session = employee_session()
    try:
        _seed_collections(db)
        _seed_pages(db)
        _seed_acl(db)
        _seed_workflow(db)
        _seed_demo_rows(db)
    finally:
        db.close()


def _seed_collections(db: Session):
    if db.query(DynCollection).count() == 0:
        create_collection(db, "leave_requests", "请假申请", [
            {"name": "id", "type": "integer", "primary": True},
            {"name": "employee", "type": "string"},
            {"name": "days", "type": "integer"},
            {"name": "reason", "type": "text"},
            {"name": "status", "type": "string"},
        ], "员工请假审批示例集合")
        create_collection(db, "expense_reports", "报销申请", [
            {"name": "id", "type": "integer", "primary": True},
            {"name": "employee", "type": "string"},
            {"name": "amount", "type": "number"},
            {"name": "status", "type": "string"},
        ], "员工报销审批示例集合")


def _seed_pages(db: Session):
    if db.query(PageSchemaModel).count() == 0:
        db.add(PageSchemaModel(name="staff_dashboard", title="员工工作台",
                               schema_json=json.dumps({"type": "page", "blocks": [
                                   {"type": "header", "config": {"title": "员工工作台"}},
                                   {"type": "table", "config": {"collection": "leave_requests"}},
                               ]}, ensure_ascii=False)))
        db.commit()


def _seed_acl(db: Session):
    if db.query(AclRule).count() == 0:
        db.add_all([
            AclRule(role="admin", collection="leave_requests", action="read", row_scope="all"),
            AclRule(role="admin", collection="leave_requests", action="create", row_scope="all"),
            AclRule(role="staff", collection="leave_requests", action="read", row_scope="own"),
        ])
        db.commit()


def _seed_workflow(db: Session):
    if db.query(WorkflowDef).count() == 0:
        db.add(WorkflowDef(
            key="leave_approval", title="请假审批",
            trigger_collection="leave_requests", status_field="status",
            nodes_json=json.dumps({"nodes": [
                {"name": "上级审批", "assign_type": "superior", "assign_value": ""},
                {"name": "人事复核", "assign_type": "role", "assign_value": "admin"},
            ], "running_status": "审批中", "done_status": "已批准", "reject_status": "已驳回"}, ensure_ascii=False),
            enabled=True,
        ))
        db.commit()


def _seed_demo_rows(db: Session):
    """演示数据（仅在空表时写入）"""
    from sqlalchemy import text
    try:
        existing = db.execute(text("SELECT COUNT(*) FROM dyn_leave_requests")).scalar() or 0
    except Exception:
        existing = 0
    if not existing:
        try:
            insert_row(db, "leave_requests", {"employee": "张三", "days": 3, "reason": "年假", "status": "审批中"})
        except Exception:
            pass
