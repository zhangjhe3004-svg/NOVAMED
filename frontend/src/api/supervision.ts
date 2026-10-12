import api from "./client";

export interface AssigneeItem {
  id: number;
  real_name: string;
  username: string;
  title: string;
  department: string;
  role: string;
  pending_count: number;
  total_count: number;
}

export interface CandidateItem extends AssigneeItem {
  superior_id: number | null;
  superior_name: string;
  assigned_to_me: boolean;
}

/** 我（上级）已分配的下级医生 */
export async function listAssignees(): Promise<{ items: AssigneeItem[] }> {
  const res = await api.get("/supervision/assignees");
  return res.data;
}

/** 可分配对象（在职非管理员员工，含当前归属） */
export async function listCandidates(keyword?: string): Promise<{ items: CandidateItem[] }> {
  const res = await api.get("/supervision/candidates", { params: { keyword } });
  return res.data;
}

/** 分配下级：把该医生转入我的责任链 */
export async function assignSubordinate(user_id: number): Promise<any> {
  const res = await api.post("/supervision/assign", { user_id });
  return res.data;
}

/** 取消分配 */
export async function unassignSubordinate(user_id: number): Promise<any> {
  const res = await api.post("/supervision/unassign", { user_id });
  return res.data;
}

/** 我名下下级的就诊记录（脱敏），可按 doctor_id 过滤 */
export async function listSubordinateRecords(doctor_id?: number): Promise<{ items: any[] }> {
  const res = await api.get("/supervision/records", { params: { doctor_id } });
  return res.data;
}
