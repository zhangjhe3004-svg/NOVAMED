/**
 * AI 辅助诊断 — Material 3 设计
 *
 * 布局：双栏不对称
 * ├── 主区域（2/3）：诊断结果 — 主导视觉区域
 * └── 侧区域（1/3）：症状输入 + 参考信息
 */
import { useState, useEffect, useRef } from "react";
import {
  Row, Col, Card, Input, Button, Select, Progress, Tag,
  Typography, message, Spin, Empty, Alert, Space, Badge, Divider,
} from "antd";
import {
  MedicineBoxOutlined,
  AlertOutlined, FileSearchOutlined, AudioOutlined, AudioMutedOutlined,
  CheckCircleOutlined, BulbOutlined, SafetyOutlined, BookOutlined,
  ThunderboltOutlined, SearchOutlined, UserOutlined, SendOutlined,
} from "@ant-design/icons";
import { aiDiagnose, aiAnalyze, getAIProviders } from "../api/ai";
import { listPatients } from "../api/patients";
import type { DiagnosisResult } from "../api/ai";

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList; resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string; message: string;
}

// NocoBase 配色
const M3 = {
  primary: "#1677ff",
  secondary: "#52c41a",
  tertiary: "#722ed1",
  error: "#ff4d4f",
  surface: "#ffffff",
  surfaceLow: "#f5f5f5",
  surfaceVariant: "#f0f0f0",
  onSurface: "#1f1f1f",
  onSurfaceVariant: "#6b7280",
  outline: "#bfbfbf",
};

