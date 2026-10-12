/**
 * 运营数据 —— 多维运营指标看板。
 *
 * 与原版的差别：
 *  1. 六张手写内联卡 → KpiTile（统一读数排版 + 真实环比）；
 *  2. 手搓 polyline → TrendChart（网格 / 坐标轴 / 悬停准星 / 多序列形变）；
 *  3. 三条竖排 label+bar → 横向 BarChart；审核状态再加一个 TickRing 看完成度；
 *  4. 全部读数的环比都从 trends 现算（近 7 日 vs 前 7 日），不再只给一个干数字。
 */
import { useEffect, useMemo, useState } from "react";
import { Select, Spin, Empty } from "antd";
import {
  UserOutlined,
  FileTextOutlined,
  CalendarOutlined,
  AccountBookOutlined,
  ExperimentOutlined,
  RiseOutlined,
} from "@ant-design/icons";
import {
  getOverview,
  getTrends,
  getDepartmentDist,
  getDoctorDist,
  getRecordStatus,
  type Overview,
  type TrendPoint,
  type NameValue,
} from "../api/analytics";
import { BarChart, KpiTile, TickRing, TrendChart } from "../components/instruments";

/** 近 7 日 vs 前 7 日；窗口不足 14 天就不给环比（宁缺勿假） */
function weekDelta(values: number[]) {
  if (values.length < 14) return { delta: null as number | null, fresh: false };
  const last = values.slice(-7).reduce((a, b) => a + b, 0);
  const prev = values.slice(-14, -7).reduce((a, b) => a + b, 0);
  if (prev === 0) return { delta: null, fresh: last > 0 };
  return { delta: Math.round(((last - prev) / prev) * 1000) / 10, fresh: false };
}

export default function Analytics() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [depts, setDepts] = useState<NameValue[]>([]);
  const [docs, setDocs] = useState<NameValue[]>([]);
  const [status, setStatus] = useState<NameValue[]>([]);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);

  const loadTrends = async (d: number) => {
    try {
      const r = await getTrends(d);
      setTrends(r.items);
    } catch {
      /* 忽略 */
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ov, tr, de, do_, st] = await Promise.all([
          getOverview(),
          getTrends(14),
          getDepartmentDist(),
          getDoctorDist(),
          getRecordStatus(),
        ]);
        setOverview(ov);
        setTrends(tr.items);
        setDepts(de.items);
        setDocs(do_.items);
        setStatus(st.items);
      } catch {
        /* 忽略 */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---- 派生数据：全部在 return 之前算完（TDZ 预防）----
  const labels = useMemo(() => trends.map((t) => t.label), [trends]);
  const series = useMemo(
    () => [
      { name: "就诊", values: trends.map((t) => t.records), area: true },
      { name: "预约", values: trends.map((t) => t.appointments) },
      { name: "收费", values: trends.map((t) => t.billing) },
      { name: "检查", values: trends.map((t) => t.labtests) },
    ],
    [trends]
  );

  const deltaRecords = useMemo(() => weekDelta(trends.map((t) => t.records)), [trends]);
  const deltaAppointments = useMemo(() => weekDelta(trends.map((t) => t.appointments)), [trends]);
  const deltaBilling = useMemo(() => weekDelta(trends.map((t) => t.billing)), [trends]);
  const deltaLabtests = useMemo(() => weekDelta(trends.map((t) => t.labtests)), [trends]);

  const review = useMemo(() => {
    const confirmed = status.find((s) => s.name.includes("确认"))?.value ?? 0;
    const total = status.reduce((a, b) => a + b.value, 0);
    return {
      confirmed,
      total,
      completion: total > 0 ? Math.round((confirmed / total) * 1000) / 10 : 0,
    };
  }, [status]);

  return (
    <div className="data-page">
      <div className="page-head">
        <div>
          <h2>运营数据</h2>
          <p>患者、诊疗、财务与检查的多维运营指标总览</p>
        </div>
      </div>

      {loading ? (
        <div className="data-loading">
          <Spin />
        </div>
      ) : (
        <>
          {/* 指标瓦片 */}
          <div className="kpi-grid is-3 md-stagger">
            <KpiTile
              title="患者总数"
              value={overview?.patient_total ?? 0}
              cat={1}
              icon={<UserOutlined />}
              foot="已建档患者"
            />
            <KpiTile
              title="就诊记录"
              value={overview?.record_total ?? 0}
              cat={2}
              icon={<FileTextOutlined />}
              delta={deltaRecords.delta}
              fresh={deltaRecords.fresh}
              foot="近 7 日 vs 前 7 日"
            />
            <KpiTile
              title="预约挂号"
              value={overview?.appointment_total ?? 0}
              cat={5}
              icon={<CalendarOutlined />}
              delta={deltaAppointments.delta}
              fresh={deltaAppointments.fresh}
              foot="近 7 日 vs 前 7 日"
            />
            <KpiTile
              title="检查检验"
              value={overview?.labtest_total ?? 0}
              cat={3}
              icon={<ExperimentOutlined />}
              delta={deltaLabtests.delta}
              fresh={deltaLabtests.fresh}
              foot="近 7 日 vs 前 7 日"
            />
            <KpiTile
              title="收费单数"
              value={overview?.billing_total ?? 0}
              cat={4}
              icon={<AccountBookOutlined />}
              delta={deltaBilling.delta}
              fresh={deltaBilling.fresh}
              foot="近 7 日 vs 前 7 日"
            />
            <KpiTile
              title="累计收费"
              value={overview?.revenue_yuan ?? 0}
              prefix="¥"
              decimals={2}
              cat={2}
              icon={<RiseOutlined />}
              foot="已支付金额合计"
            />
          </div>

          {/* 运营趋势 */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>运营趋势</h2>
                <small>近 {days} 日各业务指标变化</small>
              </div>
              <Select
                size="small"
                value={days}
                style={{ width: 110 }}
                onChange={(v) => {
                  setDays(v);
                  loadTrends(v);
                }}
                options={[
                  { value: 7, label: "近 7 日" },
                  { value: 14, label: "近 14 日" },
                  { value: 30, label: "近 30 日" },
                ]}
              />
            </div>
            <div className="panel-body pad">
              {labels.length ? (
                <TrendChart labels={labels} series={series} height={252} cat={1} dots={false} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
              )}
            </div>
          </div>

          {/* 分布 */}
          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h2>科室分布</h2>
                  <small>按接诊记录归属科室</small>
                </div>
              </div>
              <div className="panel-body">
                <BarChart data={depts.slice(0, 10)} cat={1} emptyText="暂无科室数据" />
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h2>医生接诊排行</h2>
                  <small>前 10 名</small>
                </div>
              </div>
              <div className="panel-body">
                <BarChart data={docs.slice(0, 10)} cat={2} emptyText="暂无医生数据" />
              </div>
            </div>
          </div>

          {/* 审核状态：完成度 + 明细 */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>记录审核状态</h2>
                <small>已确认 / 全部就诊记录</small>
              </div>
            </div>
            <div className="panel-body">
              <div className="ring-bars">
                <TickRing
                  value={review.completion}
                  display={review.confirmed}
                  unit="条"
                  caption="已确认"
                  cat={3}
                  size={162}
                  decimals={0}
                />
                <BarChart data={status} cat={3} max={review.total || undefined} emptyText="暂无记录" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
