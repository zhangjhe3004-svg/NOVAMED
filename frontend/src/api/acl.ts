import api from "./client";

export async function listRules(): Promise<{ items: any[] }> {
  const res = await api.get("/acl"); return res.data;
}
export async function createRule(payload: any): Promise<any> {
  const res = await api.post("/acl", payload); return res.data;
}
