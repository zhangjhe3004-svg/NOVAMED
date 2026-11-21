/**
 * 代码生成 API —— 对应后端 /api/generator（对齐 scaffold /tool/generator）
 */
import api from "./client";
import { downloadBlob } from "../utils/download";

export interface GenTableItem {
  id: number;
  tableName: string;
  tableComment: string;
  className: string;
  module: string;
  businessName: string;
  synced: boolean;
  createTime: string | null;
}

export interface ImportableTable {
  tableName: string;
  tableComment: string;
  imported: boolean;
}

export interface GenColumn {
  id: number;
  col: string;
  comment: string;
  field: string;
  type: string;
  dbType: string;
  insert: boolean;
  edit: boolean;
  list: boolean;
  query: boolean;
  queryType: string;
  formType: string;
  required: boolean;
}

export interface GenFile {
  name: string;
  path: string;
  code: string;
}

export const listGenTables = (params: { page?: number; page_size?: number; keyword?: string } = {}) =>
  api.get("/generator/tables", { params }).then((r) => r.data as { total: number; items: GenTableItem[] });

export const listImportableTables = (keyword?: string) =>
  api.get("/generator/importable-tables", { params: { keyword } }).then((r) => r.data as ImportableTable[]);

export const importTables = (tableNames: string[]) =>
  api.post("/generator/import", { tableNames }).then((r) => r.data as { imported: number; ids: number[] });

export const getGenColumns = (id: number) =>
  api.get(`/generator/tables/${id}/columns`).then((r) => r.data as GenColumn[]);

export const previewGenTable = (id: number) =>
  api.get(`/generator/tables/${id}/preview`).then(
    (r) => r.data as { files: GenFile[]; activeFile: string; code: string }
  );

export const updateGenTable = (id: number, body: { tableComment?: string; synced?: boolean }) =>
  api.put(`/generator/tables/${id}`, body).then((r) => r.data);

export const generateCode = (id: number) =>
  api.post(`/generator/tables/${id}/generate`).then((r) => r.data);

export const downloadGenTable = async (id: number, filename: string) => {
  const blob = await api
    .get(`/generator/tables/${id}/download`, { responseType: "blob" })
    .then((r) => r.data as Blob);
  downloadBlob(blob, filename);
};
