/**
 * MiniSpark —— KPI 卡右下角的一条细走势。
 *
 * 固定 viewBox + preserveAspectRatio="none"，只做「形状暗示」；
 * 不画轴、不标数，避免在小尺寸里堆信息。
 * 进场时用 dashed 描边从右往左铺开（视觉上是「刚画出来」）。
 */
import { useEffect, useRef, useState } from "react";
import { motionSkipped } from "../../utils/motion";

export interface MiniSparkProps {
  values: number[];
  color?: string;
  className?: string;
}

const W = 62;
const H = 22;
const PAD = 2.5;

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i += 1) {
    const p = pts[i - 1];
    const c = pts[i];
    const mx = (p.x + c.x) / 2;
    d += ` C${mx.toFixed(2)},${p.y.toFixed(2)} ${mx.toFixed(2)},${c.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)}`;
  }
  return d;
}

export default function MiniSpark({ values, color, className }: MiniSparkProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [drawn, setDrawn] = useState(false);
  const series = values.length >= 2 ? values : [];

  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const span = Math.max(max - min, 1);
  const step = series.length > 1 ? (W - PAD * 2) / (series.length - 1) : 0;
  const d = smoothPath(
    series.map((v, i) => ({
      x: PAD + i * step,
      y: H - PAD - ((v - min) / span) * (H - PAD * 2),
    }))
  );

  useEffect(() => {
    if (!d) return;
    if (motionSkipped()) {
      setDrawn(true);
      return;
    }
    const raf = window.requestAnimationFrame(() => setDrawn(true));
    return () => window.cancelAnimationFrame(raf);
  }, [d]);

  // 进场：用 stroke-dashoffset 把线「画」出来
  useEffect(() => {
    const el = pathRef.current;
    if (!el || !drawn) return;
    if (motionSkipped()) return;
    let len = 0;
    try {
      len = el.getTotalLength();
    } catch {
      return;
    }
    if (!len) return;
    const anim = el.animate(
      [{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDashoffset: "0" }],
      { duration: 720, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }
    );
    return () => anim.cancel();
  }, [d, drawn]);

  if (!series.length) return <span className={className} aria-hidden="true" />;

  return (
    <svg
      className={className ?? "kpi-spark"}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path ref={pathRef} d={d} style={color ? { stroke: color } : undefined} />
    </svg>
  );
}
