/**
 * Metric —— 读数块：标签 + 等宽大数字 + 上标单位（+ 任意附加内容）。
 *
 * 数字一律走 Odometer，所以刷新时只有变化的位在滚，同一个数字在不同卡片
 * 里也占同样的宽度，横向扫视时不会因为位数不同而左右错位。
 */
import type { ReactNode } from "react";
import Odometer from "./Odometer";

export interface MetricProps {
  value: number | null | undefined;
  unit?: string;
  /** 数字前的小单位，如 ¥ */
  prefix?: string;
  decimals?: number;
  size?: "xl" | "l" | "m" | "s";
  label?: string;
  children?: ReactNode;
}

export default function Metric({
  value,
  unit,
  prefix,
  decimals = 0,
  size = "m",
  label,
  children,
}: MetricProps) {
  return (
    <span className={`metric metric-${size}`}>
      {label && <span className="metric-label">{label}</span>}
      <span className="metric-figure tnum">
        {prefix && <span className="metric-unit">{prefix}</span>}
        <Odometer value={value} decimals={decimals} />
        {unit && <sup className="metric-unit">{unit}</sup>}
      </span>
      {children}
    </span>
  );
}
