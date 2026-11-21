/**
 * 侧边栏导航配置 —— 主布局、岗位阶梯、角色溯源共用同一份数据源。
 *
 * 为什么要抽出来：角色溯源要按「角色 → 分组 → 菜单」逐层下钻，
 * 用的必须是侧边栏里真实存在的那些菜单（含 adminOnly 分组），
 * 否则溯源出来的权限会和实际看到的界面不一致。
 *
 * cat 是分类色槽（1–5），与图谱舞台的 --graph-1..5 一一对应，
 * 让「阶梯台面 / 刻度表盘 / 桌面包珠」与侧边栏分组同色。
 */
import type { ReactNode } from "react";
import {
  AccountBookOutlined,
  ApartmentOutlined,
  AuditOutlined,
  BookOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  ControlOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EyeOutlined,
  FileTextOutlined,
  FileSearchOutlined,
  HeartOutlined,
  IdcardOutlined,
  LoginOutlined,
  MedicineBoxOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  NotificationOutlined,
  PhoneOutlined,
  PieChartOutlined,
  PartitionOutlined,
  ClusterOutlined,
  RadarChartOutlined,
  RiseOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShareAltOutlined,
  SolutionOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";

export interface NavItem {
  key: string;
  name: string;
  icon: ReactNode;
  /** 站内路由（external 存在时此项仅作 key 用） */
  to: string;
  /** 新标签页打开的独立应用（患者端 SPA） */
  external?: string;
  count?: number | string;
  red?: boolean;
}

export interface NavGroup {
  /** 全称：侧边栏分组标题 */
  label: string;
  /** 短名：顶栏面包屑用 */
  short: string;
  /** 分类色槽 1–5 */
  cat: number;
  /** 仅管理员可见（角色溯源据此判断「管理员专属菜单」） */
  adminOnly?: boolean;
  items: NavItem[];
}

export interface RoleMeta {
  text: string;
  color: string;
  /** 分类色槽 1–5 */
  cat: number;
  /** 该角色默认可进入的分组 short 列表 */
  groups: string[];
}

/** 角色元信息：文案 / 主色 / 分类色槽 / 可见分组 */
export const ROLE_LABELS: Record<string, RoleMeta> = {
  admin: { text: "管理员", color: "#3b82f6", cat: 1, groups: ["工作空间", "诊疗", "日常办公", "智能辅助", "系统管理", "系统监控", "系统工具"] },
  doctor: { text: "医生", color: "#138d85", cat: 2, groups: ["工作空间", "诊疗", "日常办公", "智能辅助"] },
  nurse: { text: "护士", color: "#722ed1", cat: 3, groups: ["工作空间", "诊疗", "日常办公"] },
  pharmacist: { text: "药剂师", color: "#722ed1", cat: 3, groups: ["工作空间", "诊疗", "日常办公"] },
  senior: { text: "高级职称", color: "#c4423e", cat: 4, groups: ["工作空间", "诊疗", "日常办公", "智能辅助"] },
  maintainer: { text: "运维", color: "#3b82f6", cat: 5, groups: ["工作空间", "智能辅助", "系统管理", "系统监控", "系统工具"] },
  staff: { text: "员工", color: "#7d8ba0", cat: 5, groups: ["工作空间", "日常办公"] },
};

export function roleMeta(role?: string | null): RoleMeta {
  return ROLE_LABELS[role || ""] || { text: role || "未知", color: "#7d8ba0", cat: 5, groups: ["工作空间"] };
}

/**
 * 构建侧边栏分组。
 * pendingReview 由主布局按真实待审数注入，其余计数为原型占位。
 */
/**
 * 构建侧边栏分组。
 * pendingReview 由主布局按真实待审数注入，其余计数为原型占位。
 *
 * 分组语义（2026-10-13 按相似功能聚类重排；管理域对齐 scaffold 三目录）：
 * - WORKSPACE 工作空间：全局入口与个人工具（控制台/消息/定时任务/专家市场）
 * - CLINICAL 诊疗：按就诊流程排（号源→档案→工作台→记录→审阅→检验→药房→收费）
 * - OFFICE 日常办公：行政事务（公告/排班/请假）→ 组织架构（科室/画布）→ 协作（互传）
 * - INTELLIGENCE 智能辅助：智能化能力（AI 诊断/知识库/运营数据）
 * - ADMIN 系统管理：对齐 scaffold「用户→角色→菜单→部门→岗位→字典→参数」次序，
 *   扩展项就近插入（患者账号随用户、权限链路随菜单、岗位阶梯随岗位、个人设置收尾）
 * - MONITOR 系统监控：日志审计（操作日志/登录日志，对齐 scaffold /monitor）
 * - TOOL 系统工具：开发工具（代码生成，对齐 scaffold /tool）
 */
/**
 * 侧边栏精简集合（2026-10-15）：这些入口不再常驻侧边栏，但页面与路由全部保留，
 * 仍可从顶栏「快速跳转」下拉与 ⌘K 命令面板进入。
 *
 * 精简原则：一个能力只留一个入口，低频/演示性质入口下沉。
 * - tasks 定时任务：演示页
 * - schedule 排班表：与诊疗·号源排班能力重叠
 * - orgCanvas 组织画布：与日常办公·科室组织重叠（可视化视图）
 * - analytics 运营数据：管理侧分析，低频
 * - patientAccounts 患者账号：患者管理低频，可经快速跳转进入
 * - chain 权限链路：RBAC 深度视图，低频（角色/菜单管理已覆盖日常）
 * - depts 部门管理：与日常办公·科室组织重叠（DB 化新视图）
 * - posts 岗位管理 / ladder 岗位阶梯：同域双入口，保留阶梯？→ 双双下沉，岗位信息可在用户管理看
 * - dict 字典管理 / config 参数配置：配置类低频项
 */
export const SLIM_HIDDEN_KEYS = new Set([
  "tasks",
  "schedule",
  "orgCanvas",
  "analytics",
  "patientAccounts",
  "chain",
  "depts",
  "posts",
  "ladder",
  "dict",
  "config",
]);

/** 侧边栏精简视图：剔除 SLIM_HIDDEN_KEYS 后重新过滤空分组（命令面板/角色溯源仍用全量） */
export function slimSidebarGroups(groups: NavGroup[]): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((it) => !SLIM_HIDDEN_KEYS.has(it.key)) }))
    .filter((g) => g.items.length > 0);
}

