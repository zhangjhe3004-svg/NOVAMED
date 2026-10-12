import api from "./client";

export interface WorkflowStage { key: string; name: string; group: string; order: number; enabled: boolean; desc?: string; }
export interface AIConfigSummary {
  role: string;
  generation_parameters: { temperature: number; top_p: number; repetition_penalty: number; min_p: number; seed: number };
  evidence_tiers: Record<string, string>;
}
export interface AIDiagnosisItem {
  disease: string;
  confidence: number;
  source?: string;
  rationale?: string;
  typical_symptoms?: string[];
  evidence_tier?: string;
  risk_level?: string;
  confirmation_required?: boolean;
}

export interface AIKnowledgeRef { title: string; content_snippet?: string; category?: string; tier?: string }

export interface AIVerification {
  verification_status?: string;
  confirmation_required?: boolean;
  rules_applied?: string[];
  retracted_claims?: { disease: string; reason: string }[];
  unknown_fallback?: string;
}

export interface DiagnosisResult {
  /** 富结构（云端 CoT / 完整引擎） */
  diagnoses?: AIDiagnosisItem[];
  matched_symptom_categories?: string[];
  suggested_exams?: string[];
  knowledge_refs?: AIKnowledgeRef[];
  similar_cases?: { id?: number; diagnosis?: string; symptoms?: string; treatment?: string; doctor_name?: string; visit_date?: string; similarity_score?: number }[];
  verification?: AIVerification;
  ai_analysis?: string;
  disclaimer?: string;
  /** 简版结构（本地验证引擎 / 演示后端） */
  diagnosis?: string;
  confidence?: number;
  evidence?: { title: string; category: string; tier: string }[];
  hallucination_check?: { passed: boolean; grounded: boolean };
}

export interface FullDiagnosisResult {
  diagnoses: AIDiagnosisItem[];
  matched_symptom_categories: string[];
  suggested_exams: string[];
  knowledge_refs: AIKnowledgeRef[];
  similar_cases: { id?: number; diagnosis?: string; symptoms?: string; treatment?: string; doctor_name?: string; visit_date?: string; similarity_score?: number }[];
  verification: AIVerification;
  ai_analysis: string;
  disclaimer: string;
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
export async function aiDiagnose(payload: { symptoms: string; patient_id?: number; provider?: string } | string): Promise<DiagnosisResult> {
  const body = typeof payload === "string" ? { symptoms: payload } : payload;
  const res = await api.post("/ai/diagnose", body); return res.data;
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
