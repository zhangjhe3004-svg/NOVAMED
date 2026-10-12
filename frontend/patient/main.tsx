import { createRoot } from "react-dom/client";
// Apple 风格高级交互动效系统（与员工端共用同一套动效 token）
import "../src/styles/apple-motion.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
