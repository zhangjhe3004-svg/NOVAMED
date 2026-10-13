/**
 * 菜单管理 API —— 对应后端 /api/menus（目录/页面/按钮三级菜单树 CRUD）
 */
import api from "./client";

export type MenuType = "dir" | "menu" | "btn";

export interface MenuItemRow {
  id: number;
  parent_id: number;
  type: MenuType;
  name: string;
  icon: string;
  path: string;
  component: string;
  permission: string;
  sort: number;
  visible: number;
  status: number;
  builtin: boolean;
  created_at: string | null;
  children?: MenuItemRow[];
}

export interface MenuPayload {
  parent_id?: number;
  type: MenuType;
  name: string;
  icon?: string;
  path?: string;
  component?: string;
  permission?: string;
  sort?: number;
  visible?: number;
  status?: number;
}

export const fetchMenuTree = (params: { keyword?: string; status?: string } = {}) =>
  api.get("/menus/tree", { params }).then((r) => r.data as { items: MenuItemRow[]; total: number });

export const createMenu = (body: MenuPayload) => api.post("/menus", body).then((r) => r.data);

export const updateMenu = (id: number, body: Partial<MenuPayload>) =>
  api.put(`/menus/${id}`, body).then((r) => r.data);

export const removeMenu = (id: number) => api.delete(`/menus/${id}`).then((r) => r.data);
