import api from "./client";

export interface LabTestItem {
  id: number;
  test_no: string;
  patient_id: number | null;
  patient_name: string;
  department: string;
  item_name: string;
  category: string;
  status: string;
  result: string;
  reference: string;
  doctor_id: number | null;
  doctor_name: string;
  operator: string;
  remark: string;
  created_at?: string;
}

export interface LabTestStats {
  total: number;
  done: number;
  pending: number;
  cancelled: number;
  categories: string[];
}

export async function listLabTests(params?: any): Promise<{ total: number; items: LabTestItem[] }> {
  const res = await api.get("/labtest", { params }); return res.data;
}
export async function getLabTestStats(): Promise<LabTestStats> {
  const res = await api.get("/labtest/stats"); return res.data;
}
export async function createLabTest(payload: any): Promise<LabTestItem> {
  const res = await api.post("/labtest", payload); return res.data;
}
export async function updateLabTest(id: number, payload: any): Promise<LabTestItem> {
  const res = await api.put(`/labtest/${id}`, payload); return res.data;
}
export async function changeLabTestStatus(id: number, payload: any): Promise<LabTestItem> {
  const res = await api.post(`/labtest/${id}/status`, payload); return res.data;
}
export async function deleteLabTest(id: number): Promise<any> {
  const res = await api.delete(`/labtest/${id}`); return res.data;
}
