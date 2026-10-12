import api from "./client";

export interface UserItem {
  id: number; username: string; real_name: string; role: string; phone?: string; email?: string;
  employee_no?: string; department?: string; title?: string; work_status?: string; auth_level?: number; superior_id?: number; is_active?: boolean;
}

export async function listUsers(params?: any): Promise<{ total: number; items: UserItem[] }> {
  const res = await api.get("/users", { params }); return res.data;
}
export async function getDoctors(): Promise<UserItem[]> {
  const res = await api.get("/users", { params: { role: "doctor", page_size: 100 } });
  return res.data?.items ?? [];
}
export async function updateUser(id: number, payload: any): Promise<UserItem> {
  const res = await api.put(`/users/${id}`, payload); return res.data;
}
export async function deleteUser(id: number): Promise<any> {
  const res = await api.delete(`/users/${id}`); return res.data;
}
export async function resetUserPassword(id: number, new_password: string): Promise<any> {
  const res = await api.post(`/users/${id}/reset-password`, { new_password }); return res.data;
}
export async function lookupByEmployeeNo(employee_no: string): Promise<UserItem | null> {
  const res = await api.get("/users", { params: { keyword: employee_no } });
  return res.data?.items?.[0] ?? null;
}

export async function createUser(payload: any): Promise<UserItem> {
  const res = await api.post("/users", payload); return res.data;
}

export interface UserStats {
  total_staff: number;
  doctor_count: number;
  admin_count: number;
  inactive_count: number;
  this_month_joined: number;
  on_leave: number;
  resting: number;
  available_doctors: number;
  residents: number;
  super_admins: number;
  admin_departments: string;
  last_7_days_created: number;
  need_password_change: number;
}

export async function getUserStats(): Promise<UserStats> {
  const res = await api.get("/users/stats"); return res.data;
}
