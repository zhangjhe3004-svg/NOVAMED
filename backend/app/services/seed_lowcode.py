"""
员工域低代码引擎播种（幂等）—— 建集合/页面/权限/流程 + 演示数据
"""
import json

from sqlalchemy.orm import Session

from ..core.database import employee_session
from ..models.workspace import DynCollection, PageSchemaModel, AclRule, WorkflowDef
from .dyn_engine import create_collection, insert_row


def seed_lowcode(include_demo_data: bool = False):
    """应用启动时初始化低代码元数据；演示记录仅在开发环境写入。"""
    db: Session = employee_session()
    try:
        _seed_collections(db)
        _seed_pages(db)
        _seed_acl(db)
        _seed_workflow(db)
        if include_demo_data:
            _seed_demo_rows(db)
    finally:
        db.close()


def _seed_collections(db: Session):
    def ensure(name, title, fields, desc):
        # 始终 upsert：已存在的集合也会刷新字段定义（含中文 label）
        create_collection(db, name, title, fields, desc)

    ensure("leave_requests", "请假申请", [
        {"name": "id", "type": "integer", "primary": True},
        {"name": "employee", "type": "string", "label": "员工"},
        {"name": "leave_type", "type": "string", "label": "请假类型"},
        {"name": "start_date", "type": "string", "label": "开始日期"},
        {"name": "days", "type": "number", "label": "时长(天)"},
        {"name": "reason", "type": "text", "label": "请假事由"},
        {"name": "approver", "type": "string", "label": "审批人"},
        {"name": "status", "type": "string", "label": "状态"},
        {"name": "created_at", "type": "string", "label": "提交时间"},
    ], "员工请假审批集合（申请中心）")
    ensure("expense_reports", "报销申请", [
        {"name": "id", "type": "integer", "primary": True},
        {"name": "employee", "type": "string", "label": "员工"},
        {"name": "amount", "type": "number", "label": "金额"},
        {"name": "status", "type": "string", "label": "状态"},
    ], "员工报销审批示例集合")
    ensure("staff_announcements", "院内公告", [
        {"name": "id", "type": "integer", "primary": True},
        {"name": "title", "type": "string", "label": "标题"},
        {"name": "content", "type": "text", "label": "内容"},
        {"name": "published", "type": "string", "label": "发布日期"},
    ], "院内公告集合")
    ensure("staff_schedules", "员工排班", [
        {"name": "id", "type": "integer", "primary": True},
        {"name": "employee", "type": "string", "label": "员工"},
        {"name": "date", "type": "string", "label": "日期"},
        {"name": "shift", "type": "string", "label": "班次"},
    ], "员工排班集合")
    ensure("departments", "科室组织", [
        {"name": "id", "type": "integer", "primary": True},
        {"name": "name", "type": "string", "label": "科室名称"},
        {"name": "leader", "type": "string", "label": "负责人"},
        {"name": "description", "type": "text", "label": "简介"},
    ], "科室组织集合")
    ensure("dept_members", "科室人员名单", [
        {"name": "id", "type": "integer", "primary": True},
        {"name": "department", "type": "string", "label": "科室"},
        {"name": "sub_department", "type": "string", "label": "子科室"},
        {"name": "name", "type": "string", "label": "姓名"},
        {"name": "title", "type": "string", "label": "职务/职称"},
        {"name": "phone", "type": "string", "label": "联系方式"},
        {"name": "status", "type": "string", "label": "在职状态"},
    ], "各科室（含子科室）人员名单集合")


def _seed_pages(db: Session):
    def ensure_page(name, title, blocks, overwrite=False):
        schema = json.dumps({"type": "page", "blocks": blocks}, ensure_ascii=False)
        existing = db.query(PageSchemaModel).filter(PageSchemaModel.name == name).first()
        if not existing:
            db.add(PageSchemaModel(name=name, title=title, schema_json=schema))
        elif overwrite:
            # 种子页面升级（如 staff-leave 申请中心改版）：以代码内定义为准
            existing.title = title
            existing.schema_json = schema

    ensure_page("staff_dashboard", "员工工作台", [
        {"type": "header", "config": {"title": "员工工作台"}},
        {"type": "table", "config": {"collection": "leave_requests", "title": "请假申请"}},
    ])
    ensure_page("staff-announcement", "院内公告", [
        {"type": "header", "config": {"title": "院内公告"}},
        {"type": "table", "config": {"collection": "staff_announcements", "title": "公告列表"}},
    ])
    ensure_page("staff-schedule", "排班表", [
        {"type": "header", "config": {"title": "排班表"}},
        {"type": "table", "config": {"collection": "staff_schedules", "title": "排班列表"}},
    ])
    ensure_page("staff-leave", "请假审批", [
        {"type": "header", "config": {"title": "请假审批"}},
        {"type": "leave_center", "config": {}},
    ], overwrite=True)
    ensure_page("staff-departments", "科室组织", [
        {"type": "header", "config": {"title": "科室组织"}},
        {"type": "table", "config": {"collection": "departments", "title": "科室列表"}},
    ])
    db.commit()


def _seed_acl(db: Session):
    def ensure(role, collection, action, row_scope):
        if not db.query(AclRule).filter(AclRule.role == role, AclRule.collection == collection,
                                        AclRule.action == action).first():
            db.add(AclRule(role=role, collection=collection, action=action, row_scope=row_scope))

    ensure("admin", "leave_requests", "read", "all")
    ensure("admin", "leave_requests", "create", "all")
    ensure("staff", "leave_requests", "read", "own")
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
    """演示数据（仅在空表时写入）

    注意：leave_requests（请假申请）不再写入演示数据——用户明确要求
    「张三/李四」示例永远不再出现（2026-10-11），此处留空占位防止误加回。
    """
    from sqlalchemy import text
    demo = {
        "staff_announcements": [
            {"title": "关于国庆值班安排的通知", "content": "请各科室于本周五前提交值班表。", "published": "2026-09-30"},
            {"title": "院内消防演练通知", "content": "定于本周三下午进行消防演练。", "published": "2026-10-06"},
        ],
        "staff_schedules": [
            {"employee": "张医生", "date": "2026-10-12", "shift": "早班 08:00-16:00"},
            {"employee": "李护士", "date": "2026-10-12", "shift": "晚班 16:00-24:00"},
        ],
        "departments": [
            {"name": "内科", "leader": "王主任", "description": "负责常见内科疾病诊疗"},
            {"name": "外科", "leader": "赵主任", "description": "负责外科手术与创伤处理"},
        ],
    }
    for col, rows in demo.items():
        try:
            existing = db.execute(text(f"SELECT COUNT(*) FROM dyn_{col}")).scalar() or 0
        except Exception:
            existing = 0
        if not existing:
            for r in rows:
                try:
                    insert_row(db, col, r)
                except Exception:
                    pass
