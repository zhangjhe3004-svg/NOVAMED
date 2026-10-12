import api from "./client";

export interface MedicalRecordInfo {
  id: number;
  patient_id: number;
  doctor_id: number;
  patient_name: string;
  doctor_name: string;
  symptoms: string;
  diagnosis: string;
  prescription: string;
  notes: string;
  review_status: string;
  ai_suggestion?: string;
  ai_confidence?: any;
  ai_reviewed?: number;
  admin_reviewed?: number;
  admin_name?: string;
  room?: string;
  visit_date?: string;
  registration_time?: string;
  created_at?: string;
}

export async function listRecords(params?: any): Promise<{ total: number; items: MedicalRecordInfo[] }> {
  const res = await api.get("/records", { params });
  return res.data;
}

export async function getRecord(id: number): Promise<MedicalRecordInfo> {
  const res = await api.get(`/records/${id}`);
  return res.data?.record ?? res.data;
}

export async function getPendingReviewCount(): Promise<{ count: number }> {
  const res = await api.get("/records", { params: { review_status: "待审核" } });
  return { count: res.data?.total ?? 0 };
}

export async function reviewAiSuggestion(recordId: number, action: string): Promise<any> {
  const res = await api.post(`/records/${recordId}/review`, {
    kind: "ai",
    ai_reviewed: action === "confirm" ? 1 : 2,
  });
  return res.data;
}

export async function adminReviewRecord(recordId: number, action: string): Promise<any> {
  const res = await api.post(`/records/${recordId}/review`, {
    kind: "admin",
    admin_reviewed: action === "confirm" ? 1 : action === "reject" ? 2 : 0,
  });
  return res.data;
}

export async function createRecord(payload: {
  patient_id: number;
  symptoms?: string;
  diagnosis?: string;
  prescription?: string;
  notes?: string;
}): Promise<MedicalRecordInfo> {
  const res = await api.post("/records", payload);
  return res.data;
}

export async function updateRecord(id: number, payload: any): Promise<any> {
  const res = await api.put(`/records/${id}`, payload);
  return res.data;
}

export async function searchSimilar(id: number): Promise<{ results: MedicalRecordInfo[] }> {
  const res = await api.get(`/records/${id}/similar`);
  return { results: res.data?.results ?? [] };
}