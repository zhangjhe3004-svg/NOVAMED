import api from "./client";

export interface MedicineItem {
  id: number;
  name: string;
  spec: string;
  category: string;
  manufacturer: string;
  unit: string;
  price: number;
  price_yuan: number;
  stock: number;
  stock_warning: number;
  approval_no: string;
  low_stock: boolean;
  created_at?: string;
}

export interface PharmacyStats {
  total_medicines: number;
  low_stock_count: number;
  stock_value: number;
  stock_value_yuan: number;
  categories: string[];
}

export async function listMedicines(params?: any): Promise<{ total: number; items: MedicineItem[] }> {
  const res = await api.get("/pharmacy", { params }); return res.data;
}
export async function getPharmacyStats(): Promise<PharmacyStats> {
  const res = await api.get("/pharmacy/stats"); return res.data;
}
export async function createMedicine(payload: any): Promise<MedicineItem> {
  const res = await api.post("/pharmacy", payload); return res.data;
}
export async function updateMedicine(id: number, payload: any): Promise<MedicineItem> {
  const res = await api.put(`/pharmacy/${id}`, payload); return res.data;
}
export async function adjustStock(id: number, delta: number): Promise<MedicineItem> {
  const res = await api.post(`/pharmacy/${id}/stock`, { delta }); return res.data;
}
export async function deleteMedicine(id: number): Promise<any> {
  const res = await api.delete(`/pharmacy/${id}`); return res.data;
}

export interface BillingItemInput {
  name: string;
  quantity: number;
  price: number; // 分
}

export interface BillingItem {
  name: string;
  quantity: number;
  price: number;
}

export interface BillingRecord {
  id: number;
  bill_no: string;
  patient_id: number | null;
  patient_name: string;
  department: string;
  items: BillingItem[];
  total_amount: number;
  total_yuan: number;
  payment_method: string;
  status: string;
  operator: string;
  remark: string;
  confirmed_by?: string;
  confirmed_at?: string;
  paid_by?: string;
  paid_at?: string;
  created_at?: string;
}

export interface BillingStats {
  total_count: number;
  paid_count: number;
  pending_count?: number;
  total_amount: number;
  total_yuan: number;
  refund_count: number;
}

export async function listBillings(params?: any): Promise<{ total: number; items: BillingRecord[] }> {
  const res = await api.get("/billing", { params }); return res.data;
}
export async function getBillingStats(): Promise<BillingStats> {
  const res = await api.get("/billing/stats"); return res.data;
}
export async function createBilling(payload: any): Promise<BillingRecord> {
  const res = await api.post("/billing", payload); return res.data;
}
export async function confirmBillingMethod(id: number, payment_method: string): Promise<BillingRecord> {
  const res = await api.post(`/billing/${id}/confirm-method`, { payment_method }); return res.data;
}
export async function confirmBillingPaid(id: number): Promise<BillingRecord> {
  const res = await api.post(`/billing/${id}/confirm-paid`); return res.data;
}
export async function refundBilling(id: number): Promise<BillingRecord> {
  const res = await api.post(`/billing/${id}/refund`); return res.data;
}
export async function deleteBilling(id: number): Promise<any> {
  const res = await api.delete(`/billing/${id}`); return res.data;
}
