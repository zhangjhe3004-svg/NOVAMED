import api from "./client";

export interface KnowledgeDoc {
  id: number; title: string; category: string; tags: string; content: string; created_at?: string;
}

export async function listKnowledge(params?: any): Promise<{ total: number; items: KnowledgeDoc[] }> {
  const res = await api.get("/knowledge", { params }); return res.data;
}
export async function createKnowledge(payload: any): Promise<any> {
  const res = await api.post("/knowledge", payload); return res.data;
}
export async function getKnowledgeStats(): Promise<any> {
  const res = await api.get("/knowledge/stats"); return res.data;
}
