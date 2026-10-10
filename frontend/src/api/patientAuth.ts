import api from "./client";

export interface PatientRecord { id: number; symptoms: string; diagnosis: string; prescription: string; created_at?: string; }

export async function getPatientMe(): Promise<any> {
  const res = await api.get("/patient-auth/me"); return res.data;
}
export async function getPatientAppointments(): Promise<{ items: any[] }> {
  const res = await api.get("/patient-auth/appointments"); return res.data;
}
export async function getPatientRecords(): Promise<{ items: PatientRecord[] }> {
  const res = await api.get("/patient-auth/records"); return res.data;
}
export async function updatePatientMe(payload: any): Promise<any> {
  const res = await api.put("/patient-auth/me", payload); return res.data;
}
