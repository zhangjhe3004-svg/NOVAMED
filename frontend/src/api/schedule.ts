import api from "./client";

export interface DoctorScheduleItem {
  id: number;
  doctor_id: number;
  doctor_name?: string;
  date: string;
  time_slot: string;
  department: string;
  total: number;
  remaining: number;
  remain?: number;
  booked?: number;
  fee?: number;
}

export interface BookableDoctor {
  id: number;
  real_name: string;
  username?: string;
  department: string;
  title: string;
  role: string;
}

export async function listPublicSchedules(params?: any): Promise<{ items: DoctorScheduleItem[] }> {
  const res = await api.get("/schedule/public", { params }); return res.data;
}

export interface DepartmentItem {
  department: string;
  doctor_count: number;
}

/** 患者端公开：可挂号科室列表（自动同步自医生账号分配的科室） */
export async function listPublicDepartments(): Promise<{ items: DepartmentItem[] }> {
  const res = await api.get("/schedule/public-departments"); return res.data;
}

/** 患者端公开：按科室查可挂号医生 */
export async function listPublicDoctors(department?: string): Promise<{ items: BookableDoctor[] }> {
  const res = await api.get("/schedule/public-doctors", { params: { department } }); return res.data;
}
export async function listSchedules(params?: any): Promise<{ items: DoctorScheduleItem[] }> {
  const res = await api.get("/schedule", { params }); return res.data;
}
export async function listBookableDoctors(): Promise<{ items: BookableDoctor[] }> {
  const res = await api.get("/schedule/doctors"); return res.data;
}

/** 排班表用：医生列表（仅需登录，无需管理员权限），供排班表「员工」字段下拉选择 */
export async function listStaffDoctors(): Promise<{ items: BookableDoctor[] }> {
  const res = await api.get("/schedule/staff-doctors"); return res.data;
}

export async function deleteSchedule(id: number): Promise<any> {
  const res = await api.delete(`/schedule/${id}`); return res.data;
}

export async function updateSchedule(id: number, payload: any): Promise<any> {
  const res = await api.put(`/schedule/${id}`, payload); return res.data;
}

/** 将「排班表」（staff_schedules）中的医生班次同步为号源 */
export async function syncFromStaff(payload?: any): Promise<{ created: number; skipped: number; unmatched: number; total_slots: number }> {
  const res = await api.post("/schedule/sync-from-staff", payload || {}); return res.data;
}
