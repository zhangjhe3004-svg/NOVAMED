/**
 * SpecPlate —— 规格铭牌。
 *
 * 深色玻璃小板 + 等宽键值行。刻意「不像可点控件」：只读读数、
 * 没有 hover 抬升，用来放系统的元信息（版本、库、口径、数据截止）。
 */
export interface SpecRow {
  label: string;
  value: string | number | null | undefined;
  tone?: "lime" | "red";
}

export interface SpecPlateProps {
  title?: string;
  rows: SpecRow[];
  className?: string;
}

export default function SpecPlate({ title, rows, className }: SpecPlateProps) {
  return (
    <dl className={`spec-plate${className ? ` ${className}` : ""}`} aria-label={title}>
      {title && <div className="spec-title">{title}</div>}
      {rows.map((r) => (
        <div className="spec-row" key={r.label}>
          <dt>{r.label}</dt>
          <dd className={`tnum${r.tone ? ` is-${r.tone}` : ""}`}>{r.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
