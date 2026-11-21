/**
 * 部门管理 —— 移植自 scaffold Depts.vue（组织架构树 + 画布四角面板 + 表格 CRUD）。
 *
 * 语汇：
 *   画布视图 = 整齐树布局铺满内容区（对齐 OrgCanvas），四角浮动玻璃面板：
 *     tl = 部门信息卡（路径 + 负责人/电话/邮箱/状态）
 *     tr = 部门读数铭牌（本部门 / 含下级 / 下级部门 / 层级）
 *     bl = 成员列表（头像 + 姓名 + 岗位）
 *     br = 操作组（新增下级 / 编辑 / 删除）
 *   表格视图 = 树形部门列表（名称/负责人/电话/邮箱/人数/排序/状态/操作）。
 *
 * 数据来源：/api/depts（sys_depts 表）；成员取 /users 按 department 匹配。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button, Empty, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Select, Spin, Switch, Table, TreeSelect, message } from "antd";
import {
  ApartmentOutlined,
  CompressOutlined,
  DeleteOutlined,
  EditOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useAuth } from "../stores/auth";
import { fetchDeptTree, createDept, updateDept, removeDept, type DeptItem, type DeptPayload } from "../api/depts";
import { listUsers, type UserItem } from "../api/users";
import SpecPlate from "../components/instruments/SpecPlate";
import { roleMeta } from "../config/nav";

const NODE_W = 196;
const NODE_H = 72;
const GAP_X = 26;
const GAP_Y = 64;

const catOf = (branch: number) => ((branch - 1) % 5) + 1;

interface LaidNode {
  dept: DeptItem;
  x: number;
  y: number;
  depth: number;
  branch: number;
  parentId: number | null;
  hasChildren: boolean;
  collapsed: boolean;
}

/** 树里找某节点，返回其祖先路径（含自身） */
function findPath(nodes: DeptItem[], id: number, trail: DeptItem[] = []): DeptItem[] | null {
  for (const n of nodes) {
    const next = [...trail, n];
    if (n.id === id) return next;
    const hit = findPath(n.children ?? [], id, next);
    if (hit) return hit;
  }
  return null;
}

/** 收集某部门及其全部后代的 id（编辑时排除，防止把自己挂到自己下面） */
function collectIds(node: DeptItem): number[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}

function sumMembers(node: DeptItem): number {
  return (node.member_count ?? 0) + (node.children ?? []).reduce((a, c) => a + sumMembers(c), 0);
}

function countDescendants(node: DeptItem): number {
  return (node.children ?? []).reduce((a, c) => a + 1 + countDescendants(c), 0);
}

