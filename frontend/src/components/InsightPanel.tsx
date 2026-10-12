/**
 * InsightPanel —— 溯源右侧的实体信息卡。
 *
 * 只负责「把已经算好的结论摆出来」：标题 + 关键指标 + 若干分组行 + 操作。
 * 动画只用一次入场级联（结 Crystallize），内容变化时做落定确认（settlePop），
 * 不做事后脉冲，避免在长时间停留的页面上持续抢注意力。
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Button, Empty } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { revealCascade, settlePop } from "../utils/motion";

export interface InsightRow {
  key: string | number;
  name: string;
  meta?: string;
  badge?: string;
  /** 分类色槽 1–5 */
  cat?: number;
  tone?: "off" | "warn" | "ok";
  onClick?: () => void;
}

export interface InsightSection {
  title: string;
  hint?: string;
  rows: InsightRow[];
  empty?: string;
  /** 行以胶囊 chips 排列（角色 / 分组这类短标签） */
  chips?: boolean;
}

export interface InsightPanelProps {
  title: string;
  sub?: string;
  cat?: number;
  stats?: Array<{ label: string; value: ReactNode }>;
  sections?: InsightSection[];
  note?: string;
  actions?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export default function InsightPanel({
  title,
  sub,
  cat,
  stats,
  sections = [],
  note,
  actions,
  onClose,
  className,
}: InsightPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      revealCascade(el, ":scope > *", 70);
    } else {
      settlePop(el);
    }
  }, [title, sub]);

  return (
    <div ref={ref} className={["insight", className ?? ""].filter(Boolean).join(" ")}>
      <div className="insight-head">
        <span className={`insight-swatch cat-${cat ?? 0}`} aria-hidden="true" />
        <div className="insight-title">
          <b>{title}</b>
          {sub && <small>{sub}</small>}
        </div>
        {onClose && (
          <Button
            type="text"
            size="small"
            aria-label="关闭信息卡"
            icon={<CloseOutlined />}
            onClick={onClose}
          />
        )}
      </div>

      {stats && stats.length > 0 && (
        <div className="insight-stats">
          {stats.map((s) => (
            <div className="insight-stat" key={s.label}>
              <span className="tnum">{s.value}</span>
              <small>{s.label}</small>
            </div>
          ))}
        </div>
      )}

      {sections.map((sec) => (
        <div className="insight-section" key={sec.title}>
          <div className="insight-section-head">
            <span>{sec.title}</span>
            {sec.hint && <small>{sec.hint}</small>}
          </div>
          {sec.rows.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={sec.empty || "暂无"}
              style={{ margin: "6px 0", padding: 0 }}
            />
          ) : sec.chips ? (
            <div className="insight-chips">
              {sec.rows.map((r) => (
                <span
                  key={r.key}
                  className={[
                    "insight-chip",
                    r.cat ? `cat-${r.cat}` : "",
                    r.tone ? `is-${r.tone}` : "",
                    r.onClick ? "is-clickable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  role={r.onClick ? "button" : undefined}
                  tabIndex={r.onClick ? 0 : undefined}
                  title={r.meta}
                  onClick={r.onClick}
                  onKeyDown={(e) => {
                    if (r.onClick && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      r.onClick();
                    }
                  }}
                >
                  {r.name}
                  {r.badge && <em>{r.badge}</em>}
                </span>
              ))}
            </div>
          ) : (
            <ul className="insight-rows">
              {sec.rows.map((r) => (
                <li
                  key={r.key}
                  className={[
                    "insight-row",
                    r.cat ? `cat-${r.cat}` : "",
                    r.tone ? `is-${r.tone}` : "",
                    r.onClick ? "is-clickable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  role={r.onClick ? "button" : undefined}
                  tabIndex={r.onClick ? 0 : undefined}
                  onClick={r.onClick}
                  onKeyDown={(e) => {
                    if (r.onClick && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      r.onClick();
                    }
                  }}
                >
                  <i aria-hidden="true" />
                  <span className="insight-row-name">{r.name}</span>
                  {r.meta && <small>{r.meta}</small>}
                  {r.badge && <em className="tnum">{r.badge}</em>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {note && <p className="insight-note">{note}</p>}

      {actions && <div className="insight-actions">{actions}</div>}
    </div>
  );
}
