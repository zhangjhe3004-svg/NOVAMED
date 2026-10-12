import api from "./client";

export interface ScheduledTask {
  id: number;
  name: string;
  schedule_type: "once" | "daily" | "weekly" | "interval";
  schedule_time: string;
  interval_minutes: number;
  weekdays: string;
  run_at: string;
  action: string;
  payload: string;
  enabled: boolean;
  last_run?: string | null;
  next_run?: string | null;
  run_count: number;
  created_at?: string;
}

export async function listTasks(): Promise<{ total: number; items: ScheduledTask[] }> {
  const res = await api.get("/tasks"); return res.data;
}
export async function createTask(payload: any): Promise<ScheduledTask> {
  const res = await api.post("/tasks", payload); return res.data;
}
export async function updateTask(id: number, payload: any): Promise<ScheduledTask> {
  const res = await api.put(`/tasks/${id}`, payload); return res.data;
}
export async function toggleTask(id: number): Promise<ScheduledTask> {
  const res = await api.post(`/tasks/${id}/toggle`); return res.data;
}
export async function runTaskNow(id: number): Promise<ScheduledTask> {
  const res = await api.post(`/tasks/${id}/run`); return res.data;
}
export async function deleteTask(id: number): Promise<any> {
  const res = await api.delete(`/tasks/${id}`); return res.data;
}
