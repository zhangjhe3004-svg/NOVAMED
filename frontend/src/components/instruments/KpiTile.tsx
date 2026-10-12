/**
 * KpiTile —— 指标瓦片（图标 + 读数 + 环比 + 脚注 + 迷你走势）。
 *
 * 取代原先各页各写一遍的内联 stat 卡：一处定义，全站同一节奏。
 * 整块是可点按钮但仍保持 <button> 内只有 phrased content 的写法。
 * 鼠标离开时用「自动归位」——hover 抬升交给 CSS（translate），
 * 不用内联 onMouseEnter 改 style。
 */
import type { ReactNode } from "react";
import Odometer from "./Odometer";
import DeltaPill from "./DeltaPill";
import MiniSpark from "./MiniSpark";

export interface KpiTileProps {
  title: string;
  value: number | null | undefined;
  unit?: string;
  prefix?: string;
  decimals?: number;
  icon?: ReactNode;
  cat?: 1 | 2 | 3 | 4 | 5;
  /** 环比百分比 */
  delta?: number | null;
  /** 上一周期为 0 → 「新增」 */
  fresh?: boolean;
  /** 指标涨了是坏事（如待审积压） */
  invert?: boolean;
  /** 脚注文案或节点 */
  foot?: ReactNode;
  spark?: number[];
  onPick?: () => void;
}

export default function KpiTile({
  title,
  value,
  unit,
  prefix,
  decimals = 0,
  icon,
  cat = 1,
  delta = null,
  fresh = false,
  invert = false,
  foot,
  spark,
  onPick,
}: KpiTileProps) {
  return (
    <button
      type="button"
      className={`kpi cat-${cat}`}
      onClick={onPick}
      style={onPick ? undefined : { cursor: "default" }}
    >
      <span className="kpi-top">
        <span className="kpi-title">{title}</span>
        {icon && <span className="kpi-ico">{icon}</span>}
      </span>

      <span className="kpi-mid">
        <span className="metric metric-l">
          <span className="metric-figure tnum">
            {prefix && <span className="metric-unit">{prefix}</span>}
            <Odometer value={value} decimals={decimals} />
            {unit && <sup className="metric-unit">{unit}</sup>}
          </span>
        </span>
        {(delta !== null && delta !== undefined) || fresh ? (
          <DeltaPill value={delta} fresh={fresh} invert={invert} />
        ) : null}
      </span>

      {(foot || (spark && spark.length > 1)) && (
        <span className="kpi-foot">
          {foot}
          {spark && spark.length > 1 && <MiniSpark values={spark} className="kpi-spark" />}
        </span>
      )}
    </button>
  );
}
