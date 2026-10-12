import api from "./client";

export type FieldType = "string" | "integer" | "number" | "boolean" | "text";
export interface DynField { name: string; type: FieldType; primary?: boolean; label?: string; }
export interface DynCollection {
  id: number; name: string; title: string; description: string; fields: DynField[]; enabled: boolean;
}

export async function listCollections(): Promise<{ items: DynCollection[] }> {
  const res = await api.get("/dyn/collections"); return res.data;
}
export async function createCollection(payload: any): Promise<DynCollection> {
  const res = await api.post("/dyn/collections", payload); return res.data;
}
export async function patchCollection(name: string, payload: any): Promise<DynCollection> {
  const res = await api.patch(`/dyn/collections/${name}`, payload); return res.data;
}
export async function deleteCollection(name: string): Promise<any> {
  const res = await api.delete(`/dyn/collections/${name}`); return res.data;
}
export async function listRows(name: string, params?: any): Promise<{ total: number; items: any[] }> {
  const res = await api.get(`/dyn/collections/${name}/rows`, { params }); return res.data;
}
export async function insertRow(name: string, data: any): Promise<any> {
  const res = await api.post(`/dyn/collections/${name}/rows`, data); return res.data;
}
export async function updateRow(name: string, rowId: number, data: any): Promise<any> {
  const res = await api.put(`/dyn/collections/${name}/rows/${rowId}`, data); return res.data;
}
export async function deleteRow(name: string, rowId: number): Promise<any> {
  const res = await api.delete(`/dyn/collections/${name}/rows/${rowId}`); return res.data;
}
