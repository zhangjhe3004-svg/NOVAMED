/**
 * TickRing —— 刻度环。
 *
 * 60 根径向刻度顺时针逐根点亮，点亮到位后末端圆点一次 back.out 过冲落定，
 * 中心读数逐位滚动。用来表达「完成度 / 占比 / 加载率」这类 0–100 的读数——
 * 比一个纯色圆环更有「仪表」感，也更容易看出刻度位置。
 *
 * 动效全部走 CSS（逐根 transition-delay + 圆点的回弹曲线），
 * 不用命令式补间，卸载时也不需要清理。
 */
import { useEffect, useState } from "react";
import Odometer from "./Odometer";
import { motionSkipped } from "../../utils/motion";

export interface TickRingProps {
  /** 0–100 */
  value: number | null | undefined;
  /** 中心展示的另一个数（默认同 value） */
  display?: number;
  unit?: string;
  caption?: string;
  size?: number;
  ticks?: number;
  decimals?: number;
  /** 取色：cat-1..5 */
  cat?: 1 | 2 | 3 | 4 | 5;
}

const R_OUT = 0.5;
const R_IN = 0.4;
const R_MAJOR = 0.37;

export default function TickRing({
  value,
  display,
  unit = "%",
  caption,
  size = 168,
  ticks = 60,
  decimals = 1,
  cat = 1,
}: TickRingProps) {
  const pct = Math.min(100, Math.max(0, Number(value ?? 0) || 0));
  const lit = Math.round((pct / 100) * ticks);

  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (motionSkipped()) {
      setArmed(true);
      return;
    }
    const raf = window.requestAnimationFrame(() => setArmed(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const marks = Array.from({ length: ticks }, (_, i) => {
    const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
    const major = i % 5 === 0;
    const inner = major ? R_MAJOR : R_IN;
    return {
      x1: 0.5 + Math.cos(a) * inner,
      y1: 0.5 + Math.sin(a) * inner,
      x2: 0.5 + Math.cos(a) * (R_OUT - 0.02),
      y2: 0.5 + Math.sin(a) * (R_OUT - 0.02),
      on: i < lit,
      major,
      i,
    };
  });

  const cap = lit
    ? (() => {
        const a = ((lit - 0.5) / ticks) * Math.PI * 2 - Math.PI / 2;
        return { x: 0.5 + Math.cos(a) * 0.53, y: 0.5 + Math.sin(a) * 0.53 };
      })()
    : null;

  return (
    <div className={`tick-ring cat-${cat}`}>
      <div className="tick-ring-figure" style={{ width: size, height: size }}>
        <svg
          className="tick-ring-svg"
          viewBox="0 0 1 1"
          role="img"
          aria-label={`${caption ?? "占比"} ${pct}%`}
        >
          {marks.map((m) => (
            <line
              key={m.i}
              className={`tick-ring-tick${m.major ? " is-major" : ""}${m.on && armed ? " is-on" : ""}`}
              x1={m.x1}
              y1={m.y1}
              x2={m.x2}
              y2={m.y2}
              style={m.on ? { transitionDelay: `${Math.min(m.i * 12, 480)}ms` } : undefined}
            />
          ))}
          {cap && (
            <circle
              className="tick-ring-cap"
              cx={cap.x}
              cy={cap.y}
              r={0.022}
              style={{ transform: armed ? "scale(1)" : "scale(0.2)" }}
            />
          )}
        </svg>
        <div className="tick-ring-center">
          <span className="tick-ring-value">
            <Odometer value={display ?? value} decimals={decimals} />
            {unit && <sup className="tick-ring-unit">{unit}</sup>}
          </span>
          {caption && <span className="tick-ring-caption">{caption}</span>}
        </div>
      </div>
    </div>
  );
}
