import api from "./client";

export interface UserAction {
  action: string;
  payload: any;
  at?: string;
}

/** AI 分析历史 / 用户行为记录 */
export async function listActions(action?: string, limit = 20): Promise<{ items: UserAction[] }> {
  const res = await api.get("/memory/actions", { params: { action, limit } });
  return res.data;
}

/** 记录一次行为（分析、采纳、驳回等） */
export async function recordAction(action: string, payload?: any): Promise<{ id: number; action: string }> {
  const res = await api.post("/memory/actions", { action, payload: payload || {} });
  return res.data;
}
