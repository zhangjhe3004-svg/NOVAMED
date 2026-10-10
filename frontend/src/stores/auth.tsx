/**
 * 全局认证状态管理
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { UserInfo } from "../api/auth";

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

  // 使用 useEffect 确保只在客户端执行 localStorage 操作
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");
      setToken(savedToken);
      setUser(savedUser ? JSON.parse(savedUser) : null);
    } catch (error) {
      console.error("Failed to load auth state from localStorage:", error);
    } finally {
      setMounted(true);
    }
  }, []);

  const login = useCallback((user: UserInfo, token: string) => {
    try {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);
      setToken(token);
    } catch (error) {
      console.error("Failed to save auth state to localStorage:", error);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error("Failed to clear auth state from localStorage:", error);
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