/**
 * 控制台 —— 全站第一屏。
 *
 * 这一版把原来各写一遍的内联统计卡 / 手搓 polyline 全部换成仪表组件库
 * （KpiTile / TickRing / TrendChart / BarChart），收益是三件事：
 *  1. 数字统一走 Odometer，刷新时只有变化的位在滚，横向扫视不会左右抖；
 *  2. 趋势图有网格、坐标轴与悬停准星，能读数而不只是「看个形状」；
 *  3. 环比是真实算出来的（近 7 日 vs 前 7 日），不再写死「较上月增长」。
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tag } from "antd";
import {
  UserOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { listPatients } from "../api/patients";
import { listRecords } from "../api/records";
import type { PatientInfo } from "../api/patients";
import type { MedicalRecordInfo } from "../api/records";
import {
  BarChart,
  KpiTile,
  Metric,
  Odometer,
  SpecPlate,
  TickRing,
  TrendChart,
} from "../components/instruments";

interface DayBucket {
  /** 排序键 YYYY-MM-DD（原来的 M/D 字符串排序跨月会错序） */
  key: string;
  label: string;
  count: number;
  ai: number;
  reviewed: number;
}

const STATUS_META = [
  { label: "待审", color: "#d6a451", tone: "orange" as const, code: 0 },
  { label: "已确认", color: "#1d7a63", tone: "green" as const, code: 1 },
  { label: "已驳回", color: "#c4423e", tone: "red" as const, code: 2 },
];

/** 患者列表接口并不返回 record_count / blood_type（原页面读的是 undefined），
    这里改用真实字段：建档日期、年龄。 */
function ageOf(birth?: string) {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  const years = Math.floor((Date.now() - d.getTime()) / 31557600000);
  return years >= 0 && years < 150 ? years : null;
}

