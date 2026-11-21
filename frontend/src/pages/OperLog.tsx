/**
 * 操作日志 —— 复刻 scaffold 监控·操作日志「横带」版式：
 *   概览读数条 → 近 14 日趋势 → 明细表格（行点击 → 抽屉详情）。
 */
import { useEffect, useMemo, useState } from "react";
import { Table, Drawer, message, Descriptions } from "antd";
import { DownloadOutlined, ReloadOutlined, EyeOutlined } from "@ant-design/icons";
import api from "../api/client";
import { TrendChart, Swimlane } from "../components/instruments";

interface LogRow { id: number; user_id: number; username: string; action: string; resource: string; detail: string; ip: string; created_at: string; }
interface Overview { total: number; active_users: number; today: number; per_day: { date: string; count: number }[]; }
interface TimelineEvent { id: number; time: string; action: string; resource: string; detail: string; }
interface TimelineLane { username: string; events: TimelineEvent[]; }
interface TimelineData { start: string; end: string; lanes: TimelineLane[]; }

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("zh-CN", { hour12: false }) : "—");

/** 动作 → 圆点颜色（珍珠玻璃语义色） */
const ACTION_COLOR = (action: string): string => {
  if (/登录|登出|认证/.test(action)) return "#236de9";
  if (/新增|创建|注册|导入|开启|启用/.test(action)) return "#58a021";
  if (/编辑|修改|更新|配置|授权|调整/.test(action)) return "#a8792a";
  if (/删除|清空|禁用|停用|移除/.test(action)) return "#e0443b";
  if (/导出|下载|生成/.test(action)) return "#3b82f6";
  return "#7e888c";
};

export default function OperLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [ov, setOv] = useState<Overview | null>(null);
  const [detail, setDetail] = useState<LogRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/audit-logs", { params: { page, page_size: pageSize } });
      setRows(r.data.items || []);
      setTotal(r.data.total || 0);
    } catch { message.error("加载操作日志失败"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [page, pageSize]);
  useEffect(() => { api.get("/audit-logs/overview").then((r) => setOv(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    api.get("/audit-logs/timeline", { params: { hours: 24, lanes: 6 } })
      .then((r) => setTimeline(r.data))
      .catch(() => {});
  }, []);

  const trendLabels = useMemo(() => (ov?.per_day || []).map((d) => d.date), [ov]);
  const trendSeries = useMemo(() => [{
    name: "操作次数", values: (ov?.per_day || []).map((d) => d.count), color: "#236de9", area: true,
  }], [ov]);

  const swimStart = useMemo(() => (timeline ? new Date(timeline.start).getTime() : 0), [timeline]);
  const swimEnd = useMemo(() => (timeline ? new Date(timeline.end).getTime() : 1), [timeline]);
  const swimLanes = useMemo(() => (timeline?.lanes || []).map((l) => ({
    label: l.username,
    events: l.events.map((e) => ({
      time: new Date(e.time).getTime(),
      color: ACTION_COLOR(e.action),
      title: e.action,
      sub: `${e.resource || "—"} · ${fmtTime(e.time)}`,
    })),
  })), [timeline]);

  const exportCsv = () => {
    const header = ["时间", "账号", "动作", "资源", "详情", "IP"];
    const csv = "\uFEFF" + [header, ...rows.map((r) => [fmtTime(r.created_at), r.username, r.action, r.resource, r.detail, r.ip])]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `操作日志-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>操作日志</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 6 }}>记录系统内的关键操作，支持按账号追溯每一步变更。</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="lv-btn" type="button" onClick={load}><ReloadOutlined /> 刷新</button>
          <button className="lv-btn" type="button" onClick={exportCsv}><DownloadOutlined /> 导出</button>
        </div>
      </div>

      {/* 概览读数条 */}
      <div className="lv-metrics">
        <div className="lv-metric"><span className="lv-metric-label">操作次数</span><span className="lv-metric-figure tnum">{ov?.total ?? 0}</span></div>
        <div className="lv-metric"><span className="lv-metric-label">今日操作</span><span className="lv-metric-figure tnum">{ov?.today ?? 0}</span></div>
        <div className="lv-metric"><span className="lv-metric-label">活跃账号</span><span className="lv-metric-figure tnum">{ov?.active_users ?? 0}</span></div>
        <div className="lv-metric"><span className="lv-metric-label">失败</span><span className="lv-metric-figure tnum" style={{ color: "#c4423e" }}>0</span></div>
      </div>

      {/* 趋势 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">近 14 日操作趋势</span>
          <span className="lv-panel-meta">按日聚合</span>
        </div>
        <div style={{ padding: "8px 20px 20px" }}>
          <TrendChart labels={trendLabels} series={trendSeries} height={220} unit="次" />
        </div>
      </div>

      {/* 时间轴泳道 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">操作时间轴</span>
          <span className="lv-panel-meta">近 24 小时 · 活跃账号</span>
        </div>
        <div style={{ padding: "8px 20px 20px" }}>
          {swimLanes.length > 0 ? (
            <Swimlane lanes={swimLanes} start={swimStart} end={swimEnd} height={44} />
          ) : (
            <div style={{ color: "var(--lv-faint)", fontSize: 13, padding: "28px 0", textAlign: "center" }}>
              近 24 小时暂无操作记录
            </div>
          )}
        </div>
      </div>

      {/* 明细 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">操作明细</span>
          <span className="lv-panel-meta">共 {total} 条</span>
        </div>
        <Table rowKey="id" size="middle" loading={loading} dataSource={rows} pagination={false} scroll={{ x: 900 }}
          locale={{ emptyText: "暂无操作日志" }}
          columns={[
            { title: "时间", dataIndex: "created_at", width: 170, render: (v: string) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{fmtTime(v)}</span> },
            { title: "账号", dataIndex: "username", width: 130, render: (v: string) => <span style={{ fontWeight: 600, color: "var(--lv-ink)" }}>{v || "—"}</span> },
            { title: "动作", dataIndex: "action", width: 130, render: (v: string) => <span className="lv-tag lv-tag--neutral">{v}</span> },
            { title: "资源", dataIndex: "resource", width: 180, ellipsis: true },
            { title: "详情", dataIndex: "detail", ellipsis: true, render: (v: string) => <span style={{ color: "var(--lv-muted)" }}>{v || "—"}</span> },
            { title: "IP", dataIndex: "ip", width: 130, render: (v: string) => <span className="tnum">{v || "—"}</span> },
            { title: "操作", width: 80, render: (_: any, r: LogRow) => (
              <span className="row-actions"><span className="icon-btn" data-act="view" title="查看" onClick={() => setDetail(r)}><EyeOutlined /></span></span>
            ) },
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

      {/* 详情抽屉 */}
      <Drawer title="操作详情" size={420} open={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="时间">{fmtTime(detail.created_at)}</Descriptions.Item>
            <Descriptions.Item label="账号">{detail.username || "—"}</Descriptions.Item>
            <Descriptions.Item label="动作">{detail.action}</Descriptions.Item>
            <Descriptions.Item label="资源">{detail.resource || "—"}</Descriptions.Item>
            <Descriptions.Item label="IP">{detail.ip || "—"}</Descriptions.Item>
            <Descriptions.Item label="详情"><span style={{ whiteSpace: "pre-wrap" }}>{detail.detail || "—"}</span></Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
