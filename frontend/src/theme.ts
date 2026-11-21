/**
 * NOVAMED 全域智慧医疗系统 —— Ant Design 主题配置（员工/患者共用）
 * 深色沉浸式霓虹（motionpedia 3d.html）：深宇宙底 + 电光紫青霓虹
 * 患者端保留青绿主色（.patient-app 作用域覆盖），其余深色语义与员工端一致。
 */
import { theme } from "antd";

const darkTokens = (primary: string) => ({
  colorPrimary: primary,
  colorSuccess: "#34d399", // emerald-400
  colorWarning: "#fbbf24", // amber-400
  colorError: "#f87171",   // red-400
  colorInfo: "#38bdf8",    // cyan-400
  colorTextBase: "#eaf1fb", // 浅紫白正文
  colorBgBase: "#0a0a12",   // 深宇宙底
  colorBgContainer: "#1a2740", // 深面板
  colorBgElevated: "#1a2740",
  colorBgLayout: "#0a0a12",
  colorBorder: "rgba(59, 130, 246, 0.24)",
  colorBorderSecondary: "rgba(59, 130, 246, 0.14)",
  colorText: "#eaf1fb",
  colorTextSecondary: "#9a9ab0",
  colorTextTertiary: "#7c7c96",
  fontFamily:
    "'Inter', 'Noto Sans SC', 'PingFang SC', 'Source Han Sans SC', system-ui, -apple-system, sans-serif",
  fontSize: 14,
  borderRadius: 10,
  borderRadiusLG: 12,
  borderRadiusSM: 8,
  boxShadow: "none",
  boxShadowSecondary: "0 1px 2px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)",
  wireframe: false,
});

const darkComponents = (primary: string) => ({
  Layout: {
    siderBg: "rgba(10, 10, 18, 0.9)",
    headerBg: "rgba(10, 10, 18, 0.85)",
    bodyBg: "transparent",
    triggerBg: "rgba(10, 10, 18, 0.9)",
    triggerColor: "#9a9ab0",
  },
  Menu: {
    itemBg: "transparent",
    itemSelectedBg: "rgba(59, 130, 246, 0.16)",
    itemSelectedColor: "#60a5fa",
    itemHoverBg: "#101b2e",
    itemColor: "#9a9ab0",
    itemBorderRadius: 8,
  },
  Card: { borderRadiusLG: 12, paddingLG: 22, colorBgContainer: "#1a2740" },
  Button: {
    borderRadius: 8,
    controlHeight: 36,
    contentFontSize: 14,
    fontWeight: 500,
    primaryShadow: "0 0 12px rgba(59, 130, 246, 0.35)",
  },
  Table: {
    headerBg: "#101b2e",
    headerColor: "#9a9ab0",
    headerSplitColor: "rgba(59, 130, 246, 0.14)",
    rowHoverBg: "#101b2e",
    rowSelectedBg: "rgba(59, 130, 246, 0.14)",
    rowSelectedHoverBg: "rgba(59, 130, 246, 0.2)",
    borderColor: "rgba(59, 130, 246, 0.14)",
    borderRadius: 14,
    fontSize: 13,
    cellPaddingBlock: 14,
    cellPaddingInline: 16,
  },
  Input: {
    borderRadius: 8,
    activeBorderColor: primary,
    hoverBorderColor: "#60a5fa",
    activeShadow: "0 0 0 2px rgba(59, 130, 246, 0.2)",
    colorBgContainer: "#101b2e",
  },
  Select: { borderRadius: 8 },
  Modal: {
    borderRadiusLG: 12,
    colorBgElevated: "#1a2740",
    titleFontSize: 16,
    titleColor: "#eaf1fb",
  },
  Tag: { borderRadiusSM: 6 },
  Descriptions: { borderRadiusLG: 12 },
  Tabs: {
    inkBarColor: primary,
    itemActiveColor: "#60a5fa",
    itemSelectedColor: "#60a5fa",
  },
});

export const appTheme = {
  algorithm: theme.darkAlgorithm,
  token: darkTokens("#3b82f6"),
  components: darkComponents("#3b82f6"),
};

// 患者端主题 —— Soft Utility 柔和工具风「深色版」：深青灰分层底（非纯黑），
// 薄荷青主行动色，状态色薄荷/杏/蓝，与员工端纯黑深宇宙明确区分
export const patientTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#5fd0b4",
    colorSuccess: "#5fd0b4",
    colorWarning: "#e3b45f",
    colorError: "#e0857a",
    colorInfo: "#8aa7dd",
    colorTextBase: "#e6f0ed",
    colorBgBase: "#16201f",
    colorBgContainer: "#1e2b29",
    colorBgElevated: "#243330",
    colorBgLayout: "#16201f",
    colorBorder: "rgba(169, 216, 204, 0.18)",
    colorBorderSecondary: "rgba(169, 216, 204, 0.10)",
    colorText: "#e6f0ed",
    colorTextSecondary: "#a5bab5",
    colorTextTertiary: "#7d9791",
    fontFamily:
      "'Inter', 'Noto Sans SC', 'PingFang SC', 'Source Han Sans SC', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    wireframe: false,
  },
  components: {
    Layout: {
      siderBg: "#1e2b29",
      headerBg: "#1e2b29",
      bodyBg: "#16201f",
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: "rgba(95, 208, 180, 0.16)",
      itemSelectedColor: "#5fd0b4",
      itemHoverBg: "rgba(169, 216, 204, 0.08)",
      itemColor: "#a5bab5",
      itemBorderRadius: 10,
    },
    Card: { borderRadiusLG: 14, paddingLG: 22, colorBgContainer: "#1e2b29" },
    Button: { borderRadius: 10, controlHeight: 36, fontWeight: 500, primaryShadow: "0 1px 3px rgba(0,0,0,0.3)" },
    Table: {
      headerBg: "#243330",
      headerColor: "#a5bab5",
      headerSplitColor: "transparent",
      rowHoverBg: "#1e2b29",
      rowSelectedBg: "rgba(95, 208, 180, 0.14)",
      rowSelectedHoverBg: "rgba(95, 208, 180, 0.22)",
      borderColor: "rgba(169, 216, 204, 0.10)",
      borderRadius: 12,
      fontSize: 13,
      cellPaddingBlock: 13,
      cellPaddingInline: 15,
    },
    Input: { borderRadius: 10, activeBorderColor: "#5fd0b4", hoverBorderColor: "#7fdbc3", activeShadow: "0 0 0 2px rgba(95, 208, 180, 0.22)" },
    Select: { borderRadius: 10 },
    Modal: { borderRadiusLG: 16, titleFontSize: 16, titleColor: "#e6f0ed", colorBgElevated: "#243330" },
    Drawer: { borderRadiusLG: 0 },
    Tag: { borderRadiusSM: 6 },
    Tabs: { inkBarColor: "#5fd0b4", itemSelectedColor: "#5fd0b4", itemActiveColor: "#5fd0b4" },
  },
};
