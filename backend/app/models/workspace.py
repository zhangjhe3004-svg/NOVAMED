"""
员工域低代码引擎元数据模型（NocoBase 风格，employee.db）

├── DynCollection    动态集合定义（元数据建集合 + 物理建表 dyn_<name>）
├── PageSchemaModel  低代码页面 Schema（配置驱动渲染）
├── AclRule          数据权限规则（角色 × 集合 × 动作 × 行范围）
├── WorkflowDef      业务工作流定义（通用审批）
└── WorkflowInstance 业务工作流实例（审批流转）
"""
import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text

from ..core.database import Base


def _now():
    return datetime.datetime.utcnow()


class DynCollection(Base):
    __tablename__ = "dyn_collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(200), default="")
    description = Column(String(500), default="")
    fields_json = Column(Text, default="[]")  # 字段定义
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class PageSchemaModel(Base):
    __tablename__ = "page_schemas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(200), default="")
    schema_json = Column(Text, default="{}")  # 页面 schema
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class AclRule(Base):
    __tablename__ = "acl_rules"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(50), index=True, default="")
    collection = Column(String(100), index=True, default="")
    action = Column(String(50), default="read")  # read/create/update/delete
    row_scope = Column(String(50), default="all")  # all / own / none
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)


class WorkflowDef(Base):
    __tablename__ = "wf_defs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(200), default="")
    trigger_collection = Column(String(100), default="")
    status_field = Column(String(100), default="")
    nodes_json = Column(Text, default="[]")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class WorkflowInstance(Base):
    __tablename__ = "wf_instances"

    id = Column(Integer, primary_key=True, index=True)
    def_id = Column(Integer, index=True, nullable=False)
    row_id = Column(Integer, nullable=True)
    creator_id = Column(Integer, nullable=True, index=True)
    current_index = Column(Integer, default=0)
    assignees_json = Column(Text, default="[]")
    history_json = Column(Text, default="[]")
    status = Column(String(50), index=True, default="审批中")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
