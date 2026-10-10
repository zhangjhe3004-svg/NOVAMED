# backend/app/api — 路由层

每个文件是一个 FastAPI `APIRouter`，挂载在 `/api/*` 下。`main.py` 直接挂载系统级路由，其余功能路由由插件管理器按启用状态挂载。

| 文件 | 功能 |
| --- | --- |
| `__init__.py` | 包标记（空） |
| `auth.py` | 认证（`/api/auth/login`、card-login、me、改密）+ 用户管理 `admin_router`（`/api/users`） |
| `patients.py` | 患者档案 CRUD / 搜索 / 详情（含病史时间线） |
| `records.py` | 就诊记录 CRUD / 审核 / 相似病例检索 |
| `ai.py` | AI 诊断：工作流节点、防幻觉配置、诊断、文本分析、向量统计 |
| `ai_keys.py` | AI 服务商 API Key 配置（OpenAI/DeepSeek/千问等） |
| `memory.py` | 用户行为记忆与偏好 |
| `knowledge.py` | 医学知识库 CRUD 与统计 |
| `plugins.py` | 插件市场：列表 / 启用 / 禁用（持久化到 plugins_state.json） |
| `token_usage.py` | AI Token 用量统计 |
| `conversation.py` | AI 会话的创建 / 列表 / 详情 / 删除 |
| `audit.py` | 审计日志查询 |
| `notification.py` | 通知列表 / 标记已读 |
| `message.py` | 员工站内消息收发 |
| `appointment.py` | 预约挂号 / 医生接诊 / 患者报到 / 上级脱敏查看 |
| `patient_account.py` | 患者注册 / 验证码发送 |
| `patient_auth.py` | 患者端认证（手机号登录）、患者档案 / 预约 / 就诊记录 |
| `dyn.py` | 动态数据源：集合管理 + 物理表 + 自动 CRUD |
| `pages.py` | 低代码页面 Schema 的增删查 |
| `acl.py` | 数据权限规则（角色 × 集合 × 动作 × 行范围） |
| `biz_workflow.py` | 业务工作流：定义 / 实例 / 审批流转 |
| `schedule.py` | 医生号源排班与放号 / 扣号 |
