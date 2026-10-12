/**
 * TrendChart —— 纯 SVG 趋势图（多序列）。
 *
 * 设计取舍：
 *  1. 按容器真实宽度计算坐标（ResizeObserver），线宽不被 viewBox 拉伸；
 *  2. 数据切换时折线从旧形态"形变"到新形态，而不是擦掉重画 —— 看的人能
 *     顺着线追到新位置，不会丢失"刚才它在哪"的记忆；
 *  3. 形变期间先不画节点，形变落定后再让节点出现（结 Crystallize）；
 *  4. 悬停竖准星 + 一条细读数卡，读数卡只读、不吃指针事件。
 *
 * 形变用 rAF 手写补间（项目不用 GSAP）：每帧直接 setAttribute 改 d，
 * 不 setState，避免 60fps 触发 React 重渲染。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type PointerEvent as ReactPointerEvent } from "react";
import { EASE, motionSkipped } from "../../utils/motion";

export interface TrendSeries {
  name: string;
  values: number[];
  color?: string;
  dashed?: boolean;
  /** 是否填面积（一般只给第一条） */
  area?: boolean;
}

export interface TrendChartProps {
  labels: string[];
  series: TrendSeries[];
  height?: number;
  unit?: string;
  /** 节点：点数 ≤ 12 全部显示，否则只显示末点 */
  dots?: boolean;
  cat?: 1 | 2 | 3 | 4 | 5;
}

type Pt = { x: number; y: number };

const PAD = { top: 18, right: 14, bottom: 28, left: 38 };
const MORPH_MS = 720;

/** 与 cat-1..5 同色 */
const PALETTE = ["#2563eb", "#138d85", "#7a5cc4", "#c4423e", "#a8792a", "#5b8dd6"];

/** 纵轴取整：至少留 15% 顶部余量，刻度步长取 1 / 2 / 5 × 10ⁿ */
function niceStep(raw: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const r = raw / magnitude;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * magnitude;
}

/** 中点三次贝塞尔：把折线画成不抖的平滑曲线 */
function smooth(pts: Pt[]) {
  if (!pts.length) return "";
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i += 1) {
    const p = pts[i - 1];
    const c = pts[i];
    const mx = (p.x + c.x) / 2;
    d += ` C${mx.toFixed(2)},${p.y.toFixed(2)} ${mx.toFixed(2)},${c.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)}`;
  }
  return d;
}

