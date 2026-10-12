/**
 * Odometer —— 逐位滚动读数（结 Crystallize）。
 *
 * 每一位是一条 0–9 的竖带，只有值变了的那一位会滚。
 * 位次按「从右往左」编号当 key，所以位数变化时个位、十位不会错位重排。
 *
 * 首帧先显示 0 再滚到目标值；后台标签页里 rAF 不触发，用定时器兜底。
 */
import { useEffect, useState } from "react";

export interface OdometerProps {
  value: number | null | undefined;
  decimals?: number;
  /** 千分位分隔 */
  group?: boolean;
}

export default function Odometer({ value, decimals = 0, group = true }: OdometerProps) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined" && document.hidden) {
      setSettled(true);
      return;
    }
    const timer = window.setTimeout(() => setSettled(true), 120);
    const raf = window.requestAnimationFrame(() => setSettled(true));
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  const numeric = Number(value);
  const text =
    value === null || value === undefined || Number.isNaN(numeric)
      ? "—"
      : numeric.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
          useGrouping: group,
        });

  const chars = [...text];

  return (
    <span className="odometer tnum" role="img" aria-label={text}>
      {chars.map((ch, i) => {
        const digit = /\d/.test(ch) ? Number(ch) : null;
        // 从右往左编号：位数增加时旧的个位仍拿到同一个 key，不会重新挂载
        const key = chars.length - i;
        return (
          <span key={key} className={`odo-cell${digit === null ? " is-sep" : ""}`} aria-hidden="true">
            {digit === null ? (
              ch
            ) : (
              <span
                className="odo-strip"
                style={{
                  transform: `translateY(${-(settled ? digit : 0) * 10}%)`,
                  transitionDelay: `${(key % 6) * 40}ms`,
                }}
              >
                {Array.from({ length: 10 }, (_, n) => (
                  <span key={n}>{n}</span>
                ))}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
