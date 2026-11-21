/**
 * SwiftUI 风格共享主题 —— iOS 原生视觉语言
 *
 * 设计基准：Apple Human Interface Guidelines
 * - 系统蓝 #007AFF、系统绿 #34C759、系统红 #FF3B30、系统橙 #FF9500
 * - 分组列表底色 #F2F2F7，卡片纯白，柔和弥散阴影
 * - SF 字体体系（iOS 默认 San Francisco，Android 回退系统字体）
 * - 大标题（Large Title）导航、Inset Grouped 列表、胶囊控件
 */

export const colors = {
  // 品牌色（对齐 Web 客户端 Corporate Clean 蓝白体系）
  primary: "#2563eb",        // 品牌蓝（blue-600，员工端主色）
  primaryDark: "#1d4ed8",    // blue-700（深蓝强调）
  primaryLight: "#EFF6FF",   // blue-50 浅底
  brandNavy: "#142d53",      // 员工端登录深海军蓝
  brandTeal: "#27857d",      // 患者端主青绿（患者客户端同源）
  brandTealBg: "#194e50",    // 患者端登录深青
  teal: "#27857d",           // 患者端青绿（原系统绿位置，患者屏使用）
  tealLight: "#E6F2F0",
  purple: "#AF52DE",         // 系统紫
  warning: "#FF9500",        // 系统橙（警示）
  danger: "#FF3B30",         // 系统红
  dangerLight: "#FFECEB",
  success: "#34C759",
  successLight: "#E8F8ED",

  // 中性色（Apple 风格灰阶体系）
  text: "#1d1d1f",           // 一级文字（近黑）
  textSecondary: "#6e6e73",  // 二级文字（Apple 灰）
  textMuted: "#86868b",      // 三级文字（弱化灰）
  border: "#d2d2d7",         // 分隔线
  separator: "#e8e8ed",      // 列表分隔（更浅）
  background: "#f5f5f7",     // Apple 灰背景
  groupedBackground: "#FFFFFF", // 分组内容底
  card: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  xxl: 22,
  pill: 999,
};

/** Apple 风格微妙阴影（克制、低透明度） */
export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  floating: {
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
};

/** Apple 风格按压阻尼（Haptic Touch 的视觉近似：active scale 0.98） */
export const press = {
  scale: 0.98,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 22,
  title: 28,     // 二级标题
  largeTitle: 34, // SwiftUI Large Title
};

/** iOS 系统字体权重映射（RN fontWeight 数值） */
export const font = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  heavy: "800" as const,
};
