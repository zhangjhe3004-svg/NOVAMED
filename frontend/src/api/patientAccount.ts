/**
 * 患者注册档案 API
 */
import api from "./client";

export interface PatientAccount {
  id: number;
  id_type?: string;
  id_number?: string;
  surname?: string;
  given_name?: string;
  valid_until?: string;
  issue_date?: string;
  registered_place?: string;
  phone?: string;
  status?: string;
  created_at?: string;
}

/** 患者注册（公开） */
export async function registerPatient(data: any): Promise<any> {
  const res = await api.post("/patient-register", data);
  return res.data;
}

/** 发送验证码（演示） */
export async function sendCode(phone: string): Promise<{ message: string; code?: string; note?: string }> {
  const res = await api.post("/patient-register/send-code", { phone });
  return res.data;
}

/** 员工查看患者注册档案 */
export async function getPatientAccounts(params: { page?: number; page_size?: number; keyword?: string }): Promise<{ total: number; items: PatientAccount[] }> {
  const res = await api.get("/patient-accounts", { params });
  return res.data;
}

export async function deletePatientAccount(id: number): Promise<any> {
  const res = await api.delete(`/patient-accounts/${id}`); return res.data;
}

export async function updatePatientAccount(id: number, payload: any): Promise<any> {
  const res = await api.put(`/patient-accounts/${id}`, payload); return res.data;
}
