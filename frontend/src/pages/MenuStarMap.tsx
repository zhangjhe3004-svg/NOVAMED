/**
 * 菜单管理 —— 星图 + 树表双视图（完整移植 scaffold Menus.vue + MenuStarMap.vue）
 *
 * 数据：/api/menus/tree（menu_items 表：目录/页面/按钮三级；页面 permission=导航 key，与角色授权同源）
 *
 * - 表格（对齐 scaffold ListPage 树表）：查询面板 + 树表（名称/类型/权限标识/路由组件/排序/显示开关/状态/
 *   操作 +新增子项 ✎编辑 🗑删除）+ 新增/编辑弹窗（类型切换字段、上级排除自己及子孙）
 * - 星图（三层下钻）：全景（中心珍珠球 + 目录表盘 + 页面/按钮两层真实点位）；分支（一级项竖排 +
 *   页面扇形）；页面（授权角色 → 页面 → 按钮三列 + 右侧分析栏可直接新增/编辑）
 * - 右上图例：孤立页面（可点击开关）/ 缺权限标识 / 隐藏项；左玻璃浮卡「侧栏预览」
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table, Segmented, Modal, Form, Input, Select, InputNumber, Switch, Popconfirm, message,
} from "antd";
import {
  PlusOutlined, MenuOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  AppstoreOutlined, FileTextOutlined, KeyOutlined, DownloadOutlined,
  ShrinkOutlined, NodeIndexOutlined, EyeOutlined,
} from "@ant-design/icons";
import StageGraph, { type GraphNode, type GraphLink } from "../components/StageGraph";
import InsightPanel, { type InsightSection } from "../components/InsightPanel";
import { buildNavGroups } from "../config/nav";
import { useAuth } from "../stores/auth";
import { listRoles, type RoleItem } from "../api/roles";
import { fetchMenuTree, createMenu, updateMenu, removeMenu, exportMenus, type MenuItemRow, type MenuType } from "../api/menus";
import type { NetLink, NetNode } from "../utils/stage";
import { downloadBlob } from "../utils/download";

const CAT_INK: Record<number, string> = {
  1: "#7a5a16", 2: "#275a96", 3: "#5b4597", 4: "#94384c", 5: "#2d7140",
};

const RING = { hub: 0.52, page: 0.77, btn: 0.97 };
const PREVIEW_W = 226;
const COL_TOP = 76;
const COL_BOTTOM = 40;

const TYPE_LABEL: Record<MenuType, string> = { dir: "目录", menu: "菜单", btn: "按钮" };

/** 上级菜单树形选项（排除自己及子孙） */
interface ParentOption { label: string; value: number; depth: number; disabled?: boolean }

function collectIds(n: MenuItemRow, acc: Set<number> = new Set()): Set<number> {
  acc.add(n.id);
  (n.children ?? []).forEach((c) => collectIds(c, acc));
  return acc;
}

