/**
 * 角色管理 API —— 对应后端 /api/roles（角色 CRUD + 菜单授权 + 权限矩阵数据源）
 */
import api from "./client";

export interface RoleItem {
  id: number;
  name: string;
  code: string;
  data_scope: string;
  data_scope_text?: string;
  sort: number;
  status: number;
  builtin: boolean;
  remark: string;
  user_count: number;
  created_at: string | null;
  create_time?: string | null;
  menu_ids: number[] | null;
}

export const listRoles = (params: { page?: number; page_size?: number; keyword?: string; status?: string } = {}) =>
  api.get("/roles", { params }).then((r) => r.data);

export const createRole = (body: { name: string; code: string; data_scope?: string; sort?: number; status?: number; remark?: string }) =>
  api.post("/roles", body).then((r) => r.data);

export const updateRole = (id: number, body: Record<string, unknown>) =>
  api.put(`/roles/${id}`, body).then((r) => r.data);

export const removeRole = (id: number) =>
  api.delete(`/roles/${id}`).then((r) => r.data);

export const saveRoleMenus = (id: number, menu_ids: number[]) =>
  api.put(`/roles/${id}/menus`, { menu_ids }).then((r) => r.data);

/** 角色导出 CSV（对齐 scaffold /roles/export） */
export const exportRoles = (params: { keyword?: string; status?: string } = {}) =>
  api.get("/roles/export", { params, responseType: "blob" }).then((r) => r.data as Blob);

/** 当前登录账号的菜单授权（整数 menu_id；menus=null 表示内置角色全量，[] 表示无授权） */
export const myMenus = () =>
  api.get("/roles/my-menus").then(
    (r) =>
      r.data as {
        role: string;
        roles?: string[];
        menus: number[] | null;
        /** 解析出的权限码（按钮级 medicode:*:* 及页面导航 key）；null=内置角色全量，[]=无权限 */
        permissions?: string[] | null;
      }
  );
