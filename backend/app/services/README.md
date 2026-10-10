# backend/app/services — 服务层

承载业务逻辑，不直接依赖 HTTP 请求对象。

| 文件 | 功能 |
| --- | --- |
| `__init__.py` | 包标记（空） |
| `auth.py` | 认证业务：登录 / 建用户 / 改密 / 用户列表与更新 |
| `biz_workflow.py` | 通用业务工作流引擎（定义 / 触发 / 审批 / 驳回 / 审批人解析） |
| `dyn_engine.py` | 动态集合引擎（元数据建集合 + 物理建表 + 自动 CRUD） |
| `acl_service.py` | 数据权限判定（行范围解析） |
| `vector_db.py` | FAISS 向量相似度搜索（无依赖时优雅降级） |
| `user_memory.py` | 用户行为记录与偏好（个性化推荐） |
| `seed_lowcode.py` | 员工域低代码引擎播种（建集合 / 页面 / 权限 / 流程 + 演示数据，幂等） |
