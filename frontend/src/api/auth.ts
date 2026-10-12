/**
 * 认证相关 API
 */
import api from "./client";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserInfo {
  id: number;
  username: string;
  real_name: string;
  role: string;
  phone?: string;
  email?: string;
  id_number?: string;
  employee_no?: string;
  department?: string;
  title?: string;
  work_status?: string;
  auth_level?: number;
  superior_id?: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserInfo;
}

/** 登录 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await api.post("/auth/login", data);
  return res.data;
}

/** 卡片/证件自动登录（NFC 读到工号/身份证号后调用） */
export async function cardLogin(cardNo: string): Promise<LoginResponse> {
  const res = await api.post("/auth/card-login", { card_no: cardNo });
  return res.data;
}

/** 获取当前用户信息 */
export async function getMe(): Promise<UserInfo> {
  const res = await api.get("/auth/me");
  return res.data;
}

/** 退出登录（触发后端会话归档：时间+员工姓名.sql） */
export async function logout(): Promise<any> {
  const res = await api.post("/auth/logout");
  return res.data;
}
