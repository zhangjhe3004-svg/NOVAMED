import api from "./client";

export interface Overview {
  patient_total: number;
  record_total: number;
  appointment_total: number;
  billing_total: number;
  revenue: number;
  revenue_yuan: number;
  labtest_total: number;
  labtest_done: number;
}

export interface TrendPoint {
  label: string;
  records: number;
  appointments: number;
  billing: number;
  labtests: number;
}

export interface NameValue {
  name: string;
  value: number;
  id?: number;
}

export async function getOverview(): Promise<Overview> {
  const res = await api.get("/analytics/overview"); return res.data;
}
export async function getTrends(days?: number): Promise<{ days: number; items: TrendPoint[] }> {
  const res = await api.get("/analytics/trends", { params: { days } }); return res.data;
}
export async function getDepartmentDist(): Promise<{ items: NameValue[] }> {
  const res = await api.get("/analytics/departments"); return res.data;
}
export async function getDoctorDist(): Promise<{ items: NameValue[] }> {
  const res = await api.get("/analytics/doctors"); return res.data;
}
export async function getRecordStatus(): Promise<{ items: NameValue[] }> {
  const res = await api.get("/analytics/record-status"); return res.data;
}
