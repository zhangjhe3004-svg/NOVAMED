/**
 * 全局认证状态管理
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { logout as logoutApi, type UserInfo } from "../api/auth";

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  isLoggedIn: boolean;
  login: (user: UserInfo, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // 使用 useEffect 确保只在客户端执行 sessionStorage 操作
  // sessionStorage 按标签页隔离，支持同一浏览器多标签页分别登录不同账户
  useEffect(() => {
    try {
      const savedToken = sessionStorage.getItem("token");
      const savedUser = sessionStorage.getItem("user");
      setToken(savedToken);
      setUser(savedUser ? JSON.parse(savedUser) : null);
    } catch (error) {
      console.error("Failed to load auth state from sessionStorage:", error);
    } finally {
      setMounted(true);
    }
  }, []);

  const login = useCallback((user: UserInfo, token: string) => {
    try {
      sessionStorage.setItem("token", token);
      sessionStorage.setItem("user", JSON.stringify(user));
      setUser(user);
      setToken(token);
    } catch (error) {
      console.error("Failed to save auth state to sessionStorage:", error);
    }
  }, []);

  const logout = useCallback(() => {
    // 先调用后端退出接口，生成「时间+员工姓名.sql」并归档到永不初始化的会话库
    try {
      logoutApi().catch(() => {});
    } catch (error) {
      console.error("Failed to submit session archive:", error);
    }
    try {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error("Failed to clear auth state from sessionStorage:", error);
    }
  }, []);

  // 在未挂载前不渲染子组件，避免 SSR 问题
  if (!mounted) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoggedIn: !!token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}