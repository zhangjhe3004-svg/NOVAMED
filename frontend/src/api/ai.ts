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

// ============ AI 供应商路由 / 模型注入（迁移自 cc-switch） ============

export interface AiRoutingConfig {
  active_provider: string | null;
  active_model: string | null;
  failover_enabled: boolean;
  max_attempts: number;
  system_prompts: Record<string, string>;
  user_overrides: Record<string, { active_provider?: string; active_model?: string }>;
}

export interface AiProviderKey {
  provider: string;
  name: string;
  model: string;
  models: string[];
  request_url: string;
  configured: boolean;
  enabled: boolean;
  priority: number;
  access: string;
  is_active: boolean;
}

export interface AiModelAggregate {
  provider: string;
  provider_name: string;
  model: string;
  is_active_model: boolean;
}

/** 获取 AI 服务商列表 + 路由摘要 */
export async function getAIKeysFull(): Promise<{ keys: AiProviderKey[]; routing: { active_provider: string | null; active_model: string | null; failover_enabled: boolean; max_attempts: number } }> {
  const res = await api.get("/ai-keys"); return res.data;
}

/** 读取完整路由配置 */
export async function getAIRouting(): Promise<AiRoutingConfig> {
  const res = await api.get("/ai-keys/routing"); return res.data;
}

/** 更新路由配置（部分合并） */
export async function updateAIRouting(payload: Partial<AiRoutingConfig>): Promise<any> {
  const res = await api.put("/ai-keys/routing", payload); return res.data;
}

/** 切换激活供应商/模型（Switch + Model Injection） */
export async function setActiveProvider(provider: string, model?: string): Promise<any> {
  const res = await api.put("/ai-keys/active", { provider, model }); return res.data;
}

/** 真实连通性测速 */
export async function testProvider(provider: string): Promise<{ provider: string; ok: boolean; latency_ms?: number; method?: string; models?: string[]; error?: string }> {
  const res = await api.post(`/ai-keys/${provider}/test`); return res.data;
}

/** 模型聚合列表 */
export async function getAIModels(): Promise<{ models: AiModelAggregate[] }> {
  const res = await api.get("/ai-keys/models"); return res.data;
}

/** 个人偏好覆盖（仅作用于本人） */
export async function setPreference(payload: { active_provider?: string; active_model?: string }): Promise<any> {
  const res = await api.put("/ai-keys/me/preference", payload); return res.data;
}
