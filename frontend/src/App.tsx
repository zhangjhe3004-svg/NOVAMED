/**
 * 路由配置 + NocoBase 风格主题（员工系统）
 */
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { ConfigProvider, App as AntApp } from "antd";
import { appTheme } from "./theme";
import zhCN from "antd/locale/zh_CN";
import { AuthProvider, useAuth } from "./stores/auth";
import MainLayout from "./layouts/MainLayout";
import LoginPage from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PatientList from "./pages/PatientList";
import {
  PatientDetailPage,
  PatientCreatePage,
  PatientEditPage,
} from "./pages/PatientDetail";
import RecordList from "./pages/RecordList";
import AIAssistant from "./pages/AIAssistant";
import KnowledgeBase from "./pages/KnowledgeBase";
import UserManagement from "./pages/UserManagement";
import AdminReview from "./pages/AdminReview";
import Settings from "./pages/Settings";
import SettingsCenter from "./pages/SettingsCenter";
import Messages from "./pages/Messages";
import DoctorWorkbench from "./pages/DoctorWorkbench";
import PatientAccounts from "./pages/PatientAccounts";
import LowCodeStudio from "./pages/LowCodeStudio";
import DynPage from "./pages/dyn/DynPage";
import LcpPage from "./pages/dyn/LcpPage";
import SuperviseRecords from "./pages/SuperviseRecords";
import ScheduleManager from "./pages/ScheduleManager";
import StaffPage from "./pages/StaffPage";
const SkillManager = lazy(() => import("./pages/SkillManager"));
const McpManager = lazy(() => import("./pages/McpManager"));
const ConversationManager = lazy(() => import("./pages/ConversationManager"));
const TokenUsage = lazy(() => import("./pages/TokenUsage"));

/** 路由守卫：员工系统未登录跳转到登录页 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<div style={{ padding: 48, textAlign: "center", color: "#999" }}>加载中...</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />

              {/* 受保护页面 */}
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/patients" element={<PatientList />} />
                <Route path="/patients/create" element={<PatientCreatePage />} />
                <Route path="/patients/:id" element={<PatientDetailPage />} />
                <Route path="/patients/:id/edit" element={<PatientEditPage />} />
                <Route path="/records" element={<RecordList />} />
                <Route path="/ai-assistant" element={<AIAssistant />} />
                <Route path="/knowledge" element={<KnowledgeBase />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/admin-review" element={<AdminReview />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/lowcode" element={<LowCodeStudio />} />
                <Route path="/dyn/:collection" element={<DynPage />} />
                <Route path="/lcp/:pageKey" element={<LcpPage />} />
                <Route path="/settings-center" element={<SettingsCenter />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/doctor-workbench" element={<DoctorWorkbench />} />
                <Route path="/supervise-records" element={<SuperviseRecords />} />
                <Route path="/schedule-source" element={<ScheduleManager />} />
                <Route path="/patient-accounts" element={<PatientAccounts />} />
                <Route path="/staff" element={<StaffPage />} />
                <Route path="/ai-mgmt/skills" element={<ErrorBoundary><SkillManager /></ErrorBoundary>} />
                <Route path="/ai-mgmt/mcp" element={<ErrorBoundary><McpManager /></ErrorBoundary>} />
                <Route path="/ai-mgmt/conversations" element={<ErrorBoundary><ConversationManager /></ErrorBoundary>} />
                <Route path="/ai-mgmt/tokens" element={<ErrorBoundary><TokenUsage /></ErrorBoundary>} />
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}
