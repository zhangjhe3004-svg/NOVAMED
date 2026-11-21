/**
 * InsightPanel —— 溯源右侧的实体信息卡。
 *
 * 只负责「把已经算好的结论摆出来」：标题 + 关键指标 + 若干分组行 + 操作。
 * 动画只用一次入场级联（结 Crystallize），内容变化时做落定确认（settlePop），
 * 不做事后脉冲，避免在长时间停留的页面上持续抢注意力。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Empty } from "antd";
import { CheckOutlined, CloseOutlined, LoadingOutlined, LockOutlined } from "@ant-design/icons";
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

/** 详情卡内直接编辑授权：胶囊可点选授予 / 取消（内置角色只读） */
export interface InsightGrantRole {
  id: number;
  name: string;
  code: string;
  granted: boolean;
  builtin?: boolean;
  userCount?: number;
}

export interface InsightPanelProps {
  title: string;
  sub?: string;
  cat?: number;
  /** 实体类型名（如「角色 / 用户 / 页面」），显示在标题上方 */
  kind?: string;
  /** 实体类型图标（title 左侧） */
  kindIcon?: ReactNode;
  status?: string;
  stats?: Array<{ label: string; value: ReactNode }>;
  /** 三格小读数（对齐 scaffold InsightTile） */
  tiles?: Array<{ label: string; value: ReactNode }>;
  /** 洞察卡（对齐 scaffold InsightCard：tone 色 + 标题 + 说明） */
  insights?: Array<{ tone: "info" | "warn" | "danger" | "ok"; title: string; text: string }>;
  sections?: InsightSection[];
  /** 授权编辑区：传入即可在卡内直接授予 / 取消角色 */
  grant?: {
    roles: InsightGrantRole[];
    onToggle: (roleId: number, granted: boolean) => Promise<void>;
    disabled?: boolean;
  };
  note?: string;
  actions?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export default function InsightPanel({
  title,
  sub,
  cat,
  kind,
  kindIcon,
  status,
  stats,
  tiles,
  insights,
  sections = [],
  grant,
  note,
  actions,
  onClose,
  className,
}: InsightPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const first = useRef(true);
  const [grantPending, setGrantPending] = useState<number | null>(null);

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
          {kind && (
            <small style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--lv-soft)", fontSize: 11 }}>
              {kindIcon}
              {kind}
            </small>
          )}
          <b>{title}</b>
          {sub && <small>{sub}</small>}
          {status && <small style={{ color: "var(--lv-faint)" }}>{status}</small>}
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

      {(stats || tiles) && (stats?.length ?? 0) + (tiles?.length ?? 0) > 0 && (
        <div className="insight-stats">
          {[...(stats ?? []), ...(tiles ?? [])].map((s, i) => (
            <div className="insight-stat" key={`${s.label}-${i}`}>
              <span className="tnum">{s.value}</span>
              <small>{s.label}</small>
            </div>
          ))}
        </div>
      )}

      {insights && insights.length > 0 && (
        <div className="insight-cards">
          {insights.map((c, i) => (
            <div className={`insight-card is-${c.tone}`} key={`${c.title}-${i}`}>
              <b>{c.title}</b>
              <p>{c.text}</p>
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

      {grant && grant.roles.length > 0 && (
        <div className="insight-section">
          <div className="insight-section-head">
            <span>授予角色</span>
            <small>{grant.disabled ? "需管理员账号可修改授权" : "点击胶囊直接授予 / 取消"}</small>
          </div>
          <div className="insight-chips">
            {grant.roles.map((r) => {
              const locked = Boolean(r.builtin) || grant.disabled;
              const pending = grantPending === r.id;
              return (
                <span
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  title={
                    r.builtin
                      ? "内置角色拥有全部权限，授权不可修改"
                      : `${r.code}${r.userCount !== undefined ? ` · ${r.userCount} 人持有` : ""}`
                  }
                  aria-pressed={r.granted}
                  className="insight-chip is-clickable"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    border: r.granted ? "1px solid var(--lv-blue)" : "1px solid var(--lv-line)",
                    background: r.granted ? "var(--lv-blue-soft)" : "#fff",
                    color: r.builtin ? "var(--lv-faint)" : r.granted ? "var(--lv-blue)" : "var(--lv-muted)",
                    fontWeight: r.granted ? 650 : 500,
                    cursor: locked || pending ? "default" : "pointer",
                    opacity: locked ? 0.75 : 1,
                  }}
                  onClick={() => {
                    if (locked || pending || !grant.onToggle) return;
                    if (r.builtin) return;
                    setGrantPending(r.id);
                    grant
                      .onToggle(r.id, !r.granted)
                      .catch(() => {})
                      .finally(() => setGrantPending(null));
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !locked && !pending) {
                      e.preventDefault();
                      setGrantPending(r.id);
                      grant
                        .onToggle(r.id, !r.granted)
                        .catch(() => {})
                        .finally(() => setGrantPending(null));
                    }
                  }}
                >
                  {pending ? <LoadingOutlined style={{ fontSize: 11 }} /> : r.granted ? <CheckOutlined style={{ fontSize: 11 }} /> : r.builtin ? <LockOutlined style={{ fontSize: 11 }} /> : null}
                  {r.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {note && <p className="insight-note">{note}</p>}

      {actions && <div className="insight-actions">{actions}</div>}
    </div>
  );
}
