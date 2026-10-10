import api from "./client";

export interface PatientInfo {
  id: number; name: string; gender: string; phone: string; id_card: string;
  birth_date?: string; address?: string; medical_history?: string; created_at?: string;
}

export async function listPatients(params?: any): Promise<{ total: number; items: PatientInfo[] }> {
  const res = await api.get("/patients", { params }); return res.data;
}
export async function getPatient(id: number): Promise<{ patient: PatientInfo; records: any[] }> {
  const res = await api.get(`/patients/${id}`); return res.data;
}
export async function createPatient(payload: any): Promise<PatientInfo> {
  const res = await api.post("/patients", payload); return res.data;
}
export async function updatePatient(id: number, payload: any): Promise<PatientInfo> {
  const res = await api.put(`/patients/${id}`, payload); return res.data;
}
