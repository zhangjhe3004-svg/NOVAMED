/**
 * 共享鉴权上下文 —— 提供员工/患者通用的登录态管理
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { getToken, setToken, getUser, setUser } from "./api";

export interface AuthState<T> {
  user: T | null;
  loading: boolean;
  signedIn: boolean;
  signIn: (token: string, user: T) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export function createAuthContext<T>() {
  return createContext<AuthState<T>>({
    user: null,
    loading: true,
    signedIn: false,
    signIn: async () => {},
    signOut: async () => {},
    refreshUser: async () => {},
  });
}

/**
 * 通用鉴权 Provider 工厂
 */
export function createAuthProvider<T>(
  AuthContext: React.Context<AuthState<T>>,
  UserComponent: React.ComponentType<React.PropsWithChildren<{}>>
) {
  return function AuthProvider({ children }: React.PropsWithChildren<{}>) {
    const [user, setUserState] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      (async () => {
        try {
          const token = await getToken();
          const u = await getUser<T>();
          if (token && u) setUserState(u);
        } catch {
          /* ignore */
        } finally {
          setLoading(false);
        }
      })();
    }, []);

    const signIn = async (token: string, u: T) => {
      await setToken(token);
      await setUser(u);
      setUserState(u);
    };

    const signOut = async () => {
      await setToken(null);
      await setUser(null);
      setUserState(null);
    };

    const refreshUser = async () => {
      const u = await getUser<T>();
      if (u) setUserState(u);
    };

    return (
      <AuthContext.Provider
        value={{ user, loading, signedIn: !!user, signIn, signOut, refreshUser }}
      >
        <UserComponent>{children}</UserComponent>
      </AuthContext.Provider>
    );
  };
}

export function useAuth<T>(ctx: React.Context<AuthState<T>>) {
  return useContext(ctx);
}
