import api from "./client";

export interface PageSchemaItem { id: number; name: string; title: string; schema: any; enabled: boolean; }

export async function listPages(): Promise<{ items: PageSchemaItem[] }> {
  const res = await api.get("/pages"); return res.data;
}
export async function createPage(payload: any): Promise<any> {
  const res = await api.post("/pages", payload); return res.data;
}
export async function deletePage(name: string): Promise<any> {
  const res = await api.delete(`/pages/${name}`); return res.data;
}
