"""
核心数据模型 —— 员工域（employee.db）与患者域（patient.db）

说明：
├── 员工库 employee.db：用户、消息、通知、审计、用量、会话、偏好、记忆
├── 患者库 patient.db：患者、账号、预约、就诊记录、知识库、评论、号源
└── 两库通过 SQLAlchemy Base 统一元数据，由 database.init_db() 按表名分库建表
"""
import enum
import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Enum

from ..core.database import Base


def _now():
    return datetime.datetime.utcnow()


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    NURSE = "nurse"
    STAFF = "staff"
    SENIOR = "senior"


class Gender(str, enum.Enum):
    MALE = "男"
    FEMALE = "女"
    OTHER = "其他"


class TimestampMixin:
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


# ============================================================ 员工域

class User(Base, TimestampMixin):
    """员工/系统用户（employee.db）"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    real_name = Column(String(100), default="")
    role = Column(Enum(UserRole), default=UserRole.STAFF, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    superior_id = Column(Integer, nullable=True)  # 上级（工作流审批人解析）

    # 联系方式
    phone = Column(String(50), default="")
    email = Column(String(120), default="")

    # 证件信息（支持身份证/工号卡 NFC 自动登录）
    id_type = Column(String(50), default="")
    id_number = Column(String(50), default="")
    surname = Column(String(50), default="")
    given_name = Column(String(50), default="")
    valid_until = Column(String(50), default="")
    issue_date = Column(String(50), default="")
    registered_place = Column(String(200), default="")

    # 员工信息
    employee_no = Column(String(50), default="")
    department = Column(String(100), default="")
    title = Column(String(50), default="")
    work_status = Column(String(20), default="在职")


class Message(Base, TimestampMixin):
    """员工站内消息（employee.db）"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, nullable=True)
    receiver_id = Column(Integer, index=True, nullable=False)
    title = Column(String(200), default="")
    content = Column(Text, default="")
    is_read = Column(Boolean, default=False)
    message_type = Column(String(50), default="system")


class Notification(Base, TimestampMixin):
    """通知（employee.db）"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    title = Column(String(200), default="")
    content = Column(Text, default="")
    is_read = Column(Boolean, default=False)
    level = Column(String(20), default="info")  # info / warning / error


class AuditLog(Base, TimestampMixin):
    """审计日志（employee.db）"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String(100), default="")
    action = Column(String(100), index=True, nullable=False)
    resource = Column(String(200), default="")
    detail = Column(Text, default="")
    ip = Column(String(50), default="")


class TokenUsage(Base, TimestampMixin):
    """AI Token 用量统计（employee.db）"""
    __tablename__ = "token_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    provider = Column(String(50), default="")
    model = Column(String(100), default="")
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)


class Conversation(Base, TimestampMixin):
    """AI 会话（employee.db）"""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    title = Column(String(200), default="")
    messages = Column(Text, default="[]")  # JSON 数组


class UserPreference(Base, TimestampMixin):
    """用户偏好记忆（employee.db）"""
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, unique=True, nullable=False)
    preferences = Column(Text, default="{}")  # JSON


class SessionRecord(Base, TimestampMixin):
    """用户会话记录/行为记忆（employee.db）"""
    __tablename__ = "session_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    action = Column(String(100), default="")
    payload = Column(Text, default="{}")  # JSON


# ============================================================ 患者域

class Patient(Base, TimestampMixin):
    """患者档案（patient.db）"""
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    gender = Column(Enum(Gender), default=Gender.OTHER)
    phone = Column(String(50), index=True, default="")
    id_card = Column(String(50), index=True, default="")
    birth_date = Column(String(50), default="")
    address = Column(String(300), default="")
    medical_history = Column(Text, default="")


class PatientAccount(Base, TimestampMixin):
    """患者登录账号（patient.db）"""
    __tablename__ = "patient_accounts"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, index=True, nullable=False)
    id_type = Column(String(50), default="居民身份证")
    id_number = Column(String(50), index=True, default="")
    surname = Column(String(50), default="")
    given_name = Column(String(50), default="")
    valid_until = Column(String(50), default="")
    issue_date = Column(String(50), default="")
    registered_place = Column(String(200), default="")
    phone = Column(String(50), index=True, default="")
    password_hash = Column(String(255), default="")
    status = Column(String(20), default="已注册")


class Appointment(Base, TimestampMixin):
    """预约挂号（patient.db）"""
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, index=True, nullable=False)
    patient_id = Column(Integer, index=True, nullable=True)
    patient_name = Column(String(100), default="")
    phone = Column(String(50), default="")
    hospital = Column(String(200), default="")
    department = Column(String(100), default="")
    date = Column(String(50), default="")
    time_slot = Column(String(50), default="")
    symptoms = Column(Text, default="")
    status = Column(String(30), index=True, default="待就诊")  # 待就诊/已报到/已完成/已取消
    diagnosis = Column(Text, default="")
    prescription = Column(Text, default="")
    notes = Column(Text, default="")


class MedicalRecord(Base, TimestampMixin):
    """就诊记录（patient.db）"""
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, index=True, nullable=False)
    doctor_id = Column(Integer, nullable=True)
    appointment_id = Column(Integer, nullable=True)
    symptoms = Column(Text, default="")
    diagnosis = Column(Text, default="")
    prescription = Column(Text, default="")
    notes = Column(Text, default="")
    review_status = Column(String(30), default="待审核")


class RecordComment(Base, TimestampMixin):
    """就诊记录评论/AI审核意见（patient.db）"""
    __tablename__ = "record_comments"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, index=True, nullable=False)
    author = Column(String(100), default="")
    content = Column(Text, default="")
    kind = Column(String(30), default="comment")  # comment / ai_review


class DoctorSchedule(Base, TimestampMixin):
    """医生号源排班（patient.db）"""
    __tablename__ = "doctor_schedules"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, index=True, nullable=False)
    date = Column(String(50), index=True, default="")
    time_slot = Column(String(50), default="")
    department = Column(String(100), default="")
    total = Column(Integer, default=0)
    remaining = Column(Integer, default=0)


class KnowledgeDoc(Base, TimestampMixin):
    """医学知识库文档（patient.db）"""
    __tablename__ = "knowledge_docs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    category = Column(String(100), index=True, default="")
    tags = Column(String(500), default="")
    content = Column(Text, default="")
