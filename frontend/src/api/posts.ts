/**
 * 岗位管理 API —— 对应后端 /api/posts（岗位 CRUD）
 */
import api from "./client";

export interface PostItem {
  id: number;
  post_code: string;
  post_name: string;
  sort: number;
  status: number;
  remark: string;
  user_count: number;
  created_at: string | null;
}

export interface PostPayload {
  post_code: string;
  post_name: string;
  sort?: number;
  status?: number;
  remark?: string;
}

export const listPosts = (params: { page?: number; page_size?: number; keyword?: string; status?: string } = {}) =>
  api.get("/posts", { params }).then((r) => r.data as { total: number; items: PostItem[] });

export const createPost = (body: PostPayload) => api.post("/posts", body).then((r) => r.data);

export const updatePost = (id: number, body: Partial<PostPayload>) =>
  api.put(`/posts/${id}`, body).then((r) => r.data);

export const removePost = (id: number) => api.delete(`/posts/${id}`).then((r) => r.data);
