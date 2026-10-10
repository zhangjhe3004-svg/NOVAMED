# backend/app/core — 核心基础设施

| 文件 | 功能 |
| --- | --- |
| `config.py` | 应用配置（Pydantic Settings，支持 `.env` 与环境变量覆盖） |
| `database.py` | 员工库 / 患者库双引擎与会话工厂、建表、轻量迁移 |
| `dependencies.py` | FastAPI 依赖：JWT 解析、`get_current_user`、`require_admin`、`require_doctor`、患者认证 |
| `mongodb.py` | MongoDB 异步客户端、集合与索引初始化、优雅降级 |
| `plugin_manager.py` | NocoBase 风格插件管理器（生命周期钩子 + 路由挂载） |
| `plugins.py` | 内置插件注册与启停状态持久化 |
| `security.py` | 密码哈希（bcrypt）与 JWT 生成 / 解码 |