export function buildNavGroups(opts: { pendingReview?: number } = {}): NavGroup[] {
  const pending = opts.pendingReview ?? 0;
  return [
    {
      label: "WORKSPACE / 工作空间",
      short: "工作空间",
      cat: 5,
      items: [
        { key: "dashboard", name: "总览控制台", icon: <DashboardOutlined />, to: "/dashboard" },
        { key: "messages", name: "消息", icon: <MessageOutlined />, to: "/messages", count: "3", red: true },
        { key: "tasks", name: "定时任务", icon: <ClockCircleOutlined />, to: "/tasks" },
        { key: "hub", name: "专家·技能·连接器", icon: <RobotOutlined />, to: "/hub" },
      ],
    },
    {
      label: "CLINICAL / 诊疗",
      short: "诊疗",
      cat: 1,
      items: [
        { key: "slots", name: "号源排班", icon: <CalendarOutlined />, to: "/schedule-source" },
        { key: "patients", name: "患者档案", icon: <UserOutlined />, to: "/patients" },
        { key: "workbench", name: "医生工作台", icon: <MedicineBoxOutlined />, to: "/doctor-workbench", count: "08" },
        { key: "records", name: "就诊记录", icon: <FileTextOutlined />, to: "/records" },
        { key: "supervise", name: "下级审阅", icon: <AuditOutlined />, to: "/supervise-records", count: pending, red: true },
        { key: "labTest", name: "检查检验", icon: <EyeOutlined />, to: "/labtest", count: "02", red: true },
        { key: "pharmacy", name: "药房管理", icon: <HeartOutlined />, to: "/pharmacy", count: "18", red: true },
        { key: "billing", name: "财务收费", icon: <AccountBookOutlined />, to: "/billing" },
      ],
    },
    {
      label: "OFFICE / 日常办公",
      short: "日常办公",
      cat: 2,
      items: [
        { key: "announcement", name: "院内公告", icon: <NotificationOutlined />, to: "/lcp/staff-announcement", count: "2" },
        { key: "schedule", name: "排班表", icon: <CalendarOutlined />, to: "/lcp/staff-schedule" },
        { key: "leave", name: "请假审批", icon: <SolutionOutlined />, to: "/lcp/staff-leave", count: "3" },
        { key: "departments", name: "科室组织", icon: <ApartmentOutlined />, to: "/lcp/staff-departments" },
        { key: "orgCanvas", name: "组织画布", icon: <ShareAltOutlined />, to: "/org-canvas" },
        { key: "nearby", name: "附近互传", icon: <RadarChartOutlined />, to: "/nearby" },
      ],
    },
    {
      label: "INTELLIGENCE / 智能辅助",
      short: "智能辅助",
      cat: 3,
      items: [
        { key: "ai", name: "AI 辅助诊断", icon: <ThunderboltOutlined />, to: "/ai-assistant" },
        { key: "knowledge", name: "医学知识库", icon: <BookOutlined />, to: "/knowledge" },
        { key: "analytics", name: "运营数据", icon: <PieChartOutlined />, to: "/analytics" },
      ],
    },
    {
      label: "ADMIN / 系统管理",
      short: "系统管理",
      cat: 4,
      adminOnly: true,
      items: [
        { key: "adminReview", name: "管理员审核", icon: <SafetyCertificateOutlined />, to: "/admin-review", count: "5" },
        { key: "users", name: "用户管理", icon: <TeamOutlined />, to: "/users" },
        { key: "patientAccounts", name: "患者账号", icon: <PhoneOutlined />, to: "/patient-accounts" },
        { key: "trace", name: "角色管理", icon: <PartitionOutlined />, to: "/role-trace" },
        { key: "menuStar", name: "菜单管理", icon: <ClusterOutlined />, to: "/menu-star" },
        { key: "chain", name: "权限链路", icon: <NodeIndexOutlined />, to: "/permission-chain" },
        { key: "depts", name: "部门管理", icon: <ApartmentOutlined />, to: "/depts" },
        { key: "posts", name: "岗位管理", icon: <IdcardOutlined />, to: "/posts" },
        { key: "ladder", name: "岗位阶梯", icon: <RiseOutlined />, to: "/post-ladder" },
        { key: "dict", name: "字典管理", icon: <DatabaseOutlined />, to: "/dicts" },
        { key: "config", name: "参数配置", icon: <ControlOutlined />, to: "/configs" },
        { key: "settings", name: "个人设置", icon: <SettingOutlined />, to: "/settings" },
      ],
    },
    {
      label: "MONITOR / 系统监控",
      short: "系统监控",
      cat: 4,
      adminOnly: true,
      items: [
        { key: "operLog", name: "操作日志", icon: <FileSearchOutlined />, to: "/oper-log" },
        { key: "loginLog", name: "登录日志", icon: <LoginOutlined />, to: "/login-log" },
      ],
    },
    {
      label: "TOOL / 系统工具",
      short: "系统工具",
      cat: 4,
      adminOnly: true,
      items: [
        { key: "gen", name: "代码生成", icon: <CodeOutlined />, to: "/generator" },
      ],
    },
  ];
}

