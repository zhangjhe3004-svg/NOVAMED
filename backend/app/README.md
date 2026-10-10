# backend/app — 应用主体

| 路径 | 说明 |
| --- | --- |
| [main.py](main.py) | FastAPI 应用入口：生命周期、CORS、系统级路由挂载、默认账号播种 |
| [api](api/README.md) | 各业务模块的路由（HTTP 接口） |
| [core](core/README.md) | 配置、数据库、认证依赖、插件、安全 |
| [models](models/README.md) | SQLAlchemy 数据模型 |
| [schemas](schemas/README.md) | Pydantic 请求/响应模型 |
| [services](services/README.md) | 业务逻辑 / 服务层 |
