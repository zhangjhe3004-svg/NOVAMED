/**
 * 参数管理 API —— 对应后端 /api/configs
 */
import api from "./client";

export interface ConfigItem {
  id: number;
  name: string;
  key: string;
  value: string;
  type: string;
  builtin: boolean;
  remark: string;
  created_at: string | null;
  create_time: string | null;
}

export interface ConfigPayload {
  name: string;
  key: string;
  value: string;
  builtin?: boolean;
  remark?: string;
}

export const listConfigs = (params: { page?: number; page_size?: number; keyword?: string } = {}) =>
  api.get("/configs", { params }).then((r) => r.data as { total: number; items: ConfigItem[] });

export const createConfig = (body: ConfigPayload) => api.post("/configs", body).then((r) => r.data);

export const updateConfig = (id: number, body: Partial<ConfigPayload>) =>
  api.put(`/configs/${id}`, body).then((r) => r.data);

export const removeConfig = (id: number) => api.delete(`/configs/${id}`).then((r) => r.data);

/** 参数导出 CSV（对齐 scaffold /configs/export） */
export const exportConfigs = (params: { keyword?: string } = {}) =>
  api.get("/configs/export", { params, responseType: "blob" }).then((r) => r.data as Blob);
