/**
 * 控制台 — NocoBase / MediCode 清爽仪表盘
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Row, Col, Card, Typography, List, Tag, Skeleton, Space, Button } from "antd";
import {
  UserOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { listPatients } from "../api/patients";
import { listRecords } from "../api/records";
import type { PatientInfo } from "../api/patients";
import type { MedicalRecordInfo } from "../api/records";

const { Text } = Typography;

// ---- 简单 SVG 图表（饼图/折线/横向条形）----
function StatusPie({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  if (total === 0) return <Text type="secondary">暂无数据</Text>;
  let acc = 0;
  const cx = 90, cy = 90, r = 70;
  const pts = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const a0 = acc; acc += angle; const a1 = acc;
    const x0 = cx + r * Math.cos(a0 - Math.PI / 2), y0 = cy + r * Math.sin(a0 - Math.PI / 2);
    const x1 = cx + r * Math.cos(a1 - Math.PI / 2), y1 = cy + r * Math.sin(a1 - Math.PI / 2);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return { path: `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`, color: d.color, d };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg viewBox="0 0 180 180" style={{ width: 150, height: 150, flexShrink: 0 }}>
        {pts.map((p, i) => (p.d.value > 0 ? <path key={i} d={p.path} fill={p.color} /> : null))}
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="18" fontWeight="700" fill="#333">{total}</text>
      </svg>
      <div>
        {data.map((d) => (
          <div key={d.label} style={{ fontSize: 12, marginBottom: 5 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 10, background: d.color, marginRight: 6 }} />
            {d.label}：{d.value}
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendLine({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return <Text type="secondary">暂无数据</Text>;
  const w = 380, h = 150, pad = 12;
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = (w - pad * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => `${(pad + i * step).toFixed(1)},${(h - pad - (d.value / max) * (h - pad * 2)).toFixed(1)}`);
  const every = Math.max(1, Math.floor(data.length / 6));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 150 }}>
      <polyline points={pts.join(" ")} fill="none" stroke="#1677ff" strokeWidth="2" />
      {data.map((d, i) => (i % every === 0 ? (
        <text key={i} x={pad + i * step} y={h - 2} fontSize="9" fill="#999" textAnchor="middle">{d.label}</text>
      ) : null))}
    </svg>
  );
}

function BarList({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {data.map((d) => (
        <div key={d.label} style={{ fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{d.label}</span><Text strong>{d.value}</Text>
          </div>
          <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, marginTop: 2 }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: 8, background: "#52c41a", borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [patientTotal, setPatientTotal] = useState(0);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recentPatients, setRecentPatients] = useState<PatientInfo[]>([]);
  const [recentRecords, setRecentRecords] = useState<MedicalRecordInfo[]>([]);
  const [recordsAll, setRecordsAll] = useState<MedicalRecordInfo[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [pRes, rRes, allRes] = await Promise.all([
          listPatients({ page: 1, page_size: 10 }),
          listRecords({ page: 1, page_size: 10 }),
          listRecords({ page: 1, page_size: 100 }),
        ]);
        setPatientTotal(pRes.total);
        setRecentPatients(pRes.items.slice(0, 5));
        setRecordTotal(rRes.total);
        setRecentRecords(rRes.items.slice(0, 5));
        setRecordsAll(allRes.items || []);
      } catch (err) {
        console.error("加载失败:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = [
    {
      title: "患者总数",
      value: patientTotal,
      icon: <UserOutlined />,
      color: "#1677ff",
      bg: "#e6f4ff",
      path: "/patients",
    },
    {
      title: "就诊记录",
      value: recordTotal,
      icon: <FileTextOutlined />,
      color: "#52c41a",
      bg: "#f6ffed",
      path: "/records",
    },
    {
      title: "AI 辅助诊断",
      value: recentRecords.filter((r) => r.ai_suggestion).length,
      icon: <ExperimentOutlined />,
      color: "#722ed1",
      bg: "#f9f0ff",
      suffix: " 近期",
      path: "/ai-assistant",
    },
    {
      title: "已审核建议",
      value: recentRecords.filter((r) => r.ai_reviewed === 1).length,
      icon: <CheckCircleOutlined />,
      color: "#faad14",
      bg: "#fffbe6",
      suffix: " 近期",
      path: "/records",
    },
  ];

  // 图表数据（NocoBase 仪表盘风格）
  const statusData = [
    { label: "待审", value: recordsAll.filter((r) => r.ai_reviewed === 0).length, color: "#faad14" },
    { label: "已确认", value: recordsAll.filter((r) => r.ai_reviewed === 1).length, color: "#52c41a" },
    { label: "已驳回", value: recordsAll.filter((r) => r.ai_reviewed === 2).length, color: "#ff4d4f" },
  ];
  const dayMap: Record<string, number> = {};
  recordsAll.forEach((r) => { const d = new Date(r.visit_date); const k = `${d.getMonth() + 1}/${d.getDate()}`; dayMap[k] = (dayMap[k] || 0) + 1; });
  const trendData = Object.entries(dayMap).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-14).map(([label, value]) => ({ label, value }));
  const docMap: Record<string, number> = {};
  recordsAll.forEach((r) => { const n = r.doctor_name || "未分配"; docMap[n] = (docMap[n] || 0) + 1; });
  const docData = Object.entries(docMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));

  return (
    <div>
      {/* Headline */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#1f1f1f" }}>控制台</h2>
        <Text style={{ color: "#6b7280", fontSize: 14 }}>
          系统运行正常 · 以下是您的数据摘要
        </Text>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]}>
        {statCards.map((s) => (
          <Col xs={24} sm={12} lg={6} key={s.title}>
            {loading ? (
              <div style={{ padding: 20, background: "#f5f5f5", borderRadius: 8 }}>
                <Skeleton active paragraph={{ rows: 1 }} />
              </div>
            ) : (
              <div
                onClick={() => navigate(s.path)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #f0f0f0",
                  borderRadius: 8,
                  padding: "18px 20px",
                  cursor: "pointer",
                  transition: "box-shadow .2s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = "none")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <Text style={{
                      fontSize: 12,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontWeight: 600,
                    }}>
                      {s.title}
                    </Text>
                    <div style={{ fontSize: 32, fontWeight: 700, color: s.color, lineHeight: 1.2, marginTop: 6 }}>
                      {s.value}
                      {s.suffix && <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", marginLeft: 6 }}>{s.suffix}</span>}
                    </div>
                  </div>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: s.bg, color: s.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22,
                  }}>
                    {s.icon}
                  </div>
                </div>
              </div>
            )}
          </Col>
        ))}
      </Row>

      {/* 仪表盘图表（NocoBase 风格：饼图/趋势/条形） */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={8}>
          <Card title="记录状态分布" size="small">
            <StatusPie data={statusData} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="每日就诊趋势" size="small">
            <TrendLine data={trendData} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="按接诊医生" size="small">
            <BarList data={docData} />
          </Card>
        </Col>
      </Row>

      {/* Recent */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={<Space><UserOutlined style={{ color: "#1677ff" }} /> 最近患者</Space>}
            extra={<Button type="link" onClick={() => navigate("/patients")}>全部 <ArrowRightOutlined /></Button>}
          >
            <List
              loading={loading}
              dataSource={recentPatients}
              locale={{ emptyText: "暂无患者" }}
              renderItem={(p) => (
                <List.Item
                  style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 8 }}
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <List.Item.Meta
                    avatar={
                      <div style={{
                        width: 40, height: 40, borderRadius: 20,
                        background: "#e6f4ff", color: "#1677ff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 16,
                      }}>
                        {p.name[0]}
                      </div>
                    }
                    title={p.name}
                    description={`就诊 ${p.record_count} 次`}
                  />
                  {p.blood_type && <Tag color="blue">{p.blood_type}</Tag>}
                  <Text style={{ color: p.gender === "female" ? "#eb2f96" : "#1677ff", marginLeft: 8 }}>
                    {p.gender === "male" ? "男" : p.gender === "female" ? "女" : ""}
                  </Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<Space><FileTextOutlined style={{ color: "#52c41a" }} /> 最近就诊</Space>}
            extra={
              <Space>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => navigate("/patients")}>
                  新建
                </Button>
                <Button type="link" size="small" onClick={() => navigate("/records")}>
                  全部 <ArrowRightOutlined />
                </Button>
              </Space>
            }
          >
            <List
              loading={loading}
              dataSource={recentRecords}
              locale={{ emptyText: "暂无记录" }}
              renderItem={(r) => (
                <List.Item style={{ padding: "10px 12px", borderRadius: 8 }}>
                  <List.Item.Meta
                    title={<Text ellipsis style={{ maxWidth: 280 }}>{r.symptoms.slice(0, 40)}</Text>}
                    description={`${new Date(r.visit_date).toLocaleDateString("zh-CN")} · ${r.doctor_name || ""}`}
                  />
                  {r.ai_suggestion ? (
                    <Tag color={r.ai_reviewed === 1 ? "success" : r.ai_reviewed === 2 ? "error" : "processing"}>
                      {r.ai_reviewed === 1 ? "已确认" : r.ai_reviewed === 2 ? "已驳回" : "待审核"}
                    </Tag>
                  ) : <Tag>无AI</Tag>}
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