/** 把点列重采样到 count 个点：序列长度变了也能一一对应地形变 */
function resample(points: Pt[], count: number): Pt[] {
  if (!points.length || count < 1) return [];
  if (points.length === count) return points.slice();
  return Array.from({ length: count }, (_, i) => {
    const pos = count <= 1 ? 0 : (i / (count - 1)) * (points.length - 1);
    const a = points[Math.floor(pos)];
    const b = points[Math.min(points.length - 1, Math.ceil(pos))];
    const t = pos - Math.floor(pos);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
}

/** easeInOutQuad ≈ cubic-bezier(0.45,0,0.55,1)，与 EASE.swap 同观感 */
function easeSwap(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export default function TrendChart({
  labels,
  series,
  height = 220,
  unit = "",
  dots = true,
  cat = 1,
}: TrendChartProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(SVGPathElement | null)[]>([]);
  const areaRefs = useRef<(SVGPathElement | null)[]>([]);
  const shownRef = useRef<Pt[][]>([]);
  const rafRef = useRef(0);
  const snapRef = useRef(false);
  const drawnRef = useRef(false);

  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const [instant, setInstant] = useState(false);
  const [morphing, setMorphing] = useState(true);
  const shownOnceRef = useRef(false);

  // ---- 派生值：一律声明在 effect 之前（曾因顺序倒置踩过 TDZ）----
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = Math.max(10, height - PAD.top - PAD.bottom);

  const scale = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    const peak = Math.max(1, ...all);
    const step = Math.max(1, niceStep((peak * 1.15) / 4));
    return { step, max: step * Math.max(1, Math.ceil((peak * 1.15) / step)) };
  }, [series]);

  const targets = useMemo(() => {
    return series.map((s) =>
      s.values.map((v, i) => ({
        x: PAD.left + (s.values.length <= 1 ? innerW / 2 : (i / (s.values.length - 1)) * innerW),
        y: PAD.top + innerH - (v / scale.max) * innerH,
      }))
    );
    // xAt/yAt 完全由下面这些标量决定
  }, [series, innerW, innerH, scale.max]);

  const ticks = useMemo(() => {
    const list: { y: number; label: number }[] = [];
    for (let v = 0; v <= scale.max + 1e-9; v += scale.step) {
      list.push({ y: PAD.top + innerH - (v / scale.max) * innerH, label: Math.round(v) });
    }
    return list;
  }, [scale.max, scale.step, innerH]);

  const n = labels.length;

  const xLabels = useMemo(() => {
    if (!n) return [];
    const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 70))));
    return labels
      .map((label, i) => ({ label, i }))
      .filter(({ i }) => i % step === 0 || i === n - 1);
  }, [labels, n, innerW]);

  const colorAt = useCallback(
    (i: number) => series[i]?.color ?? PALETTE[i % PALETTE.length],
    [series]
  );

  const draw = useCallback(() => {
    const base = PAD.top + innerH;
    shownRef.current.forEach((pts, si) => {
      if (!pts.length) return;
      const line = lineRefs.current[si];
      if (line) line.setAttribute("d", smooth(pts));
      const area = areaRefs.current[si];
      if (area) {
        area.setAttribute(
          "d",
          `${smooth(pts)} L${pts[pts.length - 1].x.toFixed(2)},${base.toFixed(2)} L${pts[0].x.toFixed(2)},${base.toFixed(2)} Z`
        );
      }
    });
  }, [innerH]);

  /* 形变：目标点位变了就补间过去；宽度变化（容器 resize）直接落位不补间，
     否则整条线会被横向拉长，看着像抖动。 */
  useEffect(() => {
    if (!targets.length || !targets.some((t) => t.length)) return;
    const prev = shownRef.current;
    const snap = snapRef.current || !prev.length || motionSkipped() || prev.length !== targets.length;
    snapRef.current = false;

    if (snap) {
      shownRef.current = targets.map((t) => t.slice());
      draw();
      setMorphing(false);
      return;
    }

    const from = prev.map((pts, si) => {
      const r = resample(pts, targets[si].length);
      return r.length === targets[si].length ? r : targets[si].slice();
    });
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    setMorphing(true);

    const t0 = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / MORPH_MS);
      const e = easeSwap(t);
      shownRef.current = targets.map((pts, si) =>
        pts.map((p, i) => ({
          x: from[si][i].x + (p.x - from[si][i].x) * e,
          y: from[si][i].y + (p.y - from[si][i].y) * e,
        }))
      );
      draw();
      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        setMorphing(false);
      }
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [targets, draw]);

  /* 开场：折线用 dashoffset 从起点"画"出来（每会话第一次进来才播） */
  useEffect(() => {
    if (drawnRef.current || motionSkipped()) return;
    const lines = lineRefs.current.filter(Boolean) as SVGPathElement[];
    if (!lines.length) return;
    drawnRef.current = true;
    lines.forEach((el, i) => {
      let len = 0;
      try {
        len = el.getTotalLength();
      } catch {
        return;
      }
      if (!len) return;
      el.animate(
        [
          { strokeDasharray: `${len}`, strokeDashoffset: `${len}`, opacity: 0.15 },
          { strokeDashoffset: "0", opacity: 1 },
        ],
        { duration: 900, delay: i * 90, easing: EASE.reveal, fill: "backwards" }
      );
    });
  }, [targets]);

  /* 首帧就量到真实宽度：否则 viewBox 与实际宽度不一致，文字会被横向拉扁一帧 */
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const w = Math.round(el.clientWidth);
    if (w > 0) setWidth(w);
  }, []);

  /* 容器宽度变化：直接落位（不补间），否则整条线被横向拉伸像在抖 */
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) {
        snapRef.current = true;
        setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* 读数卡首次出现时不要从 (0,0) 滑过去 */
  useEffect(() => {
    if (!instant) return;
    const raf = window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => setInstant(false))
    );
    return () => window.cancelAnimationFrame(raf);
  }, [instant]);

  useEffect(() => () => { if (rafRef.current) window.cancelAnimationFrame(rafRef.current); }, []);

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = boxRef.current?.getBoundingClientRect();
    const pts = targets[0];
    if (!rect || !pts?.length) return;
    const x = e.clientX - rect.left;
    let nearest = 0;
    for (let i = 1; i < pts.length; i += 1) {
      if (Math.abs(pts[i].x - x) < Math.abs(pts[nearest].x - x)) nearest = i;
    }
    if (!shownOnceRef.current) {
      shownOnceRef.current = true;
      setInstant(true);
    }
    setHover(nearest);
  };

  const onLeave = () => {
    setHover(null);
    shownOnceRef.current = false;
  };

  const hv = hover !== null && labels[hover] !== undefined ? hover : null;
  const hx = hv !== null ? targets[0]?.[hv]?.x ?? null : null;
  const hy = hv !== null ? targets[0]?.[hv]?.y ?? null : null;
  const tipShown = hv !== null && hx !== null && hy !== null;
  const tipLeft = hx === null ? 0 : Math.min(Math.max(hx, 54), Math.max(54, width - 54));
  const tipTop = hy === null ? 0 : Math.max(hy - 14, 46);

  const showAllDots = dots && n > 0 && n <= 12;
  const singlePoint = n === 1;
  const anySeries = series.length > 0 && n > 0;

  return (
    <div className={`trend cat-${cat}`}>
      <div
        ref={boxRef}
        className="trend-box"
        style={{ height }}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`趋势图，峰值 ${Math.max(0, ...series.flatMap((s) => s.values))}${unit}`}
        >
          <defs>
            <linearGradient id={`tg-${cat}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={colorAt(0)} stopOpacity="0.18" />
              <stop offset="100%" stopColor={colorAt(0)} stopOpacity="0" />
            </linearGradient>
          </defs>

          <g>
            {ticks.map((t) => (
              <line
                key={`g${t.label}`}
                className="trend-grid"
                x1={PAD.left}
                x2={width - PAD.right}
                y1={t.y}
                y2={t.y}
              />
            ))}
          </g>

          <g className="trend-axis">
            {ticks.map((t) => (
              <text key={`a${t.label}`} x={PAD.left - 10} y={t.y + 3.5} textAnchor="end">
                {t.label}
              </text>
            ))}
            {xLabels.map((l) => (
              <text key={`x${l.i}`} x={targets[0]?.[l.i]?.x ?? 0} y={height - 8} textAnchor="middle">
                {l.label}
              </text>
            ))}
          </g>

          {series.map((s, si) =>
            s.area ? (
              <path
                key={`area-${s.name}`}
                ref={(el) => {
                  areaRefs.current[si] = el;
                }}
                className="trend-area"
                fill={`url(#tg-${cat})`}
              />
            ) : null
          )}

          {series.map((s, si) => (
            <path
              key={`line-${s.name}`}
              ref={(el) => {
                lineRefs.current[si] = el;
              }}
              className={`trend-line${s.dashed ? " is-dashed" : ""}`}
              stroke={colorAt(si)}
            />
          ))}

          {/* 只有一个数据点时折线退化成一段空白：改成一个大点直接标数值 */}
          {!morphing &&
            singlePoint &&
            targets.map((pts, si) => {
              const p = pts[0];
              if (!p) return null;
              return (
                <g key={`sp${si}`}>
                  <circle className="trend-halo" cx={p.x} cy={p.y} r={11} fill={colorAt(si)} />
                  <circle className="trend-dot" cx={p.x} cy={p.y} r={5} fill={colorAt(si)} />
                  <text
                    className="trend-value-label"
                    x={p.x}
                    y={p.y - 15}
                    textAnchor="middle"
                  >
                    {series[si].values[0]}
                    {unit}
                  </text>
                </g>
              );
            })}

          {!morphing && anySeries && !singlePoint && dots && showAllDots && (
            <g>
              {targets.map((pts, si) =>
                pts.map((p, i) => (
                  <circle
                    key={`d${si}-${i}`}
                    className="trend-dot"
                    cx={p.x}
                    cy={p.y}
                    r={3.2}
                    fill={colorAt(si)}
                  />
                ))
              )}
            </g>
          )}

          {!morphing && anySeries && !singlePoint && dots && !showAllDots && (
            <g>
              {targets.map((pts, si) => {
                const last = pts[pts.length - 1];
                if (!last) return null;
                return (
                  <g key={`last${si}`}>
                    <circle className="trend-halo" cx={last.x} cy={last.y} r={9} fill={colorAt(si)} />
                    <circle className="trend-dot" cx={last.x} cy={last.y} r={3.6} fill={colorAt(si)} />
                  </g>
                );
              })}
            </g>
          )}

          {hx !== null && (
            <g>
              <line
                className="trend-cross"
                x1={hx}
                x2={hx}
                y1={PAD.top}
                y2={PAD.top + innerH}
              />
              {targets.map((pts, si) =>
                pts[hv!] ? (
                  <circle
                    key={`f${si}`}
                    className="trend-focus"
                    cx={pts[hv!].x}
                    cy={pts[hv!].y}
                    r={4.2}
                    fill={colorAt(si)}
                  />
                ) : null
              )}
            </g>
          )}
        </svg>

        {tipShown && (
          <div
            className={`trend-tip is-on${instant ? " is-instant" : ""}`}
            style={{ left: tipLeft, top: tipTop }}
          >
            <div className="trend-tip-head">{labels[hv!]}</div>
            {series.map((s, si) => (
              <div className="trend-tip-row" key={`tip-${s.name}`}>
                <i style={{ background: colorAt(si) }} />
                {s.name}
                <b>
                  {s.values[hv!] ?? "—"}
                  {unit}
                </b>
              </div>
            ))}
          </div>
        )}
      </div>

      {series.length > 1 && (
        <div className="trend-legend">
          {series.map((s, si) => (
            <span className="trend-legend-item" key={`lg-${s.name}`}>
              <i style={{ background: colorAt(si) }} />
              {s.name}
              <b>{s.values.reduce((a, b) => a + b, 0)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
