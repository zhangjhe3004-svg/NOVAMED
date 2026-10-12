/**
 * 组织画布（可平移缩放的树画布）—— 移植自 scaffold 的 OrgCanvas.vue。
 *
 * 交互语汇：
 *   导 Conduct —— 连线逐层先画到（stroke-dashoffset），节点才点亮；
 *   选中路径 —— 根 → 当前节点的连线变色并跑两枚脉冲（getPointAtLength 沿线运动）；
 *   抓取平移 —— 空白处拖拽；Ctrl / ⌘ + 滚轮以指针为中心缩放，普通滚轮平移；
 *   方向键     —— 上 = 上级，下 = 第一个下级，左右 = 同级相邻，Enter 居中聚焦。
 *
 * 数据面：
 *   管理员 = 全院（科室 → 人员，负责人取科室内级别最高者）
 *   非管理员 = 责任链内（我 → 上级链 / 同级 / 下级）—— /users 是管理员专属，
 *              所以非管理员走 /nearby/peers，页面顶部有明确的数据面标注。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { Button, Empty, Tag, message } from "antd";
import {
  ApartmentOutlined,
  CompressOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../stores/auth";
import { roleMeta } from "../config/nav";
import { listUsers, type UserItem } from "../api/users";
import { listPeers, type PeerItem } from "../api/nearby";
import InsightPanel, { type InsightRow, type InsightSection } from "../components/InsightPanel";
import { EASE, afterTwoFrames, createFrameLoop, motionSkipped, seedOf } from "../utils/motion";

const NODE_W = 196;
const NODE_H = 72;
const GAP_X = 26;
const GAP_Y = 64;

interface Member {
  id: number;
  name: string;
  role: string;
  title: string;
  department: string;
  level: number;
  status: string;
}

interface OrgNode {
  id: string;
  name: string;
  /** 左侧副标题：负责人 / 职称 */
  leader?: string;
  /** 右侧小胶囊：人数 或 级别 */
  badge?: string;
  /** 统计口径上的人数（人员节点为 1） */
  count: number;
  /** 分类色槽 1–5 */
  cat: number;
  off?: boolean;
  kind: "root" | "dept" | "group" | "person";
  member?: Member;
  members?: Member[];
  children?: OrgNode[];
}

interface LaidNode {
  node: OrgNode;
  x: number;
  y: number;
  depth: number;
  branch: number;
  parentId: string | null;
  hasChildren: boolean;
  collapsed: boolean;
}

interface LaidLink {
  id: string;
  d: string;
  depth: number;
  branch: number;
}

/** 深度优先找节点：用 for 循环而非 forEach，避免闭包内赋值把类型收窄成 never */
function findNode(list: OrgNode[], id: string): OrgNode | null {
  for (const n of list) {
    if (n.id === id) return n;
    const hit = n.children ? findNode(n.children, id) : null;
    if (hit) return hit;
  }
  return null;
}

const catOf = (branch: number) => ((branch - 1) % 5) + 1;

const toMember = (u: UserItem): Member => ({
  id: u.id,
  name: u.real_name,
  role: u.role,
  title: u.title || "",
  department: u.department || "",
  level: u.auth_level ?? 1,
  status: u.work_status || "在职",
});

