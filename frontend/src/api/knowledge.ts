import api from "./client";

export interface KnowledgeDoc {
  id: number;
  title: string;
  category: string;
  tags: string;
  content: string;
  created_at?: string;
}

export async function listKnowledgeDocs(params?: any): Promise<{ total: number; items: KnowledgeDoc[] }> {
  const res = await api.get("/knowledge", { params });
  return res.data;
}

export async function getKnowledgeDoc(id: number): Promise<KnowledgeDoc> {
  const res = await api.get(`/knowledge/${id}`);
  return res.data;
}

export async function createKnowledgeDoc(payload: any): Promise<any> {
  const res = await api.post("/knowledge", payload);
  return res.data;
}

export async function updateKnowledgeDoc(id: number, payload: any): Promise<any> {
  const res = await api.put(`/knowledge/${id}`, payload);
  return res.data;
}

export async function deleteKnowledgeDoc(id: number): Promise<any> {
  const res = await api.delete(`/knowledge/${id}`);
  return res.data;
}

export async function getCategories(): Promise<{ categories: string[] }> {
  const res = await api.get("/knowledge/categories");
  return res.data;
}

export async function getKnowledgeStats(): Promise<any> {
  const res = await api.get("/knowledge/stats");
  return res.data;
}