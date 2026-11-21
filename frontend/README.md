# frontend — NOVAMED Web 前端

基于 **React 19 + TypeScript + Vite 8 + antd 6 + Three.js**，包含员工端与患者端双入口。

## 目录结构

```
frontend/
├── src/                        # 员工端源码
│   ├── pages/                  # 业务页面（NearbyShare 为 3D 附近互传）
│   ├── components/             # 通用组件
│   ├── api/                    # 后端 API 客户端
│   ├── layouts/                # 布局（侧边栏 / 顶栏）
│   ├── stores/                 # 前端状态
│   ├── styles/                 # 全局样式与主题
│   └── _legacy_pages/          # 已断开路由的旧页面
├── patient/                    # 患者端独立入口
├── vite.config.ts              # 员工端构建配置
└── vite.patient.config.ts      # 患者端构建配置
```

## 启动

```bash
cd frontend
npm install

# 员工端（端口 3051）
npm run dev

# 患者端（端口 3005）
npm run dev:patient
```

## 构建

```bash
npm run build           # 员工端
npm run build:patient   # 患者端
```
