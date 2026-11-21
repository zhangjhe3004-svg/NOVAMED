/**
 * AI 供应商矢量图标 —— 统一使用 @lobehub/icons 品牌矢量 logo
 *
 * 图标为单色 SVG（fill="currentColor"），颜色由外层 `color` 控制，
 * 因此天然跟随各供应商的品牌色 tint，替换原先的 emoji 占位。
 *
 * 图标映射表集中维护在 config/aiProviders.tsx（全站唯一数据源），
 * 本组件仅做兜底与渲染。自研 WorkBuddy 云端无独立品牌图标，
 * 用 NOVAMED 矢量信号标（lime 品牌色）兜底；github 为非 AI 供应商，
 * 保留映射用于代码生成等场景。
 */
import type { CSSProperties, ComponentType } from "react";
import { Github } from "@lobehub/icons";
import BrandMark from "./BrandMark";
import { getProviderIcon, type IconCompProps } from "../config/aiProviders";

const EXTRA_ICONS: Record<string, ComponentType<IconCompProps>> = {
  github: Github,
};

export interface ProviderIconProps {
  provider: string;
  size?: number;
  style?: CSSProperties;
}

export default function ProviderIcon({ provider, size = 20, style }: ProviderIconProps) {
  if (provider === "workbuddy") {
    return <BrandMark size={size} accent="#82dd2d" shadow={false} />;
  }
  const key = (provider || "").toLowerCase();
  const C = getProviderIcon(key) || EXTRA_ICONS[key];
  if (!C) return null;
  return <C size={size} style={style} />;
}
