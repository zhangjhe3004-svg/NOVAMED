/**
 * 字典管理 API —— 对应后端 /api/dict-types、/api/dict-data、/api/dict-options
 */
import api from "./client";

export interface DictTypeItem {
  id: number;
  dict_name: string;
  dict_type: string;
  status: number;
  remark: string;
  created_at: string | null;
  create_time: string | null;
}

export interface DictTypePayload {
  dict_name: string;
  dict_type: string;
  status?: number;
  remark?: string;
}

export interface DictDataItem {
  id: number;
  dict_type: string;
  label: string;
  value: string;
  sort: number;
  status: number;
  tone: string;
  def: boolean;
  remark: string;
}

export interface DictDataPayload {
  dict_type: string;
  label: string;
  value: string;
  sort?: number;
  status?: number;
  tone?: string;
  def?: boolean;
  remark?: string;
}

export const listDictTypes = (params: { page?: number; page_size?: number; keyword?: string; status?: string } = {}) =>
  api.get("/dict-types", { params }).then((r) => r.data as { total: number; items: DictTypeItem[] });

export const createDictType = (body: DictTypePayload) => api.post("/dict-types", body).then((r) => r.data);

export const updateDictType = (id: number, body: Partial<DictTypePayload>) =>
  api.put(`/dict-types/${id}`, body).then((r) => r.data);

export const removeDictType = (id: number) => api.delete(`/dict-types/${id}`).then((r) => r.data);

/** 字典类型导出 CSV（对齐 scaffold /dict/types/export） */
export const exportDictTypes = (params: { keyword?: string; status?: string } = {}) =>
  api.get("/dict-types/export", { params, responseType: "blob" }).then((r) => r.data as Blob);

export const listDictData = (dictType: string) =>
  api.get(`/dict-data/${dictType}`).then((r) => r.data as DictDataItem[]);

export const createDictData = (body: DictDataPayload) => api.post("/dict-data", body).then((r) => r.data);

export const updateDictData = (id: number, body: Partial<DictDataPayload>) =>
  api.put(`/dict-data/${id}`, body).then((r) => r.data);

export const removeDictData = (id: number) => api.delete(`/dict-data/${id}`).then((r) => r.data);

export const dictOptions = (dictType: string) =>
  api.get(`/dict-options/${dictType}`).then((r) => r.data as { label: string; value: string; tone: string }[]);
