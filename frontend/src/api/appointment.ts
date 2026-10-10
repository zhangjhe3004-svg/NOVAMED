/**
 * 预约挂号 / 医生接诊 / 上级查看下级(脱敏) API
 */
import api from "./client";

export interface BookingData {
  doctor_id: number;
  hospital?: string;
  department?: string;
  date?: string;
  time_slot?: string;
  symptoms?: string;
  patient_name?: string;
  phone?: string;
}

/** 患者预约挂号（公开） */
export async function createAppointment(data: BookingData): Promise<any> {
  const res = await api.post("/appointments", data);
  return res.data;
}

export interface DoctorAppointment {
  id: number;
  patient_name?: string;
  phone?: string;
  symptoms?: string;
  hospital?: string;
  department?: string;
  date?: string;
  time_slot?: string;
  status: string;
  created_at?: string;
}

/** 医生查看我的接诊/挂号 */
export async function getMyAppointments(): Promise<{ items: DoctorAppointment[] }> {
  const res = await api.get("/doctors/appointments");
  return res.data;
}

/** 标记就诊完成（可选诊断结论，完成后自动生成就诊记录） */
export async function completeAppointment(id: number, payload?: { diagnosis?: string; prescription?: string; notes?: string }): Promise<any> {
  const res = await api.post(`/appointments/${id}/complete`, payload || {});
  return res.data;
}

export interface SeniorRecord {
  record_id: number;
  symptoms?: string;
  diagnosis?: string;
  prescription?: string;
  doctor_name?: string;
  doctor_title?: string;
  created_at?: string;
  patient: { name: string; id_card: string; phone: string; gender: string; address: string };
}

/** 上级查看下级诊断记录（患者信息脱敏） */
export async function getSeniorRecords(): Promise<{ items: SeniorRecord[] }> {
  const res = await api.get("/records/senior");
  return res.data;
}

/** 患者按手机号查询自己的挂号 */
export async function queryAppointments(phone: string): Promise<{ items: any[] }> {
  const res = await api.get("/appointments/query", { params: { phone } });
  return res.data;
}

/** 患者报到 */
export async function checkinAppointment(id: number): Promise<any> {
  const res = await api.post(`/appointments/${id}/checkin`);
  return res.data;
}