export default function MenuStarMap() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [view, setView] = useState<"star" | "table">("table");
  const [size, setSize] = useState({ w: 900, h: 620 });

  /* ---------- 菜单树（DB） ---------- */
  const [tree, setTree] = useState<MenuItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [kwInput, setKwInput] = useState("");
  const [kw, setKw] = useState("");
  const [statusF, setStatusF] = useState<string>("");

  const loadTree = useCallback(async (q?: { keyword?: string; status?: string }) => {
    setLoading(true);
    try {
      const r = await fetchMenuTree(q ?? {});
      setTree(r.items || []);
      setTotal(r.total || 0);
    } catch {
      message.error("加载菜单树失败");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadTree(); }, [loadTree]);

  /* ---------- 角色授权（页面 permission=导航 key → menu_ids 匹配） ---------- */
  const [roleRows, setRoleRows] = useState<RoleItem[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    listRoles({ page: 1, page_size: 100 })
      .then((r) => setRoleRows(r.items || []))
      .catch(() => {});
  }, [isAdmin]);

  const grantCount = useCallback(
    (permission: string) => {
      if (!roleRows.length) return null;
      return roleRows.filter((r) => !r.builtin && r.status === 1 && (r.menu_ids || []).includes(permission)).length;
    },
    [roleRows]
  );
  const holdersOf = useCallback(
    (permission: string) => roleRows.filter((r) => (r.menu_ids || []).includes(permission)),
    [roleRows]
  );

  /* ---------- 平铺索引 ---------- */
  interface Entry { menu: MenuItemRow; parent: MenuItemRow | null; depth: number; branchRoot: MenuItemRow }
  const flat = useMemo(() => {
    const map = new Map<number, Entry>();
    const walk = (nodes: MenuItemRow[], parent: MenuItemRow | null, depth: number, root: MenuItemRow) =>
      nodes.forEach((m) => {
        const b = depth === 0 ? m : root;
        map.set(m.id, { menu: m, parent, depth, branchRoot: b });
        walk(m.children ?? [], m, depth + 1, b);
      });
    walk(tree, null, 0, tree[0] ?? ({} as MenuItemRow));
    return map;
  }, [tree]);

  const pagesOf = (m: MenuItemRow) => (m.children ?? []).filter((c) => c.type !== "btn");
  const buttonsOf = (m: MenuItemRow) => (m.children ?? []).filter((c) => c.type === "btn");
  const isLeafTop = (m: MenuItemRow) => !pagesOf(m).length;
  const isDanger = (m: MenuItemRow) => m.type === "btn" && !m.permission;
  const isOrphan = (m: MenuItemRow) =>
    m.type !== "btn" && m.status === 1 && m.type === "menu" && (grantCount(m.permission) ?? 0) === 0 && roleRows.length > 0;
  const catOf = (m: MenuItemRow) => {
    if (m.type === "dir") return 5;
    const e = flat.get(m.id);
    return e ? e.branchRoot.id % 5 : 1;
  };
  const toneOf = (m: MenuItemRow): "danger" | "off" | undefined =>
    isDanger(m) || (showOrphans && isOrphan(m)) ? "danger" : m.status !== 1 ? "off" : undefined;

  /** 表盘读数：分支内页面被普通角色授权的比例 */
  const grantedShare = useCallback(
    (m: MenuItemRow) => {
      const pages: MenuItemRow[] = [];
      const walkList = (list: MenuItemRow[]) => list.forEach((c) => { if (c.type === "menu") pages.push(c); walkList(c.children ?? []); });
      walkList(m.type === "menu" ? [m] : m.children ?? []);
      if (!pages.length || !roleRows.length) return 0;
      return pages.filter((p) => (grantCount(p.permission) ?? 0) > 0).length / pages.length;
    },
    [grantCount, roleRows.length]
  );

  /* ═══════════════ 表格视图（图3） ═══════════════ */
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  useEffect(() => {
    // 默认展开到页面级（按钮收起），与截图一致
    setExpandedKeys(tree.flatMap((d) => [d.id, ...(d.children ?? []).map((p) => p.id)]));
  }, [tree]);

  const exportCsv = async () => {
    try {
      const blob = await exportMenus({ keyword: kw || undefined, status: statusF || undefined });
      downloadBlob(blob, "菜单列表.csv");
    } catch {
      message.error("导出失败");
    }
  };

  /* ---------- 新增 / 编辑弹窗 ---------- */
  const [form] = Form.useForm();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItemRow | null>(null);
  const [formType, setFormType] = useState<MenuType>("dir");
  const [saving, setSaving] = useState(false);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  const parentOptions = useMemo<ParentOption[]>(() => {
    const options: ParentOption[] = [{ label: "顶级", value: 0, depth: 0 }];
    const walkList = (nodes: MenuItemRow[], depth: number) => nodes.forEach((n) => {
      if (n.type === "btn") return;
      options.push({ label: n.name, value: n.id, depth, disabled: excluded.has(n.id) });
      walkList(n.children ?? [], depth + 1);
    });
    walkList(tree, 1);
    return options;
  }, [tree, excluded]);

  const openCreate = (parent?: MenuItemRow) => {
    setEditing(null);
    setExcluded(new Set());
    const type: MenuType = !parent ? "dir" : parent.type === "dir" ? "menu" : "btn";
    setFormType(type);
    form.resetFields();
    form.setFieldsValue({
      parent_id: parent?.id ?? 0, type, name: "", icon: "", path: "", component: "",
      permission: "", sort: 10, visible: 1, status: 1,
    });
    setFormOpen(true);
  };

  const openEdit = (m: MenuItemRow) => {
    setEditing(m);
    setFormType(m.type);
    setExcluded(collectIds(m));
    form.resetFields();
    form.setFieldsValue({
      parent_id: m.parent_id, type: m.type, name: m.name, icon: m.icon, path: m.path,
      component: m.component, permission: m.permission, sort: m.sort, visible: m.visible, status: m.status,
    });
    setFormOpen(true);
  };

  const submitForm = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        parent_id: v.parent_id ?? 0, type: v.type, name: (v.name || "").trim(),
        icon: v.type === "btn" ? "" : (v.icon || "").trim(),
        path: v.type === "btn" ? "" : (v.path || "").trim(),
        component: v.type === "menu" ? (v.component || "").trim() : "",
        permission: v.type === "dir" ? "" : (v.permission || "").trim(),
        sort: v.sort ?? 0, visible: v.visible ? 1 : 0, status: v.status ? 1 : 0,
      };
      if (editing) {
        await updateMenu(editing.id, payload);
        message.success("菜单已更新，刷新页面后导航生效");
      } else {
        await createMenu(payload);
        message.success("菜单已新增，刷新页面后导航生效");
      }
      setFormOpen(false);
      loadTree({ keyword: kw || undefined, status: statusF || undefined });
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "菜单保存失败");
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = async (m: MenuItemRow, visible: boolean) => {
    try {
      await updateMenu(m.id, { visible: visible ? 1 : 0 });
      setTree((prev) => {
        const walkList = (ns: MenuItemRow[]): MenuItemRow[] => ns.map((n) =>
          n.id === m.id ? { ...n, visible: visible ? 1 : 0 } : { ...n, children: n.children ? walkList(n.children) : undefined });
        return walkList(prev);
      });
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "显示状态更新失败");
    }
  };

  const handleRemove = async (m: MenuItemRow) => {
    if ((m.children ?? []).length) {
      message.info(`「${m.name}」下还有 ${m.children!.length} 个子项，需先删除子项`);
      return;
    }
    try {
      await removeMenu(m.id);
      message.success("菜单已删除");
      loadTree({ keyword: kw || undefined, status: statusF || undefined });
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "菜单删除失败");
    }
  };

  /** 类型胶囊（对齐 scaffold Tag tone：目录 neutral / 菜单 blue / 按钮 leaf） */
  const typeTag = (t: MenuType) => {
    const cls = t === "dir" ? "lv-tag lv-tag--neutral" : t === "menu" ? "lv-tag lv-tag--blue" : "lv-tag lv-tag--leaf";
    return <span className={cls}>{TYPE_LABEL[t]}</span>;
  };

  const columns = [
    {
      title: "菜单名称", dataIndex: "name", minWidth: 260,
      render: (_: string, m: MenuItemRow) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {m.type === "dir" && <AppstoreOutlined style={{ color: "var(--lv-soft)", fontSize: 13 }} />}
          {m.type === "menu" && <NavIcon permission={m.permission} />}
          <span style={{ color: m.type === "btn" ? "var(--lv-muted)" : "var(--lv-ink)", fontWeight: m.type === "btn" ? 400 : 600, fontSize: m.type === "btn" ? 12.5 : 13.5 }}>
            {m.name}
          </span>
        </span>
      ),
    },
    { title: "类型", dataIndex: "type", width: 84, render: (_: MenuType, m: MenuItemRow) => typeTag(m.type) },
    {
      title: "权限标识", dataIndex: "permission", width: 210,
      render: (v: string) => v
        ? <code style={{ fontSize: 11.5, fontFamily: "ui-monospace, monospace", background: "rgba(46,58,62,.055)", border: "1px solid var(--lv-line)", borderRadius: 6, padding: "2px 8px", color: "var(--lv-ink)" }}>{v}</code>
        : <span style={{ color: "var(--lv-faint)" }}>—</span>,
    },
    {
      title: "路由 / 组件", dataIndex: "path", width: 230,
      render: (_: string, m: MenuItemRow) => m.type === "btn" ? <span style={{ color: "var(--lv-faint)" }}>—</span> : (
        <div style={{ minWidth: 0 }}>
          <div className="tnum" style={{ fontSize: 12.5, color: "var(--lv-ink)" }}>{m.path || "—"}</div>
          {m.component && <div style={{ fontSize: 11.5, fontFamily: "ui-monospace, monospace", color: "var(--lv-soft)", marginTop: 1 }}>{m.component}</div>}
        </div>
      ),
    },
    { title: "排序", dataIndex: "sort", width: 70, align: "right" as const, render: (v: number) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{v}</span> },
    {
      title: "显示", dataIndex: "visible", width: 80,
      render: (_: number, m: MenuItemRow) => m.type === "btn"
        ? <span style={{ color: "var(--lv-faint)" }}>—</span>
        : <Switch size="small" checked={m.visible === 1} onChange={(v) => toggleVisible(m, v)} />,
    },
    {
      title: "状态", dataIndex: "status", width: 90,
      render: (v: number) => (
        <span className={`lv-tag ${v === 1 ? "lv-tag--leaf" : "lv-tag--gray"}`}><span className="lv-tag-dot" />{v === 1 ? "正常" : "停用"}</span>
      ),
    },
    {
      title: "操作", width: 120, fixed: "right" as const, className: "col-actions",
      render: (_: unknown, m: MenuItemRow) => (
        <div className="row-actions">
          {m.type !== "btn" && (
            <button className="icon-btn" title={m.type === "dir" ? "新增菜单" : "新增按钮"} data-act="add-child" onClick={() => openCreate(m)}>
              <PlusOutlined />
            </button>
          )}
          <button className="icon-btn" title="编辑" data-act="edit" onClick={() => openEdit(m)}><EditOutlined /></button>
          <Popconfirm
            title={(m.children ?? []).length ? `「${m.name}」下还有 ${m.children!.length} 个子项，需先删除子项。` : `确认删除「${m.name}」吗？已分配该菜单的角色将同时失去对应权限。`}
            okText={(m.children ?? []).length ? "知道了" : "删除"}
            okButtonProps={{ danger: !(m.children ?? []).length }}
            onConfirm={() => handleRemove(m)}
          >
            <button className="icon-btn is-danger" title="删除" data-act="remove"><DeleteOutlined /></button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  /* ═══════════════ 星图（图2） ═══════════════ */
  const [branchId, setBranchId] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [hoverBranch, setHoverBranch] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showOrphans, setShowOrphans] = useState(false);
  const layer: "hub" | "branch" | "page" = focusId !== null ? "page" : branchId !== null ? "branch" : "hub";

  const leftPad = showPreview && size.w >= 1100 && layer === "hub" ? PREVIEW_W : 0;
  const geometry = () => {
    const { w, h } = size;
    const W = w - leftPad;
    const cx = leftPad + W / 2;
    const cy = h * 0.5;
    const kx = Math.max(160, W / 2 - 60);
    const ky = Math.max(140, h / 2 - 40);
    return { cx, cy, kx, ky, W };
  };

  /** 每个一级目录的扇区：按叶子数加权，保底份额保证表盘间距 */
  const leaves = (m: MenuItemRow): number => 1 + (m.children?.length ? m.children.reduce((a, c) => a + leaves(c), 0) : 0);
  const sectors = useMemo(() => {
    const tops = tree.filter((m) => m.type !== "btn");
    const raw = tops.reduce((a, m) => a + leaves(m), 0) || 1;
    const floor = raw / Math.max(1, tops.length * 0.85);
    const weight = (m: MenuItemRow) => Math.max(leaves(m), floor);
    const totalW = tops.reduce((a, m) => a + weight(m), 0);
    let cursor = -Math.PI / 2 - (weight(tops[0] ?? ({} as MenuItemRow)) / totalW) * Math.PI;
    return tops.map((m) => {
      const span = (weight(m) / totalW) * Math.PI * 2;
      const s = { menu: m, start: cursor, span, mid: cursor + span / 2 };
      cursor += span;
      return s;
    });
  }, [tree]);

  const network = useMemo(() => {
    const { w, h } = size;
    if (!w || !h || !tree.length) return null;
    const { cx, cy, kx, ky } = geometry();
    const nodes: NetNode[] = [];
    const links: NetLink[] = [];
    sectors.forEach(({ menu: top, start, span, mid }) => {
      const cat = catOf(top);
      nodes.push({ id: `m:${top.id}`, x: cx + Math.cos(mid) * kx * RING.hub, y: cy + Math.sin(mid) * ky * RING.hub, cat, r: 0.1, depth: 1 });
      const pages = pagesOf(top);
      const directBtns = buttonsOf(top);
      const slots = pages.length || 1;
      pages.forEach((page, i) => {
        const a = start + span * ((i + 0.5) / slots);
        const pid = `m:${page.id}`;
        nodes.push({ id: pid, x: cx + Math.cos(a) * kx * RING.page, y: cy + Math.sin(a) * ky * RING.page, cat, r: 2.8, depth: 2, label: page.name, tone: toneOf(page) });
        links.push({ a: `m:${top.id}`, b: pid, cat });
        const btns = buttonsOf(page);
        const sub = (span / slots) * 0.8;
        btns.forEach((btn, j) => {
          const ba = a - sub / 2 + sub * ((j + 0.5) / btns.length);
          nodes.push({ id: `m:${btn.id}`, x: cx + Math.cos(ba) * kx * RING.btn, y: cy + Math.sin(ba) * ky * RING.btn, cat, r: 1.5, depth: 3, label: btn.permission || btn.name, tone: toneOf(btn) });
          links.push({ a: pid, b: `m:${btn.id}`, cat });
        });
      });
      directBtns.forEach((btn, j) => {
        const ba = start + span * ((j + 0.5) / directBtns.length);
        nodes.push({ id: `m:${btn.id}`, x: cx + Math.cos(ba) * kx * RING.btn, y: cy + Math.sin(ba) * ky * RING.btn, cat, r: 1.5, depth: 3, label: btn.permission || btn.name, tone: toneOf(btn) });
        links.push({ a: `m:${top.id}`, b: `m:${btn.id}`, cat });
      });
    });
    return { nodes, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, sectors, tree, roleRows, showOrphans]);

  const networkLit = layer === "hub" && hoverBranch !== null ? catOf(flat.get(hoverBranch)!.menu) : null;

  const stagger = (i: number, n: number, base = 0) => base + i * Math.min(0.09, 1.6 / Math.max(n, 1));

  const { nodes, links } = useMemo<{ nodes: GraphNode[]; links: GraphLink[] }>(() => {
    const { w, h } = size;
    if (!w || !h || !tree.length) return { nodes: [], links: [] };
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    if (layer === "hub") {
      const { cx, cy, kx, ky } = geometry();
      nodes.push({ id: "root", x: cx, y: cy, size: 72, label: "导航", sub: `${total} 项`, kind: "core", interactive: false, float: true });
      sectors.forEach(({ menu: m, mid }, i) => {
        const id = `m:${m.id}`;
        nodes.push({
          id, x: cx + Math.cos(mid) * kx * RING.hub, y: cy + Math.sin(mid) * ky * RING.hub,
          size: 80, kind: "hub", label: m.name, sub: isLeafTop(m) ? (m.path || "") : `${pagesOf(m).length} 个页面`,
          cat: catOf(m), count: leaves(m) - 1 || undefined, ratio: grantedShare(m),
          from: "root", delay: 0.7 + i * 0.12, float: true,
        });
        links.push({ a: "root", b: id, flow: "both", cat: catOf(m), dashed: m.visible === 0 });
      });
      return { nodes, links };
    }

    const H = h;
    const W = w - leftPad - (layer === "page" && w >= 900 ? 392 : 0);
    const cy = COL_TOP + (H - COL_TOP - COL_BOTTOM) / 2;
    const branch = flat.get(branchId!)?.menu;
    if (!branch) return { nodes, links };

    if (layer === "branch") {
      const coreX = leftPad + Math.max(76, W * 0.06);
      const colX = coreX + 130;
      nodes.push({ id: "root", x: coreX, y: cy, size: 56, label: "导航", kind: "core", interactive: false });
      // 一级项竖排：选中居中放大，其余上下排开并退暗
      const tops = tree.filter((m) => m.type !== "btn");
      const others = tops.filter((m) => m.id !== branch.id);
      const order = [...others.slice(0, Math.ceil(others.length / 2)), branch, ...others.slice(Math.ceil(others.length / 2))];
      const k = order.findIndex((m) => m.id === branch.id);
      const gap = Math.min(130, (H - 120) / Math.max(order.length - 1, 1));
      order.forEach((m, i) => {
        const sel = m.id === branch.id;
        const id = `m:${m.id}`;
        nodes.push({ id, x: colX, y: cy + (i - k) * gap, size: sel ? 100 : 56, ratio: grantedShare(m), kind: "hub", label: m.name, sub: sel ? `${pagesOf(m).length} 个页面` : undefined, cat: catOf(m), count: sel ? leaves(m) - 1 : undefined, from: "root", float: true });
        links.push({ a: "root", b: id, flow: sel ? "both" : "none", shape: "h", cat: catOf(m) });
      });
      const pages = pagesOf(branch);
      const fanX = Math.min(Math.max(colX + 280, leftPad + W * 0.42), leftPad + W - 300);
      const span = Math.max(120, H - COL_TOP - COL_BOTTOM);
      const n = pages.length;
      const pgap = n > 1 ? Math.min(52, span / (n - 1)) : 0;
      const y0 = COL_TOP + span / 2 - (pgap * (n - 1)) / 2;
      pages.forEach((p, i) => {
        const id = `m:${p.id}`;
        nodes.push({
          id, x: fanX, y: y0 + i * pgap, kind: "item", align: "left", label: p.name,
          sub: p.permission || p.path || "", count: buttonsOf(p).length ? `${buttonsOf(p).length} 按钮` : undefined,
          cat: catOf(p), tone: toneOf(p), from: `m:${branch.id}`, delay: 0.15 + stagger(i, n),
        });
        links.push({ a: `m:${branch.id}`, b: id, flow: "forward", shape: "h", cat: catOf(branch), tone: isOrphan(p) ? "danger" : undefined, dashed: p.visible === 0 });
      });
      return { nodes, links };
    }

    // 页面层：角色 → 页面 → 按钮
    const entry = flat.get(focusId!);
    const page = entry?.menu.type === "btn" && entry.parent ? entry.parent : entry?.menu;
    if (!page) return { nodes, links };
    const pid = `m:${page.id}`;
    const cat = catOf(page);
    nodes.push({ id: pid, x: leftPad + W * 0.44, y: cy, kind: "item", label: page.name, sub: page.permission || page.path || "", cat, tone: toneOf(page), count: page.type === "dir" ? "目录" : "页面" });
    const btns = buttonsOf(page);
    const span = Math.max(120, H - COL_TOP - COL_BOTTOM);
    const bgap = btns.length > 1 ? Math.min(52, span / (btns.length - 1)) : 0;
    const by0 = COL_TOP + span / 2 - (bgap * (btns.length - 1)) / 2;
    btns.forEach((b, i) => {
      nodes.push({ id: `m:${b.id}`, x: leftPad + W * 0.72, y: by0 + i * bgap, kind: "item", align: "left", label: b.name, sub: b.permission || "缺少权限标识", cat, tone: toneOf(b), from: pid, delay: stagger(i, btns.length, 0.2) });
      links.push({ a: pid, b: `m:${b.id}`, flow: "forward", shape: "h", cat, tone: isDanger(b) ? "danger" : undefined });
    });
    const roles = holdersOf(page.permission);
    const rgap = roles.length > 1 ? Math.min(52, span / (roles.length - 1)) : 0;
    const ry0 = COL_TOP + span / 2 - (rgap * (roles.length - 1)) / 2;
    roles.forEach((r, i) => {
      nodes.push({ id: `role:${r.id}`, x: leftPad + W * 0.16, y: ry0 + i * rgap, kind: "item", align: "right", label: r.name, sub: r.code, cat: 3, tone: r.status === 1 ? undefined : "off", from: pid, delay: stagger(i, roles.length, 0.1) });
      links.push({ a: `role:${r.id}`, b: pid, flow: "forward", shape: "h", cat: 3 });
    });
    return { nodes, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, layer, tree, sectors, branchId, focusId, roleRows, showOrphans, leftPad]);

  const highlight = useMemo(() => {
    if (layer === "branch") return nodes.filter((nd) => !(nd.kind === "hub" && nd.id !== `m:${branchId}`)).map((nd) => nd.id);
    return null;
  }, [layer, nodes, branchId]);

  function onSelect(node: GraphNode) {
    if (node.id.startsWith("role:")) {
      navigate(`/role-trace?trace=role:${node.id.slice(5)}`);
      return;
    }
    if (node.id === "root") return;
    const id = Number(node.id.slice(2));
    const e = flat.get(id);
    if (!e) return;
    if (e.depth === 0) {
      setBranchId(id);
      setFocusId(isLeafTop(e.menu) ? id : null);
      setHoverBranch(null);
      return;
    }
    setFocusId(id);
  }
  function back() {
    if (focusId !== null) {
      const f = flat.get(focusId);
      if (f?.menu.type === "btn" && f.parent) { setFocusId(f.parent.id); return; }
      const leaf = branchId !== null && focusId === branchId;
      setFocusId(null);
      if (leaf) setBranchId(null);
      return;
    }
    setBranchId(null);
  }
  function onHover(id: string | null) {
    const n = id?.startsWith("m:") ? flat.get(Number(id.slice(2))) : null;
    setHoverBranch(n && n.depth === 0 ? n.menu.id : null);
  }
  function jump(id: number) {
    const e = flat.get(id);
    if (!e) return;
    let top: Entry | undefined = e;
    while (top && top.parent) top = flat.get(top.parent.id);
    setBranchId(top?.menu.id ?? null);
    setFocusId(e.depth === 0 && !isLeafTop(e.menu) ? null : id);
  }

  /* 图例发现 */
  const findings = useMemo(() => {
    let orphan = 0, noCode = 0, hidden = 0;
    flat.forEach(({ menu }) => {
      if (isDanger(menu)) noCode += 1;
      else if (isOrphan(menu)) orphan += 1;
      if (menu.visible === 0 && menu.type !== "btn") hidden += 1;
    });
    return { orphan, noCode, hidden };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, roleRows, showOrphans]);

  const orbits = useMemo(() => {
    if (layer !== "hub" || !size.w) return [];
    const { kx, ky } = geometry();
    return [RING.hub, RING.page, RING.btn].map((r) => ({ rx: kx * r, ry: ky * r }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, size]);

  /* crumbs（可点击跳转） */
  const crumbs = useMemo(() => {
    const list: Array<{ id: number; label: string }> = [];
    const b = branchId !== null ? flat.get(branchId) : null;
    if (b) list.push({ id: b.menu.id, label: b.menu.name });
    const fe = focusId !== null ? flat.get(focusId) : null;
    const pm = fe?.menu.type === "btn" && fe.parent ? fe.parent : fe?.menu;
    if (pm && pm.id !== b?.menu.id) list.push({ id: pm.id, label: pm.name });
    if (fe && fe.menu.type === "btn") list.push({ id: fe.menu.id, label: fe.menu.name });
    return list;
  }, [branchId, focusId, flat]);

  /* 分析栏 */
  const panel = useMemo(() => {
    if (focusId === null) return null;
    const entry = flat.get(focusId);
    if (!entry) return null;
    const m = entry.menu;
    const path: string[] = [];
    let cur: Entry | undefined = entry;
    while (cur) { path.unshift(cur.menu.name); cur = cur.parent ? flat.get(cur.parent.id) : undefined; }
    const holders = holdersOf(m.permission);
    const covered = holders.reduce((n, r) => n + (r.user_count || 0), 0);
    const sections: InsightSection[] = [];
    if ((m.children ?? []).length) {
      sections.push({
        title: m.type === "menu" ? "页面按钮" : "下级菜单",
        chips: true,
        rows: (m.children ?? []).map((c) => ({
          key: c.id, name: c.name, meta: c.permission || "", cat: catOf(c),
          tone: isDanger(c) ? ("warn" as const) : c.status !== 1 ? ("off" as const) : undefined,
          onClick: () => setFocusId(c.id),
        })),
      });
    }
    if (holders.length) {
      sections.push({
        title: "授予角色",
        chips: true,
        rows: holders.map((r) => ({ key: r.id, name: r.name, meta: r.code, cat: 3, onClick: () => navigate(`/role-trace?trace=role:${r.id}`) })),
      });
    }
    return {
      key: String(m.id),
      kind: TYPE_LABEL[m.type],
      kindIcon: m.type === "btn" ? <KeyOutlined /> : m.type === "dir" ? <AppstoreOutlined /> : <NavIconEl permission={m.permission} />,
      cat: catOf(m),
      title: m.name,
      subtitle: m.permission || m.path || "",
      status: path.join(" / "),
      tiles: [
        { label: "下级", value: (m.children ?? []).length },
        { label: "授予角色", value: holders.length },
        { label: "覆盖用户", value: covered },
      ],
      insights: [
        ...(isDanger(m) ? [{ tone: "danger" as const, title: "缺少权限标识", text: "按钮没有权限标识，前后端都无法据此校验。" }] : []),
        ...(isOrphan(m) ? [{ tone: "warn" as const, title: "孤立菜单", text: "除超级管理员外没有角色授予，普通用户无法访问。" }] : []),
        ...(m.visible === 0 ? [{ tone: "info" as const, title: "导航中隐藏", text: "不显示在侧栏，有权限的用户仍可通过地址访问。" }] : []),
        ...(m.status !== 1 ? [{ tone: "warn" as const, title: "已停用", text: "停用后所有角色都无法访问该项及其下级。" }] : []),
      ],
      sections,
      menu: m,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, flat, roleRows, showOrphans]);

  /* ═══════════════ 渲染 ═══════════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>菜单管理</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 6 }}>
            维护导航目录、页面与按钮权限，配置菜单层级、显示状态和角色授权标识。
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={view}
            onChange={(v) => setView(v as "star" | "table")}
            options={[{ label: "星图", value: "star" }, { label: "表格", value: "table" }]}
          />
          <button className="lv-btn lv-btn--primary" type="button" data-act="create" onClick={() => openCreate()}>
            <PlusOutlined /> 新增目录
          </button>
        </div>
      </div>

      {view === "table" ? (
        <>
          {/* 查询面板 */}
          <div className="lv-query">
            <Input
              allowClear
              prefix={<MenuOutlined style={{ color: "var(--lv-faint)" }} />}
              placeholder="菜单名称 / 权限标识"
              style={{ width: 240 }}
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onPressEnter={() => { setKw(kwInput.trim()); loadTree({ keyword: kwInput.trim() || undefined, status: statusF || undefined }); }}
            />
            <Select
              allowClear
              placeholder="全部状态"
              style={{ width: 130 }}
              value={statusF || undefined}
              onChange={(v) => { setStatusF(v || ""); loadTree({ keyword: kw || undefined, status: v || undefined }); }}
              options={[{ value: "1", label: "正常" }, { value: "0", label: "停用" }]}
            />
            <div className="lv-query-actions">
              <button className="lv-btn" type="button" onClick={() => { setKwInput(""); setKw(""); setStatusF(""); loadTree(); }}>重置</button>
              <button className="lv-btn lv-btn--primary" type="button" onClick={() => { setKw(kwInput.trim()); loadTree({ keyword: kwInput.trim() || undefined, status: statusF || undefined }); }}>查询</button>
            </div>
          </div>

          {/* 菜单树面板 */}
          <section className="lv-panel">
            <div className="lv-panel-head">
              <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
              <span className="lv-panel-title">菜单树</span>
              <span className="lv-panel-meta">共 {total} 条</span>
              <div className="lv-panel-tools">
                <button className="icon-btn" title="全部收起" onClick={() => setExpandedKeys([])}><ShrinkOutlined /></button>
                <button className="icon-btn" title="展开页面级" onClick={() => setExpandedKeys(tree.flatMap((d) => [d.id, ...(d.children ?? []).map((p) => p.id)]))}><NodeIndexOutlined /></button>
                <button className="icon-btn" title="刷新" onClick={() => loadTree({ keyword: kw || undefined, status: statusF || undefined })}><ReloadOutlined /></button>
                <button className="icon-btn" title="导出 CSV" onClick={exportCsv}><DownloadOutlined /></button>
              </div>
            </div>
            <Table
              rowKey="id"
              size="middle"
              loading={loading}
              dataSource={tree}
              pagination={false}
              scroll={{ x: 1100 }}
              expandable={{ expandedRowKeys: expandedKeys, onExpandedRowsChange: (k) => setExpandedKeys([...k]) }}
              locale={{ emptyText: "暂无菜单" }}
              columns={columns as never}
            />
            <div className="lv-pager">
              <span className="lv-pager-meta">共 {total} 条</span>
            </div>
          </section>
        </>
      ) : (
        <div className="lv-panel md-no-lift" style={{ overflow: "hidden", position: "relative" }}>
          <StageGraph
            className="trace-stage starmap"
            style={{ height: "max(620px, calc(100dvh - 236px))" }}
            variant="stage"
            label="导航星系"
            nodes={nodes}
            links={links}
            size={size}
            onSize={setSize}
            activeId={focusId !== null ? `m:${focusId}` : null}
            highlight={highlight}
            network={network}
            networkFocus={networkLit}
            networkAlpha={layer === "hub" ? 1 : layer === "branch" ? 0.3 : 0.12}
            orbits={orbits}
            onSelect={onSelect}
            onBack={back}
            onHover={onHover}
            tl={
              <nav className="trace-crumbs" aria-label="星系路径">
                {layer !== "hub" && (
                  <button type="button" aria-label="返回上一层" onClick={back} style={{ border: 0, background: "none", cursor: "pointer", color: "var(--lv-soft)", padding: "0 2px" }}>‹</button>
                )}
                <button type="button" className={layer === "hub" ? "is-current" : ""} onClick={() => { setFocusId(null); setBranchId(null); }}>
                  <MenuOutlined style={{ fontSize: 12 }} />导航
                </button>
                {crumbs.map((c, i) => (
                  <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span className="trace-sep" aria-hidden="true">/</span>
                    {i === crumbs.length - 1
                      ? <b className="is-current">{c.label}</b>
                      : <button type="button" onClick={() => jump(c.id)}>{c.label}</button>}
                  </span>
                ))}
              </nav>
            }
            tr={
              layer === "hub" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <dl className="trace-legend">
                    {roleRows.length > 0 && (
                      <div
                        className={`is-warn${showOrphans ? " is-on" : ""}`}
                        role="button" tabIndex={0}
                        style={{ cursor: "pointer" }}
                        onClick={() => setShowOrphans(!showOrphans)}
                        onKeyDown={(e) => { if (e.key === "Enter") setShowOrphans(!showOrphans); }}
                      >
                        <dt><button type="button" aria-pressed={showOrphans} style={{ border: 0, background: "none", font: "inherit", color: "inherit", cursor: "pointer", padding: 0 }}>孤立页面</button></dt>
                        <dd className="tnum">{findings.orphan}</dd>
                      </div>
                    )}
                    <div className="is-warn"><dt>缺权限标识</dt><dd className="tnum">{findings.noCode}</dd></div>
                    <div><dt>隐藏项</dt><dd className="tnum">{findings.hidden}</dd></div>
                  </dl>
                  <button
                    type="button"
                    className="stage-chip"
                    aria-pressed={showPreview}
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    <MenuOutlined style={{ fontSize: 12 }} />导航预览
                  </button>
                </div>
              ) : null
            }
          />

          {/* 导航预览：舞台内左上玻璃浮卡 */}
          {leftPad > 0 && (
            <nav
              className="nav-preview"
              aria-label="导航预览"
              data-cell="nav-preview"
              style={{
                position: "absolute", zIndex: 5, left: 16, top: 68,
                maxHeight: "calc(100% - 84px)", width: 210, overflowY: "auto",
                padding: "10px 8px", borderRadius: 20,
                background: "rgba(255,255,255,.94)", border: "1px solid var(--lv-line)",
                boxShadow: "var(--lv-e1)", backdropFilter: "blur(16px)",
              }}
            >
              <span className="nav-preview-title" style={{ display: "block", padding: "0 8px 8px", fontSize: 11.5, fontWeight: 650, color: "var(--lv-soft)" }}>
                侧栏预览
              </span>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {tree.filter((m) => m.type !== "btn").map((dir) => (
                  <li key={dir.id} style={{ opacity: dir.status !== 1 ? 0.45 : 1 }}>
                    <button
                      type="button"
                      className={`nav-preview-item${branchId === dir.id ? " is-on" : ""}`}
                      onClick={() => jump(dir.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "5px 8px",
                        border: 0, borderRadius: 8, background: branchId === dir.id ? "var(--lv-blue-soft)" : "none",
                        color: branchId === dir.id ? "var(--lv-blue)" : "var(--lv-muted)",
                        font: "inherit", fontSize: 12, textAlign: "left", cursor: "pointer",
                        fontWeight: branchId === dir.id ? 600 : 400,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: CAT_INK[catOf(dir)], flex: "none" }} />
                      {dir.name}
                      {dir.visible === 0 && <EyeOutlined style={{ fontSize: 10, marginLeft: "auto", color: "var(--lv-faint)" }} />}
                    </button>
                    <ul style={{ listStyle: "none", margin: "1px 0 4px 16px", padding: 0, borderLeft: "1px solid var(--lv-line)" }}>
                      {pagesOf(dir).map((p) => (
                        <li key={p.id} style={{ opacity: p.status !== 1 ? 0.45 : 1 }}>
                          <button
                            type="button"
                            className="nav-preview-item is-sub"
                            data-act="goto-page"
                            onClick={() => { if (p.path?.startsWith("/")) navigate(p.path); }}
                            style={{
                              display: "block", width: "100%", padding: "4px 8px",
                              border: 0, borderRadius: 7, background: "none", color: "var(--lv-muted)",
                              font: "inherit", fontSize: 11.5, textAlign: "left", cursor: "pointer",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f7fb"; e.currentTarget.style.color = "var(--lv-ink)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--lv-muted)"; }}
                          >
                            {p.name}
                            {p.visible === 0 && <EyeOutlined style={{ fontSize: 10, marginLeft: 6, color: "var(--lv-faint)" }} />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <p className="trace-hint" style={{ position: "absolute", left: "50%", top: 22, transform: "translateX(-50%)", margin: 0, fontSize: 12, color: "var(--lv-soft)", pointerEvents: "none", whiteSpace: "nowrap", zIndex: 1 }}>
            {layer === "hub" ? "点击表盘展开分支 · 刻度为已授权页面占比" : layer === "branch" ? "点击页面查看它的按钮与授权角色" : "角色 → 页面 → 按钮 授权链路"}
          </p>

          {/* 分析栏 */}
          {panel && (
            <div className="trace-panel">
              <InsightPanel
                key={panel.key}
                title={panel.title}
                sub={panel.subtitle}
                kind={panel.kind}
                kindIcon={panel.kindIcon}
                cat={panel.cat}
                status={panel.status}
                tiles={panel.tiles}
                insights={panel.insights}
                sections={panel.sections}
                onClose={back}
                actions={
                  <div style={{ display: "flex", gap: 8 }}>
                    {panel.menu.type !== "btn" && (
                      <button className="lv-btn" type="button" onClick={() => openCreate(panel.menu)}>
                        <PlusOutlined /> {panel.menu.type === "dir" ? "新增菜单" : "新增按钮"}
                      </button>
                    )}
                    <button className="lv-btn lv-btn--primary" type="button" onClick={() => openEdit(panel.menu)}>
                      <EditOutlined /> 编辑
                    </button>
                  </div>
                }
              />
            </div>
          )}
        </div>
      )}

      {/* 新增 / 编辑菜单弹窗 */}
      <Modal
        title={editing ? "编辑菜单" : "新增菜单"}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={submitForm}
        confirmLoading={saving}
        okText={editing ? "保存" : "新增"}
        width={620}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="菜单类型" style={{ marginBottom: 14 }}>
            <Segmented
              value={formType}
              onChange={(v) => { setFormType(v as MenuType); form.setFieldValue("type", v); }}
              options={[{ label: "目录", value: "dir" }, { label: "菜单", value: "menu" }, { label: "按钮", value: "btn" }]}
            />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="parent_id" label="上级菜单">
              <Select
                showSearch
                optionFilterProp="label"
                options={parentOptions.map((o) => ({ label: `${"　".repeat(o.depth)}${o.label}`, value: o.value, disabled: o.disabled }))}
              />
            </Form.Item>
            <Form.Item name="name" label="菜单名称" rules={[{ required: true, message: "请输入菜单名称" }]}>
              <Input placeholder="如：用户管理" />
            </Form.Item>
            {formType !== "btn" && (
              <Form.Item name="icon" label="图标">
                <Input placeholder="图标名（留空则按导航自动匹配）" />
              </Form.Item>
            )}
            {formType !== "btn" && (
              <Form.Item name="path" label="路由路径" rules={[{ required: true, message: "请输入路由路径" }, { pattern: /^\//, message: "路由路径以 / 开头" }]}>
                <Input placeholder="如：/system/user" />
              </Form.Item>
            )}
            {formType === "menu" && (
              <Form.Item name="component" label="组件路径" rules={[{ required: true, message: "请输入组件路径" }]} extra="填写已注册页面的组件标识">
                <Input placeholder="如：system/user/index" />
              </Form.Item>
            )}
            {formType !== "dir" && (
              <Form.Item
                name="permission"
                label="权限标识"
                rules={formType === "btn" ? [{ required: true, message: "请输入权限标识" }] : []}
                extra="用于角色授权和对应操作的权限校验"
              >
                <Input placeholder="如：medicode:users:add" />
              </Form.Item>
            )}
            <Form.Item name="sort" label="显示排序">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          {formType !== "btn" && (
            <Form.Item name="visible" label="导航显示" valuePropName="checked" style={{ marginBottom: 14 }}>
              <Switch checkedChildren="在导航中显示" unCheckedChildren="隐藏" />
            </Form.Item>
          )}
          <Form.Item name="status" label="菜单状态" valuePropName="checked">
            <Switch checkedChildren="正常" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/* ---------- 辅助：导航图标（按页面 permission=导航 key 匹配侧栏图标） ---------- */
const ICON_REGISTRY: Record<string, ReactNode> = (() => {
  const map: Record<string, ReactNode> = {};
  try {
    buildNavGroups().forEach((g) => g.items.forEach((it) => { map[it.key] = it.icon; }));
  } catch { /* 忽略 */ }
  return map;
})();

function NavIconEl({ permission }: { permission: string }) {
  return <>{ICON_REGISTRY[permission] ?? <FileTextOutlined style={{ color: "var(--lv-soft)", fontSize: 13 }} />}</>;
}

function NavIcon({ permission }: { permission: string }) {
  return <span style={{ display: "inline-flex", color: "var(--lv-soft)", fontSize: 13 }}><NavIconEl permission={permission} /></span>;
}
