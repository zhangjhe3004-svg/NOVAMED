/**
 * 路由配置 + NocoBase 风格主题（员工系统）
 */
import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import { appTheme } from "./theme";
import zhCN from "antd/locale/zh_CN";
import { AuthProvider, useAuth } from "./stores/auth";
import MainLayout from "./layouts/MainLayout";
import LoginPage from "./pages/Login";
import MessageBridge from "./components/MessageBridge";
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
import MenuStarMap from "./pages/MenuStarMap";
import DeptManage from "./pages/DeptManage";
import PostManage from "./pages/PostManage";
import OperLog from "./pages/OperLog";
import LoginLog from "./pages/LoginLog";
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
import PermissionChain from "./pages/PermissionChain";
import PostLadder from "./pages/PostLadder";
import RoleTrace from "./pages/RoleTrace";
import OrgCanvas from "./pages/OrgCanvas";
import ScheduleManager from "./pages/ScheduleManager";
import StaffPage from "./pages/StaffPage";
import NearbyShare from "./pages/NearbyShare";
import Pharmacy from "./pages/Pharmacy";
import Billing from "./pages/Billing";
import LabTest from "./pages/LabTest";
import Analytics from "./pages/Analytics";
import Hub from "./pages/Hub";
import Tasks from "./pages/Tasks";
import ComingSoon from "./pages/ComingSoon";

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
        {/* antd v6 静态 message 失效 → 用 App 上下文回填（见 MessageBridge） */}
        <MessageBridge />
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
                <Route path="/menu-star" element={<MenuStarMap />} />
                <Route path="/depts" element={<DeptManage />} />
                <Route path="/posts" element={<PostManage />} />
                <Route path="/oper-log" element={<OperLog />} />
                <Route path="/login-log" element={<LoginLog />} />
                <Route path="/admin-review" element={<AdminReview />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/lowcode" element={<LowCodeStudio />} />
                <Route path="/dyn/:collection" element={<DynPage />} />
                <Route path="/lcp/:pageKey" element={<LcpPage />} />
                <Route path="/settings-center" element={<SettingsCenter />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/doctor-workbench" element={<DoctorWorkbench />} />
                <Route path="/supervise-records" element={<SuperviseRecords />} />
                <Route path="/permission-chain" element={<PermissionChain />} />
                <Route path="/post-ladder" element={<PostLadder />} />
                <Route path="/role-trace" element={<RoleTrace />} />
                <Route path="/org-canvas" element={<OrgCanvas />} />
                <Route path="/schedule-source" element={<ScheduleManager />} />
                <Route path="/patient-accounts" element={<PatientAccounts />} />
                <Route path="/staff" element={<StaffPage />} />
                <Route path="/nearby" element={<NearbyShare />} />
                <Route path="/pharmacy" element={<Pharmacy />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/labtest" element={<LabTest />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/hub" element={<Hub />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/coming-soon/:key?" element={<ComingSoon />} />
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
