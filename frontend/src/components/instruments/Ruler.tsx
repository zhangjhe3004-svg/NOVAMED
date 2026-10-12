/**
 * Ruler —— 刻度尺。
 *
 * 主刻度用 repeating-linear-gradient 画整条背景，不给几十个 DOM 节点；
 * marker 是 0–1 的当前位置（一根亮刻度 + 可选气泡）。
 * 用于时间轴、进度带、「你今天处在哪一档」这类需要「量感」的读数。
 */
export interface RulerProps {
  labels?: string[];
  /** 0–1，超出会被夹住 */
  marker?: number | null;
  markerLabel?: string;
  /** 主刻度之间再分几格 */
  minor?: number;
  className?: string;
}

export default function Ruler({
  labels = [],
  marker = null,
  markerLabel,
  minor = 4,
  className,
}: RulerProps) {
  const major = Math.max(labels.length - 1, 1);
  const span = Math.max(labels.length - 1, 1);
  const clamped = marker === null ? null : Math.min(Math.max(marker, 0), 1);

  return (
    <div
      className={`ruler${className ? ` ${className}` : ""}`}
      style={{ ["--ruler-major" as string]: major, ["--ruler-minor" as string]: minor }}
      aria-hidden="true"
    >
      <div className="ruler-ticks" />
      <div className="ruler-labels">
        {labels.map((l, i) => (
          <span key={l + i} style={{ left: `${(i / span) * 100}%` }}>
            {l}
          </span>
        ))}
      </div>
      {clamped !== null && (
        <span className="ruler-marker" style={{ left: `${clamped * 100}%` }}>
          {markerLabel && <span className="ruler-marker-label tnum">{markerLabel}</span>}
        </span>
      )}
    </div>
  );
}
