/**
 * DeltaPill —— 环比胶囊。
 *
 * 只在「与上一周期可比较」时才给百分比；上一周期为 0（fresh）时显示
 * 「新增」中性态，不给出会被误读的 +100%。
 *
 * invert：某些指标「涨了才是坏事」（如待审积压、超时数），此时语气反转
 * （涨=红、跌=青柠）。
 */
export interface DeltaPillProps {
  /** 环比百分比数值，如 12.4 表示 +12.4% */
  value: number | null | undefined;
  /** 显式指定方向；不传则按 value 正负判断 */
  up?: boolean | null;
  /** 上一周期为 0，显示「新增」 */
  fresh?: boolean;
  suffix?: string;
  /** 语气反转（涨为坏） */
  invert?: boolean;
  /** 无障碍/悬停说明 */
  label?: string;
}

export default function DeltaPill({
  value,
  up = null,
  fresh = false,
  suffix = "%",
  invert = false,
  label,
}: DeltaPillProps) {
  const dir: "up" | "down" | "flat" | "new" = fresh
    ? "new"
    : (() => {
        const v = Number(value ?? 0);
        if (!v || Number.isNaN(v)) return "flat";
        if (up === null) return v > 0 ? "up" : "down";
        return up ? "up" : "down";
      })();

  const text = fresh
    ? "新增"
    : (() => {
        const v = Math.abs(Number(value ?? 0));
        const sign = dir === "up" ? "+" : dir === "down" ? "−" : "±";
        return `${sign}${Number.isInteger(v) ? v : v.toFixed(1)}${suffix}`;
      })();

  return (
    <span
      className={`delta-pill is-${dir}${invert && (dir === "up" || dir === "down") ? " is-invert" : ""}`}
      title={label}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
        {dir === "up" && <path d="M4 1.2 7 6H1z" fill="currentColor" />}
        {dir === "down" && <path d="M4 6.8 1 2h6z" fill="currentColor" />}
        {dir === "new" && <circle cx="4" cy="4" r="2.2" fill="currentColor" />}
        {dir === "flat" && <rect x="1" y="3.3" width="6" height="1.4" rx=".7" fill="currentColor" />}
      </svg>
      <span className="tnum">{text}</span>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
