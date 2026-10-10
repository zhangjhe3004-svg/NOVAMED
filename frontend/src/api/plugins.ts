import api from "./client";

export interface PluginInfo { name: string; display_name: string; description: string; version: string; enabled: boolean; }

export async function getPlugins(): Promise<{ total: number; plugins: PluginInfo[] }> {
  const res = await api.get("/plugins"); return res.data;
}
export async function enablePlugin(name: string): Promise<any> {
  const res = await api.post(`/plugins/${name}/enable`); return res.data;
}
export async function disablePlugin(name: string): Promise<any> {
  const res = await api.post(`/plugins/${name}/disable`); return res.data;
}
