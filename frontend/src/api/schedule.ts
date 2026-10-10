import api from "./client";

export interface DoctorScheduleItem { id: number; doctor_id: number; date: string; time_slot: string; department: string; total: number; remaining: number; }

export async function listPublicSchedules(params?: any): Promise<{ items: DoctorScheduleItem[] }> {
  const res = await api.get("/schedule/public", { params }); return res.data;
}
export async function listSchedules(params?: any): Promise<{ items: DoctorScheduleItem[] }> {
  const res = await api.get("/schedule", { params }); return res.data;
}
