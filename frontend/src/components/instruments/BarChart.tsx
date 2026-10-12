/**
 * BarChart —— 横向条组（`.bars`）。
 *
 * 为什么是横向：中文科室名 / 医生名很长，竖柱的 x 轴塞不下，
 * 横条可以让名字左对齐、读数值右对齐，长度差异一眼可比。
 * 柱子从 0 长到目标宽度（宽高比占位不会重排，标签不会抖）。
 */
import { useEffect, useState } from "react";
import Odometer from "./Odometer";
import { motionSkipped } from "../../utils/motion";

export interface BarDatum {
  name: string;
  value: number;
}

export interface BarChartProps {
  data: BarDatum[];
  unit?: string;
  cat?: 1 | 2 | 3 | 4 | 5;
  /** 固定分母；不传则取本组最大值 */
  max?: number;
  /** 点击某条 */
  onPick?: (name: string) => void;
  emptyText?: string;
}

export default function BarChart({
  data,
  unit = "",
  cat = 1,
  max,
  onPick,
  emptyText = "暂无数据",
}: BarChartProps) {
  const [armed, setArmed] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    if (motionSkipped()) {
      setArmed(true);
      return;
    }
    const raf = window.requestAnimationFrame(() => setArmed(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  if (!data.length) return <div className="bars-empty">{emptyText}</div>;

  const peak = Math.max(...data.map((d) => d.value), 1);
  const denom = max && max > 0 ? max : peak;
  const peakName = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]).name;

  return (
    <div className={`bars cat-${cat}`}>
      {data.map((d, i) => {
        const pct = Math.max(d.value > 0 ? 2 : 0, (d.value / denom) * 100);
        return (
          <div
            key={d.name}
            className={`bar-row${hover === d.name ? " is-hover" : ""}`}
            onPointerEnter={() => setHover(d.name)}
            onPointerLeave={() => setHover((v) => (v === d.name ? null : v))}
            onClick={onPick ? () => onPick(d.name) : undefined}
            style={onPick ? { cursor: "pointer" } : undefined}
          >
            <span className="bar-name" title={d.name}>
              {d.name}
            </span>
            <span className="bar-track">
              <span
                className={`bar-fill${d.name === peakName && d.value > 0 ? " is-peak" : ""}`}
                style={{
                  width: `${armed ? pct : 0}%`,
                  transitionDelay: `${Math.min(i * 45, 360)}ms`,
                }}
              />
            </span>
            <span className="bar-value">
              <Odometer value={d.value} />
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
