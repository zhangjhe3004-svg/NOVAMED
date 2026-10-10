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
      headerBg: "#f9fbfd",
      headerColor: "#8b98aa",
      rowHoverBg: "#fcfdff",
      borderColor: "#f1f4f8",
      borderRadius: 12,
    },
    Input: {
      borderRadius: 8,
      activeBorderColor: "#83a8ee",
      hoverBorderColor: "#83a8ee",
      colorBgContainer: "#fcfdff",
    },
    Select: { borderRadius: 8 },
    Modal: {
      borderRadiusLG: 17,
      colorBgElevated: "#ffffff",
      titleFontSize: 20,
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
