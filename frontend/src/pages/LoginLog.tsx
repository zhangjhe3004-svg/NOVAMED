/**
 * 登录日志 —— 复刻 scaffold 监控·登录日志：
 *   概览读数条（24h/7d/30d）→ 登录热力（星期×小时）| 趋势 切换 → 异常聚合 → 明细表格。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Table, Segmented, Popconfirm, Input, Select, message } from "antd";
import {
  SearchOutlined, ReloadOutlined, DownloadOutlined, DeleteOutlined, CheckOutlined,
} from "@ant-design/icons";
import api from "../api/client";
import { Odometer, TrendChart, HeatGrid } from "../components/instruments";
import PermissionButton from "../components/PermissionButton";

interface LoginRow { id: number; user_id: number; username: string; ip: string; status: string; created_at: string; }
interface LoginStats { range: string; total: number; failed: number; successRate: number; users: number; ips: number; series: { bucket: string; total: number; failed: number }[]; }
interface HeatCell { dow: number; hour: number; total: number; failed: number; }
interface Anomaly { kind: "ip" | "user"; key: string; failed: number; total: number; spread: number; firstTime: string; lastTime: string; }
interface Heatmap { days: number; since: string; threshold: number; cells: HeatCell[]; anomalies: Anomaly[]; }

type Range = "24h" | "7d" | "30d";

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("zh-CN", { hour12: false }) : "—");

const RANGES: { label: string; value: Range }[] = [
  { label: "24 小时", value: "24h" },
  { label: "7 天", value: "7d" },
  { label: "30 天", value: "30d" },
];
const STATUSES = [
  { label: "全部结果", value: "" },
  { label: "成功", value: "成功" },
  { label: "失败", value: "失败" },
];

export default function LoginLog() {
  const [rows, setRows] = useState<LoginRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [kwInput, setKwInput] = useState("");
  const [status, setStatus] = useState("");

  const [range, setRange] = useState<Range>("7d");
  const [stats, setStats] = useState<LoginStats | null>(null);
  const [trendView, setTrendView] = useState<"heat" | "trend">("heat");
  const [heat, setHeat] = useState<Heatmap | null>(null);
  const [heatLoading, setHeatLoading] = useState(false);

  const tableAnchor = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/login-logs", {
        params: { page, page_size: pageSize, keyword: keyword || undefined, status: status || undefined },
      });
      setRows(r.data.items || []);
      setTotal(r.data.total || 0);
    } catch {
      message.error("加载登录日志失败");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [page, pageSize, keyword, status]);

  const loadStats = () => {
    api.get("/login-logs/stats", { params: { range } }).then((r) => setStats(r.data)).catch(() => {});
  };
  const loadHeat = () => {
    setHeatLoading(true);
    api.get("/login-logs/heatmap", { params: { days: range === "30d" ? 30 : 7 } })
      .then((r) => setHeat(r.data))
      .catch(() => {})
      .finally(() => setHeatLoading(false));
  };
  useEffect(() => { loadStats(); loadHeat(); }, [range]);

  const trendSeries = useMemo(() => [
    { name: "登录", values: (stats?.series || []).map((b) => b.total), color: "#236de9", area: true },
    { name: "失败", values: (stats?.series || []).map((b) => b.failed), color: "#c4423e" },
  ], [stats]);

  /** 异常卡点击 → 带条件筛明细并滚到表格 */
  const inspect = (a: Anomaly) => {
    setKeyword(a.key);
    setStatus("失败");
    setPage(1);
    setTimeout(() => tableAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  const exportCsv = () => {
    const header = ["登录账号", "结果", "来源 IP", "登录时间"];
    const csv = "\uFEFF" + [header, ...rows.map((r) => [r.username, r.status, r.ip || "—", fmtTime(r.created_at)])]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `登录日志-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const clearAll = async () => {
    try {
      await api.delete("/login-logs");
      message.success("登录日志已清空");
      load(); loadStats(); loadHeat();
    } catch {
      message.error("清空失败");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>登录日志</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 6 }}>记录账号的登录与失败尝试，便于发现异常登录。</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <PermissionButton code="medicode:loginLog:remove">
            <Popconfirm title="清空全部登录日志？清空后无法恢复，建议先导出留档。" okText="清空" okButtonProps={{ danger: true }} onConfirm={clearAll}>
              <button className="lv-btn" type="button" style={{ color: "var(--lv-red-text)" }}><DeleteOutlined /> 清空日志</button>
            </Popconfirm>
          </PermissionButton>
          <button className="lv-btn" type="button" onClick={exportCsv}><DownloadOutlined /> 导出</button>
        </div>
      </div>

      {/* 概览读数条 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">概览</span>
          <div className="lv-panel-tools">
            <Segmented value={range} onChange={(v) => setRange(v as Range)} options={RANGES} />
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div className="lv-metrics is-5">
            <div className="lv-metric">
              <span className="lv-metric-label">登录次数</span>
              <span className="lv-metric-figure tnum"><Odometer value={stats?.total ?? 0} /><small style={{ fontSize: 14, fontWeight: 600, color: "var(--lv-soft)", marginLeft: 4 }}>次</small></span>
            </div>
            <div className="lv-metric">
              <span className="lv-metric-label">成功率</span>
              <span className="lv-metric-figure tnum"><Odometer value={stats?.successRate ?? 0} decimals={1} group={false} /><small style={{ fontSize: 14, fontWeight: 600, color: "var(--lv-soft)", marginLeft: 4 }}>%</small></span>
            </div>
            <div className="lv-metric">
              <span className="lv-metric-label">失败</span>
              <span className="lv-metric-figure tnum" style={{ color: (stats?.failed ?? 0) > 0 ? "var(--lv-red-text)" : undefined }}>
                <Odometer value={stats?.failed ?? 0} /><small style={{ fontSize: 14, fontWeight: 600, color: "var(--lv-soft)", marginLeft: 4 }}>次</small>
              </span>
            </div>
            <div className="lv-metric">
              <span className="lv-metric-label">登录账号</span>
              <span className="lv-metric-figure tnum"><Odometer value={stats?.users ?? 0} /><small style={{ fontSize: 14, fontWeight: 600, color: "var(--lv-soft)", marginLeft: 4 }}>个</small></span>
            </div>
            <div className="lv-metric">
              <span className="lv-metric-label">来源 IP</span>
              <span className="lv-metric-figure tnum"><Odometer value={stats?.ips ?? 0} /><small style={{ fontSize: 14, fontWeight: 600, color: "var(--lv-soft)", marginLeft: 4 }}>个</small></span>
            </div>
          </div>
        </div>
      </div>

      {/* 热力 / 趋势 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">{trendView === "heat" ? "登录热力" : "登录与失败趋势"}</span>
          <span className="lv-panel-meta">
            {trendView === "heat" ? `近 ${range === "30d" ? 30 : 7} 天 · 星期 × 小时` : RANGES.find((r) => r.value === range)?.label}
          </span>
          <div className="lv-panel-tools">
            <Segmented value={trendView} onChange={(v) => setTrendView(v as "heat" | "trend")}
              options={[{ label: "热力", value: "heat" }, { label: "趋势", value: "trend" }]} />
          </div>
        </div>
        <div style={{ padding: "8px 20px 20px" }}>
          {trendView === "heat" ? (
            <HeatGrid cells={heat?.cells ?? []} loading={heatLoading} />
          ) : (
            <TrendChart labels={(stats?.series || []).map((b) => b.bucket)} series={trendSeries} height={236} unit="次" dots={false} />
          )}
        </div>
      </div>

      {/* 异常聚合 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">异常聚合</span>
          <span className="lv-panel-meta">同一 IP 或账号失败 ≥ {heat?.threshold ?? 5} 次</span>
        </div>
        <div style={{ padding: 16 }}>
          {heat && heat.anomalies.length > 0 ? (
            <div className="alert-grid">
              {heat.anomalies.map((a) => (
                <button key={`${a.kind}-${a.key}`} type="button" className="alert-card" aria-label={`查看 ${a.key} 的失败记录`} onClick={() => inspect(a)}>
                  <span className="alert-head">
                    <span className="alert-kind">{a.kind === "ip" ? "IP 来源" : "登录账号"}</span>
                    <span aria-hidden="true" style={{ color: "var(--lv-red-text)" }}>→</span>
                  </span>
                  <span className="alert-key">{a.key}</span>
                  <span className="alert-figure">
                    <b className="tnum">{a.failed}</b>
                    <span>次失败 / 共 {a.total} 次 · {a.kind === "ip" ? `尝试 ${a.spread} 个账号` : `来自 ${a.spread} 个 IP`}</span>
                  </span>
                  <span className="alert-meta">{a.firstTime} → {a.lastTime}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="alert-calm"><CheckOutlined />近 {range === "30d" ? 30 : 7} 天没有达到告警阈值的失败聚集。</p>
          )}
        </div>
      </div>

      {/* 明细 */}
      <div ref={tableAnchor}>
        <div className="lv-panel">
          <div className="lv-panel-head">
            <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
            <span className="lv-panel-title">登录记录</span>
            <span className="lv-panel-meta">共 {total} 条</span>
            <div className="lv-panel-tools">
              <button className="icon-btn" title="刷新" onClick={load}><ReloadOutlined /></button>
            </div>
          </div>

          <div style={{ padding: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
              placeholder="登录账号 / IP"
              style={{ width: 240 }}
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onPressEnter={() => { setKeyword(kwInput.trim()); setPage(1); }}
            />
            <Select
              allowClear placeholder="全部结果" style={{ width: 130 }} value={status || undefined}
              onChange={(v) => { setStatus(v || ""); setPage(1); }}
              options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="lv-btn" type="button" onClick={() => { setKeyword(kwInput.trim()); setPage(1); }}>查询</button>
              <button className="lv-btn" type="button" onClick={() => { setKwInput(""); setKeyword(""); setStatus(""); setPage(1); }}>重置</button>
            </div>
          </div>

          <Table rowKey="id" size="middle" loading={loading} dataSource={rows} pagination={false} scroll={{ x: 760 }}
            locale={{ emptyText: "暂无登录日志" }}
            columns={[
              { title: "登录账号", dataIndex: "username", width: 150, render: (v: string) => <span style={{ fontWeight: 600, color: "var(--lv-ink)" }}>{v || "—"}</span> },
              { title: "结果", dataIndex: "status", width: 100, render: (v: string) => (
                <span className={`lv-tag ${v === "成功" ? "lv-tag--leaf" : "lv-tag--red"}`}><span className="lv-tag-dot" />{v}</span>
              ) },
              { title: "来源 IP", dataIndex: "ip", width: 150, render: (v: string) => <span className="tnum">{v || "—"}</span> },
              { title: "登录时间", dataIndex: "created_at", width: 180, render: (v: string) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{fmtTime(v)}</span> },
            ]} />
          <div className="lv-pager">
            <span className="lv-pager-meta">共 {total} 条，当前 {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</span>
            <div className="lv-pager-btns">
              <button className="icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
              <span className="tnum lv-pager-cur">{page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
              <button className="icon-btn" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(page + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
