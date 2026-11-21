import { createRoot } from "react-dom/client";
// 自托管字体：Inter（拉丁/数字，保时捷工程感）+ 思源黑体 Noto Sans SC（中文，替代微软雅黑）
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/700.css";
// Apple 风格高级交互动效系统（与员工端共用同一套动效 token）
import "../src/styles/apple-motion.css";
// 仪表组件库（读数/刻度环/趋势/铭牌）：患者端首页仪器化复用员工端同一套读数元件
import "../src/styles/instruments.css";
// 患者端仪表配色覆盖（青绿色系，不改变员工端颜色）
import "../src/styles/patient-instruments.css";
// 液态玻璃（Glassmorphism）全局皮肤 —— 必须最后引入，确保覆盖既有皮肤
import "../src/styles/glassmorphism.css";
// 患者端 body 覆盖：Soft Utility 深青灰分层底（非纯黑），压掉员工端深宇宙紫光斑
import "../src/styles/patient-body.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
