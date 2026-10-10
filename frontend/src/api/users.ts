import api from "./client";

export interface UserItem {
  id: number; username: string; real_name: string; role: string; phone?: string; email?: string;
  employee_no?: string; department?: string; title?: string; work_status?: string; is_active?: boolean;
}

export async function listUsers(params?: any): Promise<{ total: number; items: UserItem[] }> {
  const res = await api.get("/users", { params }); return res.data;
}
export async function getDoctors(): Promise<{ items: UserItem[] }> {
  const res = await api.get("/users", { params: { role: "doctor" } }); return res.data;
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
