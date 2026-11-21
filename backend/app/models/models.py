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
    auth_level = Column(Integer, default=1, nullable=False)  # 数字身份权限级别（1-9）
    reg_fee = Column(Integer, default=0, nullable=False)  # 挂号费（分；0=未设定，患者端显示「待定」）


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
    # 扩展：删除/撤回/引用（微信式交互）
    deleted_by = Column(String(200), default="")     # 逗号分隔的 user_id，仅对该用户隐藏
    recalled = Column(Boolean, default=False)        # 撤回（双方均显示「已撤回」）
    quote_id = Column(Integer, nullable=True)        # 引用的消息 id
    quote_preview = Column(String(200), default="")  # 引用消息预览文本


class Notification(Base, TimestampMixin):
    """通知（employee.db）"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    title = Column(String(200), default="")
    content = Column(Text, default="")
    is_read = Column(Boolean, default=False)
    level = Column(String(20), default="info")  # info / warning / error
    link = Column(String(200), default="")  # 相关页面路由，通知可一键跳转处理


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


class LoginLog(Base, TimestampMixin):
    """登录日志（employee.db）"""
    __tablename__ = "login_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String(100), default="")
    ip = Column(String(50), default="")
    status = Column(String(20), default="成功")


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
    ai_suggestion = Column(Text, default="")
    ai_confidence = Column(String(20), default="")
    ai_reviewed = Column(Integer, default=0)
    admin_reviewed = Column(Integer, default=0)
    admin_name = Column(String(100), default="")
    room = Column(String(50), default="")


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


class Medicine(Base, TimestampMixin):
    """药品（药房管理，patient.db）"""
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    spec = Column(String(100), default="")           # 规格（如 0.3g×24片）
    category = Column(String(100), default="")        # 分类（处方药/OTC/中成药等）
    manufacturer = Column(String(200), default="")    # 生产厂家
    unit = Column(String(30), default="盒")           # 单位
    price = Column(Integer, default=0)                # 单价（分，避免浮点误差）
    stock = Column(Integer, default=0)                # 库存
    stock_warning = Column(Integer, default=10)       # 库存预警阈值
    approval_no = Column(String(100), default="")     # 批准文号


class BillingRecord(Base, TimestampMixin):
    """收费记录（财务收费，patient.db）"""
    __tablename__ = "billing_records"

    id = Column(Integer, primary_key=True, index=True)
    bill_no = Column(String(50), index=True, default="")        # 收费单号
    patient_id = Column(Integer, index=True, nullable=True)     # 患者
    patient_name = Column(String(100), default="")
    department = Column(String(100), default="")                # 科室
    items = Column(Text, default="")                             # 收费项目（JSON 数组）
    total_amount = Column(Integer, default=0)                    # 总金额（分）
    payment_method = Column(String(30), default="")              # 支付方式（确认收费方式时填写）
    status = Column(String(30), index=True, default="待收费")    # 待收费/待到账/已收费/已退费
    operator = Column(String(100), default="")                   # 开单收费员
    confirmed_by = Column(String(100), default="")               # 确认收费方式操作员
    confirmed_at = Column(String(30), default="")                # 确认收费方式时间
    paid_by = Column(String(100), default="")                    # 确认到账操作员
    paid_at = Column(String(30), default="")                     # 确认到账时间
    remark = Column(Text, default="")


class LabTest(Base, TimestampMixin):
    """检查检验项目（检查检验，patient.db）"""
    __tablename__ = "lab_tests"

    id = Column(Integer, primary_key=True, index=True)
    test_no = Column(String(50), index=True, default="")        # 检查单号
    patient_id = Column(Integer, index=True, nullable=True)     # 患者
    patient_name = Column(String(100), default="")
    department = Column(String(100), default="")                # 开单科室
    item_name = Column(String(200), default="")                 # 检查项目名
    category = Column(String(50), default="")                   # 分类（检验/影像/超声/内镜/病理）
    status = Column(String(30), index=True, default="待检查")   # 待检查/已采样/检查中/已出报告/已取消
    result = Column(Text, default="")                           # 检查结果/结论
    reference = Column(Text, default="")                        # 参考值/正常范围
    doctor_id = Column(Integer, nullable=True)                  # 开单医生
    doctor_name = Column(String(100), default="")
    operator = Column(String(100), default="")                  # 检查技师/录入人
    remark = Column(Text, default="")


class FamilyHistory(Base, TimestampMixin):
    """家族病史（patient.db）—— 患者个人健康档案的一部分"""
    __tablename__ = "family_history"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, index=True, nullable=False)
    relation = Column(String(50), default="")    # 亲属关系：父亲/母亲/祖父母/兄弟姐妹等
    disease = Column(String(200), default="")    # 疾病名称
    onset_age = Column(String(20), default="")   # 发病年龄
    note = Column(Text, default="")              # 备注


class PatientNotification(Base, TimestampMixin):
    """患者通知（patient.db）—— 患者端消息/通知中心"""
    __tablename__ = "patient_notifications"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, index=True, nullable=False)
    title = Column(String(200), default="")
    content = Column(Text, default="")
    is_read = Column(Boolean, default=False)
    level = Column(String(20), default="info")   # info / warning / success
    kind = Column(String(30), default="system")  # system / appointment / report


class ScannedDocument(Base, TimestampMixin):
    """扫描文档归档（patient.db）—— 拍照/扫描件 + 本地 OCR 识别文本

    通过 patient_id / record_id / labtest_id 三个可空外键，关联到
    患者档案、就诊记录、检查检验任意一个业务对象（也可都为空，作通用归档）。
    images 存 JSON 数组（base64，前端已压缩），ocr_text 为 tesseract.js 本地识别结果。
    """
    __tablename__ = "scanned_documents"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, index=True, nullable=True)   # 关联患者
    record_id = Column(Integer, index=True, nullable=True)    # 关联就诊记录
    labtest_id = Column(Integer, index=True, nullable=True)   # 关联检查检验
    title = Column(String(200), default="")
    category = Column(String(30), default="病历")  # 病历/处方/检验单/影像/证件/其他
    images = Column(Text, default="[]")            # JSON 数组存 base64（前端压缩）
    ocr_text = Column(Text, default="")            # OCR 识别文本
    created_by = Column(Integer, nullable=True)    # 录入员工 id
    created_by_name = Column(String(100), default="")


class ScheduledTask(Base, TimestampMixin):
    """定时任务（员工域 employee.db）"""
    __tablename__ = "scheduled_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)       # 所属用户
    name = Column(String(200), nullable=False)                  # 任务名称
    # once=指定时间一次 / daily=每天 / weekly=每周几 / interval=固定间隔分钟
    schedule_type = Column(String(20), default="daily")
    schedule_time = Column(String(10), default="09:00")          # HH:MM（once/daily/weekly 用）
    interval_minutes = Column(Integer, default=60)               # interval 用
    weekdays = Column(String(20), default="1,2,3,4,5")           # weekly 用（1=周一）
    run_at = Column(String(30), default="")                      # once 用（YYYY-MM-DD HH:MM）
    action = Column(String(30), default="notify")                # 动作：notify=站内通知提醒
    payload = Column(Text, default="")                           # 动作内容（通知正文）
    enabled = Column(Boolean, default=True)
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True, index=True)
    run_count = Column(Integer, default=0)


class SysRole(Base, TimestampMixin):
    """角色（employee.db）—— 角色管理页 CRUD 实体（对齐 scaffold sys_role）"""
    __tablename__ = "sys_roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    code = Column(String(50), index=True, nullable=False)
    data_scope = Column(String(20), default="SELF")   # ALL/DEPT_AND_CHILD/DEPT/SELF/CUSTOM
    sort = Column(Integer, default=0)
    status = Column(Integer, default=1)               # 1 正常 / 0 停用
    builtin = Column(Boolean, default=False)
    remark = Column(String(200), default="")


class SysRoleMenu(Base, TimestampMixin):
    """角色-菜单授权（employee.db）—— menu_id（整数，指向 menu_items.id，含 dir/menu/btn 三级）为权威粒度。

    menu_key 为 legacy 字符串导航 key 列（保留以兼容旧数据，由 core/rbac.migrate_role_menus 迁移到 menu_id）。
    """
    __tablename__ = "sys_role_menus"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, index=True, nullable=False)
    menu_id = Column(Integer, index=True, nullable=True)
    menu_key = Column(String(80), nullable=False, default="")


class SysUserRole(Base):
    """用户-角色关联（employee.db）—— 对齐 scaffold sys_user_role（user_id, role_id 复合主键）。

    说明：本表是用户角色的**权威来源**（支持多角色叠加）；users.role 枚举作为「主角色」
    提示保留以向后兼容，由 core/rbac.sync_user_primary_role 在角色变更时同步。
    """
    __tablename__ = "sys_user_role"

    user_id = Column(Integer, primary_key=True, index=True, nullable=False)
    role_id = Column(Integer, primary_key=True, index=True, nullable=False)


class MenuItem(Base, TimestampMixin):
    """菜单（employee.db）—— 菜单管理页 CRUD 实体（对齐 scaffold sys_menu：目录/页面/按钮三级）"""
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, default=0, index=True)   # 0=顶级
    type = Column(String(10), default="menu")            # dir 目录 / menu 页面 / btn 按钮
    name = Column(String(50), nullable=False)
    icon = Column(String(50), default="")
    path = Column(String(120), default="")               # 路由路径（dir/menu）
    component = Column(String(120), default="")          # 组件路径（menu）
    permission = Column(String(80), default="", index=True)  # 权限标识：页面=导航 key（与角色授权对应），按钮=medicode:<key>:<action>
    sort = Column(Integer, default=0)
    visible = Column(Integer, default=1)                 # 1 显示 / 0 隐藏
    status = Column(Integer, default=1)                  # 1 正常 / 0 停用
    builtin = Column(Boolean, default=False)             # 与前端导航同步的内置项（可编辑不可删导航主体？预留）


class SysDept(Base, TimestampMixin):
    """部门（employee.db）—— 部门管理页 CRUD 实体（对齐 scaffold sys_dept：组织架构树）"""
    __tablename__ = "sys_depts"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, default=0, index=True)   # 0=顶级
    name = Column(String(100), nullable=False)
    leader = Column(String(64), default="")              # 负责人（用户 real_name）
    phone = Column(String(32), default="")
    email = Column(String(128), default="")
    sort = Column(Integer, default=0)
    status = Column(Integer, default=1)                  # 1 正常 / 0 停用


class SysPost(Base, TimestampMixin):
    """岗位（employee.db）—— 岗位管理页 CRUD 实体（对齐 scaffold sys_post）"""
    __tablename__ = "sys_posts"

    id = Column(Integer, primary_key=True, index=True)
    post_code = Column(String(64), nullable=False, index=True)  # 岗位编码
    post_name = Column(String(100), nullable=False)             # 岗位名称
    sort = Column(Integer, default=0)
    status = Column(Integer, default=1)                         # 1 正常 / 0 停用
    remark = Column(String(500), default="")


class SysDictType(Base, TimestampMixin):
    """字典类型（employee.db）—— 字典管理页 CRUD 实体（对齐 scaffold sys_dict_type）"""
    __tablename__ = "sys_dict_types"

    id = Column(Integer, primary_key=True, index=True)
    dict_name = Column(String(100), nullable=False)             # 字典名称
    dict_type = Column(String(100), nullable=False, index=True, unique=True)  # 字典编码
    status = Column(Integer, default=1)                         # 1 正常 / 0 停用
    remark = Column(String(500), default="")


class SysDictData(Base, TimestampMixin):
    """字典数据（employee.db）—— 字典管理页抽屉 CRUD 实体（对齐 scaffold sys_dict_data）"""
    __tablename__ = "sys_dict_data"

    id = Column(Integer, primary_key=True, index=True)
    dict_type = Column(String(100), nullable=False, index=True)  # 所属字典类型编码
    dict_label = Column(String(100), nullable=False)             # 显示标签
    dict_value = Column(String(100), nullable=False)             # 实际键值
    sort = Column(Integer, default=0)                            # 排序号
    status = Column(Integer, default=1)                          # 1 正常 / 0 停用
    tone = Column(String(32), default="")                        # 标签色调 neutral/ok/info/danger
    is_default = Column(Integer, default=0)                      # 1 默认项 / 0 否
    remark = Column(String(500), default="")


class SysConfig(Base, TimestampMixin):
    """参数配置（employee.db）—— 参数管理页 CRUD 实体（对齐 scaffold sys_config）"""
    __tablename__ = "sys_configs"

    id = Column(Integer, primary_key=True, index=True)
    config_name = Column(String(100), nullable=False)            # 参数名称
    config_key = Column(String(100), nullable=False, index=True, unique=True)  # 参数键名
    config_value = Column(String(500), nullable=False)           # 参数值
    config_type = Column(String(1), default="N")                 # Y 系统内置 / N 自定义
    builtin = Column(Boolean, default=False)                     # 内置参数：不可删除、键名不可改
    remark = Column(String(500), default="")


class GenTable(Base, TimestampMixin):
    """代码生成表配置（employee.db）—— 代码生成页导入的数据表（对齐 scaffold gen_table）"""
    __tablename__ = "gen_tables"

    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String(100), nullable=False, index=True, unique=True)  # 数据库表名
    table_comment = Column(String(200), default="")              # 表说明
    class_name = Column(String(100), nullable=False)             # 后端实体类名（大驼峰）
    module_name = Column(String(64), nullable=False)             # 模块名称
    business_name = Column(String(64), nullable=False)           # 业务名称
    synced = Column(Boolean, default=True)                       # 是否确认字段配置


class GenTableColumn(Base, TimestampMixin):
    """代码生成字段配置（employee.db）—— 导入表的字段映射（对齐 scaffold gen_table_column）"""
    __tablename__ = "gen_table_columns"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, nullable=False, index=True)       # 所属 gen_tables.id
    column_name = Column(String(100), nullable=False)            # 数据库字段名
    field_name = Column(String(100), nullable=False)             # 模型字段名（snake_case）
    py_type = Column(String(64), nullable=False)                 # Python 类型 str/int/float/bool/datetime
    db_type = Column(String(64), nullable=False)                 # SQLite 声明类型
    column_comment = Column(String(200), default="")             # 字段说明
    is_insert = Column(Boolean, default=True)                    # 是否新增字段
    is_edit = Column(Boolean, default=True)                      # 是否编辑字段
    is_list = Column(Boolean, default=True)                      # 是否列表展示
    is_query = Column(Boolean, default=False)                    # 是否查询字段
    query_type = Column(String(32), default="=")                 # 查询方式 LIKE / =
    form_type = Column(String(64), default="文本框")              # 表单控件类型
    required = Column(Boolean, default=False)                    # 是否必填
    sort = Column(Integer, default=0)                            # 排序号