/** 与主布局一致：非管理员隐藏 adminOnly 分组 */
export function visibleNavGroups(groups: NavGroup[], role?: string | null): NavGroup[] {
  const isAdmin = role === "admin";
  return groups.filter((g) => !g.adminOnly || isAdmin);
}

/** 账号旁显示的岗位名称：优先取 1–9 级数字身份名 */
export const LEVEL_NAMES: Record<number, string> = {
  1: "一级·访客",
  2: "二级·普通员工",
  3: "三级·专员",
  4: "四级·高级专员",
  5: "五级·主管",
  6: "六级·经理",
  7: "七级·总监",
  8: "八级·院领导",
  9: "九级·超级管理员",
};

export const LEVEL_DESCS: Record<number, string> = {
  1: "仅可查看公告与本人提交的工单",
  2: "查看本科室基础数据",
  3: "读写本科室业务数据",
  4: "跨科室只读协作",
  5: "管理本组下级并审批",
  6: "管理科室数据与人员",
  7: "全院数据分析",
  8: "全院数据读写与策略",
  9: "系统全权限与安全审计",
};

export const LEVELS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function levelName(level: number): string {
  return LEVEL_NAMES[level] || `${level} 级`;
}

export function levelDesc(level: number): string {
  return LEVEL_DESCS[level] || "";
}
