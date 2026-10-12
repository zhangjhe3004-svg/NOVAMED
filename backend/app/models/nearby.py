"""
附近协作与数字权限模型（employee.db）

├── PermissionLevel  数字身份权限级别（管理员配置 1-9 级，按数字分类）
└── NearbyTransfer   责任链内员工间数据互传记录（类三星「附近设备」互传）
"""
import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text

from ..core.database import Base


def _now():
    return datetime.datetime.utcnow()


class PermissionLevel(Base):
    """数字身份权限级别：按数字（1-9）对身份权限分类。"""
    __tablename__ = "permission_levels"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(Integer, unique=True, index=True, nullable=False)
    name = Column(String(100), default="")
    description = Column(String(500), default="")
    permissions = Column(Text, default="[]")  # JSON 数组：该级别允许的操作
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class NearbyTransfer(Base):
    """员工间数据互传记录（仅限责任链内：上级 / 下级）。"""
    __tablename__ = "nearby_transfers"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, index=True, nullable=False)
    receiver_id = Column(Integer, index=True, nullable=False)
    direction = Column(String(20), default="send")  # send 发送 / request 请求
    item_type = Column(String(50), default="message")  # message/record/text/file/profile
    item_title = Column(String(300), default="")
    payload = Column(Text, default="{}")  # JSON：传输的内容快照
    status = Column(String(30), index=True, default="待处理")  # 待处理/已接收/已拒绝/已完成
    note = Column(String(500), default="")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class NearbyFile(Base):
    """互传附件：任意格式文件入库（磁盘存储 + 元数据记录）。"""
    __tablename__ = "nearby_files"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, index=True, nullable=False)   # 所属互传记录
    file_name = Column(String(300), default="")                 # 原始文件名
    file_size = Column(Integer, default=0)                      # 字节
    content_type = Column(String(150), default="")
    stored_path = Column(String(500), default="")               # 磁盘相对路径
    uploader_id = Column(Integer, index=True, nullable=False)   # 上传者
    created_at = Column(DateTime, default=_now)


class NearbyConnection(Base):
    """员工间连接（互传授权）：低权限向高权限发起申请，高权限审批通过后才能互传。

    status: pending 待审批 / accepted 已连接 / rejected 已拒绝
    权限低 → 权限高：需对方审批；同级或权限高 → 权限低：自动通过。
    """
    __tablename__ = "nearby_connections"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, index=True, nullable=False)  # 发起方（低权限）
    target_id = Column(Integer, index=True, nullable=False)     # 审批方（高权限）
    status = Column(String(20), index=True, default="pending")  # pending/accepted/rejected
    note = Column(String(300), default="")                      # 申请备注
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
