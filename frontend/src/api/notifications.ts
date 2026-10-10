import api from "./client";

export interface NotificationItem { id: number; title: string; content: string; is_read: boolean; level: string; created_at?: string; }

export async function listNotifications(): Promise<{ items: NotificationItem[] }> {
  const res = await api.get("/notifications"); return res.data;
}
export async function markRead(id: number): Promise<any> {
  const res = await api.post(`/notifications/${id}/read`); return res.data;
}