export default function AIAssistant() {
  const [symptoms, setSymptoms] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<number | undefined>();
  const [patients, setPatients] = useState<{ value: number; label: string }[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const patientSearchTimer = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [isFirstVisit, setIsFirstVisit] = useState(true);

  // 防幻觉增强：引擎选择
  const [provider, setProvider] = useState("local");
  const [providers, setProviders] = useState<string[]>([]);

  // 语音
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

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

    // 加载可用服务商
    getAIProviders()
      .then((res) => setProviders(res.providers || []))
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

  const handleDiagnose = async () => {
    if (!symptoms.trim()) { message.warning("请输入症状描述"); return; }
    setLoading(true);
    setResult(null);
    setIsFirstVisit(false);
    try {
      const params = { symptoms: symptoms.trim(), patient_id: selectedPatientId };
      // 未配置任何云端服务商时，一律走本地验证引擎；否则按所选引擎调用
      const useCloud = provider !== "local" && providers.length > 0;
      const res = useCloud
        ? await aiAnalyze({ ...params, provider })
        : await aiDiagnose({ ...params, provider: "local" });
      setResult(res);
    } catch (err: any) {
      message.error(err.response?.data?.detail || "AI诊断请求失败");
    } finally { setLoading(false); }
  };

  const confidenceLevel = (conf: number) => {
    if (conf >= 0.7) return { color: M3.secondary, label: "较高", bg: "#f6ffed" };
    if (conf >= 0.5) return { color: "#faad14", label: "中等", bg: "#fffbe6" };
    return { color: M3.error, label: "较低", bg: "#FFDAD6" };
  };

  return (
    <div>
      {/* Material 3 页面标题 */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: `linear-gradient(135deg, ${M3.primary}, ${M3.tertiary})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 2px 12px rgba(108,71,255,0.2)`,
        }}>
          <ThunderboltOutlined style={{ fontSize: 24, color: "#fff" }} />
        </div>
        <div>
          <h2 style={{ font: "600 24px/32px 'Outfit', sans-serif", margin: 0, color: M3.onSurface }}>
            AI 辅助诊断
          </h2>
          <Text style={{ color: M3.onSurfaceVariant, fontSize: 14 }}>
            基于症状描述 + 历史病例 + 知识库的多层分析引擎
          </Text>
        </div>
      </div>

      <Row gutter={20}>
        {/* ============ 主区域：诊断结果 ============ */}
        <Col xs={24} lg={15}>
          {isFirstVisit && !loading ? (
            /* 初始引导状态 */
            <Card style={{
              borderRadius: 20,
              border: `1px dashed ${M3.outline}`,
              background: M3.surfaceLow,
              textAlign: "center",
              padding: "60px 24px",
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: 24,
                background: `linear-gradient(135deg, ${M3.primary}15, ${M3.tertiary}15)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px",
              }}>
                <MedicineBoxOutlined style={{ fontSize: 40, color: M3.primary }} />
              </div>
              <Title level={3} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
                临床 AI 诊断引擎
              </Title>
              <Text style={{ color: M3.onSurfaceVariant, fontSize: 15, display: "block", maxWidth: 400, margin: "0 auto 24px" }}>
                在右侧输入患者症状描述，系统将通过规则引擎 + 相似病例投票 + 知识库检索三层分析，生成诊断建议供您参考。
              </Text>
              <Space size={16}>
                <Tag icon={<CheckCircleOutlined />} color="success">11类症状覆盖</Tag>
                <Tag icon={<SearchOutlined />} color="blue">向量语义搜索</Tag>
                <Tag icon={<SafetyOutlined />} color="purple">医生最终确认</Tag>
              </Space>
            </Card>
          ) : loading ? (
            /* 加载状态 */
            <Card style={{ borderRadius: 20, textAlign: "center", padding: "60px 24px" }}>
              <Spin size="large" />
              <div style={{ marginTop: 24 }}>
                <Title level={4} style={{ fontFamily: "'Outfit', sans-serif" }}>正在分析症状...</Title>
                <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                  🧬 规则引擎匹配 · 🔍 向量检索相似病例 · 📚 搜索知识库参考
                </Text>
              </div>
            </Card>
          ) : result && result.diagnoses.length > 0 ? (
            /* 诊断结果列表 */
            <div>
              {/* 诊断摘要卡片 */}
              <div style={{
                background: `linear-gradient(135deg, ${M3.primary}08, ${M3.tertiary}08)`,
                borderRadius: 16,
                padding: "16px 20px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}>
                <Space size={16} wrap>
                  <span>
                    <Text style={{ fontSize: 12, color: M3.onSurfaceVariant }}>匹配分类</Text><br/>
                    <Text strong style={{ fontSize: 14 }}>
                      {result.matched_symptom_categories?.length || 0} 类
                    </Text>
                  </span>
                  <Divider type="vertical" />
                  <span>
                    <Text style={{ fontSize: 12, color: M3.onSurfaceVariant }}>候选诊断</Text><br/>
                    <Text strong style={{ fontSize: 14, color: M3.primary }}>
                      {result.diagnoses?.length || 0} 项
                    </Text>
                  </span>
                  <Divider type="vertical" />
                  <span>
                    <Text style={{ fontSize: 12, color: M3.onSurfaceVariant }}>相似病例</Text><br/>
                    <Text strong style={{ fontSize: 14 }}>{result.similar_cases?.length || 0} 例</Text>
                  </span>
                  <Divider type="vertical" />
                  <span>
                    <Text style={{ fontSize: 12, color: M3.onSurfaceVariant }}>建议检查</Text><br/>
                    <Text strong style={{ fontSize: 14, color: M3.secondary }}>{result.suggested_exams?.length || 0} 项</Text>
                  </span>
                </Space>
                <Tag color="blue" style={{ fontSize: 12 }}>引擎: {result.engine}</Tag>
              </div>

              {/* 每个诊断卡片 */}
              {result.diagnoses.map((diag, i) => {
                const level = confidenceLevel(diag.confidence);
                return (
                  <div key={diag.disease} style={{
                    background: M3.surface,
                    borderRadius: 16,
                    border: `1px solid ${M3.surfaceVariant}`,
                    padding: "16px 20px",
                    marginBottom: 12,
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.2s",
                  }}>
                    {/* 左侧置信度色条 */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, bottom: 0, width: 4,
                      background: `linear-gradient(180deg, ${level.color}, ${level.color}88)`,
                    }}/>

                    {/* 诊断名称 + 置信度 */}
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "flex-start", marginBottom: 12, paddingLeft: 4,
                    }}>
                      <div>
                        <Text strong style={{ fontSize: 17, fontFamily: "'Outfit', sans-serif" }}>
                          #{i + 1} {diag.disease}
                        </Text>
                        <Space size={8} style={{ marginLeft: 12 }}>
                          <Tag color={i === 0 ? "blue" : "default"} style={{ borderRadius: 8 }}>
                            {diag.source === "rule_based" ? "规则引擎" : diag.source === "similar_cases" ? "相似病例" : diag.source}
                          </Tag>
                          {diag.similar_case_support && (
                            <Text style={{ fontSize: 12, color: M3.onSurfaceVariant }}>
                              📊 {diag.similar_case_support} 例支持
                            </Text>
                          )}
                        </Space>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Text style={{ fontSize: 28, fontWeight: 800, color: level.color, lineHeight: 1 }}>
                          {(diag.confidence * 100).toFixed(0)}%
                        </Text>
                        <div style={{
                          padding: "1px 8px", borderRadius: 6,
                          background: level.bg, color: level.color,
                          fontSize: 11, fontWeight: 600,
                        }}>
                          {level.label}置信度
                        </div>
                      </div>
                    </div>

                    {/* 置信度进度条 */}
                    <Progress
                      percent={Math.round(diag.confidence * 100)}
                      strokeColor={{ from: level.color, to: level.color + "88" }}
                      trailColor={M3.surfaceVariant}
                      showInfo={false}
                      strokeWidth={6}
                      style={{ marginBottom: 12 }}
                    />

                    {/* 理据 */}
                    {diag.rationale && (
                      <div style={{
                        background: M3.surfaceLow,
                        borderRadius: 10,
                        padding: "8px 14px",
                        marginBottom: 10,
                      }}>
                        <Text style={{ fontSize: 13, color: M3.onSurfaceVariant }}>
                          <BulbOutlined style={{ marginRight: 6, color: "#faad14" }} />
                          {diag.rationale}
                        </Text>
                      </div>
                    )}

                    {/* 典型症状标签 */}
                    {diag.typical_symptoms && (
                      <div style={{ marginBottom: 4, paddingLeft: 4 }}>
                        <Text style={{ fontSize: 11, color: M3.onSurfaceVariant, marginRight: 8 }}>
                          典型症状：
                        </Text>
                        {diag.typical_symptoms.map((s) => (
                          <Tag key={s} style={{
                            borderRadius: 6, marginBottom: 4,
                            background: symptoms.includes(s) ? "#e6f4ff" : M3.surfaceVariant,
                            color: symptoms.includes(s) ? M3.primary : M3.onSurfaceVariant,
                            border: "none",
                            fontWeight: symptoms.includes(s) ? 600 : 400,
                          }}>
                            {s} {symptoms.includes(s) && "✓"}
                          </Tag>
                        ))}
                      </div>
                    )}

                    {diag.patient_history_support && (
                      <Tag color="purple" style={{ borderRadius: 8 }}>
                        📋 {diag.patient_history_support}
                      </Tag>
                    )}

                    {/* 防幻觉：证据分级 + 风险 + 待医生确认 */}
                    {(diag.evidence_tier || diag.risk_level || diag.confirmation_required) && (
                      <Space size={6} wrap style={{ marginTop: 6, marginBottom: 4 }}>
                        {diag.evidence_tier && (
                          <Tag
                            style={{
                              borderRadius: 8,
                              background: diag.evidence_tier === "A" ? "#f6ffed" : diag.evidence_tier === "B" ? "#e6f4ff" : "#fffbe6",
                              color: diag.evidence_tier === "A" ? M3.secondary : diag.evidence_tier === "B" ? M3.primary : "#D46B08",
                              border: "none", fontWeight: 600,
                            }}
                          >
                            证据等级 {diag.evidence_tier}
                          </Tag>
                        )}
                        {diag.risk_level && <Tag style={{ borderRadius: 8 }}>风险 {diag.risk_level}</Tag>}
                        {diag.confirmation_required && <Tag color="purple" style={{ borderRadius: 8 }}>待医生确认</Tag>}
                      </Space>
                    )}

                    {/* 防幻觉：引用证据定位 */}
                    {diag.citations && diag.citations.length > 0 && (
                      <div style={{
                        background: "#f7f9fc", borderRadius: 10, padding: "8px 14px", marginBottom: 6,
                      }}>
                        <Text style={{ fontSize: 11, color: M3.onSurfaceVariant, fontWeight: 600 }}>
                          <SafetyOutlined style={{ marginRight: 4 }} />引用证据定位
                        </Text>
                        {diag.citations.map((c, idx) => (
                          <div key={idx} style={{ fontSize: 12, color: M3.onSurface, marginTop: 4 }}>
                            [{c.source}] {c.quote}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 免责声明 */}
              <Alert
                message={result.disclaimer}
                type="warning"
                showIcon
                icon={<AlertOutlined />}
                style={{ borderRadius: 12, marginTop: 8 }}
              />

              {/* 云端 CoT 深度分析 */}
              {result.ai_analysis && (
                <Card style={{
                  borderRadius: 16, marginTop: 12,
                  border: `1px solid ${M3.tertiary}55`, background: "#FBF9FF",
                }} bodyStyle={{ padding: "14px 20px" }}>
                  <Text strong style={{ fontSize: 14, color: M3.tertiary }}>
                    <BulbOutlined style={{ marginRight: 6 }} />AI 深度分析（思维链 CoT）
                  </Text>
                  <div style={{
                    marginTop: 8, fontSize: 13, lineHeight: 1.75,
                    color: M3.onSurface, whiteSpace: "pre-wrap",
                  }}>
                    {result.ai_analysis}
                  </div>
                </Card>
              )}

              {/* 防幻觉验证摘要 */}
              {result.verification && (
                <Card style={{
                  borderRadius: 16, marginTop: 12,
                  border: `1px solid ${M3.surfaceVariant}`,
                }} bodyStyle={{ padding: "12px 20px" }}>
                  <Space size={8} wrap style={{ marginBottom: 8 }}>
                    {result.verification.verification_status === "confirmed" ? (
                      <Tag color="success" icon={<SafetyOutlined />}>证据校验通过</Tag>
                    ) : (
                      <Tag color="warning" icon={<AlertOutlined />}>证据不足</Tag>
                    )}
                    {result.verification.confirmation_required && <Tag color="purple">需医生确认</Tag>}
                    <Tag color="default">防幻觉规则 {result.verification.rules_applied?.length || 0} 条</Tag>
                  </Space>

                  {result.verification.rules_applied && result.verification.rules_applied.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, color: M3.onSurfaceVariant, fontWeight: 600 }}>
                        已启用防幻觉机制：
                      </Text>
                      {result.verification.rules_applied.map((r, i) => (
                        <div key={i} style={{ fontSize: 12, color: M3.onSurfaceVariant, marginTop: 2 }}>
                          {r}
                        </div>
                      ))}
                    </div>
                  )}

                  {result.verification.retracted_claims && result.verification.retracted_claims.length > 0 && (
                    <div style={{ background: "#FFF7E6", borderRadius: 10, padding: "8px 14px", marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: 600, color: "#D46B08" }}>
                        已撤回的主张（找不到支撑性引用）：
                      </Text>
                      {result.verification.retracted_claims.map((r, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#D46B08", marginTop: 2 }}>
                          · {r.disease} — {r.reason}
                        </div>
                      ))}
                    </div>
                  )}

                  {result.verification.unknown_fallback && (
                    <Alert
                      type="warning" showIcon icon={<AlertOutlined />}
                      message={result.verification.unknown_fallback}
                      style={{ borderRadius: 10, marginTop: 4 }}
                    />
                  )}
                </Card>
              )}
            </div>
          ) : result && result.diagnoses.length === 0 ? (
            /* 空结果（可能有「我不知道/建议进一步检查」兜底） */
            <Card style={{ borderRadius: 20, textAlign: "center", padding: 40 }}>
              <Empty
                description={
                  <span style={{ color: M3.onSurfaceVariant, fontSize: 14 }}>
                    {result.verification?.unknown_fallback ? (
                      <Text style={{ fontSize: 14, color: "#D46B08", fontWeight: 600 }}>
                        {result.verification.unknown_fallback}
                      </Text>
                    ) : (
                      <>
                        未找到匹配的诊断建议<br/>
                        <Text style={{ fontSize: 12 }}>请补充更多症状细节后重试</Text>
                      </>
                    )}
                  </span>
                }
              />
            </Card>
          ) : null}
        </Col>

        {/* ============ 侧区域：输入 + 参考 ============ */}
        <Col xs={24} lg={9}>
          <div style={{ position: "sticky", top: 80 }}>
            {/* 症状输入卡片 */}
            <Card style={{
              borderRadius: 20,
              border: `1px solid ${M3.surfaceVariant}`,
              marginBottom: 16,
            }}>
              {/* 患者选择 */}
              <div style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: M3.onSurface, display: "block", marginBottom: 6 }}>
                  <UserOutlined style={{ marginRight: 4 }} />关联患者（可选）
                </Text>
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
                {selectedPatientId ? (
                  <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                    已关联患者 #{selectedPatientId}，诊断时会结合该患者病史
                  </Text>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                    不关联时仅按症状做通用诊断
                  </Text>
                )}
              </div>

              {/* 分析引擎选择 */}
              <div style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: M3.onSurface, display: "block", marginBottom: 6 }}>
                  <ThunderboltOutlined style={{ marginRight: 4 }} />分析引擎
                </Text>
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
                <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                  {providers.length === 0
                    ? "未配置云端服务商，将使用本地验证引擎（离线可用）"
                    : "云端 CoT 失败时自动回退本地验证引擎"}
                </Text>
              </div>

              {/* 症状输入 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: M3.onSurface }}>
                    症状描述
                  </Text>
                  {voiceSupported && (
                    <Button
                      size="small"
                      type={isListening ? "primary" : "text"}
                      danger={isListening}
                      icon={isListening ? <AudioMutedOutlined /> : <AudioOutlined />}
                      onClick={toggleVoice}
                      style={{ borderRadius: 12 }}
                    >
                      {isListening ? "停止" : "语音"}
                    </Button>
                  )}
                </div>
                <TextArea
                  rows={8}
                  placeholder="描述患者症状...&#10;&#10;例如：患者头痛3天，伴恶心呕吐，&#10;体温38.5°C，咳嗽有黄痰..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  style={{
                    resize: "none",
                    borderRadius: 12,
                    background: M3.surfaceLow,
                    border: `1px solid ${M3.surfaceVariant}`,
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                />
                {isListening && (
                  <Text style={{ fontSize: 11, color: M3.error, display: "block", marginTop: 4 }}>
                    🔴 录音中... 请说话，点击停止结束
                  </Text>
                )}
              </div>

              {/* 分析按钮 */}
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={loading}
                onClick={handleDiagnose}
                block
                size="large"
                style={{
                  height: 48,
                  borderRadius: 14,
                  fontSize: 16,
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${M3.primary}, ${M3.tertiary})`,
                  border: "none",
                  boxShadow: `0 4px 16px rgba(108,71,255,0.25)`,
                }}
              >
                开始 AI 分析
              </Button>
            </Card>

            {/* 结果出现后显示参考信息 */}
            {result && (
              <>
                {/* 建议检查 */}
                {result.suggested_exams.length > 0 && (
                  <Card
                    title={
                      <Space><FileSearchOutlined style={{ color: M3.secondary }} />建议检查项目</Space>
                    }
                    style={{ borderRadius: 16, marginBottom: 16, border: `1px solid ${M3.surfaceVariant}` }}
                    bodyStyle={{ padding: "12px 20px" }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {result.suggested_exams.map((exam) => (
                        <Tag key={exam} style={{
                          borderRadius: 8, padding: "4px 12px",
                          background: "#f6ffed", color: M3.secondary,
                          border: "none", fontWeight: 500,
                        }}>
                          {exam}
                        </Tag>
                      ))}
                    </div>
                  </Card>
                )}

                {/* 相似病例 */}
                <Card
                  title={<Space><SearchOutlined style={{ color: M3.primary }} />相似病例参考</Space>}
                  extra={<Badge count={result.similar_cases?.length || 0} color={M3.primary} />}
                  style={{ borderRadius: 16, marginBottom: 16, border: `1px solid ${M3.surfaceVariant}` }}
                  bodyStyle={{ padding: "8px 16px", maxHeight: 360, overflow: "auto" }}
                >
                  {result.similar_cases.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无相似病例" />
                  ) : (
                    result.similar_cases.map((c, i) => (
                      <div key={i} style={{
                        padding: "10px 0",
                        borderBottom: i < result.similar_cases.length - 1 ? `1px solid ${M3.surfaceVariant}` : "none",
                      }}>
                        <Space style={{ marginBottom: 4 }}>
                          <Tag style={{
                            borderRadius: 6, fontSize: 11,
                            background: "rgba(27,110,243,0.1)", color: M3.primary,
                            border: "none", fontWeight: 600,
                          }}>
                            {((c.similarity_score || 0) * 100).toFixed(0)}% 匹配
                          </Tag>
                          <Text style={{ fontSize: 11, color: M3.onSurfaceVariant }}>
                            {c.patient_name || c.symptoms}
                          </Text>
                        </Space>
                        <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 12, margin: "4px 0 0", color: M3.onSurface }}>
                          {c.symptoms}
                        </Paragraph>
                        {c.diagnosis && (
                          <Text style={{ fontSize: 11, color: M3.secondary, fontWeight: 600 }}>
                            诊断：{c.diagnosis}
                          </Text>
                        )}
                      </div>
                    ))
                  )}
                </Card>

                {/* 知识库参考 */}
                {result.knowledge_refs.length > 0 && (
                  <Card
                    title={<Space><BookOutlined style={{ color: M3.tertiary }} />知识库参考</Space>}
                    style={{ borderRadius: 16, border: `1px solid ${M3.surfaceVariant}` }}
                    bodyStyle={{ padding: "8px 16px" }}
                  >
                    {result.knowledge_refs.map((ref, i) => (
                      <div key={i} style={{
                        padding: "8px 0",
                        borderBottom: i < result.knowledge_refs.length - 1 ? `1px solid ${M3.surfaceVariant}` : "none",
                      }}>
                        <Text strong style={{ fontSize: 13 }}>{ref.title}</Text>
                        <br />
                        <Text style={{ fontSize: 12, color: M3.onSurfaceVariant }}>
                          {ref.content_snippet}
                        </Text>
                      </div>
                    ))}
                  </Card>
                )}
              </>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}
