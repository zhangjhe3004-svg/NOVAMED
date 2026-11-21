# backend — NOVAMED 后端服务

基于 **FastAPI + SQLAlchemy + SQLite 多库** 的智能医疗后端，为员工端与患者端提供 REST API，支持多租户数据存储与医院级数据安全。

## 目录结构

```
backend/
├── app/
│   ├── main.py          # FastAPI 入口（CORS / 路由注册 / 启动任务）
│   ├── core/            # 配置、多库引擎、依赖（鉴权 / 管理员）
│   ├── models/          # 核心模型 + 附近协作模型
│   ├── schemas/         # Pydantic 请求 / 响应模型
│   ├── api/             # 插件式业务路由
│   └── services/        # 业务服务层
├── db/                  # 真实数据库（employee.db / patient.db / storage.db）
├── scripts/             # 种子 / 一次性数据脚本
├── data/                # [遗留] 旧数据库目录
├── tests/               # 后端测试
└── requirements.txt     # Python 依赖
```

## 启动

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 18001
```

环境变量见根目录 `.env.example`，复制为 `backend/.env` 后按需填写。