function fmtDay(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 把记录按自然日装桶（只用于取每天的量，不负责补齐空日） */
function bucketByDay(records: MedicalRecordInfo[]): Map<string, DayBucket> {
  const map = new Map<string, DayBucket>();
  records.forEach((r) => {
    if (!r.visit_date) return;
    const d = new Date(r.visit_date);
    if (Number.isNaN(d.getTime())) return;
    const key = dayKey(d);
    let b = map.get(key);
    if (!b) {
      b = { key, label: `${d.getMonth() + 1}/${d.getDate()}`, count: 0, ai: 0, reviewed: 0 };
      map.set(key, b);
    }
    b.count += 1;
    if (r.ai_suggestion) b.ai += 1;
    if (r.ai_reviewed === 1) b.reviewed += 1;
  });
  return map;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** 连续 N 天窗口（含今天），没有数据的日子补 0 —— 不然坐标轴只画有数据的那几天，
    和面板上写的「近 14 日」对不上，也看不出空档。 */
function windowOfDays(map: Map<string, DayBucket>, span: number): DayBucket[] {
  const out: DayBucket[] = [];
  const today = new Date();
  for (let i = span - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = dayKey(d);
    out.push(
      map.get(key) ?? {
        key,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        count: 0,
        ai: 0,
        reviewed: 0,
      }
    );
  }
  return out;
}

/** 近 7 日 vs 前 7 日的环比（%）；上周为 0 则返回 null，由 fresh 表达 */
function weekDelta(days: DayBucket[], pick: (d: DayBucket) => number) {
  const last = days.slice(-7).reduce((a, b) => a + pick(b), 0);
  const prev = days.slice(-14, -7).reduce((a, b) => a + pick(b), 0);
  return {
    delta: prev > 0 ? Math.round(((last - prev) / prev) * 1000) / 10 : null,
    fresh: prev === 0 && last > 0,
    last,
  };
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

  // ---- 派生数据：一律在 return 之前声明完（避免 TDZ）----
  const days = useMemo(() => windowOfDays(bucketByDay(recordsAll), 14), [recordsAll]);
  const trend = days;
  const hasTrend = useMemo(() => trend.some((d) => d.count > 0), [trend]);

  const labels = useMemo(() => trend.map((d) => d.label), [trend]);
  const countSeries = useMemo(() => trend.map((d) => d.count), [trend]);
  const aiSeries = useMemo(() => trend.map((d) => d.ai), [trend]);
  const reviewedSeries = useMemo(() => trend.map((d) => d.reviewed), [trend]);

  const statusCount = useMemo(() => {
    const by = (code: number) => recordsAll.filter((r) => r.ai_reviewed === code).length;
    const pending = by(0);
    const confirmed = by(1);
    const rejected = by(2);
    const total = pending + confirmed + rejected;
    return {
      pending,
      confirmed,
      rejected,
      total,
      completion: total > 0 ? Math.round((confirmed / total) * 1000) / 10 : 0,
    };
  }, [recordsAll]);

  const aiTotal = useMemo(() => recordsAll.filter((r) => r.ai_suggestion).length, [recordsAll]);

  const docData = useMemo(() => {
    const docMap: Record<string, number> = {};
    recordsAll.forEach((r) => {
      const name = r.doctor_name || "未分配";
      docMap[name] = (docMap[name] || 0) + 1;
    });
    return Object.entries(docMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [recordsAll]);

  const deltaRecords = useMemo(() => weekDelta(days, (d) => d.count), [days]);
  const deltaAi = useMemo(() => weekDelta(days, (d) => d.ai), [days]);
  const deltaReviewed = useMemo(() => weekDelta(days, (d) => d.reviewed), [days]);

  const loadedAt = useMemo(
    () =>
      new Date().toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const todo = [
    {
      key: "pending",
      icon: <FileTextOutlined />,
      bg: "#f2f6ff",
      color: "#5784d2",
      title: "待审核就诊记录",
      desc: "AI 已生成建议，等待确认",
      num: statusCount.pending,
      go: "/records",
    },
    {
      key: "patients",
      icon: <UserOutlined />,
      bg: "#fff8eb",
      color: "#c49338",
      title: "新注册患者",
      desc: "需要完善档案信息",
      num: recentPatients.length,
      go: "/patients",
    },
    {
      key: "ai",
      icon: <ExperimentOutlined />,
      bg: "#eef8f5",
      color: "#138d85",
      title: "AI 辅助诊断",
      desc: "待查看分析结果",
      num: aiTotal,
      go: "/ai-assistant",
    },
  ];

  return (
    <div className="dash">
      {/* Hero */}
      <section className="dash-hero md-rise">
        <div className="dash-hero-main">
          <h2>欢迎回到工作空间</h2>
          <p>连接患者、诊疗与医学知识。以清晰的工作空间，陪伴每一次专业判断。</p>
          <button className="dash-hero-cta" onClick={() => navigate("/records")}>
            查看今日任务 →
          </button>
        </div>
        <div className="dash-hero-stat">
          <Metric value={patientTotal} size="xl" label="累计患者" />
        </div>
      </section>

      {/* 指标瓦片 */}
      <div className="kpi-grid md-stagger">
        <KpiTile
          title="患者总数"
          value={patientTotal}
          cat={1}
          icon={<UserOutlined />}
          foot="已建档患者"
          onPick={() => navigate("/patients")}
        />
        <KpiTile
          title="就诊记录"
          value={recordTotal}
          cat={2}
          icon={<FileTextOutlined />}
          delta={deltaRecords.delta}
          fresh={deltaRecords.fresh && deltaRecords.delta === null}
          foot="近 7 日 vs 前 7 日"
          spark={countSeries}
          onPick={() => navigate("/records")}
        />
        <KpiTile
          title="AI 辅助诊断"
          value={aiTotal}
          cat={3}
          icon={<ExperimentOutlined />}
          delta={deltaAi.delta}
          fresh={deltaAi.fresh && deltaAi.delta === null}
          foot="样本内已生成建议"
          spark={aiSeries}
          onPick={() => navigate("/ai-assistant")}
        />
        <KpiTile
          title="已审核建议"
          value={statusCount.confirmed}
          cat={5}
          icon={<CheckCircleOutlined />}
          delta={deltaReviewed.delta}
          fresh={deltaReviewed.fresh && deltaReviewed.delta === null}
          foot="样本内已确认"
          spark={reviewedSeries}
          onPick={() => navigate("/records")}
        />
      </div>

      {/* 图表 + 待办 */}
      <div className="dash-split">
        <div className="dash-col">
          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h2>记录状态分布</h2>
                  <small>按审核状态统计</small>
                </div>
              </div>
              <div className="panel-body">
                <div className="ring-block">
                  <TickRing
                    value={statusCount.completion}
                    display={statusCount.confirmed}
                    unit="条"
                    caption="已确认"
                    cat={3}
                    size={158}
                    decimals={0}
                  />
                  <div className="trend-legend">
                    <span className="trend-legend-item">
                      <i style={{ background: STATUS_META[0].color }} />
                      待审
                      <b>{statusCount.pending}</b>
                    </span>
                    <span className="trend-legend-item">
                      <i style={{ background: STATUS_META[1].color }} />
                      已确认
                      <b>{statusCount.confirmed}</b>
                    </span>
                    <span className="trend-legend-item">
                      <i style={{ background: STATUS_META[2].color }} />
                      已驳回
                      <b>{statusCount.rejected}</b>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <div>
                  <h2>每日就诊趋势</h2>
                  <small>近 {labels.length || 14} 日</small>
                </div>
              </div>
              <div className="panel-body pad">
                {hasTrend ? (
                  <TrendChart
                    labels={labels}
                    series={[{ name: "就诊记录", values: countSeries, area: true }]}
                    height={196}
                    unit=" 例"
                    cat={1}
                  />
                ) : (
                  <div className="dash-empty">近 14 日暂无就诊记录</div>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>按接诊医生</h2>
                <small>样本内就诊记录归属</small>
              </div>
            </div>
            <div className="panel-body">
              <BarChart data={docData} cat={2} />
            </div>
          </div>
        </div>

        <div className="dash-col">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>待办任务</h2>
                <small>需要您处理的事项</small>
              </div>
            </div>
            <div className="dash-todo">
              {todo.map((t) => (
                <button key={t.key} className="dash-todo-row" onClick={() => navigate(t.go)}>
                  <span className="dash-todo-ico" style={{ background: t.bg, color: t.color }}>
                    {t.icon}
                  </span>
                  <span className="dash-todo-txt">
                    <strong>{t.title}</strong>
                    <p>{t.desc}</p>
                  </span>
                  <span className="dash-num">
                    <Odometer value={t.num} />
                  </span>
                  <span className="dash-arrow">→</span>
                </button>
              ))}
            </div>
          </div>

          <SpecPlate
            title="数据口径"
            rows={[
              { label: "数据源", value: "患者库 · 就诊库" },
              { label: "统计窗口", value: `近 ${labels.length || 14} 日` },
              { label: "纳入样本", value: `${recordsAll.length} 条就诊` },
              { label: "载入时间", value: loadedAt },
            ]}
          />
        </div>
      </div>

      {/* 最近患者 + 最近就诊 */}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>最近患者</h2>
            </div>
            <button className="dash-link" onClick={() => navigate("/patients")}>
              全部 →
            </button>
          </div>
          <div className="dash-list">
            {loading ? (
              <div className="dash-empty">加载中…</div>
            ) : recentPatients.length === 0 ? (
              <div className="dash-empty">暂无患者</div>
            ) : (
              recentPatients.slice(0, 5).map((p) => {
                const age = ageOf(p.birth_date);
                return (
                  <div
                    key={p.id}
                    className="dash-row is-clickable"
                    onClick={() => navigate(`/patients/${p.id}`)}
                  >
                    <span className="dash-avatar">{p.name?.[0] ?? "?"}</span>
                    <span className="dash-row-main">
                      <span className="dash-row-title">{p.name}</span>
                      <small className="dash-row-sub">
                        {p.gender === "male" ? "男" : p.gender === "female" ? "女" : "-"} · 建档{" "}
                        {fmtDay(p.created_at)}
                      </small>
                    </span>
                    {age !== null && (
                      <Tag color="blue" style={{ fontSize: 10, marginInlineEnd: 0 }}>
                        {age} 岁
                      </Tag>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>最近就诊</h2>
            </div>
            <button className="dash-link" onClick={() => navigate("/records")}>
              全部 →
            </button>
          </div>
          <div className="dash-list">
            {loading ? (
              <div className="dash-empty">加载中…</div>
            ) : recentRecords.length === 0 ? (
              <div className="dash-empty">暂无记录</div>
            ) : (
              recentRecords.slice(0, 5).map((r) => {
                const meta =
                  STATUS_META.find((s) => s.code === r.ai_reviewed) ?? STATUS_META[0];
                return (
                  <div key={r.id} className="dash-row">
                    <span className="dash-avatar teal">
                      <FileTextOutlined />
                    </span>
                    <span className="dash-row-main">
                      <span className="dash-row-title">
                        {r.symptoms?.slice(0, 40) || "无主诉"}
                      </span>
                      <small className="dash-row-sub">
                        {r.visit_date ? new Date(r.visit_date).toLocaleDateString("zh-CN") : "-"}
                        {r.doctor_name ? ` · ${r.doctor_name}` : ""}
                      </small>
                    </span>
                    <Tag color={meta.tone} style={{ fontSize: 10, marginInlineEnd: 0 }}>
                      {meta.label}
                    </Tag>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
