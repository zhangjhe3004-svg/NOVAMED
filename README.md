# MediCode 医码合一智慧医疗系统

基于 FastAPI + React + SQLite/MongoDB 的全域智慧医疗辅助系统，覆盖员工端（医生/护士/管理员）与患者端。

## 快速开始

```bat
:: 1. 安装依赖（首次）
bat\一键安装.bat

:: 2. 初始化数据库（首次，可跳过，启动时自动建表）
bat\初始化数据库.bat

:: 3. 一键启动（自动检测端口、清缓存、启动后端 + 员工前端 + 患者前端）
bat\一键启动.bat
```

启动后访问：

- 员工端：<http://localhost:3051>（默认账号 `admin / admin`）
- 患者端：<http://localhost:3005>（默认账号 `admin / admin`）
- 后端 API 文档：<http://localhost:18001/docs>

## 环境诊断

```bat
python scripts\dev\doctor.py
```

## 目录结构

| 目录 | 说明 |
| --- | --- |
| [backend](backend/README.md) | FastAPI 后端（API / 模型 / 服务 / 核心） |
| [frontend](frontend/README.md) | React + TypeScript + Ant Design 前端 |
| [bat](bat/README.md) | Windows 双击启动/安装/初始化入口 |
| [scripts](scripts/README.md) | Python/PowerShell 脚本实现 |
| [config](config/README.md) | 配置文件（AI 防幻觉等） |
| [db](db/README.md) | 数据库说明 |
| [docs](docs/README.md) | 使用文档 / 开发文档 / UI 设计预览 |

## 技术栈

- 后端：FastAPI、SQLAlchemy（双 SQLite）、MongoDB/Motor、JWT、FAISS
- 前端：React 19、TypeScript、Ant Design 6、Vite、React Router
- 部署：Docker Compose

## 默认账号

- 员工端管理员：`admin / admin`
- 患者端演示账号：`admin / admin`（手机号 admin）

更多说明见 [docs/使用文档](docs/使用文档/README.md)。
