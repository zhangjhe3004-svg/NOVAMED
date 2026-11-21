/**
 * Swimlane —— 时间轴泳道（复刻 scaffold Swimlane：横向时间轴 + 按账号分泳道）。
 *
 * 每条泳道 = 一个账号（或任意分组），横向为时间轴，事件以圆点落在对应时间位置。
 * 悬停圆点弹出读数卡（动作 / 资源 / 时间）。纯 SVG 自绘，无图表库，颜色取 lv-* 令牌。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface SwimEvent {
  /** 毫秒时间戳，用于在 [start, end] 区间内定位 */
  time: number;
  /** 圆点颜色（缺省用 --lv-blue） */
  color?: string;
  /** 读数卡主标题（如动作） */
  title?: string;
  /** 读数卡副标题（如资源 · 时间） */
  sub?: string;
}

export interface SwimLane {
  label: string;
  events: SwimEvent[];
}

export interface SwimlaneProps {
  lanes: SwimLane[];
  /** 时间轴起点（毫秒时间戳） */
  start: number;
  /** 时间轴终点（毫秒时间戳） */
  end: number;
  /** 底部时间刻度标签（按 time 定位），缺省按 0 / 1/4 / 2/4 / 3/4 / 1 五等分生成 */
  ticks?: { time: number; label: string }[];
  height?: number;
}

const PAD = { top: 14, right: 12, bottom: 26, left: 116 };
const LANE_H = 44;
const DOT_R = 4.2;

export default function Swimlane({ lanes, start, end, ticks, height }: SwimlaneProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<{ lane: number; ev: number } | null>(null);
  const laneH = height && height > 0 ? height : LANE_H;

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const w = Math.round(el.clientWidth);
    if (w > 0) setWidth(w);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = lanes.length * laneH;
  const h = PAD.top + PAD.bottom + innerH;

  const span = Math.max(1, end - start);
  const xAt = (time: number) => PAD.left + Math.max(0, Math.min(1, (time - start) / span)) * innerW;
  const yAt = (lane: number) => PAD.top + lane * laneH + laneH / 2;

  const defaultTicks = useMemo(() => {
    if (ticks && ticks.length) return ticks;
    return [0, 0.25, 0.5, 0.75, 1].map((p) => ({
      time: start + span * p,
      label: new Date(start + span * p).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    }));
  }, [ticks, start, span]);

  const hoveredEv = hover !== null ? lanes[hover.lane]?.events[hover.ev] : null;

  return (
    <div className="swimlane" ref={boxRef} style={{ position: "relative" }}>
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${width} ${h}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="操作时间轴泳道"
        onPointerLeave={() => setHover(null)}
      >
        {/* 泳道底纹：隔行浅底 */}
        {lanes.map((_, i) =>
          i % 2 === 1 ? (
            <rect
              key={`bg-${i}`}
              x={PAD.left}
              y={PAD.top + i * laneH}
              width={innerW}
              height={laneH}
              fill="var(--lv-hover-bg, rgba(46,58,62,0.03))"
            />
          ) : null
        )}

        {/* 泳道标签 + 基线 */}
        {lanes.map((lane, i) => {
          const y = yAt(i);
          return (
            <g key={`lane-${i}`}>
              <text
                x={PAD.left - 12}
                y={y + 3.5}
                textAnchor="end"
                className="swimlane-label"
                fill="var(--lv-ink)"
                fontSize={12.5}
                fontWeight={600}
              >
                {lane.label}
              </text>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--lv-line, rgba(46,58,62,0.085))"
                strokeWidth={1}
              />
            </g>
          );
        })}

        {/* 事件圆点 */}
        {lanes.map((lane, i) =>
          lane.events.map((ev, j) => {
            const x = xAt(ev.time);
            const y = yAt(i);
            const isHover = hover?.lane === i && hover?.ev === j;
            return (
              <circle
                key={`e-${i}-${j}`}
                cx={x}
                cy={y}
                r={isHover ? DOT_R + 1.4 : DOT_R}
                fill={ev.color || "var(--lv-blue, #236de9)"}
                stroke="var(--lv-surface-solid, #fff)"
                strokeWidth={1.4}
                style={{ cursor: "pointer" }}
                onPointerEnter={() => setHover({ lane: i, ev: j })}
              />
            );
          })
        )}

        {/* 时间轴刻度 */}
        {defaultTicks.map((t, i) => (
          <g key={`t-${i}`}>
            <line
              x1={xAt(t.time)}
              x2={xAt(t.time)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--lv-line, rgba(46,58,62,0.085))"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text
              x={xAt(t.time)}
              y={h - 8}
              textAnchor="middle"
              fontSize={11}
              fill="var(--lv-muted, #596368)"
            >
              {t.label}
            </text>
          </g>
        ))}
      </svg>

      {/* 读数卡 */}
      {hoveredEv && hover && (
        <div
          className="swimlane-tip"
          style={{
            left: Math.min(Math.max(xAt(hoveredEv.time), 60), Math.max(60, width - 60)),
            top: yAt(hover.lane) - 46,
          }}
        >
          <div className="swimlane-tip-title">{hoveredEv.title || lanes[hover.lane].label}</div>
          {hoveredEv.sub && <div className="swimlane-tip-sub">{hoveredEv.sub}</div>}
        </div>
      )}
    </div>
  );
}
