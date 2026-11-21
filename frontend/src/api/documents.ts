import api from "./client";

export interface ScannedDocumentMeta {
  id: number;
  title: string;
  category: string;
  patient_id: number | null;
  record_id: number | null;
  labtest_id: number | null;
  image_count: number;
  ocr_preview: string;
  created_by: number | null;
  created_by_name: string;
  created_at: string;
}

export interface ScannedDocumentDetail extends ScannedDocumentMeta {
  images: string[];
  ocr_text: string;
}

export interface DocumentCreatePayload {
  title: string;
  category: string;
  patient_id?: number | null;
  record_id?: number | null;
  labtest_id?: number | null;
  images: string[];
  ocr_text: string;
}

export async function listDocuments(params?: {
  patient_id?: number;
  record_id?: number;
  labtest_id?: number;
}): Promise<{ total: number; items: ScannedDocumentMeta[] }> {
  const res = await api.get("/documents", { params });
  return res.data;
}

export async function getDocument(id: number): Promise<ScannedDocumentDetail> {
  const res = await api.get(`/documents/${id}`);
  return res.data?.document ?? res.data;
}

export async function uploadDocument(payload: DocumentCreatePayload): Promise<ScannedDocumentMeta> {
  const res = await api.post("/documents", payload);
  return res.data?.document ?? res.data;
}

export async function deleteDocument(id: number): Promise<any> {
  const res = await api.delete(`/documents/${id}`);
  return res.data;
}
