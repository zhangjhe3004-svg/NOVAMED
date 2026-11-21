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

/* ── 报告查询（患者范围） ── */
export interface PatientLabTest {
  id: number;
  test_no: string;
  item_name: string;
  category: string;
  status: string;
  department?: string;
  result?: string;
  reference?: string;
  doctor_name?: string;
  created_at?: string;
}
export async function getPatientLabTests(): Promise<{ items: PatientLabTest[] }> {
  const res = await api.get("/patient-auth/lab-tests"); return res.data;
}
export async function getPatientLabTestDetail(id: number): Promise<PatientLabTest> {
  const res = await api.get(`/patient-auth/lab-tests/${id}`); return res.data;
}

/* ── 消息通知中心（患者范围） ── */
export interface PatientNotificationItem {
  id: number;
  title: string;
  content: string;
  is_read: boolean;
  level?: string;
  kind?: string;
  created_at?: string;
}
export async function getPatientNotifications(): Promise<{ items: PatientNotificationItem[]; unread: number }> {
  const res = await api.get("/patient-auth/notifications"); return res.data;
}
export async function markPatientNotificationRead(id: number): Promise<any> {
  const res = await api.post(`/patient-auth/notifications/${id}/read`); return res.data;
}
export async function markAllPatientNotificationsRead(): Promise<any> {
  const res = await api.post("/patient-auth/notifications/read-all"); return res.data;
}

/* ── 家族病史 CRUD（患者范围） ── */
export interface FamilyHistoryItem {
  id: number;
  relation: string;
  disease: string;
  onset_age?: string;
  note?: string;
  created_at?: string;
}
export async function getFamilyHistory(): Promise<{ items: FamilyHistoryItem[] }> {
  const res = await api.get("/patient-auth/family-history"); return res.data;
}
export async function createFamilyHistory(payload: Partial<FamilyHistoryItem>): Promise<FamilyHistoryItem> {
  const res = await api.post("/patient-auth/family-history", payload); return res.data;
}
export async function updateFamilyHistory(id: number, payload: Partial<FamilyHistoryItem>): Promise<FamilyHistoryItem> {
  const res = await api.put(`/patient-auth/family-history/${id}`, payload); return res.data;
}
export async function deleteFamilyHistory(id: number): Promise<any> {
  const res = await api.delete(`/patient-auth/family-history/${id}`); return res.data;
}

/* ── 首页概览（仪器化聚合） ── */
export interface PatientOverview {
  upcoming: number;
  record_count: number;
  done_count: number;
  lab_count: number;
  lab_done: number;
  lab_pending: number;
  unread: number;
}
export async function getPatientOverview(): Promise<PatientOverview> {
  const res = await api.get("/patient-auth/overview"); return res.data;
}
