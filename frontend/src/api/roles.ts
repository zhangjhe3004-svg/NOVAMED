/**
 * 角色管理 API —— 对应后端 /api/roles（角色 CRUD + 菜单授权 + 权限矩阵数据源）
 */
import api from "./client";

export interface RoleItem {
  id: number;
  name: string;
  code: string;
  data_scope: string;
  sort: number;
  status: number;
  builtin: boolean;
  remark: string;
  user_count: number;
  created_at: string | null;
  menu_ids: string[] | null;
}

export const listRoles = (params: { page?: number; page_size?: number; keyword?: string; status?: string } = {}) =>
  api.get("/roles", { params }).then((r) => r.data);

export const createRole = (body: { name: string; code: string; data_scope?: string; sort?: number; status?: number; remark?: string }) =>
  api.post("/roles", body).then((r) => r.data);

export const updateRole = (id: number, body: Record<string, unknown>) =>
  api.put(`/roles/${id}`, body).then((r) => r.data);

export const removeRole = (id: number) =>
  api.delete(`/roles/${id}`).then((r) => r.data);

export const saveRoleMenus = (id: number, menu_ids: string[]) =>
  api.put(`/roles/${id}/menus`, { menu_ids }).then((r) => r.data);

/** 角色导出 CSV（对齐 scaffold /roles/export） */
export const exportRoles = (params: { keyword?: string; status?: string } = {}) =>
  api.get("/roles/export", { params, responseType: "blob" }).then((r) => r.data as Blob);

/** 当前登录账号的菜单授权（menus=null 表示未配置，前端回退静态分组） */
export const myMenus = () =>
  api.get("/roles/my-menus").then((r) => r.data as { role: string; menus: string[] | null });
