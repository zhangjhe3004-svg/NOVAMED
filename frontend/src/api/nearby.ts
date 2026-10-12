import api from "./client";

export interface PeerItem {
  id: number; real_name: string; username: string; role: string;
  auth_level: number; department?: string; title?: string; phone?: string; relation: string;
  superior_id?: number | null;
}
export interface PermissionLevel {
  id: number; level: number; name: string; description: string; permissions: string[]; enabled: boolean;
}
export interface TransferItem {
  id: number; sender_id: number; receiver_id: number; sender_name: string; receiver_name: string;
  direction: string; item_type: string; item_title: string; payload: any; status: string; note?: string; created_at?: string;
  files?: { id: number; file_name: string; file_size: number; content_type?: string }[];
}
export interface TeamMember {
  id: number; real_name: string; department?: string; title?: string; auth_level: number; role: string;
}
export interface TransferableRecord {
  id: number; patient_id: number; diagnosis?: string; symptoms?: string; prescription?: string; created_at?: string;
}
export async function listPeers(): Promise<{ items: PeerItem[] }> {
  const res = await api.get("/nearby/peers"); return res.data;
}
export async function listLevels(): Promise<{ items: PermissionLevel[] }> {
  const res = await api.get("/nearby/levels"); return res.data;
}
export async function createLevel(payload: any): Promise<PermissionLevel> {
  const res = await api.post("/nearby/levels", payload); return res.data;
}
export async function updateLevel(id: number, payload: any): Promise<PermissionLevel> {
  const res = await api.put("/nearby/levels/" + id, payload); return res.data;
}
export async function deleteLevel(id: number): Promise<any> {
  const res = await api.delete("/nearby/levels/" + id); return res.data;
}
export async function listTransfers(): Promise<{ items: TransferItem[] }> {
  const res = await api.get("/nearby/transfers"); return res.data;
}
export async function listRecords(): Promise<{ items: TransferableRecord[] }> {
  const res = await api.get("/nearby/records"); return res.data;
}
export async function sendTransfer(payload: any): Promise<any> {
  const res = await api.post("/nearby/transfer", payload); return res.data;
}
export async function respondTransfer(id: number, accept: boolean): Promise<any> {
  const res = await api.post("/nearby/transfers/" + id + "/respond", { accept }); return res.data;
}

/** 上传任意格式文件并发起互传 */
export async function sendFiles(receiverId: number, files: File[], note: string): Promise<any> {
  const fd = new FormData();
  fd.append("receiver_id", String(receiverId));
  fd.append("note", note || "");
  files.forEach((f) => fd.append("files", f));
  const res = await api.post("/nearby/transfer-file", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/** 互传附件下载地址 */
export function fileDownloadUrl(fid: number): string {
  return (api.defaults.baseURL || "/api") + `/nearby/files/${fid}/download`;
}

/** 查看某人负责的人员（直接下级） */
export async function teamOf(uid: number): Promise<{ user: any; items: TeamMember[] }> {
  const res = await api.get(`/nearby/assignees/${uid}`);
  return res.data;
}

// ---------- 连接（互传授权：低权限申请 → 高权限审批） ----------

export interface ConnectionItem {
  id: number; requester_id: number; target_id: number;
  requester_name: string; target_name: string;
  requester_level: number; target_level: number;
  status: "pending" | "accepted" | "rejected";
  note: string; created_at?: string; updated_at?: string;
}
export interface ConnectionsData {
  connected_ids: number[];
  incoming_pending: ConnectionItem[];
  outgoing: ConnectionItem[];
}

/** 我的连接数据：已连接对方 id + 待我审批的申请 + 我发出的申请状态 */
export async function getConnections(): Promise<ConnectionsData> {
  const res = await api.get("/nearby/connections"); return res.data;
}

/** 发起连接申请：低权限→高权限需对方审批；同级或高→低自动通过 */
export async function requestConnection(targetId: number, note = ""): Promise<{ id: number; status: string }> {
  const res = await api.post("/nearby/connect/request", { target_id: targetId, note });
  return res.data;
}

/** 为责任链内两名成员发起连接申请（3D 场景点选两节点）；一方可是自己 */
export async function requestConnectionPair(aId: number, bId: number, note = ""): Promise<{ id: number; status: string }> {
  const res = await api.post("/nearby/connect/request-pair", { a_id: aId, b_id: bId, note });
  return res.data;
}

/** 审批方通过 / 拒绝连接申请 */
export async function respondConnection(connectionId: number, accept: boolean): Promise<{ id: number; status: string }> {
  const res = await api.post(`/nearby/connect/${connectionId}/respond`, { accept });
  return res.data;
}

/** 取消（断开）与某同事的连接；待审批申请也会撤回 */
export async function cancelConnection(peerId: number): Promise<any> {
  const res = await api.delete(`/nearby/connect/${peerId}`);
  return res.data;
}
