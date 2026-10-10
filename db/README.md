# 数据库说明

本系统使用双 SQLite 数据库（开发环境默认），自动建表，无需手动初始化：

- 员工库：`backend/data/employee.db`（用户、消息、通知、审计、用量、会话、低代码元数据）
- 患者库：`backend/data/patient.db`（患者、账号、预约、就诊记录、知识库、号源）

启动后端时会自动执行建表与轻量迁移（见 `backend/app/core/database.py` 的 `init_db()`）。

如需手动重建数据库，删除 `backend/data/*.db` 后重启后端即可。

生产环境可切换为 PostgreSQL（设置 `DATABASE_URL` 环境变量）。
