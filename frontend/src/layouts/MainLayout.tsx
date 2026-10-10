/**
 * 主布局 — 基于 UI 设计稿的侧边栏设计
 * 232px 侧边栏，白色背景，简洁品牌展示
 */
import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Layout,
  Menu,
  Button,
  Dropdown,
  Avatar,
  Typography,
  Space,
  message,
  Input,
  Popover,
  Badge,
  List,
  Empty,
} from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  IdcardOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  SettingOutlined,
  BookOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  MedicineBoxOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AppstoreOutlined,
  ToolOutlined,
  ApiOutlined,
  MessageOutlined,
  FundOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  PlusOutlined,
  CalendarOutlined,
  AuditOutlined,
  NotificationOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import { useAuth } from "../stores/auth";
import { listNotifications, markRead } from "../api/notifications";
import type { NotificationItem } from "../api/notifications";
import { getPendingReviewCount } from "../api/records";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// 侧边栏菜单按「诊断流程」顺序构建（见组件内 menuItems）

const roleLabels: Record<string, { text: string; color: string }> = {
  admin: { text: "管理员", color: "#2563eb" },
  doctor: { text: "医生", color: "#138d85" },
  pharmacist: { text: "药剂师", color: "#722ed1" },
  maintainer: { text: "运维", color: "#d6a451" },
};

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // 通知
  const [notifItems, setNotifItems] = useState<NotificationItem[]>([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingReview, setPendingReview] = useState(0);

  const loadNotif = async () => {
    try {
      const r = await listNotifications();
      setNotifItems(r.items || []);
      setNotifUnread(r.unread || 0);
    } catch {
      // 忽略
    }
  };
  useEffect(() => { loadNotif(); }, []);
  useEffect(() => {
    if (user?.role === "admin") {
      getPendingReviewCount().then(setPendingReview).catch(() => {});
    }
  }, [user?.role]);

  const isAdmin = user?.role === "admin";

  // 侧边栏（按角色精简 + 重新分组）：控制台 / 诊疗 / 员工 / 知识库 / 管理(仅管理员)
  const menuItems: any[] = [
    { key: "/dashboard", icon: <DashboardOutlined />, label: "总览控制台" },
    {
      key: "medical", icon: <MedicineBoxOutlined />, label: "诊疗",
      children: [
        { key: "/patients", icon: <UserOutlined />, label: "患者管理" },
        { key: "/patient-accounts", icon: <IdcardOutlined />, label: "患者档案" },
        { key: "/lcp/medical-records", icon: <FileTextOutlined />, label: "就诊记录" },
        { key: "/ai-assistant", icon: <ExperimentOutlined />, label: "AI 诊断" },
        { key: "/doctor-workbench", icon: <MedicineBoxOutlined />, label: "医生工作台" },
        { key: "/supervise-records", icon: <AuditOutlined />, label: "下级审阅" },
      ],
    },
    {
      key: "staff", icon: <TeamOutlined />, label: "员工",
      children: [
        { key: "/staff", icon: <TeamOutlined />, label: "员工办公" },
        { key: "/messages", icon: <MessageOutlined />, label: "消息" },
        { key: "staff-divider", type: "divider" },
        { key: "/lcp/staff-announcement", icon: <NotificationOutlined />, label: "院内公告（独立页）" },
        { key: "/lcp/staff-schedule", icon: <CalendarOutlined />, label: "排班表（独立页）" },
        { key: "/lcp/staff-leave", icon: <AuditOutlined />, label: "请假审批（独立页）" },
        { key: "/lcp/staff-departments", icon: <ApartmentOutlined />, label: "科室组织（独立页）" },
      ],
    },
    { key: "/knowledge", icon: <BookOutlined />, label: "医学知识库" },
    ...(isAdmin
      ? [
          {
            key: "mgmt", icon: <SettingOutlined />, label: "管理",
            children: [
              { key: "/users", icon: <TeamOutlined />, label: "用户管理" },
              {
                key: "/admin-review", icon: <SafetyCertificateOutlined />,
                label: (
                  <Space>
                    <span>审核中心</span>
                    {pendingReview > 0 && <Badge count={pendingReview} size="small" />}
                  </Space>
                ),
              },
              { key: "/schedule-source", icon: <CalendarOutlined />, label: "号源排班" },
              { key: "/lowcode", icon: <AppstoreOutlined />, label: "低代码工作台" },
              { key: "/ai-mgmt/skills", icon: <ToolOutlined />, label: "技能管理" },
              { key: "/ai-mgmt/mcp", icon: <ApiOutlined />, label: "MCP 管理" },
              { key: "/ai-mgmt/conversations", icon: <MessageOutlined />, label: "会话管理" },
              { key: "/ai-mgmt/tokens", icon: <FundOutlined />, label: "Token 用量" },
            ],
          },
        ]
      : []),
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleInfo = roleLabels[user?.role || ""] || {
    text: user?.role,
    color: "#999",
  };

  const userMenuItems = [
    { key: "profile", label: `${user?.real_name} · ${roleInfo.text}`, disabled: true },
    { type: "divider" as const },
    { key: "settings", icon: <SettingOutlined />, label: "个人设置", onClick: () => navigate("/settings") },
    { type: "divider" as const },
    { key: "logout", icon: <LogoutOutlined />, label: "退出登录", danger: true, onClick: handleLogout },
  ];

  const selectedKey =
    menuItems
      .flatMap((item: any) => [item, ...(item.children || [])])
      .filter((item) => location.pathname.startsWith(item.key))
      .sort((a, b) => b.key.length - a.key.length)[0]?.key || "/dashboard";

  return (
    <Layout style={{ minHeight: "100vh", background: "#f4f7fb" }}>
      {/* UI 设计稿风格侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={232}
        style={{
          background: "#ffffff",
          borderRight: "1px solid #e6ecf3",
          position: "fixed",
          height: "100vh",
          left: 0,
          top: 0,
          zIndex: 30,
        }}
      >
        {/* Logo — UI 设计稿风格 */}
        <div
          style={{
            padding: "28px 17px 31px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 11,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 35,
                height: 37,
                background: "#2563eb",
                borderRadius: 11,
                display: "grid",
                placeItems: "center",
                color: "white",
                fontWeight: 600,
                fontSize: 29,
              }}
            >
              +
            </div>
            <div>
              <div
                style={{
                  fontSize: 23,
                  letterSpacing: -0.8,
                  fontWeight: 600,
                  color: "#1b2b45",
                }}
              >
                MediCode
              </div>
              <small
                style={{
                  display: "block",
                  fontSize: 10,
                  letterSpacing: 2,
                  color: "#78869b",
                  marginTop: 3,
                }}
              >
                SMART MEDICAL
              </small>
            </div>
          </div>
        </div>

        {/* 导航标签 */}
        <div
          style={{
            fontSize: 10,
            letterSpacing: 1.6,
            color: "#9aa6b5",
            margin: "19px 14px 11px",
          }}
        >
          WORKSPACE / 工作空间
        </div>

        {/* Navigation Menu */}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems.map((item: any) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            style: item.children ? undefined : {
              margin: "4px 0",
              borderRadius: 9,
              padding: "13px 15px",
              color: "#63718a",
              fontSize: 13,
            },
            children: item.children
              ? item.children.map((c: any) => ({
                  key: c.key,
                  icon: c.icon,
                  label: c.label,
                  style: {
                    margin: "4px 0",
                    borderRadius: 9,
                    padding: "13px 15px",
                    color: "#63718a",
                    fontSize: 13,
                  },
                }))
              : undefined,
          }))}
          onClick={({ key }) => navigate(key)}
          style={{
            background: "transparent",
            border: "none",
          }}
        />

        {/* 底部帮助卡片 */}
        <div
          style={{
            margin: "auto",
            padding: "18px 10px 0",
          }}
        >
          <div
            style={{
              background: "#f6f9fd",
              padding: 16,
              borderRadius: 10,
              fontSize: 12,
              lineHeight: 1.8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              让诊疗更专注
            </div>
            <div style={{ color: "#78869b" }}>
              统一的信息，连贯的工作流程。
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 23,
              color: "#8996a8",
              fontSize: 11,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                background: "#138d85",
                display: "inline-block",
                borderRadius: "50%",
              }}
            ></span>
            设计概念 v1.0 · 本地演示
          </div>
        </div>
      </Sider>

      <Layout>
        {/* 主内容区域 */}
        <Content
          style={{
            marginLeft: 232,
            width: "calc(100% - 232px)",
            minWidth: 0,
          }}
        >
          {/* 顶部栏 */}
          <Header
            style={{
              height: 78,
              background: "#ffffffec",
              borderBottom: "1px solid #e6ecf3",
              display: "flex",
              alignItems: "center",
              padding: "0 34px",
              gap: 20,
              position: "sticky",
              top: 0,
              zIndex: 20,
              backdropFilter: "blur(10px)",
            }}
          >
            <Space>
              <Button
                type="text"
                icon={
                  collapsed ? (
                    <MenuUnfoldOutlined style={{ fontSize: 20 }} />
                  ) : (
                    <MenuFoldOutlined style={{ fontSize: 20 }} />
                  )
                }
                onClick={() => setCollapsed(!collapsed)}
                style={{ color: "#6b7280" }}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: "#8b96a7",
                }}
              >
                工作空间
              </Text>
              <Text
                style={{
                  color: "#1b2b45",
                  fontWeight: 500,
                  marginLeft: 10,
                }}
              >
                {menuItems
                  .flatMap((item: any) => [item, ...(item.children || [])])
                  .find((i) => i.key === selectedKey)?.label || "总览控制台"}
              </Text>
            </Space>

            <Input.Search
              placeholder="搜索患者或功能…"
              allowClear
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 9,
                background: "#f6f8fc",
                border: "1px solid #edf1f7",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#9aa6b6",
                width: 225,
              }}
              onSearch={(v) => { if (v.trim()) { navigate("/patients"); message.info("已搜索：" + v.trim()); } }}
            />

            <Space size="small">
              <span
                style={{
                  padding: "5px 9px",
                  background: "#fff7e7",
                  color: "#947034",
                  borderRadius: 5,
                  fontSize: 10,
                  whiteSpace: "nowrap",
                }}
              >
                UI 原型 · 演示数据
              </span>
              <Popover
                placement="bottomRight"
                trigger="click"
                open={notifOpen}
                onOpenChange={(o) => { setNotifOpen(o); if (o) loadNotif(); }}
                title={
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>通知</span>
                      <Button size="small" type="link" onClick={async () => { await markRead(); loadNotif(); }}>全部已读</Button>
                    </div>
                }
                content={
                  notifItems.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" style={{ margin: 0, padding: "12px 0" }} />
                  ) : (
                    <List
                      size="small"
                      style={{ width: 320, maxHeight: 360, overflow: "auto" }}
                      dataSource={notifItems}
                      renderItem={(n: NotificationItem) => (
                        <div
                          style={{ padding: "8px 4px", borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
                          onClick={() => { markRead(n.id); setNotifOpen(false); if (n.link && n.link !== "/") navigate(n.link); }}
                        >
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {n.is_read === 0 && <span style={{ width: 6, height: 6, borderRadius: 6, background: "#2563eb" }} />}
                            <Text strong style={{ fontSize: 13 }}>{n.title}</Text>
                          </div>
                          {n.content && <Text type="secondary" style={{ fontSize: 12, display: "block" }} ellipsis>{n.content}</Text>}
                          {n.created_at && <Text type="secondary" style={{ fontSize: 11 }}>{new Date(n.created_at).toLocaleString("zh-CN")}</Text>}
                        </div>
                      )}
                    />
                  )
                }
              >
                <Badge count={notifUnread} size="small">
                  <Button type="text" shape="circle" icon={<BellOutlined />} />
                </Badge>
              </Popover>
              <Button type="text" shape="circle" icon={<QuestionCircleOutlined />} onClick={() => message.info("MediCode 帮助")} />
            </Space>

            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={["click"]}
            >
              <div
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  borderLeft: "1px solid #e6ecf3",
                  paddingLeft: 19,
                }}
              >
                <Avatar
                  size={34}
                  style={{
                    background: "#eaf1ff",
                    color: "#4774b9",
                    fontWeight: 600,
                  }}
                >
                  {user?.real_name?.[0]}
                </Avatar>
                <div>
                  <div style={{ fontSize: 12 }}>{user?.real_name}</div>
                  <small style={{ display: "block", color: "#8996a8", fontSize: 10, marginTop: 3 }}>
                    {roleInfo.text}
                  </small>
                </div>
              </div>
            </Dropdown>
          </Header>

          {/* 页面内容 */}
          <main
            style={{
              maxWidth: 1570,
              padding: "31px 34px 26px",
              margin: "auto",
            }}
          >
            <Outlet />
          </main>
        </Content>
      </Layout>
    </Layout>
  );
}
