import api from "./client";

export interface MedicalRecordInfo {
  id: number; patient_id: number; doctor_id: number; patient_name: string; doctor_name: string;
  symptoms: string; diagnosis: string; prescription: string; notes: string; review_status: string; created_at?: string;
}

export async function listRecords(params?: any): Promise<{ total: number; items: MedicalRecordInfo[] }> {
  const res = await api.get("/records", { params }); return res.data;
}
export async function getRecord(id: number): Promise<{ record: MedicalRecordInfo; comments: any[] }> {
  const res = await api.get(`/records/${id}`); return res.data;
}
export async function getPendingReviewCount(): Promise<{ count: number }> {
  const res = await api.get("/records", { params: { review_status: "待审核" } });
  return { count: res.data?.total ?? 0 };
}
export async function adminReviewRecord(id: number, payload: any): Promise<any> {
  const res = await api.post(`/records/${id}/review`, payload); return res.data;
}
export async function searchSimilar(id: number): Promise<any> {
  const res = await api.get(`/records/${id}/similar`); return res.data;
}
