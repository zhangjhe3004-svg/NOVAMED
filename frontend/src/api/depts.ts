/**
 * 部门管理 API —— 对应后端 /api/depts（组织架构树 CRUD）
 */
import api from "./client";

export interface DeptItem {
  id: number;
  parent_id: number;
  name: string;
  leader: string;
  phone: string;
  email: string;
  sort: number;
  status: number;
  member_count: number;
  created_at: string | null;
  children?: DeptItem[];
}

export interface DeptPayload {
  parent_id?: number;
  name: string;
  leader?: string;
  phone?: string;
  email?: string;
  sort?: number;
  status?: number;
}

export const fetchDeptTree = (params: { keyword?: string; status?: string } = {}) =>
  api.get("/depts/tree", { params }).then((r) => r.data as { items: DeptItem[]; total: number });

export const createDept = (body: DeptPayload) => api.post("/depts", body).then((r) => r.data);

export const updateDept = (id: number, body: Partial<DeptPayload>) =>
  api.put(`/depts/${id}`, body).then((r) => r.data);

export const removeDept = (id: number) => api.delete(`/depts/${id}`).then((r) => r.data);
