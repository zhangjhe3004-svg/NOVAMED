/**
 * 权限关系图 API —— 对应后端 /api/permissions/graph（RBAC 真实授权数据）
 *
 * 「问系统」与溯源类页面共用：用户-角色（sys_user_role）、角色-菜单（sys_role_menus.menu_id）
 * 两组关联 + 全量用户/角色/菜单节点，本地即可推演「谁能 X / 谁没角色 / 哪些菜单孤立」等问题。
 */
import api from "./client";

export interface PermGraphUser {
  id: number;
  username: string;
  nickname: string;
  deptName: string | null;
  status: number;
}

export interface PermGraphRole {
  id: number;
  name: string;
  code: string;
  dataScope: string;
  status: number;
  builtin: boolean;
  userCount: number;
  menuIds: number[];
}

export interface PermGraphMenu {
  id: number;
  parentId: number;
  name: string;
  type: "dir" | "menu" | "btn";
  icon: string | null;
  path: string | null;
  permission: string | null;
  sort: number;
  visible: number;
  status: number;
}

export interface PermGraph {
  users: PermGraphUser[];
  roles: PermGraphRole[];
  menus: PermGraphMenu[];
  /** [user_id, role_id] 关联对（sys_user_role 权威多角色源） */
  userRoles: [number, number][];
  usersVisible: boolean;
}

export const fetchPermissionGraph = () =>
  api.get("/permissions/graph").then((r) => r.data as PermGraph);
