import api from "./client";

export interface TokenStats {
  total_tokens: number; prompt_tokens: number; completion_tokens: number; by_provider: Record<string, number>; by_model: Record<string, number>;
}

export async function getTokenUsageStats(): Promise<TokenStats> {
  const res = await api.get("/token-usage/stats"); return res.data;
}
