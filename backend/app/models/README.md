# backend/app/models — 数据模型

SQLAlchemy 模型，统一注册到 `core/database.py` 的 `Base`，由 `init_db()` 按表名分库建表。

| 文件 | 功能 |
| --- | --- |
| `__init__.py` | 导出核心模型（便捷导入） |
| `models.py` | 核心模型：员工域（User/Message/Notification/AuditLog/TokenUsage/Conversation/UserPreference/SessionRecord）与患者域（Patient/PatientAccount/Appointment/MedicalRecord/RecordComment/DoctorSchedule/KnowledgeDoc） |
| `workspace.py` | 员工域低代码元数据：DynCollection / PageSchemaModel / AclRule / WorkflowDef / WorkflowInstance |
