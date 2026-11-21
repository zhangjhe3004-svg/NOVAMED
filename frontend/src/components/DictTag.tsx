/**
 * 字典标签胶囊 —— 按 tone 渲染（对齐 scaffold Tag.vue：四色语义 + 圆点）。
 * tone 就近归档：purple/warn 等历史色值映射到四色。
 */
import type { ReactNode } from "react";

const TONE_MAP: Record<string, string> = {
  ok: "leaf", success: "leaf",
  primary: "info", info: "info", purple: "info",
  danger: "red", error: "red", warn: "red", warning: "red",
  neutral: "neutral", default: "neutral",
};

export function toneClass(tone?: string): string {
  return TONE_MAP[tone ?? "neutral"] ?? "neutral";
}

export default function DictTag({
  tone,
  dot = true,
  isOff,
  children,
}: {
  tone?: string;
  dot?: boolean;
  isOff?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`lv-tag lv-tag--${toneClass(tone)}${isOff ? " dict-tag is-off" : ""}`}>
      {dot && <span className="lv-tag-dot" />}
      {children}
    </span>
  );
}
