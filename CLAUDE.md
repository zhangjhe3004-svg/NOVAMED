# MediCode 全域智慧医疗系统

> **本文档是桥接文件**：完整、人看的《项目与技术文档》见 **`docs/开发文档/技术文档.md`**；面向用户的操作说明见 **`docs/使用文档/使用教程.md`**。
> 为了不产生两份内容漂移，本文件只保留 AI Agent 在开发时需要的最关键上下文与约定，详细阐述一律以 `docs/开发文档/技术文档.md` 为准。
> 若需查看/修改某项规定的详细内容，请打开 `docs/开发文档/技术文档.md` 对应章节。

---

## 一、项目速览

- **名称**：MediCode全域智慧医疗系统（暂定名）
- **一句话**：运行在本地/边缘设备上的智能医疗辅助系统，能存患者数据、分析病史、AI 辅助医生诊断。
- **技术栈**：Python 3.11 + FastAPI + SQLAlchemy(2.0) + Pydantic(2)｜React 18 + TypeScript + Vite + Ant Design 5（Material 3 主题）｜SQLite(开发)/PostgreSQL(生产) + MongoDB(可选) + FAISS 向量搜索。
- **AI 方案**：混合模式 = 规则引擎 + 相似病例/知识库检索（离线、默认）+ 可选云端大模型（OpenAI/DeepSeek/通义千问/Claude）。

---

## 二、启动与账号

```bash
# 一键启动（推荐）：双击 bat\一键启动.bat（首次先 bat\一键安装.bat）
# 手动：
cd backend && uvicorn app.main:app --reload --port 18001   # 后端, 接口文档 /docs
cd frontend && npm run dev                                # 员工前端, 端口 3051
cd frontend && npm run dev:patient                        # 患者前端, 端口 3052
# 数据库初始化：python scripts/init_databases.py
```
默认账号：**admin / admin**（管理员）。

---

## 三、目录结构（关键）

```
MediCode/
├── docs/                    # ★ 文档总目录
│   ├── 使用文档/            # 面向用户：使用教程 / 启动指南 / 故障排查 / 端口说明
│   └── 开发文档/            # 面向开发者：技术文档 / 未完成功能 / 技术栈与实现 / 设计方案等
├── config/                  # ★ 业务配置集中（agent_config.json）
├── CLAUDE.md                # 本文（AI Agent 桥接，留在根目录）
├── scripts/                  # 数据库初始化脚本 / 插件安装脚本
│   ├── init_databases.py
│   ├── install_all_marketplace_plugins.ps1
│   └── plugin_install_log.txt
├── docker/                   # Docker 配置文件
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
├── frontend/  src/{api, blocks, pages, layouts}
├── backend/   app/{api, core, services, models}
│   ├── core/plugin_manager.py   # 插件化：Plugin 基类 + PluginManager
│   ├── core/plugins.py          # 内置插件注册 + 启停持久化
│   ├── services/diagnosis_workflow.py  # 配置驱动诊断工作流
│   └── data/                    # SQLite + plugins_state.json + workflow_override.json
├── bat/                        # 精简后 4 个脚本：一键启动(含端口切换)/一键安装/初始化数据库/端口工具
└── Port/                       # select_free_port.ps1（被 bat 调用）
```

---

## 四、关键约定（AI Agent 必须遵守）

1. **不要复制大段文档进本文件**。详细内容（架构/状态/路线图/数据库/AI训练/硬件/术语）在 `docs/开发文档/技术文档.md`。
2. **AI 防幻觉是核心特性**，改动 AI 诊断务必保留：证据分级、引用核查、撤回兜底、医生确认门控、低温参数(0.2)。配置源 `config/agent_config.json`，加载器 `backend/app/core/agent_config.py`。
3. **插件化**：后端功能模块是插件（`core/plugins.py` 注册），新增模块要注册为插件并挂载 router；启停写在 `backend/data/plugins_state.json`（重启生效）。
4. **配置驱动工作流**：AI 诊断为节点化（`diagnosis_workflow.py`），节点可开关/排序，由 `config/agent_config.json -> diagnosis_workflow.pipeline` 或 `POST /api/ai/workflow` 编排。
5. **前端区块化**：页面由 Schema 区块驱动（`frontend/src/blocks/`），新增区块用 `registerBlock(type, component)`。
6. **医疗合规**：AI 建议仅供参考，最终须由执业医师确认；敏感数据本地处理。

---

## 五、文档索引（避免漂移）

| 想看什么 | 去哪 |
|---------|------|
| 项目/架构/技术栈/功能/路线图/数据库/AI训练/API/术语 | `docs/开发文档/技术文档.md` |
| 启动/登录/配置Key/诊断/结果解读/低代码工作台/FAQ | `docs/使用文档/使用教程.md` |
| 一键启动 / 安装 / 初始化数据库 / 端口 | `bat/` 内 `一键启动.bat`、`一键安装.bat`、`初始化数据库.bat`、`端口工具.bat`；说明见 `docs/使用文档/端口说明.md` |

> 若你正在开发，改动功能后请同步更新 `docs/开发文档/技术文档.md`（「已实现功能/技术数据/API」等章节），保持文档与代码一致。
