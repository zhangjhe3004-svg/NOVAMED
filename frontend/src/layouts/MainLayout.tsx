/**
 * 主布局 — 基于 UI 设计稿的侧边栏设计
 * 232px 侧边栏，白色背景，简洁品牌展示
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Layout,
  Button,
  Dropdown,
  Avatar,
  Typography,
  Space,
  message,
  Popover,
  Select,
  Badge,
  List,
  Empty,
} from "antd";
import {
  BellOutlined,
  DownOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useAuth } from "../stores/auth";
import { buildNavGroups, roleMeta, visibleNavGroups } from "../config/nav";
import CommandPalette from "../components/CommandPalette";
import { myMenus } from "../api/roles";
import { listNotifications, markRead } from "../api/notifications";
import type { NotificationItem } from "../api/notifications";
import { getPendingReviewCount } from "../api/records";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// 侧边栏菜单来自 config/nav.ts，与「岗位阶梯 / 角色溯源」共用同一份数据源

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
  const [userHover, setUserHover] = useState(false);
  // 命令面板（⌘K / Ctrl+K）
  const [cmdOpen, setCmdOpen] = useState(false);

  // 侧边栏导航容器引用 — 用于绑定鼠标滚轮滚动
  const navRef = useRef<HTMLElement>(null);

  // 全局快捷键：⌘K / Ctrl+K 开合命令面板；Esc 关闭（面板内也处理，这里兜底）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 鼠标滚轮下拉：当侧边栏导航内容超出可视高度时，滚轮优先滚动导航本身，
  // 到达顶部/底部边界后再放行给页面，避免整页被滚动。
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = nav;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      const canScrollUp = e.deltaY < 0 && !atTop;
      const canScrollDown = e.deltaY > 0 && !atBottom;
      if (canScrollUp || canScrollDown) {
        e.preventDefault();
        nav.scrollTop += e.deltaY;
      }
    };
    nav.addEventListener("wheel", onWheel, { passive: false });
    return () => nav.removeEventListener("wheel", onWheel);
  }, []);

  // 路由切换时复位滚动位置：新页面从顶部展开，配合 .md-page-enter 转场
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  const loadNotif = async () => {    try {
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
      getPendingReviewCount().then((res) => setPendingReview(res.count)).catch(() => {});
    }
  }, [user?.role]);

  // 侧边栏导航：分组结构对齐原型 pages.html（仅挂接真实系统中已存在的路由，
  // 原型有但系统尚未实现的模块先进入「建设中」占位页，避免死链）。
  // 配置见 config/nav.ts —— 角色溯源按同一份配置下钻「角色 → 分组 → 菜单」。
  const navGroups = buildNavGroups({ pendingReview });

  const visibleGroups = visibleNavGroups(navGroups, user?.role);

  // DB 菜单授权联动（角色管理·分配权限的真实效果）：
  // /roles/my-menus 返回 null（角色未配置授权）时回退静态分组；管理员始终全量。
  const [grantedKeys, setGrantedKeys] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    if (user?.role === "admin") {
      setGrantedKeys(null);
      return;
    }
    myMenus()
      .then((r) => {
        if (alive) setGrantedKeys(r.menus ?? null);
      })
      .catch(() => {
        if (alive) setGrantedKeys(null);
      });
    return () => {
      alive = false;
    };
  }, [user?.role]);

  const effectiveGroups = useMemo(() => {
    if (grantedKeys == null) return visibleGroups;
    const allowed = new Set(grantedKeys);
    return visibleGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => allowed.has(it.key)) }))
      .filter((g) => g.items.length > 0);
  }, [visibleGroups, grantedKeys]);
  const allNavItems = effectiveGroups.flatMap((g) => g.items);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleInfo = roleMeta(user?.role);

  const userMenuItems = [
    { key: "profile", label: `${user?.real_name} · ${roleInfo.text}`, disabled: true },
    { type: "divider" as const },
    { key: "settings", icon: <SettingOutlined />, label: "个人设置", onClick: () => navigate("/settings") },
    { type: "divider" as const },
    { key: "logout", icon: <LogoutOutlined />, label: "退出登录", danger: true, onClick: handleLogout },
  ];

  const selectedKey =
    allNavItems
      .filter((it: any) => location.pathname.startsWith(it.to))
      .sort((a: any, b: any) => b.to.length - a.to.length)[0]?.key || "dashboard";

  const currentNav = allNavItems.find((it: any) => it.key === selectedKey);
  const currentGroup = effectiveGroups.find((g: any) => g.items.some((it: any) => it.key === selectedKey));

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
        {/* 内部 flex 列容器：让 nav 获得受约束高度从而可滚轮滚动 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
        {/* Logo — UI 设计稿风格 */}
        <div
          style={{
            padding: "28px 17px 31px",
          }}
        >
          <div
            className="md-brand"
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
                borderRadius: 11,
                flexShrink: 0,
                filter: "drop-shadow(0 3px 6px rgba(37,99,235,0.35))",
              }}
            >
              <svg width="35" height="37" viewBox="0 0 35 37" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logo-bg" x1="4" y1="2" x2="31" y2="35" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4f8bff" />
                    <stop offset="0.55" stopColor="#2563eb" />
                    <stop offset="1" stopColor="#1d4ed8" />
                  </linearGradient>
                  <linearGradient id="logo-shine" x1="8" y1="2" x2="18" y2="16" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ffffff" stopOpacity="0.35" />
                    <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* 渐变圆角底座 */}
                <rect x="0.5" y="0.5" width="34" height="36" rx="10.5" fill="url(#logo-bg)" />
                <rect x="0.5" y="0.5" width="34" height="36" rx="10.5" fill="url(#logo-shine)" />
                <rect x="0.75" y="0.75" width="33.5" height="35.5" rx="10.25" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="0.5" />
                {/* 医疗十字（圆角端点） */}
                <path
                  d="M17.5 9.5V27.5M8.5 18.5H26.5"
                  stroke="#ffffff"
                  strokeWidth="5.2"
                  strokeLinecap="round"
                />
                {/* 十字中心微光点 */}
                <circle cx="17.5" cy="18.5" r="1.6" fill="#bfdbfe" />
              </svg>
            </div>
            {!collapsed && (
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
            )}
          </div>
        </div>

        {/* 顶部快速跳转下拉导航条 */}
        {!collapsed && (
          <div style={{ padding: "0 14px 10px" }}>
            <Select
              showSearch
              allowClear
              value={selectedKey}
              placeholder="快速跳转到…"
              style={{ width: "100%" }}
              optionFilterProp="label"
              popupMatchSelectWidth={false}
              onChange={(val: string) => {
                const it: any = allNavItems.find((x: any) => x.key === val);
                if (it) { if (it.external) { window.open(it.external, "_blank"); } else { navigate(it.to); } }
              }}
              options={effectiveGroups.map((g: any) => ({
                label: g.label,
                options: g.items.map((it: any) => ({
                  value: it.key,
                  label: it.name,
                })),
              }))}
            />
          </div>
        )}

        {/* 导航：分组样式对齐原型 pages.html */}
        <nav
          ref={navRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "4px 14px 16px",
            marginTop: 4,
          }}
        >
          {effectiveGroups.map((g: any) => (
            <div key={g.label}>
              {!collapsed && (
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.6,
                    color: "#9aa6b5",
                    margin: "16px 14px 8px",
                  }}
                >
                  {g.label}
                </div>
              )}
              {g.items.map((it: any) => {
                const active = selectedKey === it.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    className="md-nav-item"
                    data-active={active ? "true" : "false"}
                    onClick={() => {
                      if (it.external) { window.open(it.external, "_blank"); return; }
                      navigate(it.to);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      textAlign: "left",
                      padding: collapsed ? "11px 0" : "10px 15px",
                      justifyContent: collapsed ? "center" : "flex-start",
                      borderRadius: 9,
                      margin: "2px 0",
                      color: active ? "#2563eb" : "#63718a",
                      background: active ? "#eaf1ff" : "transparent",
                      fontWeight: active ? 600 : 400,
                      fontSize: 13,
                      border: 0,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f5f8fd"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                    title={collapsed ? it.name : undefined}
                  >
                    <span className="md-nav-icon" style={{ display: "inline-flex", fontSize: 17 }}>{it.icon}</span>
                    {!collapsed && <span style={{ flex: 1 }}>{it.name}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        </div>

      </Sider>

      <Layout>
        {/* 主内容区域 */}
        <Content
          style={{
            marginLeft: collapsed ? 80 : 232,
            width: `calc(100% - ${collapsed ? 80 : 232}px)`,
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
                {currentGroup ? currentGroup.short : "工作空间"}
              </Text>
              <Text
                style={{
                  color: "#1b2b45",
                  fontWeight: 500,
                  marginLeft: 10,
                }}
              >
                {currentNav?.name || "总览控制台"}
              </Text>
            </Space>

            {/* 命令面板触发器：⌘K 打开，支持页面 / 用户 / 动作 / 问系统 */}
            <button
              type="button"
              className="cmd-trigger"
              onClick={() => setCmdOpen(true)}
              title="搜索页面、用户或动作（⌘K）"
            >
              <SearchOutlined />
              <span className="cmd-trigger-label">搜索页面、用户或动作</span>
              <span className="kbd">⌘K</span>
            </button>

            <Space size="small">
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
                onMouseEnter={() => setUserHover(true)}
                onMouseLeave={() => setUserHover(false)}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginLeft: 19,
                  padding: "5px 14px 5px 6px",
                  borderRadius: 999,
                  border: `1px solid ${userHover ? "#dbe4f0" : "#edf1f7"}`,
                  background: userHover ? "#eef3fa" : "#f6f8fc",
                  boxShadow: userHover ? "0 3px 10px rgba(27,43,69,0.08)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                <Avatar
                  size={32}
                  style={{
                    background: `linear-gradient(135deg, ${roleInfo.color}, ${roleInfo.color}bb)`,
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {user?.real_name?.[0]}
                </Avatar>
                <div style={{ lineHeight: 1.3 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1b2b45" }}>
                    {user?.real_name}
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 3,
                      padding: "0 6px",
                      height: 16,
                      lineHeight: "16px",
                      borderRadius: 4,
                      fontSize: 10,
                      color: roleInfo.color,
                      background: `${roleInfo.color}14`,
                    }}
                  >
                    {roleInfo.text}
                  </span>
                </div>
                <DownOutlined style={{ fontSize: 9, color: "#9aa6b5", marginLeft: 2 }} />
              </div>
            </Dropdown>
          </Header>

          {/* 页面内容 */}
          <main
            className="md-route-host"
            style={{
              maxWidth: 1570,
              padding: "31px 34px 26px",
              margin: "auto",
            }}
          >
            {/* 路由转场：key 绑定 pathname，切换页面时重放苹果式淡入上浮动画 */}
            <div key={location.pathname} className="md-page-enter">
              <Outlet />
            </div>
          </main>
        </Content>
      </Layout>

      {/* 命令面板：⌘K 打开，挂在布局最外层以覆盖整个视口 */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </Layout>
  );
}
