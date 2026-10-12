import { createRoot } from 'react-dom/client'
import './index.css'
// 全站表格 / 弹窗 / 表单控件皮肤（对齐 scaffold-master-main 的表格规范）
import './styles/scaffold-tables.css'
import './styles/pages-theme.css'
// Apple 风格高级交互动效系统（全局，员工端 & 患者端共用）
import './styles/apple-motion.css'
// 图谱舞台 / 岗位阶梯 / 角色溯源
import './styles/stage.css'
// 命令面板（⌘K）：结果列表 + 玻璃滑块 + 问系统卡片
import './styles/command.css'
// 组织画布：可平移缩放的树画布
import './styles/org.css'
// 仪表组件库：读数 / 刻度环 / 趋势 / 横条 / 铭牌
import './styles/instruments.css'
// 总览控制台版式（Hero / 两栏骨架 / 待办 / 最近列表）
import './styles/dashboard.css'
import './styles/leave.css'
// AI 辅助诊断页专属版式（左输入轨道 + 右结果舞台）
import './styles/ai.css'
// 登录页动态效果（神经网络 / 秒针时钟 / 开场编排 / 成功三拍）
import './styles/login-fx.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

// 开发环境下 StrictMode 会导致双重渲染，可能导致性能问题和渲染错误
// 生产环境可以启用 StrictMode 来检测潜在问题
const isDev = import.meta.env.DEV

createRoot(document.getElementById('root')!).render(
  isDev ? (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  ) : (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  ),
)