# backend — 后端服务

FastAPI 应用，采用「员工库 + 患者库」双 SQLite（可切 PostgreSQL）+ MongoDB + 插件化架构。

## 目录

| 路径 | 说明 |
| --- | --- |
| [app](app/README.md) | 应用代码（入口 / API / 核心 / 模型 / 服务） |
| [tests](tests/README.md) | 测试脚本 |

## 启动

```bash
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 18001
```

启动时会自动：初始化双数据库、创建默认管理员（admin/admin）与默认患者账号、尝试连接 MongoDB、预热向量库、注册内置插件、播种低代码元数据。

API 文档：<http://localhost:18001/docs>
