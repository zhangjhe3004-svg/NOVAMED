/**
 * MediCode 全域智慧医疗系统 —— Ant Design 主题配置（员工/患者共用）
 * 基于 UI 设计稿的配色方案
 */
import { theme } from "antd";

export const appTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // UI 设计稿配色
    colorPrimary: "#2563eb", // 主蓝色
    colorSuccess: "#138d85", // 青色
    colorWarning: "#d6a451", // 金色
    colorError: "#ff4d4f",
    colorInfo: "#2563eb",
    colorTextBase: "#1b2b45", // 主要文字颜色
    colorBgBase: "#ffffff",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBgLayout: "#f4f7fb", // 背景色
    colorBorder: "#e6ecf3", // 边框颜色
    colorBorderSecondary: "#f0f3f8",
    fontFamily:
      "Segoe UI, Microsoft YaHei, -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    borderRadius: 14, // 增大圆角
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    boxShadow: "none",
    boxShadowSecondary: "0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)",
    wireframe: false,
  },
  components: {
    Layout: {
      siderBg: "#ffffff",
      headerBg: "#ffffff",
      bodyBg: "#f4f7fb",
      triggerBg: "#ffffff",
      triggerColor: "#1b2b45",
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: "#eaf1ff",
      itemSelectedColor: "#2563eb",
      itemHoverBg: "#f5f8fd",
      itemColor: "#63718a",
      itemBorderRadius: 9,
    },
    Card: {
      borderRadiusLG: 14,
      paddingLG: 24,
      colorBgContainer: "#ffffff",
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
      contentFontSize: 14,
      fontWeight: 500,
      primaryShadow: "0 4px 8px rgba(37, 99, 235, 0.15)",
    },
    Table: {
      // 对齐 scaffold 表格规范：13px 字号、16px 单元格内边距、16px 圆角面板；
      // 视觉层（表头 40px / 行高 48px / 吸右操作列）在 styles/scaffold-tables.css
      headerBg: "#fbfcfd",
      headerColor: "#7e888c",
      headerSplitColor: "transparent",
      rowHoverBg: "#f4f6f8",
      rowSelectedBg: "#eaf2fe",
      rowSelectedHoverBg: "#e1edfd",
      borderColor: "#e6ecf3",
      borderRadius: 16,
      fontSize: 13,
      cellPaddingBlock: 14,
      cellPaddingInline: 16,
    },
    Input: {
      borderRadius: 10,
      activeBorderColor: "#2563eb",
      hoverBorderColor: "#c9d3e0",
      activeShadow: "0 0 0 2px rgba(37, 99, 235, 0.12)",
      colorBgContainer: "#ffffff",
    },
    Select: { borderRadius: 10 },
    Modal: {
      borderRadiusLG: 24,
      colorBgElevated: "#ffffff",
      titleFontSize: 16,
      titleColor: "#1b2b45",
    },
    Tag: { borderRadiusSM: 5 },
    Descriptions: { borderRadiusLG: 14 },
    Tabs: {
      inkBarColor: "#2563eb",
      itemActiveColor: "#2563eb",
      itemSelectedColor: "#2563eb",
    },
  },
};


// 患者端主题 —— 青绿色调（对应 docs/设计预览/patient.html 与 login.html 的患者模式）
export const patientTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#27857d",
    colorSuccess: "#12806b",
    colorWarning: "#d6a451",
    colorError: "#ff4d4f",
    colorInfo: "#27857d",
    colorTextBase: "#243e59",
    colorBgBase: "#ffffff",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBgLayout: "#f4f8f8",
    colorBorder: "#e5eeef",
    colorBorderSecondary: "#eef4f4",
    fontFamily:
      "Segoe UI, Microsoft YaHei, -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    borderRadius: 14,
    borderRadiusLG: 18,
    borderRadiusSM: 8,
    boxShadow: "none",
    boxShadowSecondary: "0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)",
    wireframe: false,
  },
  components: {
    Layout: {
      siderBg: "#ffffff",
      headerBg: "#ffffff",
      bodyBg: "#f4f8f8",
      triggerBg: "#ffffff",
      triggerColor: "#243e59",
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: "#e6f2ef",
      itemSelectedColor: "#27857d",
      itemHoverBg: "#f1f7f6",
      itemColor: "#637d7c",
      itemBorderRadius: 9,
    },
    Card: { borderRadiusLG: 15, paddingLG: 25, colorBgContainer: "#ffffff" },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
      contentFontSize: 14,
      fontWeight: 500,
      primaryShadow: "0 4px 8px rgba(39, 133, 125, 0.15)",
    },
    Table: { headerBg: "#f7fafa", headerColor: "#8497ab", rowHoverBg: "#fbfefe", borderColor: "#eef4f4", borderRadius: 12 },
    Input: { borderRadius: 8, activeBorderColor: "#70bdb4", hoverBorderColor: "#70bdb4", colorBgContainer: "#fcfefe" },
    Select: { borderRadius: 8 },
    Modal: { borderRadiusLG: 17, colorBgElevated: "#ffffff", titleFontSize: 20, titleColor: "#243e59" },
    Tag: { borderRadiusSM: 5 },
    Descriptions: { borderRadiusLG: 14 },
    Tabs: { inkBarColor: "#27857d", itemActiveColor: "#27857d", itemSelectedColor: "#27857d" },
  },
};