export default function OrgCanvas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [users, setUsers] = useState<UserItem[]>([]);
  const [peers, setPeers] = useState<PeerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * 折叠状态存「用户显式指定过的覆盖」，没指定过的走默认规则：
   * 成员超过 5 个的科室 / 分支默认收起。这样首屏不会被 11 人的大科室撑成一排 11 张卡，
   * 也不需要在数据到达后再补一次 setState（那会先渲染展开态、再跳成收起态）。
   */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const animTimer = useRef(0);
  const panRef = useRef<{ id: number; x: number; y: number; vx: number; vy: number } | null>(null);
  const linkEls = useRef(new Map<string, SVGPathElement>());
  const pulseEls = useRef(new Map<string, SVGCircleElement>());
  const pathLens = useRef(new Map<string, number>());
  const playedRef = useRef(false);

  /* ============================================================
     取数
     ============================================================ */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const res = await listUsers({ page_size: 100 });
        setUsers(res.items || []);
      } else {
        const res = await listPeers();
        setPeers(res.items || []);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载组织数据失败");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  /* ============================================================
     建树
     ============================================================ */
  const tree = useMemo<OrgNode[]>(() => {
    if (isAdmin) {
      if (!users.length) return [];
      const byDept = new Map<string, UserItem[]>();
      users.forEach((u) => {
        const d = u.department || "未分配科室";
        if (!byDept.has(d)) byDept.set(d, []);
        byDept.get(d)!.push(u);
      });
      // 人多的科室排前面，颜色按顺序分槽
      const depts = [...byDept.entries()].sort(
        (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "zh")
      );
      const deptNodes: OrgNode[] = depts.map(([name, list], i) => {
        const sorted = [...list].sort(
          (a, b) => (b.auth_level ?? 0) - (a.auth_level ?? 0) || a.real_name.localeCompare(b.real_name, "zh")
        );
        const cat = (i % 5) + 1;
        return {
          id: `dept-${name}`,
          name,
          leader: sorted[0] ? `负责人 ${sorted[0].real_name}` : "未设负责人",
          badge: `${list.length} 人`,
          count: list.length,
          cat,
          kind: "dept",
          members: sorted.map(toMember),
          children: sorted.map((u) => {
            const m = toMember(u);
            return {
              id: `u-${u.id}`,
              name: u.real_name,
              leader: m.title || roleMeta(u.role).text,
              badge: `L${m.level}`,
              count: 1,
              cat,
              off: m.status !== "在职",
              kind: "person" as const,
              member: m,
            };
          }),
        };
      });
      return [
        {
          id: "root-hospital",
          name: "MediCode 智慧医疗",
          leader: `全院 ${depts.length} 个科室统一视图`,
          badge: `${users.length} 人`,
          count: users.length,
          cat: 5,
          kind: "root",
          members: users.map(toMember),
          children: deptNodes,
        },
      ];
    }

    if (!user) return [];
    const byId = new Map<number, PeerItem>(peers.map((p) => [p.id, p] as const));
    const upChain: PeerItem[] = [];
    const seen = new Set<number>();
    let cur: number | null | undefined = user.superior_id ?? undefined;
    while (cur && byId.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      const node: PeerItem = byId.get(cur)!;
      upChain.push(node);
      cur = node.superior_id ?? undefined;
    }
    const same = peers.filter((p) => p.relation === "同级");
    const down = peers.filter((p) => p.relation === "下级");
    const rest = peers.filter((p) => !["上级", "同级", "下级"].includes(p.relation));

    const personOf = (p: PeerItem, cat: number): OrgNode => ({
      id: `u-${p.id}`,
      name: p.real_name,
      leader: p.title || roleMeta(p.role).text,
      badge: `L${p.auth_level}`,
      count: 1,
      cat,
      kind: "person",
      member: {
        id: p.id,
        name: p.real_name,
        role: p.role,
        title: p.title || "",
        department: p.department || "",
        level: p.auth_level,
        status: "在职",
      },
    });

    const branches: OrgNode[] = [];
    if (upChain.length) {
      branches.push({
        id: "grp-up",
        name: "上级链路",
        leader: "沿上级关系逐级向上",
        badge: `${upChain.length} 级`,
        count: upChain.length,
        cat: 1,
        kind: "group",
        children: upChain.map((p) => personOf(p, 1)),
      });
    }
    if (same.length) {
      branches.push({
        id: "grp-same",
        name: "同级同事",
        leader: "责任链内同级",
        badge: `${same.length} 人`,
        count: same.length,
        cat: 3,
        kind: "group",
        children: same.map((p) => personOf(p, 3)),
      });
    }
    if (down.length) {
      branches.push({
        id: "grp-down",
        name: "我的下级",
        leader: "可审阅其就诊记录",
        badge: `${down.length} 人`,
        count: down.length,
        cat: 2,
        kind: "group",
        children: down.map((p) => personOf(p, 2)),
      });
    }
    if (rest.length) {
      branches.push({
        id: "grp-rest",
        name: "责任链内其他",
        leader: "未标注明确关系",
        badge: `${rest.length} 人`,
        count: rest.length,
        cat: 4,
        kind: "group",
        children: rest.map((p) => personOf(p, 4)),
      });
    }

    return [
      {
        id: `u-${user.id}`,
        name: `${user.real_name}（我）`,
        leader: user.title || roleMeta(user.role).text,
        badge: `L${user.auth_level ?? 1}`,
        count: 1,
        cat: 5,
        kind: "root",
        member: {
          id: user.id,
          name: user.real_name,
          role: user.role,
          title: user.title || "",
          department: user.department || "",
          level: user.auth_level ?? 1,
          status: user.work_status || "在职",
        },
        children: branches,
      },
    ];
  }, [isAdmin, users, peers, user]);

  /* ============================================================
     折叠：默认收起成员多的大分支（>5），用户点过之后以用户为准
     ============================================================ */
  const isCollapsed = useCallback(
    (node: OrgNode) => {
      const ov = overrides[node.id];
      if (ov !== undefined) return ov;
      return (node.children?.length ?? 0) > 5;
    },
    [overrides]
  );

  /* ============================================================
     树布局：后序游标铺叶子，父节点取子节点中点
     ============================================================ */
  const layout = useMemo(() => {
    const nodes: LaidNode[] = [];
    let cursor = 0;
    const place = (node: OrgNode, depth: number, branch: number, parentId: string | null): number => {
      const collapsed = isCollapsed(node);
      const kids = collapsed ? [] : node.children ?? [];
      let x: number;
      if (!kids.length) {
        x = cursor;
        cursor += NODE_W + GAP_X;
      } else {
        const xs = kids.map((child, i) => place(child, depth + 1, depth === 0 ? i + 1 : branch, node.id));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      nodes.push({
        node,
        x,
        y: depth * (NODE_H + GAP_Y),
        depth,
        branch,
        parentId,
        hasChildren: Boolean(node.children?.length),
        collapsed,
      });
      return x;
    };
    tree.forEach((root, i) => place(root, 0, i + 1, null));
    nodes.sort((a, b) => a.depth - b.depth || a.x - b.x);

    const byId = new Map(nodes.map((n) => [n.node.id, n] as const));
    const links: LaidLink[] = nodes
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
        return { id: n.node.id, d, depth: n.depth, branch: n.branch };
      });

    const width = nodes.length ? Math.max(...nodes.map((n) => n.x)) + NODE_W : 0;
    const height = nodes.length ? Math.max(...nodes.map((n) => n.y)) + NODE_H : 0;
    return { nodes, links, width, height };
  }, [tree, isCollapsed]);

  // 帧循环与各种回调都在 render 之外读这份最新布局，避免闭包拿到旧值
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  /* ============================================================
     视图变换
     ============================================================ */
  const apply = useCallback((animate: boolean) => {
    const layer = layerRef.current;
    if (!layer) return;
    window.clearTimeout(animTimer.current);
    if (animate && !motionSkipped()) {
      layer.classList.add("is-animating");
      animTimer.current = window.setTimeout(() => layer.classList.remove("is-animating"), 620);
    } else {
      layer.classList.remove("is-animating");
    }
    const v = view.current;
    layer.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.k})`;
  }, []);

  const fit = useCallback(
    (animate = true) => {
      const box = viewportRef.current;
      const { width, height } = layoutRef.current;
      if (!box || !width) return;
      // 用布局像素而非包围盒：页面进场缩放期间包围盒会偏小
      const w = box.clientWidth;
      const h = box.clientHeight;
      const pad = 96;
      // 下界放到 0.12：分支多的树平铺后能到 3000px 以上，
      // 卡在 0.35 会让整棵树被裁掉一半（宁可能看清全貌再让人放大）
      const k = Math.min(1.15, Math.max(0.12, Math.min((w - pad * 2) / width, (h - pad * 2.4) / height)));
      const v = view.current;
      v.k = k;
      v.x = (w - width * k) / 2;
      v.y = Math.max(48, (h - height * k) / 2);
      apply(animate);
    },
    [apply]
  );

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const box = viewportRef.current?.getBoundingClientRect();
      if (!box) return;
      const px = cx ?? box.width / 2;
      const py = cy ?? box.height / 2;
      const v = view.current;
      const k = Math.min(2, Math.max(0.3, v.k * factor));
      v.x = px - ((px - v.x) / v.k) * k;
      v.y = py - ((py - v.y) / v.k) * k;
      v.k = k;
      apply(true);
    },
    [apply]
  );

  const focusNode = useCallback(
    (id: string) => {
      const node = layoutRef.current.nodes.find((n) => n.node.id === id);
      const box = viewportRef.current;
      if (!node || !box) return;
      const v = view.current;
      v.k = Math.max(v.k, 0.9);
      v.x = box.clientWidth / 2 - (node.x + NODE_W / 2) * v.k;
      v.y = box.clientHeight / 2 - (node.y + NODE_H / 2) * v.k;
      apply(true);
    },
    [apply]
  );

  /* ---------- 滚轮：Ctrl / ⌘ 缩放，其余平移 ---------- */
  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = box.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        zoomAt(Math.exp(-event.deltaY * 0.0022), event.clientX - rect.left, event.clientY - rect.top);
      } else {
        view.current.x -= event.deltaX;
        view.current.y -= event.deltaY;
        apply(false);
      }
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [apply, zoomAt]);

  /* ---------- 尺寸变化重新适应（不播动画） ---------- */
  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => fit(false));
    ro.observe(box);
    return () => ro.disconnect();
  }, [fit]);

  /* ============================================================
     入场：逐层先画连线再点亮节点
     ============================================================ */
  const playEntrance = useCallback(() => {
    const layer = layerRef.current;
    if (!layer || motionSkipped()) return;
    const { nodes } = layoutRef.current;
    const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
    for (let d = 0; d <= maxDepth; d += 1) {
      layer.querySelectorAll<SVGPathElement>(`.org-link[data-depth="${d}"]`).forEach((path) => {
        const len = path.getTotalLength();
        path.animate(
          [
            { strokeDasharray: `${len}`, strokeDashoffset: `${len}` },
            { strokeDasharray: `${len}`, strokeDashoffset: "0" },
          ],
          {
            duration: 420,
            delay: Math.max(0, d * 200 - 120),
            easing: EASE.swap,
            fill: "backwards",
          }
        );
      });
      let i = 0;
      layer.querySelectorAll<HTMLElement>(`.org-node[data-depth="${d}"]`).forEach((el) => {
        el.animate(
          [
            { opacity: 0, transform: "translateY(10px) scale(0.96)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
          {
            duration: 500,
            delay: d * 200 + 180 + i * 40,
            easing: EASE.reveal,
            fill: "backwards",
          }
        );
        i += 1;
      });
    }
  }, []);

  // 布局一变，缓存的路径长度就失效（父节点连线会随子树宽度改变）
  useEffect(() => {
    pathLens.current.clear();
  }, [layout]);

  /**
   * 「适应画布」只在数据到达时做一次。
   * 之后展开 / 收起由镜头跟随（见 toggle）负责 —— 用户正盯着某一处，
   * 每次增删节点就把镜头拉回全景会把人甩出去。
   */
  useEffect(() => {
    if (!layout.nodes.length) return;
    afterTwoFrames(() => {
      fit(playedRef.current);
      if (!playedRef.current) {
        playedRef.current = true;
        playEntrance();
      }
    });
  }, [tree, fit, playEntrance]);

  /* ============================================================
     选中路径脉冲
     ============================================================ */
  const activePathIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedId) return ids;
    const parentOf = new Map(layout.nodes.map((n) => [n.node.id, n.parentId] as const));
    let cur: string | null | undefined = selectedId;
    while (cur) {
      const parent = parentOf.get(cur);
      if (parent == null) break;
      ids.add(cur);
      cur = parent;
    }
    return ids;
  }, [layout, selectedId]);

  const pulseNodes = useMemo(() => {
    const out: Array<{ key: string; cat: number; idx: number }> = [];
    const branchOf = new Map(layout.links.map((l) => [l.id, catOf(l.branch)] as const));
    activePathIds.forEach((id) => {
      for (let k = 0; k < 2; k += 1) {
        out.push({ key: `${id}:${k}`, cat: branchOf.get(id) ?? 1, idx: k });
      }
    });
    return out;
  }, [layout, activePathIds]);

  useEffect(() => {
    const loop = createFrameLoop((_dt, t) => {
      if (!pulseEls.current.size) return;
      const skip = motionSkipped();
      pulseEls.current.forEach((circle, key) => {
        const linkId = key.slice(0, key.lastIndexOf(":"));
        const path = linkEls.current.get(linkId);
        if (!path || skip) {
          circle.style.opacity = "0";
          return;
        }
        let len = pathLens.current.get(linkId);
        if (len === undefined) {
          len = path.getTotalLength();
          pathLens.current.set(linkId, len);
        }
        const idx = Number(circle.dataset.idx ?? 0);
        const u = (t * 0.3 + idx * 0.5 + seedOf(linkId) * 7 * 0.11) % 1;
        const pt = path.getPointAtLength(len * u);
        circle.setAttribute("cx", String(pt.x));
        circle.setAttribute("cy", String(pt.y));
        circle.style.opacity = String(Math.sin(u * Math.PI) * 0.9);
      });
    });
    loop.start(viewportRef.current);
    return () => loop.stop();
  }, []);

  /* ============================================================
     指针与键盘
     ============================================================ */
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest(".org-node, .org-controls, .org-panel, button")) return;
    panRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, vx: view.current.x, vy: view.current.y };
    const box = viewportRef.current;
    box?.setPointerCapture(event.pointerId);
    box?.classList.add("is-panning");
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.id !== event.pointerId) return;
    view.current.x = pan.vx + event.clientX - pan.x;
    view.current.y = pan.vy + event.clientY - pan.y;
    apply(false);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.id !== event.pointerId) return;
    panRef.current = null;
    viewportRef.current?.classList.remove("is-panning");
  };

  const toggle = useCallback(
    (id: string, currentlyCollapsed: boolean) => {
      setOverrides((prev) => ({ ...prev, [id]: !currentlyCollapsed }));
      // 展开或收起都把镜头带到该节点：11 个成员的科室在全景缩放下小到看不清，
      // 跟着镜头过去才看得见刚展开出来的那一片；收起时也能确认收到了什么。
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => focusNode(id))
      );
    },
    [focusNode]
  );

  const onNodeKey = (event: ReactKeyboardEvent<HTMLDivElement>, laid: LaidNode) => {
    const nodes = layoutRef.current.nodes;
    let target: LaidNode | undefined;
    if (event.key === "ArrowUp") {
      target = nodes.find((n) => n.node.id === laid.parentId);
    } else if (event.key === "ArrowDown") {
      target = nodes.find((n) => n.parentId === laid.node.id);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const row = nodes.filter((n) => n.depth === laid.depth).sort((a, b) => a.x - b.x);
      target = row[row.indexOf(laid) + (event.key === "ArrowRight" ? 1 : -1)];
    } else if (event.key === "Enter") {
      focusNode(laid.node.id);
      return;
    } else {
      return;
    }
    event.preventDefault();
    if (!target) return;
    const targetId = target.node.id;
    setSelectedId(targetId);
    window.requestAnimationFrame(() => {
      layerRef.current?.querySelector<HTMLElement>(`[data-node="${targetId}"]`)?.focus();
    });
  };

  /* ============================================================
     右侧信息卡
     ============================================================ */
  const selected = useMemo(() => (selectedId ? findNode(tree, selectedId) : null), [tree, selectedId]);

  const insightStats = useMemo(() => {
    if (!selected) return undefined;
    const childTotal = (selected.children ?? []).reduce((sum, c) => sum + c.count, 0);
    const levels = (selected.members ?? []).map((m) => m.level);
    return [
      { label: "人数", value: selected.kind === "person" ? 1 : childTotal || selected.count },
      { label: "下级节点", value: (selected.children ?? []).length },
      {
        label: selected.kind === "person" ? "数字职级" : "最高职级",
        value: levels.length ? `L${Math.max(...levels)}` : "—",
      },
    ];
  }, [selected]);

  const insightSections = useMemo<InsightSection[]>(() => {
    if (!selected) return [];
    if (selected.kind === "person" && selected.member) {
      const m = selected.member;
      return [
        {
          title: "岗位信息",
          rows: [
            { key: "role", name: roleMeta(m.role).text, cat: selected.cat },
            { key: "title", name: m.title || "无职称" },
            { key: "dept", name: m.department || "未分配科室" },
            { key: "level", name: `数字职级 L${m.level}`, badge: m.status },
          ],
          hint: "只读",
        },
      ];
    }
    const countByRole = new Map<string, number>();
    (selected.members ?? []).forEach((m) => {
      countByRole.set(m.role, (countByRole.get(m.role) || 0) + 1);
    });
    return [
      {
        title: "角色构成",
        rows: [...countByRole.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([role, n], i) => ({
            key: role,
            name: roleMeta(role).text,
            cat: (i % 5) + 1,
            badge: `${n} 人`,
          })),
        chips: true,
        empty: "暂无成员",
      },
      {
        title: "成员",
        hint: `${Math.min(selected.members?.length ?? 0, 14)} / ${selected.members?.length ?? 0}`,
        rows: (selected.members ?? []).slice(0, 14).map((m): InsightRow => ({
          key: m.id,
          name: m.name,
          meta: `${m.title || roleMeta(m.role).text} · L${m.level}`,
          cat: selected.cat,
          tone: m.status === "在职" ? undefined : "off",
          onClick: () => {
            const target = `u-${m.id}`;
            if (findNode(tree, target)) {
              setSelectedId(target);
              focusNode(target);
            } else {
              navigate("/users");
            }
          },
        })),
        empty: "暂无成员",
      },
    ];
  }, [selected, tree, focusNode, navigate]);

  /* ============================================================
     渲染
     ============================================================ */
  const deepLevels = layout.nodes.reduce((m, n) => Math.max(m, n.depth), 0) + 1;

  // 图例直接列出一级分支的真实名称 —— 分类色就是用来区分一级分支的
  const legend = useMemo(() => {
    const kids = tree[0]?.children ?? [];
    return kids.slice(0, 6).map((k) => ({ name: k.name, cat: k.cat }));
  }, [tree]);
  const legendExtra = Math.max(0, (tree[0]?.children?.length ?? 0) - legend.length);

  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ORGANIZATION CANVAS</div>
          <h1>组织画布</h1>
          <div className="sub">
            拖拽平移，Ctrl / ⌘ + 滚轮缩放；单击选中、双击居中，方向键在上三级之间移动。
            连线逐层画到后节点才点亮，选中路径会跑脉冲 —— 与「岗位阶梯」「角色溯源」同色同源。
          </div>
        </div>
        <div className="actions">
          <Tag color="navy" style={{ background: "#e4eaf4", color: "#2d4a74", border: "none" }}>
            <TeamOutlined style={{ marginRight: 4 }} />
            {isAdmin ? `全院 ${users.length} 人` : `责任链内 ${peers.length} 人`}
          </Tag>
          <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
            刷新
          </Button>
        </div>
      </div>

      <div className="trace-wrap">
        <div className="org-canvas-wrap">
          <div
            ref={viewportRef}
            className="org-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="org-dots" aria-hidden="true" />

            <div
              ref={layerRef}
              className="org-layer"
              style={{ width: layout.width || 1, height: layout.height || 1 }}
            >
              <svg
                className="org-links"
                width={layout.width || 1}
                height={layout.height || 1}
                aria-hidden="true"
              >
                {layout.links.map((l) => (
                  <path
                    key={l.id}
                    ref={(el) => {
                      if (el) linkEls.current.set(l.id, el);
                      else linkEls.current.delete(l.id);
                    }}
                    d={l.d}
                    data-depth={l.depth}
                    data-link={l.id}
                    className={`org-link cat-${catOf(l.branch)}${activePathIds.has(l.id) ? " is-active" : ""}`}
                  />
                ))}
                {pulseNodes.map((p) => (
                  <circle
                    key={p.key}
                    ref={(el) => {
                      if (el) pulseEls.current.set(p.key, el);
                      else pulseEls.current.delete(p.key);
                    }}
                    data-idx={p.idx}
                    r={3}
                    className={`org-pulse cat-${p.cat}`}
                  />
                ))}
              </svg>

              {layout.nodes.map((n) => (
                <div
                  key={n.node.id}
                  role="button"
                  tabIndex={0}
                  data-node={n.node.id}
                  data-depth={n.depth}
                  aria-pressed={n.node.id === selectedId}
                  aria-label={`${n.node.name}，${n.node.count} 人`}
                  className={[
                    "org-node",
                    `cat-${catOf(n.branch)}`,
                    n.node.id === selectedId ? "is-selected" : "",
                    n.depth === 0 ? "is-root" : "",
                    n.node.off ? "is-off" : "",
                    n.node.kind === "person" ? "is-person" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
                  onClick={() => setSelectedId(n.node.id)}
                  onDoubleClick={() => focusNode(n.node.id)}
                  onKeyDown={(e) => onNodeKey(e, n)}
                >
                  <span className="org-strip" aria-hidden="true" />
                  <span className="org-name">{n.node.name}</span>
                  <span className="org-meta">
                    <span className="org-leader">{n.node.leader}</span>
                    {n.node.badge && <span className="org-count">{n.node.badge}</span>}
                  </span>
                  {n.hasChildren && (
                    <button
                      type="button"
                      className="org-toggle"
                      aria-label={n.collapsed ? "展开下级" : "收起下级"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(n.node.id, n.collapsed);
                      }}
                    >
                      {n.collapsed ? n.node.children?.length ?? 0 : "−"}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 四角浮动玻璃面板：图例 / 数据面 / 操作提示 */}
            <div className="org-panel is-tl">
              <div className="org-chip-row">
                {legend.map((l) => (
                  <span key={l.name} className={`org-legend cat-${l.cat}`}>
                    <i />
                    {l.name}
                  </span>
                ))}
                {legendExtra > 0 && <span className="org-legend cat-5">+{legendExtra}</span>}
              </div>
            </div>

            <div className="org-panel is-tr">
              <button
                type="button"
                className="org-scope"
                onClick={() => setScopeOpen((v) => !v)}
                title="数据面说明"
              >
                <ApartmentOutlined />
                {isAdmin ? "数据面：全院" : "数据面：责任链内"}
              </button>
              {scopeOpen && (
                <div className="org-scope-note">
                  {isAdmin
                    ? "管理员可见全院名册，因此画布按「科室 → 人员」铺开；负责人取该科室数字职级最高者。"
                    : "用户名册接口仅管理员可读，因此按责任链（我 → 上级链 / 同级 / 下级）展开；如需全院视图请用管理员账号。"}
                </div>
              )}
            </div>

            <div className="org-panel is-bl">
              <div className="org-hint">
                <span>
                  <b>拖拽</b> 平移
                </span>
                <span>
                  <b>⌘ / Ctrl + 滚轮</b> 缩放
                </span>
                <span>
                  <b>双击</b> 居中
                </span>
                <span>
                  <b>↑ ↓ ← →</b> 移动
                </span>
              </div>
            </div>

            <div className="org-controls" role="group" aria-label="画布缩放">
              <button type="button" aria-label="放大" onClick={() => zoomAt(1.2)}>
                <PlusOutlined />
              </button>
              <button type="button" aria-label="缩小" onClick={() => zoomAt(1 / 1.2)}>
                <MinusOutlined />
              </button>
              <button type="button" aria-label="适应画布" onClick={() => fit()}>
                <CompressOutlined />
              </button>
            </div>
          </div>
        </div>

        {selected ? (
          <InsightPanel
            key={selected.id}
            cat={selected.cat}
            title={selected.name}
            sub={
              selected.kind === "person"
                ? `人员节点 · ${deepLevels} 层画布`
                : `第 ${layout.nodes.find((n) => n.node.id === selected.id)?.depth ?? 0} 层 · 共 ${deepLevels} 层`
            }
            stats={insightStats}
            sections={insightSections}
            note={
              selected.kind === "person"
                ? "人员节点没有下级；点「成员」列表里的同级同事可跳到对应节点。"
                : "点成员可定位到画布上的该人员节点（被收起的科室会先自动展开）。"
            }
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <aside className="trace-side-hint">
            <UserOutlined />
            <p>
              {loading
                ? "正在加载组织数据…"
                : "点选画布上的任意节点，这里会显示它的人数、角色构成与成员名单。"}
            </p>
            {!loading && layout.nodes.length === 0 && (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有可用数据" style={{ margin: 0 }} />
            )}
          </aside>
        )}
      </div>

      <p className="note" style={{ background: "#f6f8fc", color: "#7d8ba0", marginTop: 14 }}>
        提示：科室名与成员来自员工名册的「科室」字段，给账号分配科室后会自动出现在这里，
        无需单独维护科室字典。选中节点后其根路径的连线会点亮并跑脉冲（导 Conduct）。
      </p>
    </div>
  );
}
