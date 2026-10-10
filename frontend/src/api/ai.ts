import api from "./client";

export interface WorkflowStage { key: string; name: string; group: string; order: number; enabled: boolean; desc?: string; }
export interface AIConfigSummary {
  role: string;
  generation_parameters: { temperature: number; top_p: number; repetition_penalty: number; min_p: number; seed: number };
  evidence_tiers: Record<string, string>;
}
export interface DiagnosisResult {
  diagnosis: string; confidence: number;
  similar_cases: { id: number; diagnosis: string; symptoms: string }[];
  evidence: { title: string; category: string; tier: string }[];
  hallucination_check: { passed: boolean; grounded: boolean };
}

export async function getWorkflow(): Promise<{ stages: WorkflowStage[] }> {
  const res = await api.get("/ai/workflow"); return res.data;
}
export async function updateWorkflow(stage: { key: string; enabled: boolean }): Promise<any> {
  const res = await api.post("/ai/workflow", stage); return res.data;
}
export async function getAIConfig(): Promise<AIConfigSummary> {
  const res = await api.get("/ai/config"); return res.data;
}
export async function aiDiagnose(symptoms: string): Promise<DiagnosisResult> {
  const res = await api.post("/ai/diagnose", { symptoms }); return res.data;
}
export async function aiAnalyze(payload: any): Promise<any> {
  const res = await api.post("/ai/analyze", payload); return res.data;
}
export async function getAIProviders(): Promise<{ keys: { provider: string; configured: boolean }[] }> {
  const res = await api.get("/ai-keys"); return res.data;
}
export async function getVectorStats(): Promise<any> {
  const res = await api.get("/ai/vector-stats"); return res.data;
}
