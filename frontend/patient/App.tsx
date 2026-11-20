import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import { patientTheme } from "../src/theme";
import PatientConsole from "../src/pages/PatientConsole";

/** 员工端（统一登录入口）地址：患者端不再提供独立登录页，未登录一律回员工端 */
const STAFF_ORIGIN: string =
  import.meta.env.VITE_STAFF_ORIGIN || (import.meta.env.DEV ? "http://localhost:3051" : window.location.origin);

/* ── SSO 落地引导：员工端登录页「患者登录」直通 ──
   跳转形如 /patient-console#/sso=<token>。模块加载即解析（先于任何路由守卫）：
   token 写入 sessionStorage（患者端会话键），随后抹掉 hash 防止残留/刷新重放。 */
(function patientSsoBootstrap() {
  const m = window.location.hash.match(/^#\/sso=(.+)$/);
  if (!m) return;
  try {
    const token = decodeURIComponent(m[1]);
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("patient_token", token);
  } catch { /* 忽略：无效 token 交由登录守卫处理 */ }
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
})();

function RequirePatient({ children }: { children: React.ReactNode }) {
  const token = sessionStorage.getItem("token");
  if (!token) {
    // 患者端已移除独立登录页：未登录一律回到员工端统一登录页
    window.location.href = `${STAFF_ORIGIN}/login`;
    return null;
  }
  return <>{children}</>;
}

/** 患者端路由容器：随 pathname 重放苹果式淡入上浮转场，并复位滚动位置 */
function PatientRoutes() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div key={location.pathname} className="md-route-host md-page-enter">
      <Routes>
        {/* 患者端只保留登录后的控制台；门户首页/登录/注册页已移除，统一走员工端登录 */}
        <Route path="/patient-console" element={<RequirePatient><PatientConsole /></RequirePatient>} />
        <Route path="*" element={<Navigate to="/patient-console" replace />} />
      </Routes>
    </div>
  );
}

export default function PatientApp() {
  return (
    <ConfigProvider locale={zhCN} theme={patientTheme}>
      <AntApp>
        <BrowserRouter>
          <PatientRoutes />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
