import api from "./client";

export interface PatientRecord {
  id: number;
  record_id: number;
  doctor_id?: number;
  doctor_name?: string;
  symptoms: string;
  diagnosis: string;
  prescription: string;
  notes?: string;
  review_status?: string;
  visit_date?: string;
  created_at?: string;
}

export interface PatientAppointment {
  id: number;
  doctor_id: number;
  doctor_name?: string;
  hospital?: string;
  department?: string;
  date?: string;
  time_slot?: string;
  status: string;
  symptoms?: string;
}

export async function getPatientMe(): Promise<any> {
  const res = await api.get("/patient-auth/me"); return res.data;
}
export async function getPatientAppointments(): Promise<{ items: PatientAppointment[] }> {
  const res = await api.get("/patient-auth/appointments"); return res.data;
}
export async function getPatientRecords(): Promise<{ items: PatientRecord[] }> {
  const res = await api.get("/patient-auth/records"); return res.data;
}
export async function updatePatientMe(payload: any): Promise<any> {
  const res = await api.put("/patient-auth/me", payload); return res.data;
}
export async function changePatientPassword(old_password: string, new_password: string): Promise<any> {
  const res = await api.post("/patient-auth/change-password", { old_password, new_password }); return res.data;
}
export async function cancelPatientAppointment(id: number): Promise<any> {
  const res = await api.post(`/patient-auth/appointments/${id}/cancel`); return res.data;
}

export async function deletePatientRecord(id: number): Promise<any> {
  const res = await api.delete(`/patient-auth/records/${id}`); return res.data;
}

export async function deleteMyPatientAccount(): Promise<any> {
  const res = await api.delete("/patient-auth/me"); return res.data;
}
