/**
 * Token 用量 — 参考「暴喵AI管家」Token 用量截图。
 * 数据来自后端 /api/token-usage/stats（接入云端模型后每次调用自动记账，按模型单价实时算成本）。
 */
import { useState, useEffect } from "react";
import {
  Card, Row, Col, Statistic, Select, Space, Typography, Table, Button, Spin,
} from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import { getTokenUsageStats } from "../api/tokenUsage";
import type { TokenStats } from "../api/tokenUsage";

const { Title, Text } = Typography;

const MODELS = ["claude-3-5-sonnet", "deepseek-v4-flash-vision", "gpt-4o", "qwen-max"];

function fmt(n: number) {
  return n.toLocaleString("en-US");
}
function fmtWan(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`;
}

function TrendChart({ data, labels }: { data: number[]; labels: string[] }) {
  const w = 900, h = 240, pad = 8;
  const max = Math.max(...data, 1);
  const step = (w - pad * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => `${(pad + i * step).toFixed(1)},${(h - pad - (v / max) * (h - pad * 2)).toFixed(1)}`);
  if (data.length === 0) return <Text type="secondary">暂无趋势数据</Text>;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 240 }}>
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#722ed1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#722ed1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {labels.map((l, i) => (i % 3 === 0 ? (
          <text key={i} x={pad + i * step} y={h - 2} fontSize="9" fill="#999" textAnchor="middle">{l}</text>
        ) : null))}
        <polygon points={`${pad},${h - pad} ${pts.join(" ")} ${(pad + (data.length - 1) * step).toFixed(1)},${h - pad}`} fill="url(#tg)" />
        <polyline points={pts.join(" ")} fill="none" stroke="#722ed1" strokeWidth="2" />
      </svg>
    </div>
  );
}

export default function TokenUsage() {
  const [range, setRange] = useState(0);
  const [provider, setProvider] = useState("全部来源");
  const [model, setModel] = useState("全部模型");
  const [tab, setTab] = useState("请求记录");
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTokenUsageStats({
        range_days: range,
        model: model === "全部模型" ? undefined : model,
        provider: provider === "全部来源" ? undefined : provider,
      });
      setStats(res);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [range, provider, model]);

  const total = stats?.total_tokens || 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>使用统计</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>查看 AI 模型的使用情况和成本统计（按时间段查询）</Text>
        </div>
        <Space>
          <Select value={provider} style={{ width: 130 }} onChange={setProvider}
            options={["全部来源", "本地", "暴喵API"].map((v) => ({ value: v, label: v }))} />
          <Select value={model} style={{ width: 180 }} onChange={setModel}
            options={["全部模型", ...MODELS].map((v) => ({ value: v, label: v }))} />
          <Select value={range} style={{ width: 120 }} onChange={setRange}
            options={[{ value: 0, label: "今天" }, { value: 3, label: "近3天" }, { value: 7, label: "近7天" }]} />
        </Space>
      </div>

      <Spin spinning={loading}>
        {/* 总览 */}
        <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: "18px 24px" }}>
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} md={8}>
              <Space size={12}>
                <ThunderboltOutlined style={{ fontSize: 32, color: "#722ed1" }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>消耗 Tokens</Text>
                  <div style={{ fontSize: 30, fontWeight: 700 }}>{fmt(total)}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {total >= 100000000 ? `≈ ${(total / 100000000).toFixed(2)}亿` : total >= 10000 ? `≈ ${(total / 10000).toFixed(1)}万` : ""}
                  </Text>
                </div>
              </Space>
            </Col>
            <Col xs={12} md={5}><Statistic title="新增输入" value={fmtWan(stats?.input_tokens || 0)} /></Col>
            <Col xs={12} md={5}><Statistic title="新增输出" value={fmtWan(stats?.output_tokens || 0)} /></Col>
            <Col xs={12} md={6}>
              <div style={{ display: "flex", gap: 16 }}>
                <Statistic title="总成本" value={(stats?.cost || 0).toFixed(2)} suffix="元" />
                <Statistic title="请求数" value={stats?.count || 0} />
              </div>
            </Col>
          </Row>
        </Card>

        {/* 使用趋势 */}
        <Card title="使用趋势" size="small" style={{ marginBottom: 16 }} bodyStyle={{ padding: 16 }}>
          <TrendChart data={stats?.trend_data || []} labels={stats?.trend_labels || []} />
        </Card>

        {/* 请求明细 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Button type={tab === "请求记录" ? "primary" : "default"} onClick={() => setTab("请求记录")}>请求记录</Button>
          <Button type={tab === "供应商统计" ? "primary" : "default"} onClick={() => setTab("供应商统计")}>供应商统计</Button>
          <Button type={tab === "模型统计" ? "primary" : "default"} onClick={() => setTab("模型统计")}>模型统计</Button>
        </div>
        {stats && stats.count === 0 ? (
          <Text type="secondary" style={{ display: "block", padding: 24, textAlign: "center" }}>
            暂无调用记录。接入云端模型（配置 API Key 后使用「AI 诊断 → 云端分析」）即会自动记账。
          </Text>
        ) : (
          <Table
            rowKey={(r: any) => r.time + r.model + r.input}
            size="small"
            columns={[
              { title: "时间", width: 150, render: (_: any, r: any) => new Date(r.time).toLocaleString("zh-CN") },
              { title: "供应商", dataIndex: "provider", width: 100 },
              { title: "计算模型", dataIndex: "model", width: 200 },
              { title: "输入", dataIndex: "input", width: 90, render: (v: number) => fmt(v) },
              { title: "输出", dataIndex: "output", width: 90, render: (v: number) => fmt(v) },
              { title: "总成本", dataIndex: "cost", width: 90, render: (v: number) => Number(v).toFixed(2) },
              { title: "状态", dataIndex: "status", width: 70 },
              { title: "来源", dataIndex: "source", width: 90 },
            ]}
            dataSource={stats?.records || []}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Spin>
    </div>
  );
}
