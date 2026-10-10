# frontend — 前端（员工端 + 患者端）

React 19 + TypeScript + Ant Design 6 + Vite。员工端与患者端共用 `src/` 代码，通过两个 Vite 配置分别启动。

## 文件

| 文件 | 说明 |
| --- | --- |
| [package.json](package.json) | 依赖与脚本（dev / dev:patient / build / build:patient） |
| [vite.config.ts](vite.config.ts) | 员工端构建配置（端口 3051，代理 `/api` 到后端） |
| [vite.patient.config.ts](vite.patient.config.ts) | 患者端构建配置（端口 3005） |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 前端故障排查指南 |

## 启动

```bash
npm install          # 首次
npm run dev          # 员工端 http://localhost:3051
npm run dev:patient  # 患者端 http://localhost:3005
```

## 目录

| 路径 | 说明 |
| --- | --- |
| [src](src/README.md) | 源码（路由 / API / 页面 / 布局 / 状态） |
