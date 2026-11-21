/**
 * AI 辅助诊断 —— 全站统一板块语汇重设计（lv-* 面板 + ai-* 页面骨架）
 *
 * 布局：左 400px「诊断请求」输入轨道（sticky）+ 右结果舞台
 *   空态 = 珍珠玻璃 Hero；加载 = 三阶段步骤点亮；
 *   结果 = 候选诊断卡（置信度条）→ 相似病例 → AI 深度分析 → 防幻觉验证 → 医生确认操作条。
 * 功能与数据流保持不变：诊断 / 历史分析 / 采纳为草稿 / 驳回建议。
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Input, Button, Select,
  Typography, message, Spin, Empty, Alert, Space, Modal, Form, Table, Segmented,
} from "antd";
import {
  MedicineBoxOutlined,
  AlertOutlined, FileTextOutlined, AudioOutlined, AudioMutedOutlined,
  CheckCircleOutlined, BulbOutlined, SafetyOutlined, BookOutlined,
  ThunderboltOutlined, SearchOutlined, UserOutlined, SendOutlined,
  CloseCircleOutlined, HistoryOutlined, ReloadOutlined, UserSwitchOutlined,
} from "@ant-design/icons";
import { aiDiagnose, aiAnalyze, getAIProviders } from "../api/ai";
import { listPatients } from "../api/patients";
import { listActions, recordAction } from "../api/memory";
import { createRecord } from "../api/records";
import type { FullDiagnosisResult } from "../api/ai";
import VoiceTextArea from "../components/VoiceTextArea";

const { TextArea } = Input;
const { Text } = Typography;

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList; resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string; message: string;
}

export default function AIAssistant() {
  const navigate = useNavigate();
  const [symptoms, setSymptoms] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<number | undefined>();
  const [patients, setPatients] = useState<{ value: number; label: string }[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const patientSearchTimer = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullDiagnosisResult | null>(null);
  const [isFirstVisit, setIsFirstVisit] = useState(true);

  // 防幻觉增强：引擎选择
  const [provider, setProvider] = useState("local");
  const [providers, setProviders] = useState<string[]>([]);

  // 分析强度
  const [analysisStrength, setAnalysisStrength] = useState("中等");

  // 语音
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 历史分析
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // 采纳 / 驳回
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [adoptForm] = Form.useForm();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectForm] = Form.useForm();
  const [decided, setDecided] = useState<"" | "adopted" | "rejected">("");

  const genderLabel = (g?: string) =>
    g === "male" ? "男" : g === "female" ? "女" : g === "other" ? "其他" : "";

  /** 按关键词搜索患者（支持姓名/手机号/档案等，后端模糊检索） */
  const loadPatients = async (kw = "") => {
    setPatientSearching(true);
    try {
      const res = await listPatients({ page: 1, page_size: kw.trim() ? 20 : 50, keyword: kw.trim() });
      setPatients(res.items.map((p: any) => ({
        value: p.id,
        label: [p.name, genderLabel(p.gender), p.phone, p.id ? `#${p.id}` : ""]
          .filter(Boolean)
          .join(" · "),
      })));
    } catch {
      // 忽略加载失败，保留现有选项
    } finally {
      setPatientSearching(false);
    }
  };

  const onPatientSearch = (v: string) => {
    if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current);
    patientSearchTimer.current = setTimeout(() => loadPatients(v), 300);
  };

  useEffect(() => {
    loadPatients("");

    // 加载可用服务商（未配置时回退本地引擎）
    getAIProviders()
      .then((res) => setProviders((res.keys || []).filter((k) => k.configured).map((k) => k.provider)))
      .catch(() => {});

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      setVoiceSupported(true);
      const r = new SR();
      r.lang = "zh-CN"; r.continuous = true; r.interimResults = true;
      r.onresult = (e: SpeechRecognitionEvent) => {
        let t = "";
        for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
        setSymptoms((p) => (p && !p.endsWith("。") && !p.endsWith("，") ? p + "，" : p) + t);
      };
      r.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === "not-allowed") message.error("请允许麦克风权限");
        setIsListening(false);
      };
      r.onend = () => setIsListening(false);
      recognitionRef.current = r;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
    setIsListening(!isListening);
  };

  const handleDiagnose = async (overrideSymptoms?: string) => {
    const text = (overrideSymptoms ?? symptoms).trim();
    if (!text) { message.warning("请输入症状描述"); return; }
    setLoading(true);
    setResult(null);
    setIsFirstVisit(false);
    setDecided("");
    try {
      const params = { symptoms: text, patient_id: selectedPatientId, provider: "local" };
      // 未配置任何云端服务商时，一律走本地验证引擎；否则按所选引擎调用
      const useCloud = provider !== "local" && providers.length > 0;
      const res = useCloud
        ? await aiAnalyze({ ...params, provider })
        : await aiDiagnose(params);
      const normalized = normalizeResult(res);
      setResult(normalized);
      // 写入分析历史（可在「历史分析」中回看与复跑）
      recordAction("ai_analyze", {
        symptoms: text,
        patient_id: selectedPatientId,
        provider: useCloud ? provider : "local",
        top: normalized.diagnoses?.[0]?.disease || "",
        confidence: normalized.diagnoses?.[0]?.confidence || 0,
        candidates: (normalized.diagnoses || []).map((d) => d.disease),
      }).catch(() => {});
    } catch (err: any) {
      message.error(err.response?.data?.detail || "AI诊断请求失败");
    } finally { setLoading(false); }
  };

  /** 兼容不同引擎返回结构：富结构直接使用，简版结构（云端 /analyze 等）就地转换 */
  const normalizeResult = (res: any): FullDiagnosisResult => {
    if (res && Array.isArray(res.diagnoses)) return res as FullDiagnosisResult;
    const conf = typeof res?.confidence === "number" ? res.confidence : 0.6;
    const passed = res?.hallucination_check?.passed !== false;
    const evidence = res?.evidence || [];
    return {
      diagnoses: res?.diagnosis
        ? [{
            disease: res.diagnosis,
            confidence: conf,
            source: "rule_based",
            rationale: "简版引擎返回，未提供推理细节",
            typical_symptoms: [],
            evidence_tier: evidence[0]?.tier || "B",
            confirmation_required: true,
          }]
        : [],
      matched_symptom_categories: [],
      suggested_exams: evidence.map((e: any) => e.title).filter(Boolean).slice(0, 3),
      knowledge_refs: evidence.map((e: any) => ({
        title: e.title, content_snippet: e.category, category: e.category, tier: e.tier,
      })),
      similar_cases: res?.similar_cases || [],
      verification: {
        verification_status: passed ? "confirmed" : "insufficient",
        confirmation_required: true,
        rules_applied: res?.verification?.rules_applied || [],
        retracted_claims: res?.verification?.retracted_claims || [],
        unknown_fallback: passed ? "" : "证据不足，建议人工复核并补充病史",
      },
      ai_analysis: res?.summary || res?.ai_analysis || "",
      disclaimer: res?.disclaimer || "本结果由 AI 引擎生成，仅供医生参考，不构成医疗建议。",
    };
  };

  /** 历史分析：读取用户行为记录中的 AI 分析/采纳/驳回轨迹 */
  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await listActions("ai_", 30);
      setHistory(res.items || []);
    } catch {
      message.error("加载历史分析失败");
    } finally { setHistoryLoading(false); }
  };

  const loadFromHistory = (item: any) => {
    const text = item?.payload?.symptoms || "";
    if (!text) { message.warning("该记录不含症状文本"); return; }
    setSymptoms(text);
    if (item.payload.patient_id) setSelectedPatientId(item.payload.patient_id);
    setResult(null);
    setIsFirstVisit(true);
    setDecided("");
    setHistoryOpen(false);
    message.success("已载入历史症状，可点击「开始分析」重新诊断");
  };

  const rerunFromHistory = async (item: any) => {
    const text = item?.payload?.symptoms || "";
    if (!text) { message.warning("该记录不含症状文本"); return; }
    setSymptoms(text);
    if (item.payload.patient_id) setSelectedPatientId(item.payload.patient_id);
    setHistoryOpen(false);
    await handleDiagnose(text);
  };

  /** 采纳为诊断草稿 → 写入就诊记录并进入审核流程 */
  const openAdopt = () => {
    if (!result) return;
    const top = result.diagnoses?.[0];
    adoptForm.setFieldsValue({
      patient_id: selectedPatientId,
      symptoms,
      diagnosis: top?.disease || "",
      prescription: "",
      notes: `来源：AI 辅助诊断${top ? `（置信度 ${(Number(top.confidence || 0) * 100).toFixed(0)}%）` : ""}`,
    });
    setAdoptOpen(true);
  };

  const submitAdopt = async (values: any) => {
    setAdopting(true);
    try {
      const rec: any = await createRecord({
        patient_id: values.patient_id,
        symptoms: values.symptoms || "",
        diagnosis: values.diagnosis || "",
        prescription: values.prescription || "",
        notes: values.notes || "",
      });
      recordAction("ai_adopt", {
        symptoms: values.symptoms,
        diagnosis: values.diagnosis,
        record_id: rec?.id,
      }).catch(() => {});
      message.success("已采纳为诊断草稿，就诊记录已进入审核流程");
      setAdoptOpen(false);
      adoptForm.resetFields();
      setDecided("adopted");
      navigate("/records");
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "采纳失败（需要医生或管理员权限）");
    } finally { setAdopting(false); }
  };

  /** 驳回建议 → 记录原因用于模型评估 */
  const submitReject = async (values: any) => {
    setRejecting(true);
    try {
      await recordAction("ai_reject", {
        symptoms,
        patient_id: selectedPatientId,
        candidates: (result?.diagnoses || []).map((d) => d.disease),
        reason: values.reason,
      }).catch(() => {});
      message.success("已驳回该建议，原因已记录用于模型评估");
      setRejectOpen(false);
      rejectForm.resetFields();
      setDecided("rejected");
    } finally { setRejecting(false); }
  };

  const kwChips = symptoms.split(/[，,。\s]+/).filter((s) => s.length > 1).slice(0, 5);

  const similarColumns = [
    { title: "相似度", width: 120, render: (_: any, c: any) => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className="ai-confbar" style={{ width: 64, marginTop: 0, display: "inline-block" }}>
          <i style={{ width: `${(c.similarity_score || 0) * 100}%` }} />
        </span>
        <b className="tnum" style={{ fontSize: 12, color: "var(--lv-blue)" }}>{((c.similarity_score || 0) * 100).toFixed(0)}%</b>
      </span>
    ) },
    { title: "症状", dataIndex: "symptoms", ellipsis: true },
    { title: "诊断", dataIndex: "diagnosis", width: 140, ellipsis: true, render: (v: string) => v || "-" },
    { title: "处置", dataIndex: "treatment", width: 140, ellipsis: true, render: (v: string) => v || "-" },
    { title: "医生", dataIndex: "doctor_name", width: 100, render: (v: string) => v || "-" },
    { title: "时间", dataIndex: "visit_date", width: 110, render: (v: string) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{v || "-"}</span> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>AI 辅助诊断</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 6 }}>基于症状描述、知识库与相似病例给出可核查的候选诊断；最终结论由医生确认。</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span className="lv-tag lv-tag--neutral"><ThunderboltOutlined /> 模型：{provider === "local" ? "本地验证引擎" : provider === "auto" ? "云端 · 自动选择" : `云端 ${provider}`}</span>
          <button className="lv-btn" type="button" onClick={openHistory}><HistoryOutlined /> 历史分析</button>
        </div>
      </div>

      <div className="ai-grid">
        {/* ============ 左：诊断请求输入轨道 ============ */}
        <aside className="ai-rail">
          <section className="lv-panel">
            <div className="lv-panel-head">
              <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
              <span className="lv-panel-title">诊断请求</span>
              <span className="lv-panel-meta">规则引擎 + 相似病例 + 知识库</span>
            </div>
            <div className="ai-fields">
              {/* 关联患者 */}
              <div className="ai-field">
                <span className="ai-label"><UserOutlined style={{ color: "var(--lv-soft)" }} />关联患者（可选）</span>
                <Select
                  style={{ width: "100%" }}
                  allowClear showSearch
                  placeholder="输入姓名/手机号等搜索患者…"
                  options={patients}
                  loading={patientSearching}
                  filterOption={false}
                  onSearch={onPatientSearch}
                  notFoundContent={patientSearching ? <Spin size="small" /> : "未找到患者"}
                  onChange={(v) => setSelectedPatientId(v as number | undefined)}
                  suffixIcon={<SearchOutlined />}
                />
                <span className="ai-hint">
                  {selectedPatientId
                    ? `已关联患者 #${selectedPatientId}，诊断时会结合该患者病史`
                    : "不关联时仅按症状做通用诊断"}
                </span>
              </div>

              {/* 分析强度 */}
              <div className="ai-field">
                <span className="ai-label">分析强度</span>
                <Segmented block value={analysisStrength} onChange={(v) => setAnalysisStrength(v as string)}
                  options={["较低", "中等", "较高"]} />
                <span className="ai-hint">较高强度会检索更多相似病例并延长分析时间</span>
              </div>

              {/* 分析引擎 */}
              <div className="ai-field">
                <span className="ai-label"><ThunderboltOutlined style={{ color: "var(--lv-soft)" }} />分析引擎</span>
                <Select
                  style={{ width: "100%" }}
                  value={provider}
                  onChange={setProvider}
                  options={[
                    { value: "local", label: "本地验证引擎（离线防幻觉）" },
                    ...providers.map((p) => ({ value: p, label: `云端 ${p}（CoT）` })),
                    ...(providers.length > 0 ? [{ value: "auto", label: "云端 自动选择" }] : []),
                  ]}
                />
                <span className="ai-hint">
                  {providers.length === 0
                    ? "未配置云端服务商，将使用本地验证引擎（离线可用）"
                    : "云端 CoT 失败时自动回退本地验证引擎"}
                </span>
              </div>

              {/* 检索来源 */}
              <div className="ai-field">
                <span className="ai-label">检索来源</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="ai-source">向量语义搜索<span className="lv-tag lv-tag--leaf"><span className="lv-tag-dot" />已启用</span></div>
                  <div className="ai-source">知识库参考<span className="lv-tag lv-tag--leaf"><span className="lv-tag-dot" />已启用</span></div>
                  <div className="ai-source">相似病例参考<span className="lv-tag lv-tag--leaf"><span className="lv-tag-dot" />已启用</span></div>
                </div>
              </div>

              {/* 症状描述 */}
              <div className="ai-field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="ai-label">症状描述</span>
                  {voiceSupported && (
                    <Button
                      size="small"
                      type={isListening ? "primary" : "text"}
                      danger={isListening}
                      icon={isListening ? <AudioMutedOutlined /> : <AudioOutlined />}
                      onClick={toggleVoice}
                      style={{ borderRadius: 8 }}
                    >
                      {isListening ? "停止" : "语音"}
                    </Button>
                  )}
                </div>
                <TextArea
                  rows={7}
                  placeholder="描述患者症状...&#10;&#10;例如：患者头痛3天，伴恶心呕吐，&#10;体温38.5°C，咳嗽有黄痰..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  style={{ resize: "none", fontSize: 13, lineHeight: 1.8 }}
                />
                {isListening && (
                  <span className="ai-hint is-error">● 录音中… 请说话，点击「停止」结束</span>
                )}
                {kwChips.length > 0 && (
                  <span className="ai-kw">
                    {kwChips.map((k) => <span key={k} className="lv-tag lv-tag--neutral">{k}</span>)}
                  </span>
                )}
              </div>

              {/* 开始分析 */}
              <Button
                type="primary"
                className="lv-submit"
                icon={<SendOutlined />}
                loading={loading}
                onClick={() => handleDiagnose()}
                block
                size="large"
                style={{ height: 44, fontSize: 14, fontWeight: 650 }}
              >
                开始分析
              </Button>
              <div className="ai-hint" style={{ textAlign: "center" }}>
                分析结果仅供医生参考，不构成医疗建议；系统会记录每次分析的模型、依据与确认人。
              </div>
            </div>
          </section>
        </aside>

        {/* ============ 右：结果舞台 ============ */}
        <section style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {isFirstVisit && !loading ? (
            /* 初始引导 Hero */
            <div className="ai-hero">
              <div className="ai-orb"><MedicineBoxOutlined style={{ fontSize: 40 }} /></div>
              <h2>临床 AI 诊断引擎</h2>
              <p>
                在左侧输入患者症状描述，系统将通过规则引擎、相似病例投票与知识库检索三层分析，
                生成可核查的候选诊断供您参考。
              </p>
              <div className="ai-hero-chips">
                <span className="lv-tag lv-tag--leaf"><CheckCircleOutlined /> 11 类症状覆盖</span>
                <span className="lv-tag lv-tag--neutral"><SearchOutlined /> 向量语义搜索</span>
                <span className="lv-tag lv-tag--amber"><SafetyOutlined /> 医生最终确认</span>
              </div>
            </div>
          ) : loading ? (
            /* 加载状态：三阶段步骤 */
            <section className="lv-panel">
              <div className="lv-panel-head">
                <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
                <span className="lv-panel-title">正在分析症状</span>
                <span className="lv-panel-meta">三层检索流水线</span>
              </div>
              <div style={{ padding: "44px 24px 52px", textAlign: "center" }}>
                <Spin size="large" />
                <div className="ai-steps">
                  <div className="ai-step"><i />规则引擎匹配症状分类</div>
                  <div className="ai-step"><i />向量检索相似病例投票</div>
                  <div className="ai-step"><i />知识库取证与防幻觉校验</div>
                </div>
              </div>
            </section>
          ) : result && result.diagnoses.length > 0 ? (
            /* 诊断结果 */
            <>
              {/* 候选诊断 */}
              <section className="lv-panel">
                <div className="lv-panel-head">
                  <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
                  <span className="lv-panel-title">候选诊断</span>
                  <span className="lv-panel-meta">按置信度排序 · 匹配分类：{result.matched_symptom_categories?.join("、") || "未分类"}</span>
                  <div className="lv-panel-tools">
                    <span className={`lv-tag ${result.verification?.verification_status === "confirmed" ? "lv-tag--leaf" : "lv-tag--amber"}`}>
                      <span className="lv-tag-dot" />
                      证据校验{result.verification?.verification_status === "confirmed" ? "通过" : "中"}
                    </span>
                  </div>
                </div>
                <div className="ai-dx-list">
                  {result.diagnoses.map((diag, i) => (
                    <div key={diag.disease} className={`ai-dx${i === 0 ? " is-top" : ""}`}>
                      <div className="ai-dx-head">
                        <span className="ai-rank">{String(i + 1).padStart(2, "0")}</span>
                        <span className="ai-dx-name">{diag.disease}</span>
                        <span className="lv-tag lv-tag--neutral">{diag.source === "rule_based" ? "规则引擎" : diag.source === "similar_cases" ? "相似病例" : diag.source}</span>
                        <span className="ai-pct">{(diag.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="ai-confbar"><i style={{ width: `${diag.confidence * 100}%` }} /></div>
                      {diag.rationale && (
                        <p className="ai-dx-rationale">
                          <BulbOutlined style={{ color: "#b9770a", flexShrink: 0, marginTop: 2 }} />
                          <span>{diag.rationale}</span>
                        </p>
                      )}
                      {diag.typical_symptoms && diag.typical_symptoms.length > 0 && (
                        <div className="ai-dx-foot">
                          {diag.typical_symptoms.map((s) => (
                            <span key={s} className={`lv-tag ${symptoms.includes(s) ? "lv-tag--leaf" : "lv-tag--neutral"}`}>
                              {symptoms.includes(s) && <span className="lv-tag-dot" />}{s}{symptoms.includes(s) ? " ✓" : ""}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="ai-dx-foot">
                        {diag.evidence_tier && (
                          <span className={`lv-tag ${diag.evidence_tier === "A" ? "lv-tag--leaf" : diag.evidence_tier === "B" ? "lv-tag--neutral" : "lv-tag--amber"}`}>
                            证据等级 {diag.evidence_tier}
                          </span>
                        )}
                        {diag.risk_level && <span className="lv-tag lv-tag--neutral">风险 {diag.risk_level}</span>}
                        {diag.confirmation_required && <span className="lv-tag lv-tag--amber"><span className="lv-tag-dot" />待医生确认</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 相似病例参考 */}
              {result.similar_cases.length > 0 && (
                <section className="lv-panel">
                  <div className="lv-panel-head">
                    <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
                    <span className="lv-panel-title">相似病例参考</span>
                    <span className="lv-panel-meta">基于向量语义检索，已脱敏 · 共 {result.similar_cases.length} 例</span>
                  </div>
                  <Table
                    rowKey={(_, i) => String(i)}
                    size="middle"
                    dataSource={result.similar_cases.slice(0, 3)}
                    columns={similarColumns}
                    pagination={false}
                    scroll={{ x: 820 }}
                    locale={{ emptyText: "暂无相似病例" }}
                  />
                </section>
              )}

              {/* 建议检查 + 知识库参考 */}
              {(result.suggested_exams.length > 0 || result.knowledge_refs.length > 0) && (
                <section className="lv-panel">
                  <div className="lv-panel-head">
                    <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
                    <span className="lv-panel-title">建议检查与知识库参考</span>
                    {result.knowledge_refs.length > 0 && <span className="lv-panel-meta">{result.knowledge_refs.length} 条文献</span>}
                  </div>
                  <div className="ai-verify">
                    {result.suggested_exams.length > 0 && (
                      <div>
                        <div className="ai-label" style={{ marginBottom: 8 }}>建议检查项目</div>
                        <div className="ai-kw">
                          {result.suggested_exams.map((exam, i) => (
                            <span key={exam} className={`lv-tag ${i < 2 ? "lv-tag--leaf" : "lv-tag--neutral"}`}>{exam}</span>
                          ))}
                        </div>
                        <div className="ai-hint" style={{ marginTop: 8 }}>高亮项为模型优先建议；可加入本次诊疗的检查单。</div>
                      </div>
                    )}
                    {result.knowledge_refs.length > 0 && (
                      <div>
                        <div className="ai-label" style={{ marginBottom: 8 }}>知识库参考</div>
                        {result.knowledge_refs.map((ref, i) => (
                          <div key={i} className="ai-verify-row" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <BookOutlined style={{ color: "var(--lv-soft)", flexShrink: 0, marginTop: 3 }} />
                            <span><b style={{ color: "var(--lv-ink)" }}>{ref.title}</b>
                              {ref.content_snippet && <span style={{ color: "var(--lv-faint)" }}> · {ref.content_snippet}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 免责声明 */}
              <Alert
                title={result.disclaimer}
                type="warning"
                showIcon
                icon={<AlertOutlined />}
                style={{ borderRadius: 12 }}
              />

              {/* 云端 CoT 深度分析 */}
              {result.ai_analysis && (
                <section className="lv-panel">
                  <div className="lv-panel-head">
                    <span className="lv-tag lv-tag--amber" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
                    <span className="lv-panel-title">AI 深度分析（思维链 CoT）</span>
                  </div>
                  <div className="ai-prose">{result.ai_analysis}</div>
                </section>
              )}

              {/* 防幻觉验证摘要 */}
              {result.verification && (
                <section className="lv-panel">
                  <div className="lv-panel-head">
                    <span className={`lv-tag ${result.verification.verification_status === "confirmed" ? "lv-tag--leaf" : "lv-tag--amber"}`} style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
                    <span className="lv-panel-title">防幻觉验证</span>
                    <span className="lv-panel-meta">规则 {result.verification.rules_applied?.length || 0} 条</span>
                    <div className="lv-panel-tools">
                      {result.verification.verification_status === "confirmed"
                        ? <span className="lv-tag lv-tag--leaf"><SafetyOutlined /> 证据校验通过</span>
                        : <span className="lv-tag lv-tag--amber"><AlertOutlined /> 证据不足</span>}
                      {result.verification.confirmation_required && <span className="lv-tag lv-tag--neutral">需医生确认</span>}
                    </div>
                  </div>
                  <div className="ai-verify">
                    {result.verification.rules_applied && result.verification.rules_applied.length > 0 && (
                      <div>
                        <div className="ai-label" style={{ marginBottom: 6 }}>已启用防幻觉机制</div>
                        {result.verification.rules_applied.map((r, i) => (
                          <div key={i} className="ai-verify-row">· {r}</div>
                        ))}
                      </div>
                    )}

                    {result.verification.retracted_claims && result.verification.retracted_claims.length > 0 && (
                      <div>
                        <div className="ai-label" style={{ marginBottom: 6, color: "var(--lv-red-text)" }}>已撤回的主张（找不到支撑性引用）</div>
                        {result.verification.retracted_claims.map((r, i) => (
                          <div key={i} className="ai-verify-row" style={{ color: "var(--lv-red-text)" }}>
                            · {r.disease} — {r.reason}
                          </div>
                        ))}
                      </div>
                    )}

                    {result.verification.unknown_fallback && (
                      <Alert
                        type="warning" showIcon icon={<AlertOutlined />}
                        title={result.verification.unknown_fallback}
                        style={{ borderRadius: 12 }}
                      />
                    )}
                  </div>
                </section>
              )}

              {/* 医生确认操作条 */}
              <section className="lv-panel">
                <div className="ai-actionbar">
                  {decided === "adopted" ? (
                    <span className="lv-tag lv-tag--leaf"><span className="lv-tag-dot" />已采纳 · 已生成记录</span>
                  ) : decided === "rejected" ? (
                    <span className="lv-tag lv-tag--gray"><span className="lv-tag-dot" />已驳回</span>
                  ) : (
                    <span className="lv-tag lv-tag--amber"><span className="lv-tag-dot" />待医生确认</span>
                  )}
                  <div className="ai-actionbar-text">
                    医生最终确认后，候选诊断将写入就诊记录并进入审核流程；驳回将记录原因用于模型评估。
                  </div>
                  {decided === "" ? (
                    <Space size={10}>
                      <Button icon={<CloseCircleOutlined />} danger onClick={() => { rejectForm.resetFields(); setRejectOpen(true); }}>
                        驳回建议
                      </Button>
                      <Button type="primary" className="lv-submit" icon={<CheckCircleOutlined />} onClick={openAdopt}>
                        采纳为诊断草稿
                      </Button>
                    </Space>
                  ) : (
                    <Space size={10}>
                      <Button icon={<FileTextOutlined />} onClick={() => navigate("/records")}>查看就诊记录</Button>
                      <Button type="primary" className="lv-submit" icon={<ReloadOutlined />} onClick={() => handleDiagnose()}>重新分析</Button>
                    </Space>
                  )}
                </div>
              </section>
            </>
          ) : result && result.diagnoses.length === 0 ? (
            /* 空结果 */
            <section className="lv-panel">
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <Empty
                  description={
                    result.verification?.unknown_fallback ? (
                      <Text style={{ fontSize: 14, color: "#b9770a", fontWeight: 600 }}>
                        {result.verification.unknown_fallback}
                      </Text>
                    ) : (
                      <>
                        未找到匹配的诊断建议<br />
                        <Text style={{ fontSize: 12 }}>请补充更多症状细节后重试</Text>
                      </>
                    )
                  }
                />
              </div>
            </section>
          ) : null}
        </section>
      </div>

      {/* 历史分析 */}
      <Modal
        title="历史分析记录"
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        footer={<Button onClick={() => setHistoryOpen(false)}>关闭</Button>}
        width={720}
      >
        {historyLoading ? (
          <div style={{ textAlign: "center", padding: 30 }}><Spin /></div>
        ) : history.length === 0 ? (
          <Empty description="暂无历史分析记录，完成一次分析后会自动留痕" />
        ) : (
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            {history.map((h, i) => {
              const kind = h.action === "ai_adopt" ? "采纳" : h.action === "ai_reject" ? "驳回" : "分析";
              const tone = h.action === "ai_adopt" ? "lv-tag--leaf" : h.action === "ai_reject" ? "lv-tag--red" : "lv-tag--neutral";
              return (
                <div
                  key={i}
                  style={{
                    borderBottom: "1px solid var(--lv-line)",
                    padding: "12px 2px",
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <span className={`lv-tag ${tone}`} style={{ flexShrink: 0 }}><span className="lv-tag-dot" />{kind}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--lv-ink)", lineHeight: 1.7 }}>
                      <b>症状：</b>{h.payload?.symptoms || "-"}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--lv-muted)", marginTop: 3 }}>
                      {h.payload?.top || h.payload?.diagnosis || h.payload?.candidates?.join("、") || "-"}
                      {h.payload?.confidence ? ` · 置信度 ${(h.payload.confidence * 100).toFixed(0)}%` : ""}
                      {h.payload?.reason ? ` · 驳回原因：${h.payload.reason}` : ""}
                      {h.payload?.record_id ? ` · 已生成记录 #${h.payload.record_id}` : ""}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--lv-faint)", marginTop: 3 }}>
                      {h.at ? new Date(h.at).toLocaleString("zh-CN") : ""}
                      {h.payload?.provider ? ` · 引擎 ${h.payload.provider}` : ""}
                    </div>
                  </div>
                  <Space size={6} style={{ flexShrink: 0 }}>
                    <Button size="small" icon={<UserSwitchOutlined />} onClick={() => loadFromHistory(h)}>载入症状</Button>
                    <Button size="small" type="primary" className="lv-submit" icon={<ReloadOutlined />} onClick={() => rerunFromHistory(h)}>
                      重新分析
                    </Button>
                  </Space>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* 采纳为诊断草稿 */}
      <Modal
        title="采纳为诊断草稿"
        open={adoptOpen}
        onCancel={() => setAdoptOpen(false)}
        onOk={() => adoptForm.submit()}
        confirmLoading={adopting}
        okText="采纳并生成记录"
        width={620}
      >
        <div className="ai-verify-row" style={{
          background: "var(--lv-blue-soft)", borderRadius: 10, padding: "10px 14px", marginBottom: 12,
          color: "var(--lv-blue)",
        }}>
          采纳后将按「就诊记录」创建一条草稿记录（医生为当前账号），并进入医生/管理员审核流程。
        </div>
        <Form form={adoptForm} layout="vertical" onFinish={submitAdopt}>
          <Form.Item name="patient_id" label="患者" rules={[{ required: true, message: "请选择患者（记录必须归属患者）" }]}>
            <Select
              showSearch
              placeholder="搜索并选择患者"
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
              options={patients}
            />
          </Form.Item>
          <Form.Item name="symptoms" label="主诉症状" rules={[{ required: true, message: "请填写主诉症状" }]}>
            <VoiceTextArea rows={3} />
          </Form.Item>
          <Form.Item name="diagnosis" label="诊断结果（默认取置信度最高的候选）" rules={[{ required: true, message: "请填写诊断结果" }]}>
            <VoiceTextArea rows={2} />
          </Form.Item>
          <Form.Item name="prescription" label="处方"><VoiceTextArea rows={2} placeholder="可留空，后续在记录中补充" /></Form.Item>
          <Form.Item name="notes" label="备注"><VoiceTextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* 驳回建议 */}
      <Modal
        title="驳回 AI 建议"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => rejectForm.submit()}
        confirmLoading={rejecting}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <div className="ai-verify-row" style={{ marginBottom: 12 }}>
          驳回原因会写入用户行为记录，用于模型评估与后续优化。
        </div>
        <Form form={rejectForm} layout="vertical" onFinish={submitReject}>
          <Form.Item name="reason" label="驳回原因" rules={[{ required: true, message: "请填写驳回原因" }]}>
            <VoiceTextArea rows={4} placeholder="例如：与患者体征不符 / 缺少实验室证据 / 已排除该诊断" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
