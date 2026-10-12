import api from "./client";

export interface EmployeeMessage {
  id: number;
  sender_id: number | null;
  receiver_id: number;
  title: string;
  content: string;
  is_read: boolean;
  message_type: string;
  recalled?: boolean;
  deleted?: boolean;
  quote_id?: number | null;
  quote_preview?: string;
  sender_name?: string;
  receiver_name?: string;
  created_at?: string;
}

export interface ConversationItem {
  peer_id: number;
  peer_name: string;
  last_id: number;
  last_text: string;
  last_at: string;
  last_is_me: boolean;
  last_recalled: boolean;
  unread: number;
}

/** 会话列表（与我相关的所有会话） */
export async function listMessages(): Promise<{ items: ConversationItem[] }> {
  const res = await api.get("/messages");
  return res.data;
}

/** 与某同事的完整对话 */
export async function listConversation(peerId: number): Promise<{ items: EmployeeMessage[] }> {
  const res = await api.get("/messages", { params: { peer_id: peerId } });
  return res.data;
}

/** 发送消息（可引用） */
export async function sendMessage(payload: {
  receiver_id: number;
  title?: string;
  content: string;
  quote_id?: number;
}): Promise<{ id: number; created_at?: string }> {
  const res = await api.post("/messages", payload);
  return res.data;
}

/** 撤回消息（2 分钟内） */
export async function recallMessage(id: number): Promise<any> {
  const res = await api.post(`/messages/${id}/recall`);
  return res.data;
}

/** 删除消息（单方隐藏） */
export async function deleteMessage(id: number): Promise<any> {
  const res = await api.post(`/messages/${id}/delete`);
  return res.data;
}

/** 标记单条已读 */
export async function markRead(id: number): Promise<any> {
  const res = await api.post(`/messages/${id}/read`);
  return res.data;
}

/** 标记与某同事的全部消息已读 */
export async function markPeerRead(peerId: number): Promise<any> {
  const res = await api.post(`/messages/peer/${peerId}/read`);
  return res.data;
}
