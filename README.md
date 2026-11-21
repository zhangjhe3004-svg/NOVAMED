# NOVAMED 医院诊疗协同系统

基于 **React 19 + TypeScript + antd 6 + FastAPI + SQLite 双库** 的医院诊疗协同平台，包含员工端（诊疗业务、排班、AI 辅助、附近互传）与患者端（预约挂号、就诊记录、个人中心）。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端（员工端） | React 19、TypeScript、Vite 8、antd 6、Three.js（3D 全息场景）、react-router 7 |
| 前端（患者端） | 同上，独立入口 `vite.patient.config.ts`（端口 3005） |
| 后端 | FastAPI、SQLAlchemy、SQLite 双库（patient.db / employee.db）、插件式路由注册 |
| 3D/全息 | three@0.186 + OrbitControls（Canvas 2D 已升级为真 3D 场景） |

## 快速启动

```bash
# 后端（端口 18001，热重载）
cd backend
uvicorn app.main:app --reload --port 8000   # 实际运行实例监听 18001 时以启动脚本为准

# 前端员工端（端口 3051）
cd frontend
npm install
npm run dev

# 前端患者端（端口 3005）
npm run dev:patient
```

> 常见问题：新增页面/路由后若白屏报 `xx is not defined`，为 Vite HMR 缓存问题 —— 杀掉 dev server、删除 `node_modules/.vite`、重启并硬刷新（Ctrl+Shift+R）。

## 多机并发 / 一机多账户

系统已原生支持**多台电脑并发使用**与**一台电脑多账户同时运行**：

- **多机并发访问**：
  - 后端监听 `0.0.0.0:18001`（`app/core/config.py` 的 `HOST`，或 `bat/一键启动.bat` 中 `--host 0.0.0.0`），局域网内其他电脑通过 `http://<本机IP>:18001` 访问 API
  - 前端 dev server 监听 `0.0.0.0`（vite.config.ts / vite.patient.config.ts），其他电脑可通过 `http://<本机IP>:3051`（员工端）/ `:3005`（患者端）访问
  - CORS 已放开为任意来源（鉴权走 Bearer header，无需 cookie）
  - SQLite 启用 **WAL 模式 + busy_timeout(30s) + 连接池(10+20)**，支持并发读写、缓解写锁竞争；生产高并发建议迁移 PostgreSQL
- **一机多账户同时运行**：
  - 登录态改用 **sessionStorage**（按浏览器标签页隔离），同一浏览器开多个标签页可分别登录不同账户，互不干扰
  - 员工端（`src/stores/auth.tsx`、`src/api/client.ts`）与患者端（`patient/pages/Login.tsx`、`patient/App.tsx`）均已隔离
  - 认证接口限流按「客户端 IP + 路径」计数（60s 内 20 次），多账户并发登录不会触发

> 生产部署建议：将 `app/core/config.py` 的 `SECRET_KEY` 通过环境变量覆盖为强随机值；数据库从 SQLite 迁移到 PostgreSQL + pgbouncer 以支撑万级并发（配置项已预留 `STORAGE_*`）。

## 目录结构

```
NOVAMED/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口（CORS/路由注册/启动任务）
│   │   ├── core/                # 配置、双库引擎（database.py）、依赖（鉴权/管理员）
│   │   ├── models/              # models.py 核心模型 + nearby.py 附近协作模型
│   │   ├── api/                 # 插件式业务路由（auth/appointment/records/nearby/...）
│   │   └── services/            # 业务服务（nearby_service 责任链/连接/互传等）
│   ├── db/                      # 真实数据库 patient.db / employee.db + nearby_files 附件
│   ├── scripts/                 # 一次性数据脚本与种子脚本（归档）
│   ├── data/                    # [遗留] 旧数据库目录，勿使用，真实库在 db/
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── pages/               # 业务页面（NearbyShare 为 3D 附近互传）
│   │   ├── components/          # 通用组件（HolographicScene3D / VoiceTextArea / ApiKeyManager...）
│   │   ├── api/                 # 后端 API 客户端（按域拆分）
│   │   ├── layouts/             # MainLayout 侧边栏/顶栏
│   │   ├── stores/              # auth 等前端状态
│   │   └── _legacy_pages/       # 已断开路由的旧页面（AI 管理等），不参与构建
│   └── scripts/                 # 前端辅助脚本
├── docs/                        # 设计/使用/安全/开发文档（docx）+ 设计预览 HTML
├── scripts/                     # 根级脚本与归档工具
├── config/ bat/                 # 配置与启动脚本
└── docker-compose.yml           # 容器化编排
```

## 核心功能模块

### 员工端
- **工作台**：控制台数据概览、我的接诊、下级诊断记录、导出 Excel
- **诊疗**：患者档案/详情、就诊记录（审核流）、检查检验（LabTest 状态机）、知识库
- **预约闭环**：患者端下单 → 扣号源 → 医生接诊通知 → 完成接诊自动生成病历 → 患者端同步
- **排班**：学习通式年/月/日/周日历、24h 时段排班、号源同步（`POST /api/schedule/sync-from-staff`）
- **运营**：药房管理、财务收费（开单/退费）、运营数据看板
- **附近互传（3D 全息）**：详见 `docs/开发文档/附近互传与连接机制.md`
  - Three.js 3D 全息粒子球节点（jarvis-holographic 风格），左键旋转/滚轮缩放/右键平移
  - 责任链同事层级连线、多连接、搜索员工定位并申请连接
  - 连接审批：低权限→高权限需对方审批，通过后才能互传；可随时断开
  - 任意格式文件传输入库 + 下载；传输记录搜索
- **智能辅助**：AI 辅助诊断（规则引擎+知识库检索）、语音转文字（Web Speech API 全站文本域）
- **系统**：专家·技能·连接器（Hub）、定时任务（后台调度线程）、权限级别管理、用户管理、审计日志

### 患者端
- 登录、预约挂号（真实号源）、就诊记录、报告查询、个人中心（渐变横幅两栏布局）

## 数据库双库分域

| 库 | 表域 |
|---|---|
| `backend/db/patient.db` | patients、patient_accounts、appointments、medical_records、medicines、billing_records、lab_tests、knowledge_docs、doctor_schedules... |
| `backend/db/employee.db` | users、messages、notifications、audit_logs、scheduled_tasks、nearby_transfers、nearby_connections、nearby_files、permission_levels、低代码元数据表... |

新表必须在 `app/core/database.py` 的 `_PATIENT_TABLES` / `_EMPLOYEE_TABLES` 注册，模型在对应 models 文件定义并被 `init_db()` 导入。

## 附近互传连接机制（摘要）

- 模型 `NearbyConnection`（nearby_connections 表）：requester_id / target_id / status（pending/accepted/rejected）
- 规则：申请方权限 **低于** 对方 → `pending` 需对方审批；同级或更高 → 自动 `accepted`
- API：`GET /api/nearby/connections`、`POST /connect/request`、`POST /connect/{id}/respond`、`DELETE /connect/{peer_id}`
- 互传校验：`create_transfer` 同时校验责任链 + 已连接（accepted），未连接返回 403
- 审批/断开均写站内通知（notifications 表）

## 开发约定

- 前端构建验证用 `npx vite build`（`npm run build` 的 `tsc -b` 因缺 tsconfig.json 为既有问题）
- 个人设置页（Settings.tsx）已按原型定稿，只允许增量调整
- lint：`npx oxlint`
- 每次新增页面/路由后提醒用户硬刷新，必要时重启 dev server + 清 `.vite` 缓存
