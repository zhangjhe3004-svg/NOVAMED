/**
 * 主布局 — 悬浮岛式液态玻璃侧边栏
 * 232px 侧边栏，四周留白 + 磨砂玻璃；导航分组可折叠 + 当前项液态胶囊高亮
 */
import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
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
import { buildNavGroups, roleMeta, visibleNavGroups, slimSidebarGroups } from "../config/nav";
import CommandPalette from "../components/CommandPalette";
import BrandLockup from "../components/BrandLockup";
import BrandSparkle from "../components/BrandSparkle";
import { myMenus } from "../api/roles";
import { fetchMenuTree, type MenuItemRow } from "../api/menus";
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
  // 液态高亮胶囊（Liquid Pill）位置：当前项滑动指示器
  const [pill, setPill] = useState({ top: 0, height: 0, opacity: 0 });

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

  // DB 菜单授权联动（角色管理·分配权限的真实效果，RBAC：整数 menu_id）：
  // /roles/my-menus 返回整数 menu_id 数组；null=内置角色全量（回退静态分组），[]=无菜单。
  // 前端用菜单树把 menu_id → 导航 key 再过滤侧栏。
  const [grantedMenuIds, setGrantedMenuIds] = useState<number[] | null>(null);
  // 由 menu_id 解析出的导航 key 集合（与 grantedMenuIds 配套）
  const [grantedKeys, setGrantedKeys] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    if (user?.role === "admin") {
      setGrantedMenuIds(null);
      return;
    }
    (async () => {
      try {
        const [mine, tree] = await Promise.all([myMenus(), fetchMenuTree()]);
        if (!alive) return;
        const keyById = new Map<number, string>();
        const walk = (ns: MenuItemRow[]) =>
          ns.forEach((n) => {
            if (n.type === "menu") keyById.set(n.id, n.permission);
            walk(n.children ?? []);
          });
        walk(tree.items || []);
        const menus = mine.menus;
        if (menus == null) {
          setGrantedMenuIds(null);
          return;
        }
        const keys = new Set<string>();
        menus.forEach((id) => {
          const k = keyById.get(id);
          if (k) keys.add(k);
        });
        setGrantedMenuIds(menus);
        // 缓存 key 集合供下方过滤
        setGrantedKeys(keys.size ? [...keys] : []);
      } catch {
        if (alive) setGrantedMenuIds(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.role]);

  const effectiveGroups = useMemo(() => {
    if (grantedMenuIds == null) return visibleGroups;
    const allowed = new Set(grantedKeys ?? []);
    return visibleGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => allowed.has(it.key)) }))
      .filter((g) => g.items.length > 0);
  }, [visibleGroups, grantedMenuIds, grantedKeys]);
  const allNavItems = effectiveGroups.flatMap((g) => g.items);

  // 侧边栏精简视图：低频/重复入口不常驻（SLIM_HIDDEN_KEYS），
  // 快速跳转下拉与 ⌘K 仍用全量 effectiveGroups，被精简页面不受影响。
  const sidebarGroups = useMemo(() => slimSidebarGroups(effectiveGroups as any), [effectiveGroups]);

  // 分组折叠：默认只展开当前所在分组，其余收起；点击分组标题手动开合（可多开）。
  const [openShorts, setOpenShorts] = useState<string[]>([]);
  const toggleGroup = (short: string) =>
    setOpenShorts((prev) => (prev.includes(short) ? prev.filter((s) => s !== short) : [...prev, short]));

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

  // 路由变化时自动展开目标分组（不收起其他已展开分组，避免切换跳动）
  useEffect(() => {
    const short = currentGroup?.short;
    if (short) setOpenShorts((prev) => (prev.includes(short) ? prev : [...prev, short]));
  }, [currentGroup?.short]);

  // 液态胶囊定位：随当前项/折叠/分组展开状态滑动（CSS 过渡带弹性回弹）
  // 注意：值未变化时返回原对象让 React 跳过渲染，避免上游派生数组每次渲染
  // 都是新引用而造成的无限更新循环。
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const btn = nav.querySelector<HTMLElement>('.md-nav-item[data-active="true"]');
    if (!btn) { setPill((p) => (p.opacity === 0 ? p : { ...p, opacity: 0 })); return; }
    const nr = nav.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const top = br.top - nr.top + nav.scrollTop;
    setPill((p) =>
      p.top === top && p.height === br.height && p.opacity === 1 ? p : { top, height: br.height, opacity: 1 }
    );
  }, [selectedKey, collapsed, effectiveGroups, sidebarGroups, openShorts]);

  // 窗口尺寸变化时重定位胶囊
  useEffect(() => {
    const onResize = () => {
      const nav = navRef.current;
      if (!nav) return;
      const btn = nav.querySelector<HTMLElement>('.md-nav-item[data-active="true"]');
      if (!btn) return;
      const nr = nav.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      const top = br.top - nr.top + nav.scrollTop;
      setPill((p) =>
        p.top === top && p.height === br.height && p.opacity === 1 ? p : { top, height: br.height, opacity: 1 }
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <Layout style={{ minHeight: "100vh", background: "transparent" }}>
      {/* 悬浮岛式玻璃侧边栏：不贴边、四周留白，像一张悬浮的圆角卡 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={232}
        style={{
          background: "rgba(16, 16, 28, 0.82)",
          border: "1px solid rgba(59, 130, 246, 0.16)",
          backdropFilter: "blur(22px) saturate(150%)",
          WebkitBackdropFilter: "blur(22px) saturate(150%)",
          position: "fixed",
          height: "calc(100vh - 24px)",
          left: 12,
          top: 12,
          borderRadius: 24,
          overflow: "hidden",
          boxShadow:
            "0 24px 60px -20px rgba(0,0,0,0.6), 0 8px 22px -10px rgba(0,0,0,0.5)",
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
        {/* Logo — 深空芯片：黑蓝配色承托新星核 */}
        <div
          style={{
            padding: "22px 14px 18px",
          }}
        >
          <div
            className="md-brand"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 7,
              alignItems: "stretch",
            }}
          >
            {/* 霓虹芯片：深紫黑底 + 紫青星核 + 白字（图标-文字间距收紧） */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: 6,
                padding: collapsed ? "10px 0" : "11px 14px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0e1a33 0%, #16294d 100%)",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(96, 165, 250, 0.14)",
              }}
            >
              <BrandSparkle size={collapsed ? 28 : 26} on="dark" />
              {!collapsed && <BrandLockup height={26} on="dark" />}
            </div>
            {!collapsed && (
              <small
                style={{
                  display: "block",
                  fontSize: 10,
                  letterSpacing: 2.6,
                  color: "#7c7c96",
                  fontWeight: 600,
                  marginLeft: 4,
                }}
              >
                NOVA MEDICAL
              </small>
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

        {/* 导航：分组样式对齐原型 pages.html；折叠用 grid-rows 高度过渡 */}
        <nav
          ref={navRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "4px 14px 16px",
            marginTop: 4,
            position: "relative",
          }}
        >
          {/* 液态高亮胶囊：滑动到当前项下方，带弹性回弹 */}
          <span
            className="md-nav-pill"
            aria-hidden="true"
            style={{ top: pill.top, height: pill.height, opacity: pill.opacity }}
          />
          {sidebarGroups.map((g: any) => {
            const activeInGroup = g.items.some((it: any) => it.key === selectedKey);
            // 折叠模式（图标条）下不显示分组标题、全部展开；展开模式默认只开当前分组
            const open = collapsed || activeInGroup || openShorts.includes(g.short);
            return (
            <div key={g.label}>
              {!collapsed && (
                <button
                  type="button"
                  className="md-nav-group-head"
                  aria-expanded={open}
                  title={open ? "收起分组" : "展开分组"}
                  onClick={() => toggleGroup(g.short)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    width: "calc(100% - 28px)",
                    margin: "16px 14px 8px",
                    padding: 0,
                    fontSize: 11,
                    letterSpacing: 0.6,
                    color: "rgba(232,232,244,0.78)",
                    fontWeight: 600,
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <span>{g.label}</span>
                  <DownOutlined
                    style={{
                      fontSize: 8,
                      color: "rgba(232,232,244,0.55)",
                      transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 0.3s ease",
                    }}
                  />
                </button>
              )}
              <div
                className="md-nav-group-body"
                style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
              >
              <div>
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
                      color: active ? "#60a5fa" : "#9a9ab0",
                      background: "transparent",
                      fontWeight: active ? 600 : 400,
                      fontSize: 13,
                      border: 0,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                    title={collapsed ? it.name : undefined}
                  >
                    <span className="md-nav-icon" style={{ display: "inline-flex", fontSize: 17 }}>{it.icon}</span>
                    {!collapsed && <span style={{ flex: 1 }}>{it.name}</span>}
                  </button>
                );
              })}
              </div>
              </div>
            </div>
            );
          })}
        </nav>
        </div>

      </Sider>

      <Layout>
        {/* 主内容区域 */}
        <Content
          style={{
            marginLeft: collapsed ? 104 : 256,
            width: `calc(100% - ${collapsed ? 104 : 256}px)`,
            minWidth: 0,
          }}
        >
          {/* 顶部栏（磨砂玻璃） */}
          <Header
            style={{
              height: 78,
              background: "rgba(16, 16, 28, 0.6)",
              borderBottom: "1px solid rgba(59, 130, 246, 0.12)",
              display: "flex",
              alignItems: "center",
              padding: "0 34px",
              gap: 20,
              position: "sticky",
              top: 0,
              zIndex: 20,
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
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
                style={{ color: "#9a9ab0" }}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: "#9a9ab0",
                }}
              >
                {currentGroup ? currentGroup.short : "工作空间"}
              </Text>
              <Text
                style={{
                  color: "#eaf1fb",
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
                          style={{ padding: "8px 4px", borderBottom: "1px solid rgba(59, 130, 246, 0.1)" }}
                        >
                          <div
                            style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
                            onClick={() => { markRead(n.id); loadNotif(); setNotifOpen(false); if (n.link && n.link !== "/") navigate(n.link); }}
                          >
                            {n.is_read === 0 && <span style={{ width: 6, height: 6, borderRadius: 6, background: "#3b82f6" }} />}
                            <Text strong style={{ fontSize: 13 }}>{n.title}</Text>
                          </div>
                          {n.content && <Text type="secondary" style={{ fontSize: 12, display: "block" }} ellipsis>{n.content}</Text>}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                            {n.created_at && <Text type="secondary" style={{ fontSize: 11 }}>{new Date(n.created_at).toLocaleString("zh-CN")}</Text>}
                            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                              {n.link && n.link !== "/" && (
                                <Button
                                  size="small" type="primary"
                                  style={{ height: 20, padding: "0 8px", fontSize: 10, borderRadius: 4 }}
                                  onClick={(e) => { e.stopPropagation(); markRead(n.id); loadNotif(); setNotifOpen(false); navigate(n.link!); }}
                                >
                                  去处理
                                </Button>
                              )}
                              {n.is_read === 0 && (
                                <Button
                                  size="small" type="text"
                                  style={{ height: 20, padding: "0 6px", fontSize: 10 }}
                                  onClick={(e) => { e.stopPropagation(); markRead(n.id); loadNotif(); }}
                                >
                                  标为已读
                                </Button>
                              )}
                            </span>
                          </div>
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
              <Button type="text" shape="circle" icon={<QuestionCircleOutlined />} onClick={() => message.info("NOVAMED 帮助")} />
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
                  border: `1px solid ${userHover ? "rgba(59, 130, 246, 0.3)" : "rgba(59, 130, 246, 0.16)"}`,
                  background: userHover ? "#1a2740" : "#101b2e",
                  boxShadow: userHover ? "0 3px 10px rgba(0,0,0,0.4)" : "none",
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
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#eaf1fb" }}>
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
                <DownOutlined style={{ fontSize: 9, color: "rgba(232,232,244,0.72)", marginLeft: 2 }} />
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
