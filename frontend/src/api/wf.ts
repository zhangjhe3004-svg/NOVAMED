import api from "./client";

export interface WfNode { name: string; assign_type: string; assign_value: string; }
export interface WfDef {
  id: number; key: string; title: string; trigger_collection: string; status_field: string;
  enabled: boolean; nodes: WfNode[]; running_status: string; done_status: string; reject_status: string;
}
export interface WfInstance {
  id: number; def_key: string; def_title: string; row_id: number | null; current_index: number;
  assignees: number[]; history: any[]; status: string;
}

export async function listDefs(): Promise<{ items: WfDef[] }> {
  const res = await api.get("/workflow/defs"); return res.data;
}
export async function saveDef(payload: any): Promise<any> {
  const res = await api.post("/workflow/defs", payload); return res.data;
}
export async function setDefEnabled(key: string, enabled: boolean): Promise<any> {
  const res = await api.post(`/workflow/defs/${key}/toggle?enabled=${enabled}`); return res.data;
}
export async function deleteDef(key: string): Promise<any> {
  const res = await api.delete(`/workflow/defs/${key}`); return res.data;
}
export async function listInstances(def_key?: string, status?: string): Promise<{ items: WfInstance[] }> {
  const res = await api.get("/workflow/instances", { params: { def_key, status } }); return res.data;
}
export async function actInstance(id: number, action: "approve" | "reject", comment?: string): Promise<any> {
  const res = await api.post(`/workflow/instances/${id}/${action}`, { comment }); return res.data;
}
