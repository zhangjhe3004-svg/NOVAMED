# MediCode 移动端（React Native + Expo）

本目录包含 MediCode 智慧医疗系统的两个移动端 App，基于 Expo SDK 57（React Native 0.86 + React 19）开发，与 Web 前端共享同一后端 API。

## 目录结构

```
apk/
├── package.json          # npm workspaces 根
├── apps/
│   ├── staff/            # 员工端 App（医生/护士/管理员）
│   │   ├── App.tsx       # 导航入口
│   │   └── src/screens/  # 登录、工作台、患者、记录、我的
│   └── patient/          # 患者端 App
│       ├── App.tsx
│       └── src/screens/  # 登录、首页、预约、记录、我的
└── packages/
    └── shared/           # 共享包：API 客户端、鉴权、主题、类型
```

## 快速开始

```bash
cd apk
npm install                # 首次安装依赖（workspaces 统一安装）

# 员工端
npm run staff              # 启动 Metro，扫码在 Expo Go 中运行
npm run staff:android      # 直接启动 Android 模拟器

# 患者端
npm run patient
npm run patient:android
```

## 后端 API 对接

移动端通过 `packages/shared/src/api.ts` 对接后端。默认 `baseUrl` 为 `http://10.0.2.2:18001`（Android 模拟器访问宿主机）。

- **真机调试**：将 `baseUrl` 改为后端所在电脑的局域网 IP，例如 `http://192.168.1.100:18001`
- 后端需以 `0.0.0.0:18001` 监听（已默认配置）

### 接口约定（Bearer JWT）

| 端 | 登录接口 | 备注 |
| --- | --- | --- |
| 员工端 | `POST /api/auth/login` | `{username, password}` |
| 患者端 | `POST /api/patient-auth/login` | `{phone, password}` |

## 打包 APK

使用 EAS Build 云端打包，或本地 `npx expo run:android` 生成原生工程后构建：

```bash
cd apps/staff
npx eas build --platform android --profile preview   # 员工端 APK

cd ../patient
npx eas build --platform android --profile preview   # 患者端 APK
```

## 技术栈

- Expo SDK 57 / React Native 0.86 / React 19.2
- React Navigation 7（Stack + Bottom Tabs）
- @react-native-async-storage/async-storage（token 持久化）
- npm workspaces monorepo（共享 `@medicode/shared` 包）
