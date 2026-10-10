import api from "./client";

export interface ConversationItem { id: number; title: string; created_at?: string; }
export interface ConversationDetail { id: number; title: string; messages: any[]; }

export async function listConversations(): Promise<{ items: ConversationItem[] }> {
  const res = await api.get("/conversations"); return res.data;
}
export async function getConversation(id: number): Promise<ConversationDetail> {
  const res = await api.get(`/conversations/${id}`); return res.data;
}
export async function deleteConversation(id: number): Promise<any> {
  const res = await api.delete(`/conversations/${id}`); return res.data;
}
