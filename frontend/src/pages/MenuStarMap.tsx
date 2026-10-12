/**
 * 菜单管理 —— 导航星图（逐行移植 scaffold MenuStarMap.vue 的三层下钻几何）
 *
 * - 全景：中心珍珠球「导航」(size 72)，三圈椭圆轨道（0.52 / 0.77 / 0.97）；
 *   一级目录是内圈玻璃刻度表盘（size 80，刻度 = 已授权页面占比），页面作为真实点位
 *   排在中圈（r 2.8），按一级分支着分类色；悬停表盘点亮整条分支
 * - 分支：点表盘 → 珍珠球退左、一级项竖排，下属页面以带标签胶囊触须扇形长出
 * - 页面：授予它的角色在左（来自 /api/roles 菜单授权），脉冲 角色 → 页面
 * - 右上图例（孤立页面/缺权限标识/隐藏项）与「导航预览」开关；左玻璃浮卡即时渲染侧栏样子
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Segmented, message } from "antd";
import { PlusOutlined, MenuOutlined } from "@ant-design/icons";
import StageGraph, { type GraphNode, type GraphLink } from "../components/StageGraph";
import { buildNavGroups, type NavGroup } from "../config/nav";
import { useAuth } from "../stores/auth";
import { listRoles, type RoleItem } from "../api/roles";

const CAT_INK: Record<number, string> = {
  1: "#7a5a16", 2: "#275a96", 3: "#5b4597", 4: "#94384c", 5: "#2d7140",
};

const RING = { hub: 0.52, page: 0.77, btn: 0.97 };
const PREVIEW_W = 226;
const COL_TOP = 76;
const COL_BOTTOM = 40;

export default function MenuStarMap() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [view, setView] = useState<"star" | "table">("star");
  const [size, setSize] = useState({ w: 900, h: 620 });
  const [showPreview, setShowPreview] = useState(true);

  const groups: NavGroup[] = useMemo(
    () => buildNavGroups().filter((g) => user?.role === "admin" || !g.adminOnly),
    [user?.role]
  );

  /* 授权数据：页面 → 授予它的启用非内置角色数（/api/roles 的 menu_ids） */
  const [roleRows, setRoleRows] = useState<RoleItem[]>([]);
  useEffect(() => {
    if (user?.role !== "admin") return;
    listRoles({ page: 1, page_size: 100 })
      .then((r) => setRoleRows(r.items || []))
      .catch(() => {});
  }, [user?.role]);

  const grantCount = useCallback(
    (pageKey: string) => {
      if (!roleRows.length) return null;
      return roleRows.filter((r) => !r.builtin && r.status === 1 && (r.menu_ids || []).includes(pageKey)).length;
    },
    [roleRows]
  );

  /* ── 层级状态 ── */
  const [branchIdx, setBranchIdx] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<{ g: number; i: number } | null>(null);
  const [hoverBranch, setHoverBranch] = useState<number | null>(null);
  const layer: "hub" | "branch" | "page" = focusIdx ? "page" : branchIdx !== null ? "branch" : "hub";

  const totalPages = groups.reduce((n, g) => n + g.items.length, 0);
  const pageAt = (g: number, i: number) => groups[g]?.items[i];
  const keyAt = (g: number, i: number) => `pg-${g}-${i}`;

  /** 表盘读数：分支内页面被普通角色授权的比例 */
  const grantedShare = useCallback(
    (g: number) => {
      const items = groups[g]?.items ?? [];
      if (!items.length || !roleRows.length) return 0;
      return items.filter((it) => (grantCount(it.key) ?? 0) > 0).length / items.length;
    },
    [groups, grantCount]
  );

  /* 授予某页面的角色（页面层用） */
  const holdersOf = useCallback(
    (pageKey: string) =>
      roleRows.filter((r) => !r.builtin && (r.menu_ids || []).includes(pageKey)),
    [roleRows]
  );

  /* ── 全景几何：以珍珠球为心的三圈椭圆 ── */
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

  /* 每个一级目录的扇区：按页面数加权，保底份额保证表盘间距 */
  const sectors = useMemo(() => {
    const weight = (m: NavGroup) => Math.max(m.items.length + 1, (totalPages + groups.length) / Math.max(1, groups.length * 0.85));
    const total = groups.reduce((a, m) => a + weight(m), 0) || 1;
    let cursor = -Math.PI / 2 - (weight(groups[0] ?? ({} as NavGroup)) / total) * Math.PI;
    return groups.map((m) => {
      const span = (weight(m) / total) * Math.PI * 2;
      const s = { g: m, idx: groups.indexOf(m), start: cursor, span, mid: cursor + span / 2 };
      cursor += span;
      return s;
    });
  }, [groups, totalPages]);

  /* ── 背景网络：表盘锚点（内圈）+ 页面点（中圈）── */
  const network = useMemo(() => {
    const { w, h } = size;
    if (!w || !h || !groups.length) return null;
    const { cx, cy, kx, ky } = geometry();
    const nodes: Array<{ id: string; x: number; y: number; cat: number; r: number; depth: number }> = [];
    const links: Array<{ a: string; b: string; cat: number }> = [];
    sectors.forEach(({ g, idx, start, span, mid }) => {
      const cat = g.cat;
      nodes.push({ id: `m:${idx}`, x: cx + Math.cos(mid) * kx * RING.hub, y: cy + Math.sin(mid) * ky * RING.hub, cat, r: 0.1, depth: 1 });
      const pages = g.items;
      const slots = pages.length || 1;
      pages.forEach((page, i) => {
        const a = start + span * ((i + 0.5) / slots);
        const id = `pg-${idx}-${i}`;
        nodes.push({ id, x: cx + Math.cos(a) * kx * RING.page, y: cy + Math.sin(a) * ky * RING.page, cat, r: 2.8, depth: 2 });
        links.push({ a: `m:${idx}`, b: id, cat });
      });
    });
    return { nodes, links };
  }, [size, sectors, groups]);

  const networkLit = layer === "hub" && hoverBranch !== null ? groups[hoverBranch]?.cat ?? null : null;

  /* ── 场景 ── */
  const stagger = (i: number, n: number, base = 0) => base + i * Math.min(0.09, 1.6 / Math.max(n, 1));

  const { nodes, links } = useMemo<{ nodes: GraphNode[]; links: GraphLink[] }>(() => {
    const { w, h } = size;
    if (!w || !h || !groups.length) return { nodes: [], links: [] };
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    if (layer === "hub") {
      const { cx, cy, kx, ky } = geometry();
      nodes.push({ id: "root", x: cx, y: cy, size: 72, label: "导航", sub: `${totalPages} 项`, kind: "core", interactive: false, float: true });
      sectors.forEach(({ g, idx, mid }) => {
        const id = `m:${idx}`;
        nodes.push({
          id, x: cx + Math.cos(mid) * kx * RING.hub, y: cy + Math.sin(mid) * ky * RING.hub,
          size: 80, kind: "hub", label: g.short, sub: `${g.items.length} 个页面`,
          cat: g.cat, count: g.items.length, ratio: grantedShare(idx),
          from: "root", delay: 0.7 + idx * 0.12, float: true,
        });
        links.push({ a: "root", b: id, flow: "both", cat: g.cat });
      });
      return { nodes, links };
    }

    const H = h;
    const left = 0;
    const W = w - (layer === "page" && w >= 900 ? 392 : 0);
    const cy = COL_TOP + (H - COL_TOP - COL_BOTTOM) / 2;
    const branch = groups[branchIdx!];
    if (!branch) return { nodes, links };

    if (layer === "branch") {
      const coreX = left + Math.max(76, W * 0.06);
      const colX = coreX + 130;
      nodes.push({ id: "root", x: coreX, y: cy, size: 56, label: "导航", kind: "core", interactive: false });
      // 一级项竖排：选中居中放大，其余上下排开并退暗
      const others = groups.map((m, i) => ({ m, i })).filter(({ i }) => i !== branchIdx);
      const order = [...others.slice(0, Math.ceil(others.length / 2)), { m: branch, i: branchIdx! }, ...others.slice(Math.ceil(others.length / 2))];
      const k = order.findIndex(({ i }) => i === branchIdx);
      const gap = Math.min(130, (H - 120) / Math.max(order.length - 1, 1));
      order.forEach(({ m, i }, oi) => {
        const sel = i === branchIdx;
        const id = `m:${i}`;
        nodes.push({ id, x: colX, y: cy + (oi - k) * gap, size: sel ? 100 : 56, ratio: grantedShare(i), kind: "hub", label: m.short, sub: sel ? `${m.items.length} 个页面` : undefined, cat: m.cat, count: sel ? m.items.length : undefined, from: "root", float: true });
        links.push({ a: "root", b: id, flow: sel ? "both" : "none", shape: "h", cat: m.cat });
      });
      const pages = branch.items;
      const fanX = Math.min(Math.max(colX + 280, left + W * 0.42), left + W - 300);
      const span = Math.max(120, H - COL_TOP - COL_BOTTOM);
      const n = pages.length;
      const pgap = n > 1 ? Math.min(52, span / (n - 1)) : 0;
      const y0 = COL_TOP + span / 2 - (pgap * (n - 1)) / 2;
      pages.forEach((p, i) => {
        const id = keyAt(branchIdx!, i);
        nodes.push({ id, x: fanX, y: y0 + i * pgap, kind: "item", align: "left", label: p.name, sub: p.to ?? "", cat: branch.cat, from: `m:${branchIdx}`, delay: 0.15 + stagger(i, n) });
        links.push({ a: `m:${branchIdx}`, b: id, flow: "forward", shape: "h", cat: branch.cat });
      });
      return { nodes, links };
    }

    // 页面层：授权角色 → 页面
    const page = pageAt(focusIdx!.g, focusIdx!.i)!;
    const pid = keyAt(focusIdx!.g, focusIdx!.i);
    const cat = branch!.cat;
    nodes.push({ id: pid, x: left + W * 0.44, y: cy, kind: "item", label: page.name, sub: page.to ?? "", cat, count: "页面" });
    const roles = holdersOf(page.key);
    const span = Math.max(120, H - COL_TOP - COL_BOTTOM);
    const n = roles.length;
    const rgap = n > 1 ? Math.min(52, span / (n - 1)) : 0;
    const ry0 = COL_TOP + span / 2 - (rgap * (n - 1)) / 2;
    roles.forEach((r, i) => {
      nodes.push({ id: `role:${r.id}`, x: left + W * 0.16, y: ry0 + i * rgap, kind: "item", align: "right", label: r.name, sub: r.code, cat: 3, from: pid, delay: stagger(i, n, 0.1) });
      links.push({ a: `role:${r.id}`, b: pid, flow: "forward", shape: "h", cat: 3 });
    });
    return { nodes, links };
  }, [size, layer, groups, sectors, branchIdx, focusIdx, grantedShare, holdersOf, totalPages]);

  const highlight = useMemo(() => {
    if (layer === "branch") return nodes.filter((nd) => !(nd.kind === "hub" && nd.id !== `m:${branchIdx}`)).map((nd) => nd.id);
    return null;
  }, [layer, nodes, branchIdx]);

  function onSelect(node: GraphNode) {
    if (node.id.startsWith("role:")) {
      navigate(`/role-trace?trace=role:${node.id.slice(5)}`);
      return;
    }
    if (node.id === "root") return;
    if (node.id.startsWith("m:")) {
      const idx = Number(node.id.slice(2));
      setBranchIdx(idx);
      setFocusIdx(null);
      setHoverBranch(null);
      return;
    }
    const m = node.id.match(/^pg-(\d+)-(\d+)$/);
    if (m) setFocusIdx({ g: Number(m[1]), i: Number(m[2]) });
  }
  function back() {
    if (focusIdx) { setFocusIdx(null); return; }
    setBranchIdx(null);
  }
  function onHover(id: string | null) {
    const m = id?.startsWith("m:") ? Number(id.slice(2)) : null;
    setHoverBranch(m !== null && layer === "hub" ? m : null);
  }

  /* 图例与发现（对齐 scaffold trace-legend：孤立页面 / 缺权限标识 / 隐藏项） */
  const findings = useMemo(() => {
    let orphan = 0;
    groups.forEach((g) => g.items.forEach((it) => {
      const c = grantCount(it.key);
      if (c !== null && c === 0) orphan += 1;
    }));
    return { orphan, noCode: 0, hidden: 0 };
  }, [groups, grantCount]);

  const orbits = useMemo(() => {
    if (layer !== "hub" || !size.w) return [];
    const { kx, ky } = geometry();
    return [RING.hub, RING.page, RING.btn].map((r) => ({ rx: kx * r, ry: ky * r }));
  }, [layer, size]);

  const rows = useMemo(
    () => groups.flatMap((g) => g.items.map((it) => ({ group: g.short, cat: g.cat, name: it.name, to: it.to }))),
    [groups]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>菜单管理</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 6 }}>
            维护导航目录、页面与按钮权限，配置菜单路径、显示状态和角色授权标识。
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={view}
            onChange={(v) => setView(v as "star" | "table")}
            options={[{ label: "星图", value: "star" }, { label: "表格", value: "table" }]}
          />
          <button
            className="lv-btn lv-btn--primary" type="button" data-act="create"
            onClick={() => message.info("导航目录由前端配置统一管理，业务页面可在低代码工作台扩展")}
          >
            <PlusOutlined /> 新增目录
          </button>
        </div>
      </div>

      {view === "star" ? (
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
            activeId={focusIdx ? keyAt(focusIdx.g, focusIdx.i) : null}
            highlight={highlight}
            network={network}
            networkFocus={networkLit}
            networkAlpha={layer === "hub" ? 1 : layer === "branch" ? 0.3 : 0.12}
            orbits={orbits}
            onSelect={onSelect}
            onBack={back}
            onHover={onHover}
            tl={
              <nav className="trace-crumbs" aria-label="星系路径" style={{ background: "rgba(255,255,255,.92)", boxShadow: "var(--lv-e1)", borderRadius: 999, padding: "5px 14px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--lv-ink)" }}>
                  <MenuOutlined style={{ fontSize: 12 }} />导航
                </span>
                {branchIdx !== null && (
                  <>
                    <span className="trace-sep" aria-hidden="true">/</span>
                    <b style={{ fontSize: 12.5, color: "var(--lv-ink)" }}>{groups[branchIdx]?.short}</b>
                  </>
                )}
                {focusIdx && (
                  <>
                    <span className="trace-sep" aria-hidden="true">/</span>
                    <b style={{ fontSize: 12.5, color: "var(--lv-ink)" }}>{pageAt(focusIdx.g, focusIdx.i)?.name}</b>
                  </>
                )}
              </nav>
            }
            tr={
              layer === "hub" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <dl className="trace-legend" style={{ background: "rgba(255,255,255,.92)", boxShadow: "var(--lv-e1)", margin: 0 }}>
                    <div className="is-warn"><dt>孤立页面</dt><dd className="tnum">{findings.orphan}</dd></div>
                    <div className="is-warn"><dt>缺权限标识</dt><dd className="tnum">{findings.noCode}</dd></div>
                    <div><dt>隐藏项</dt><dd className="tnum">{findings.hidden}</dd></div>
                  </dl>
                  <button
                    type="button"
                    className="stage-chip"
                    aria-pressed={showPreview}
                    onClick={() => setShowPreview(!showPreview)}
                    style={{ background: "rgba(255,255,255,.92)", boxShadow: "var(--lv-e1)" }}
                  >
                    <MenuOutlined style={{ fontSize: 12 }} />导航预览
                  </button>
                </div>
              ) : null
            }
          />

          {/* 导航预览：舞台内左上玻璃浮卡（scaffold nav-preview） */}
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
                {groups.map((g, gi) => (
                  <li key={g.short}>
                    <button
                      type="button"
                      className={`nav-preview-item${branchIdx === gi ? " is-on" : ""}`}
                      onClick={() => { setBranchIdx(branchIdx === gi ? null : gi); setFocusIdx(null); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "5px 8px",
                        border: 0, borderRadius: 8, background: branchIdx === gi ? "var(--lv-blue-soft)" : "none",
                        color: branchIdx === gi ? "var(--lv-blue)" : "var(--lv-muted)",
                        font: "inherit", fontSize: 12, textAlign: "left", cursor: "pointer",
                        fontWeight: branchIdx === gi ? 600 : 400,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: CAT_INK[g.cat], flex: "none" }} />
                      {g.short}
                      <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--lv-faint)" }}>{g.items.length}</span>
                    </button>
                    <ul style={{ listStyle: "none", margin: "1px 0 4px 16px", padding: 0, borderLeft: "1px solid var(--lv-line)" }}>
                      {g.items.map((it, ii) => (
                        <li key={it.key}>
                          <button
                            type="button"
                            className="nav-preview-item is-sub"
                            data-act="goto-page"
                            onClick={() => { if (it.to) navigate(it.to); }}
                            style={{
                              display: "block", width: "100%", padding: "4px 8px",
                              border: 0, borderRadius: 7, background: "none", color: "var(--lv-muted)",
                              font: "inherit", fontSize: 11.5, textAlign: "left", cursor: "pointer",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f7fb"; e.currentTarget.style.color = "var(--lv-ink)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--lv-muted)"; }}
                          >
                            {it.name}
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
            {layer === "hub" ? "点击表盘展开分支 · 刻度为已授权页面占比" : layer === "branch" ? "点击页面查看它的授权角色" : "角色 → 页面 授权链路"}
          </p>
        </div>
      ) : (
        <div className="lv-panel">
          <div className="lv-panel-head">
            <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
            <span className="lv-panel-title">菜单目录</span>
            <span className="lv-panel-meta">共 {rows.length} 个页面</span>
          </div>
          <Table rowKey={(r) => `${r.group}-${r.name}`} size="middle" pagination={false} dataSource={rows} scroll={{ x: 720 }}
            columns={[
              { title: "目录", dataIndex: "group", width: 150, render: (v: string, r: any) => (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: CAT_INK[r.cat] }} />{v}
                </span>
              ) },
              { title: "页面", dataIndex: "name", render: (v: string) => <span style={{ fontWeight: 600, color: "var(--lv-ink)" }}>{v}</span> },
              { title: "路径", dataIndex: "to", render: (v: string) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{v || "—"}</span> },
            ]} />
          <div className="lv-pager">
            <span className="lv-pager-meta">共 {rows.length} 个页面 · {groups.length} 个目录</span>
          </div>
        </div>
      )}
    </div>
  );
}
