/**
 * 共享 API 客户端 —— 封装后端接口调用
 * 基于 fetch + AsyncStorage 持久化 JWT，兼容 React Native 环境。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ApiConfig {
  baseUrl: string;
  tokenKey: string;
  userKey: string;
}

export const defaultConfig: ApiConfig = {
  // 真机访问电脑：用电脑局域网 IP（手机和电脑连同一 WiFi）。
  // Android 模拟器可改回 http://10.0.2.2:18001
  baseUrl: "http://192.168.0.6:18001",
  tokenKey: "medicode_token",
  userKey: "medicode_user",
};

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(defaultConfig.tokenKey);
}

export async function setToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(defaultConfig.tokenKey, token);
  else await AsyncStorage.removeItem(defaultConfig.tokenKey);
}

export async function getUser<T = any>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(defaultConfig.userKey);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setUser(user: any): Promise<void> {
  if (user) await AsyncStorage.setItem(defaultConfig.userKey, JSON.stringify(user));
  else await AsyncStorage.removeItem(defaultConfig.userKey);
}

/**
 * 统一请求方法
 * @param path 相对路径，例如 "/api/auth/login"
 * @param options fetch 选项
 * @param baseUrl 可覆盖 baseUrl
 */
export async function request<T = any>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: any;
    auth?: boolean;
    baseUrl?: string;
  } = {}
): Promise<T> {
  const { method = "GET", body, auth = true, baseUrl } = options;
  const base = baseUrl || defaultConfig.baseUrl;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    await setToken(null);
    await setUser(null);
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail =
      data?.detail || (typeof data === "string" ? data : `请求失败 (${res.status})`);
    throw new ApiError(res.status, detail);
  }

  return data as T;
}