export default function DeptManage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tree, setTree] = useState<DeptItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"canvas" | "table">("canvas");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [members, setMembers] = useState<UserItem[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // 查询
  const [kwInput, setKwInput] = useState("");
  const [kw, setKw] = useState("");
  const [statusF, setStatusF] = useState("");

  // 表单
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DeptItem | null>(null);
  const [form] = Form.useForm();
  const [formSaving, setFormSaving] = useState(false);
  const [excludeIds, setExcludeIds] = useState<number[]>([]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const viewState = useRef({ x: 0, y: 0, k: 1 });
  const animTimer = useRef(0);
  const panRef = useRef<{ id: number; x: number; y: number; vx: number; vy: number } | null>(null);
  const playedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDeptTree({ keyword: kw || undefined, status: statusF || undefined });
      setTree(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载部门数据失败");
    } finally {
      setLoading(false);
    }
  }, [kw, statusF]);

  useEffect(() => {
    load();
  }, [load]);

  // 成员（按 department 匹配；仅管理员可读 /users）
  useEffect(() => {
    if (!isAdmin) {
      setMembers([]);
      return;
    }
    listUsers({ page_size: 100 })
      .then((r) => setMembers(r.items || []))
      .catch(() => setMembers([]));
  }, [isAdmin]);

  /* ---------- 树布局（叶子游标 + 父节点取子节点中点） ---------- */
  const layout = useMemo(() => {
    const nodes: LaidNode[] = [];
    let cursor = 0;
    const place = (dept: DeptItem, depth: number, branch: number, parentId: number | null): number => {
      const collapsed = overrides[dept.id] ?? (dept.children?.length ?? 0) > 6;
      const kids = collapsed ? [] : dept.children ?? [];
      let x: number;
      if (!kids.length) {
        x = cursor;
        cursor += NODE_W + GAP_X;
      } else {
        const xs = kids.map((child, i) => place(child, depth + 1, depth === 0 ? i + 1 : branch, dept.id));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      nodes.push({ dept, x, y: depth * (NODE_H + GAP_Y), depth, branch, parentId, hasChildren: Boolean(dept.children?.length), collapsed });
      return x;
    };
    tree.forEach((root, i) => place(root, 0, i + 1, null));
    nodes.sort((a, b) => a.depth - b.depth || a.x - b.x);

    const byId = new Map(nodes.map((n) => [n.dept.id, n] as const));
    const links = nodes
      .filter((n) => n.parentId !== null && byId.has(n.parentId))
      .map((n) => {
        const p = byId.get(n.parentId!)!;
        const px = p.x + NODE_W / 2;
        const py = p.y + NODE_H;
        const cx = n.x + NODE_W / 2;
        const midY = py + GAP_Y / 2;
        const r = Math.min(10, Math.abs(cx - px) / 2);
        const dir = cx > px ? 1 : -1;
        const d =
          Math.abs(cx - px) < 1
            ? `M${px},${py} V${n.y}`
            : `M${px},${py} V${midY - r} Q${px},${midY} ${px + dir * r},${midY} H${cx - dir * r} Q${cx},${midY} ${cx},${midY + r} V${n.y}`;
        return { id: n.dept.id, d, depth: n.depth, branch: n.branch };
      });

    const width = nodes.length ? Math.max(...nodes.map((n) => n.x)) + NODE_W : 0;
    const height = nodes.length ? Math.max(...nodes.map((n) => n.y)) + NODE_H : 0;
    return { nodes, links, width, height };
  }, [tree, overrides]);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  /* ---------- 视图变换 ---------- */
  const apply = useCallback((animate: boolean) => {
    const layer = layerRef.current;
    if (!layer) return;
    window.clearTimeout(animTimer.current);
    if (animate) {
      layer.classList.add("is-animating");
      animTimer.current = window.setTimeout(() => layer.classList.remove("is-animating"), 620);
    } else {
      layer.classList.remove("is-animating");
    }
    const v = viewState.current;
    layer.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.k})`;
  }, []);

  const fit = useCallback(
    (animate = true) => {
      const box = viewportRef.current;
      const { width, height } = layoutRef.current;
      if (!box || !width) return;
      const w = box.clientWidth;
      const h = box.clientHeight;
      const pad = 96;
      const k = Math.min(1.15, Math.max(0.12, Math.min((w - pad * 2) / width, (h - pad * 2.4) / height)));
      const v = viewState.current;
      v.k = k;
      v.x = (w - width * k) / 2;
      v.y = Math.max(48, (h - height * k) / 2);
      apply(animate);
    },
    [apply]
  );

  const zoomAt = useCallback(
    (factor: number) => {
      const box = viewportRef.current?.getBoundingClientRect();
      if (!box) return;
      const v = viewState.current;
      const px = box.width / 2;
      const py = box.height / 2;
      const k = Math.min(2, Math.max(0.3, v.k * factor));
      v.x = px - ((px - v.x) / v.k) * k;
      v.y = py - ((py - v.y) / v.k) * k;
      v.k = k;
      apply(true);
    },
    [apply]
  );

  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = box.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        zoomAt(Math.exp(-event.deltaY * 0.0022));
      } else {
        viewState.current.x -= event.deltaX;
        viewState.current.y -= event.deltaY;
        apply(false);
      }
      void rect;
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [apply, zoomAt]);

  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => fit(false));
    ro.observe(box);
    return () => ro.disconnect();
  }, [fit]);

  useEffect(() => {
    if (!layout.nodes.length) return;
    const t = window.setTimeout(() => {
      fit(playedRef.current);
      playedRef.current = true;
    }, 30);
    return () => window.clearTimeout(t);
  }, [tree, fit]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest(".org-node, .org-controls, .org-panel, button")) return;
    panRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, vx: viewState.current.x, vy: viewState.current.y };
    viewportRef.current?.setPointerCapture(event.pointerId);
    viewportRef.current?.classList.add("is-panning");
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.id !== event.pointerId) return;
    viewState.current.x = pan.vx + event.clientX - pan.x;
    viewState.current.y = pan.vy + event.clientY - pan.y;
    apply(false);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.id !== event.pointerId) return;
    panRef.current = null;
    viewportRef.current?.classList.remove("is-panning");
  };

  const toggle = (id: number) => {
    setOverrides((prev) => {
      const cur = prev[id] ?? (tree.find((t) => t.id === id)?.children?.length ?? 0) > 6;
      return { ...prev, [id]: !cur };
    });
  };

  /* ---------- 选中部门 / 成员 ---------- */
  const selectedPath = useMemo(() => (selectedId === null ? null : findPath(tree, selectedId)), [tree, selectedId]);
  const selected = selectedPath?.[selectedPath.length - 1] ?? null;
  const deptMembers = useMemo(
    () => (selected ? members.filter((m) => m.department === selected.name) : []),
    [selected, members]
  );

  /* ---------- CRUD ---------- */
  const openCreate = (parent?: DeptItem) => {
    setEditing(null);
    setExcludeIds([]);
    form.setFieldsValue({ parent_id: parent?.id ?? 0, name: "", leader: undefined, phone: "", email: "", sort: 10, status: 1 });
    setFormOpen(true);
  };
  const openEdit = (row: DeptItem) => {
    setEditing(row);
    setExcludeIds(collectIds(row));
    form.setFieldsValue({ parent_id: row.parent_id ?? 0, name: row.name, leader: row.leader || undefined, phone: row.phone, email: row.email, sort: row.sort, status: row.status });
    setFormOpen(true);
  };
  const submitForm = async () => {
    const values = await form.validateFields();
    setFormSaving(true);
    try {
      const payload: DeptPayload = {
        parent_id: values.parent_id ?? 0,
        name: values.name.trim(),
        leader: values.leader || "",
        phone: values.phone || "",
        email: values.email || "",
        sort: values.sort ?? 0,
        status: values.status ? 1 : 0,
      };
      if (editing) {
        await updateDept(editing.id, payload);
        message.success("部门已更新");
      } else {
        await createDept(payload);
        message.success("部门已新增");
      }
      setFormOpen(false);
      await load();
    } catch (e: any) {
      if (e?.errorFields) return; // 校验错误
      message.error(e?.response?.data?.detail || "部门保存失败");
    } finally {
      setFormSaving(false);
    }
  };
  const handleRemove = async (row: DeptItem) => {
    try {
      await removeDept(row.id);
      message.success("部门已删除");
      if (selectedId === row.id) setSelectedId(null);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "部门删除失败");
    }
  };

  /* ---------- 上级部门树选项（排除自身后代） ---------- */
  const parentTreeData = useMemo(() => {
    const build = (nodes: DeptItem[]): any[] =>
      nodes
        .filter((n) => !excludeIds.includes(n.id))
        .map((n) => ({ title: n.name, value: n.id, children: build(n.children ?? []) }));
    return [{ title: "无（顶级部门）", value: 0, children: build(tree) }];
  }, [tree, excludeIds]);

  const userOptions = useMemo(
    () => members.map((m) => ({ value: m.real_name, label: `${m.real_name}${m.title ? ` · ${m.title}` : ""}` })),
    [members]
  );

  /* ---------- 表格行 ---------- */
  const toTableRow = (rows: DeptItem[]): any[] =>
    rows.map((r) => ({ ...r, key: r.id, children: r.children?.length ? toTableRow(r.children) : undefined }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>部门管理</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 6 }}>
            维护组织架构。部门层级同时决定「本部门及以下」数据权限的范围。
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={view}
            onChange={(v) => setView(v as "canvas" | "table")}
            options={[
              { label: "画布", value: "canvas" },
              { label: "表格", value: "table" },
            ]}
          />
          <span className="lv-tag lv-tag--neutral">
            <ApartmentOutlined />
            {total} 个部门
          </span>
          <button className="lv-btn" type="button" onClick={load}><ReloadOutlined /> 刷新</button>
          {isAdmin && (
            <button className="lv-btn lv-btn--primary" type="button" onClick={() => openCreate()}><PlusOutlined /> 新增部门</button>
          )}
        </div>
      </div>

      {view === "canvas" ? (
        <section className="panel md-no-lift" style={{ marginTop: 16 }}>
          <div className="panel-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 80 }}><Spin /></div>
            ) : !tree.length ? (
              <Empty description="暂无部门数据" style={{ padding: 80 }} />
            ) : (
              <div
                ref={viewportRef}
                className="org-canvas"
                style={{ border: "none", borderRadius: 0, boxShadow: "none" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <div className="org-dots" aria-hidden="true" />
                <div ref={layerRef} className="org-layer" style={{ width: layout.width || 1, height: layout.height || 1 }}>
                  <svg className="org-links" width={layout.width || 1} height={layout.height || 1} aria-hidden="true">
                    {layout.links.map((l) => (
                      <path key={l.id} d={l.d} data-depth={l.depth} className={`org-link cat-${catOf(l.branch)}`} />
                    ))}
                  </svg>
                  {layout.nodes.map((n) => (
                    <div
                      key={n.dept.id}
                      role="button"
                      tabIndex={0}
                      data-node={n.dept.id}
                      aria-pressed={n.dept.id === selectedId}
                      className={[
                        "org-node",
                        `cat-${catOf(n.branch)}`,
                        n.dept.id === selectedId ? "is-selected" : "",
                        n.depth === 0 ? "is-root" : "",
                        n.dept.status === 0 ? "is-off" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
                      onClick={() => setSelectedId(n.dept.id)}
                    >
                      <span className="org-strip" aria-hidden="true" />
                      <span className="org-name">{n.dept.name}</span>
                      <span className="org-meta">
                        <span className="org-leader">{n.dept.leader || "未设负责人"}</span>
                        <span className="org-count">{n.dept.member_count ?? 0} 人</span>
                      </span>
                      {n.hasChildren && (
                        <button type="button" className="org-toggle" aria-label={n.collapsed ? "展开下级" : "收起下级"} onClick={(e) => { e.stopPropagation(); toggle(n.dept.id); }}>
                          {n.collapsed ? n.dept.children?.length ?? 0 : "−"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* 四角浮动玻璃面板 */}
                {selected && (
                  <>
                    <div className="org-panel is-tl">
                      <section className="org-card">
                        <span className="eyebrow">{selectedPath?.map((d) => d.name).slice(0, -1).join(" / ") || "根部门"}</span>
                        <h2 className="org-card-title">{selected.name}</h2>
                        <dl className="org-card-rows">
                          <dt>负责人</dt><dd>{selected.leader || "—"}</dd>
                          <dt>电话</dt><dd className="tnum">{selected.phone || "—"}</dd>
                          <dt>邮箱</dt><dd>{selected.email || "—"}</dd>
                          <dt>状态</dt>
                          <dd>
                            <span className={`lv-tag ${selected.status === 1 ? "lv-tag--leaf" : "lv-tag--gray"}`}><span className="lv-tag-dot" />{selected.status === 1 ? "正常" : "停用"}</span>
                          </dd>
                        </dl>
                      </section>
                    </div>
                    <div className="org-panel is-tr">
                      <SpecPlate
                        title="部门读数"
                        rows={[
                          { label: "本部门", value: selected.member_count ?? 0 },
                          { label: "含下级", value: sumMembers(selected), tone: "lime" },
                          { label: "下级部门", value: countDescendants(selected) },
                          { label: "层级", value: selectedPath?.length ?? 1 },
                        ]}
                      />
                    </div>
                    <div className="org-panel is-bl">
                      <section className="org-card">
                        <span className="eyebrow">成员 · 本部门 {deptMembers.length} 人</span>
                        {deptMembers.length ? (
                          <ul className="org-members">
                            {deptMembers.map((u) => (
                              <li key={u.id}>
                                <span className="org-avatar" style={{ background: roleMeta(u.role).color }}>{u.real_name?.slice(0, 1) || "?"}</span>
                                <span className="ellipsis">{u.real_name}</span>
                                <span className="faint ellipsis">{u.title || roleMeta(u.role).text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <ul className="org-members"><li className="faint">暂无成员</li></ul>
                        )}
                      </section>
                    </div>
                    <div className="org-panel is-br">
                      <section className="org-card org-actions">
                        {isAdmin && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openCreate(selected)}>新增下级</Button>}
                        {isAdmin && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(selected)}>编辑</Button>}
                        {isAdmin && (
                          <Popconfirm title={`确认删除部门「${selected.name}」吗？`} okText="删除" okButtonProps={{ danger: true }} onConfirm={() => handleRemove(selected)}>
                            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                          </Popconfirm>
                        )}
                      </section>
                    </div>
                  </>
                )}

                <div className="org-panel is-tl" style={selected ? { display: "none" } : undefined}>
                  <div className="org-chip-row">
                    {(tree[0]?.children ?? []).slice(0, 5).map((k, i) => (
                      <span key={k.id} className={`org-legend cat-${(i % 5) + 1}`}><i />{k.name}</span>
                    ))}
                  </div>
                </div>

                <div className="org-controls" role="group" aria-label="画布缩放">
                  <button type="button" aria-label="放大" onClick={() => zoomAt(1.2)}><PlusOutlined /></button>
                  <button type="button" aria-label="缩小" onClick={() => zoomAt(1 / 1.2)}><MinusOutlined /></button>
                  <button type="button" aria-label="适应画布" onClick={() => fit()}><CompressOutlined /></button>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className="lv-query" style={{ marginTop: 16 }}>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
              placeholder="部门名称"
              style={{ width: 240 }}
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onPressEnter={() => setKw(kwInput.trim())}
            />
            <Select
              allowClear
              placeholder="全部状态"
              style={{ width: 130 }}
              value={statusF || undefined}
              onChange={(v) => setStatusF(v || "")}
              options={[{ value: "1", label: "正常" }, { value: "0", label: "停用" }]}
            />
            <div className="lv-query-actions">
              <button className="lv-btn" type="button" onClick={() => setKw(kwInput.trim())}>查询</button>
              <button className="lv-btn" type="button" onClick={() => { setKwInput(""); setKw(""); setStatusF(""); }}>重置</button>
            </div>
          </div>

          <section className="lv-panel">
            <div className="lv-panel-head">
              <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
              <span className="lv-panel-title">组织架构</span>
              <span className="lv-panel-meta">共 {total} 个部门</span>
              <div className="lv-panel-tools">
                <button className="icon-btn" title="刷新" onClick={load}><ReloadOutlined /></button>
              </div>
            </div>
            <Table
              rowKey="id"
              size="middle"
              loading={loading}
              dataSource={toTableRow(tree)}
              pagination={false}
              scroll={{ x: 1080 }}
              locale={{ emptyText: "暂无部门" }}
              expandable={{ defaultExpandAllRows: true }}
              columns={[
                { title: "部门名称", dataIndex: "name", width: 240, fixed: "left" as const, render: (v: string) => <span className="cell-title">{v}</span> },
                { title: "负责人", dataIndex: "leader", width: 110, render: (v: string) => v || <span style={{ color: "var(--lv-faint)" }}>—</span> },
                { title: "联系电话", dataIndex: "phone", width: 130, render: (v: string) => <span className="tnum" style={{ color: "var(--lv-muted)" }}>{v || "—"}</span> },
                { title: "邮箱", dataIndex: "email", width: 180, render: (v: string) => <span style={{ color: "var(--lv-muted)" }}>{v || "—"}</span> },
                { title: "人数", dataIndex: "member_count", width: 80, align: "right" as const, render: (v: number) => <span className="tnum">{v}</span> },
                { title: "排序", dataIndex: "sort", width: 70, align: "right" as const, render: (v: number) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{v}</span> },
                {
                  title: "状态", dataIndex: "status", width: 90,
                  render: (v: number) => <span className={`lv-tag ${v === 1 ? "lv-tag--leaf" : "lv-tag--gray"}`}><span className="lv-tag-dot" />{v === 1 ? "正常" : "停用"}</span>,
                },
                {
                  title: "操作", width: 130, fixed: "right" as const, className: "col-actions",
                  render: (_: any, r: DeptItem) => (
                    <div className="row-actions">
                      {isAdmin && <button className="icon-btn" title="新增下级部门" data-act="add" onClick={() => openCreate(r)}><PlusOutlined /></button>}
                      {isAdmin && <button className="icon-btn" title="编辑" data-act="edit" onClick={() => openEdit(r)}><EditOutlined /></button>}
                      {isAdmin && (
                        <Popconfirm title={`确认删除部门「${r.name}」吗？`} okText="删除" okButtonProps={{ danger: true }} onConfirm={() => handleRemove(r)}>
                          <button className="icon-btn is-danger" title="删除" data-act="remove"><DeleteOutlined /></button>
                        </Popconfirm>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </section>
        </>
      )}

      {/* 新增 / 编辑部门弹窗 */}
      <Modal
        title={editing ? "编辑部门" : "新增部门"}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={submitForm}
        confirmLoading={formSaving}
        okText={editing ? "保存" : "新增"}
        width={620}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="parent_id" label="上级部门" style={{ gridColumn: "1 / -1" }}>
              <TreeSelect treeData={parentTreeData} treeDefaultExpandAll placeholder="选择上级部门" />
            </Form.Item>
            <Form.Item name="name" label="部门名称" rules={[{ required: true, message: "请输入部门名称" }]}>
              <Input placeholder="如：研发中心" />
            </Form.Item>
            <Form.Item name="leader" label="负责人">
              <Select allowClear showSearch optionFilterProp="label" placeholder="选择负责人" options={userOptions} />
            </Form.Item>
            <Form.Item name="phone" label="联系电话">
              <Input placeholder="选填" />
            </Form.Item>
            <Form.Item name="email" label="邮箱">
              <Input placeholder="选填" />
            </Form.Item>
            <Form.Item name="sort" label="显示排序">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="status" label="部门状态" valuePropName="checked">
              <Switch checkedChildren="正常" unCheckedChildren="停用" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
