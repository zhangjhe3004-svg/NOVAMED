/**
 * HeatGrid —— 星期 × 小时登录热力格（复刻 scaffold HeatGrid.vue）。
 *
 * 把后端稀疏格子补成 7 × 24 网格，按分位分 0–4 级（青柠由浅到深），
 * 失败占比高的格子叠斜线（.is-risky）。悬停十字高亮整行整列并显示读数；
 * 格子可聚焦。入场从左上角向右下对角线波纹点亮（animation-delay 按 dow+hour 递增）。
 */
import { useMemo, useState } from "react";

export interface HeatCell {
  dow: number;   // 0=周一 … 6=周日
  hour: number;  // 0–23
  total: number;
  failed: number;
}

interface HeatGridCell extends HeatCell {
  level: 0 | 1 | 2 | 3 | 4;
  failRate: number;
  risky: boolean;
}

const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export default function HeatGrid({ cells, loading }: { cells: HeatCell[]; loading?: boolean }) {
  const [hover, setHover] = useState<HeatGridCell | null>(null);

  const { grid, peak } = useMemo(() => {
    const g: HeatGridCell[][] = Array.from({ length: 7 }, (_, dow) =>
      Array.from({ length: 24 }, (_, hour) => ({
        dow, hour, total: 0, failed: 0, level: 0 as const, failRate: 0, risky: false,
      }))
    );
    for (const c of cells) {
      if (c.dow < 0 || c.dow > 6 || c.hour < 0 || c.hour > 23) continue;
      const cell = g[c.dow][c.hour];
      cell.total += c.total;
      cell.failed += c.failed;
    }
    const totals = g.flat().map((c) => c.total).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p: number) => (totals.length ? totals[Math.floor(p * (totals.length - 1))] : 0);
    const cuts = [q(0.25), q(0.5), q(0.75)];
    let peak: HeatGridCell | null = null;
    for (const cell of g.flat()) {
      cell.failRate = cell.total ? cell.failed / cell.total : 0;
      cell.risky = cell.failed >= 2 && cell.failRate >= 0.3;
      cell.level = cell.total === 0 ? 0 : cell.total <= cuts[0] ? 1 : cell.total <= cuts[1] ? 2 : cell.total <= cuts[2] ? 3 : 4;
      if (!peak || cell.total > peak.total) peak = cell;
    }
    return { grid: g, peak: peak && peak.total ? peak : null };
  }, [cells]);

  const label = (c: HeatGridCell) =>
    `${DAYS[c.dow]} ${String(c.hour).padStart(2, "0")}:00，登录 ${c.total} 次${c.failed ? `，失败 ${c.failed} 次` : ""}`;

  return (
    <div className={`heat${loading ? " is-loading" : ""}`} onPointerLeave={() => setHover(null)}>
      <div className="heat-hours" aria-hidden="true">
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className={hover?.hour === h ? "is-on" : ""}>
            {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
          </span>
        ))}
      </div>
      {grid.map((row, dow) => (
        <div key={dow} className="heat-row" role="row">
          <span className={`heat-day${hover?.dow === dow ? " is-on" : ""}`}>{DAYS[dow]}</span>
          {row.map((cell) => {
            const isCross = !!hover && (hover.dow === cell.dow || hover.hour === cell.hour);
            return (
              <button
                key={cell.hour}
                type="button"
                data-cell={`${cell.dow}-${cell.hour}`}
                className={`heat-cell lv-${cell.level}${cell.risky ? " is-risky" : ""}${isCross ? " is-cross" : ""}${hover === cell ? " is-hover" : ""}`}
                style={{ animationDelay: `${(cell.dow + cell.hour) * 13}ms` }}
                aria-label={label(cell)}
                onPointerEnter={() => setHover(cell)}
                onFocus={() => setHover(cell)}
              />
            );
          })}
        </div>
      ))}
      <div className="heat-foot">
        <span className="heat-readout" aria-live="polite">
          {hover
            ? label(hover)
            : peak
              ? `高峰：${DAYS[peak.dow]} ${String(peak.hour).padStart(2, "0")}:00 · ${peak.total} 次`
              : "所选范围内暂无登录"}
        </span>
        <span className="heat-legend" aria-hidden="true">
          少<i className="lv-1" /><i className="lv-2" /><i className="lv-3" /><i className="lv-4" />多<i className="is-risky" />失败集中
        </span>
      </div>
    </div>
  );
}
