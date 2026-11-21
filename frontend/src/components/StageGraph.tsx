/**
 * StageGraph —— 关系图舞台（移植自 scaffold 的 RelationGraph.vue）
 *
 * 节点与连线由页面按当前层级算好目标坐标，本组件负责「活起来」：
 *   · 节点以弹簧追随目标，层级切换即布局变形；新节点从 from 节点处长出（delay 依次长出 = 触须）
 *   · 连线是三次贝塞尔，带单向 / 往返脉冲（导 Conduct）
 *   · 悬停节点：一层邻居保持，其余降到 26%
 *   · 方向键在节点间空间导航，Esc 发 onBack 由页面逐层返回
 *   · variant="stage"：珍珠球、玻璃刻度表盘、台阶光柱、背景网络画在一张 Canvas 上，
 *     DOM 只保留可点的标签与命中区；右上角带「重播 / 暂停」
 *
 * 坐标单位是容器像素；容器尺寸通过 onSize 回传给页面做布局。
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  bezierAt,
  createFrameLoop,
  motionSkipped,
  seedOf,
  spring,
  springOf,
  type FrameLoop,
  type SpringState,
} from "../utils/motion";
import {
  paintDial,
  paintDot,
  paintHorizon,
  paintNetwork,
  paintOrb,
  paintOrbit,
  paintPillar,
  paintPulse,
  paintRipple,
  paintThread,
  readStagePalette,
  type Curve,
  type NetworkData,
  type StagePalette,
} from "../utils/stage";

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  label: string;
  sub?: string;
  /** core 中心盘 / hub 刻度表盘 / item 胶囊 / dot 圆点（标签悬停显示）/ slab 台阶（下带光柱） */
  kind?: "core" | "hub" | "item" | "dot" | "slab";
  cat?: number;
  tone?: "danger" | "off" | "accent" | "lime";
  icon?: ReactNode;
  count?: number | string;
  /** 锚点在节点的哪侧：left = 节点在锚点右边展开（扇形条目） */
  align?: "center" | "left" | "right";
  from?: string;
  delay?: number;
  interactive?: boolean;
  title?: string;
  /** 常驻轻漂（表盘 / 珍珠球游动） */
  float?: boolean;
  /** 珍珠球 / 刻度表盘直径、台阶宽度（px） */
  size?: number;
  /** 台阶眉标（如「第 2 级」） */
  rank?: string;
  /** 刻度着色比例（0–1） */
  ratio?: number;
}

export interface GraphLink {
  a: string;
  b: string;
  flow?: "none" | "forward" | "both";
  cat?: number;
  tone?: "danger" | "accent" | "lime";
  shape?: "arc" | "h" | "v";
  dashed?: boolean;
}

interface StageGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  size: { w: number; h: number };
  onSize: (s: { w: number; h: number }) => void;
  activeId?: string | null;
  /** 额外高亮的节点（如溯源链路），为空时只按悬停高亮 */
  highlight?: string[] | null;
  variant?: "light" | "stage";
  network?: NetworkData | null;
  networkFocus?: number | null;
  networkAlpha?: number;
  orbits?: Array<{ rx: number; ry: number }>;
  burstKey?: number | string;
  label?: string;
  className?: string;
  style?: CSSProperties;
  onSelect?: (node: GraphNode) => void;
  onBack?: () => void;
  onHover?: (id: string | null) => void;
  tl?: ReactNode;
  tr?: ReactNode;
  bl?: ReactNode;
  br?: ReactNode;
}

interface NodeState {
  x: SpringState;
  y: SpringState;
  o: SpringState;
  s: SpringState;
  born: number;
}

export default function StageGraph({
  nodes,
  links,
  size,
  onSize,
  activeId = null,
  highlight = null,
  variant = "light",
  network = null,
  networkFocus = null,
  networkAlpha = 1,
  orbits,
  burstKey = 0,
  label = "关系图",
  className,
  style,
  onSelect,
  onBack,
  onHover,
  tl,
  tr,
  bl,
  br,
}: StageGraphProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statesRef = useRef(new Map<string, NodeState>());
  const nodeElsRef = useRef(new Map<string, HTMLElement>());
  const lastNodesRef = useRef(new Map<string, GraphNode>());
  const ghostsRef = useRef<GraphNode[]>([]);
  const loopRef = useRef<FrameLoop | null>(null);
  const paintRef = useRef<{
    palette: StagePalette | null;
    start: number;
    burst: number;
  }>({ palette: null, start: performance.now(), burst: -1 });

  /* 帧循环的「实时值」引用：让 rAF 回调始终读到最新一帧的 props，而不必重建循环 */
  const hoverIdRef = useRef<string | null>(null);
  const isDimRef = useRef<(id: string) => boolean>(() => false);
  const linkLitRef = useRef<(l: GraphLink) => boolean>(() => true);
  const pausedRef = useRef(false);
  const pathElsRef = useRef<Array<SVGPathElement | null>>([]);
  const pulseElsRef = useRef<Array<Array<SVGCircleElement | null>>>([]);

  const [hoverId, setHoverId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [, bumpGhosts] = useState(0);

  const isStage = variant === "stage";

  const ghostIds = useMemo(
    () => new Set(ghostsRef.current.map((g) => g.id)),
    // ghostsRef 变化时由 bumpGhosts 触发重渲染，这里跟着重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ghostsRef.current.length, nodes]
  );
  const allNodes = useMemo(
    () => [...nodes, ...ghostsRef.current],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, ghostsRef.current.length]
  );

  /* ── 节点状态：弹簧 + 出生时间；被移除的节点作为幽灵退回来处后再消失 ── */
  const ensureState = (node: GraphNode, now: number) => {
    const states = statesRef.current;
    const existing = states.get(node.id);
    if (existing) return existing;
    const origin = node.from ? states.get(node.from) : null;
    const snap = motionSkipped();
    const sx = snap ? node.x : origin ? origin.x.x : node.x;
    const sy = snap ? node.y : origin ? origin.y.x : node.y;
    const st: NodeState = {
      x: springOf(sx),
      y: springOf(sy),
      o: springOf(snap ? 1 : 0),
      s: springOf(snap ? 1 : origin ? 0.4 : 0.82),
      born: now,
    };
    states.set(node.id, st);
    return st;
  };

  // 节点集合变化：消失的变幽灵退回 from，新节点建立状态
  useEffect(() => {
    const now = performance.now();
    const ids = new Set(nodes.map((n) => n.id));
    const states = statesRef.current;
    const leaving: GraphNode[] = [];
    lastNodesRef.current.forEach((node, id) => {
      if (ids.has(id) || !states.has(id) || motionSkipped()) {
        if (!ids.has(id)) states.delete(id);
        return;
      }
      const back = node.from && ids.has(node.from) ? nodes.find((n) => n.id === node.from) : null;
      leaving.push({
        ...node,
        x: back?.x ?? node.x,
        y: back?.y ?? node.y,
        interactive: false,
        from: undefined,
      });
    });
    ghostsRef.current = [
      ...ghostsRef.current.filter((g) => !ids.has(g.id)),
      ...leaving,
    ];
    nodes.forEach((n) => ensureState(n, now));
    lastNodesRef.current = new Map(nodes.map((n) => [n.id, n]));
    bumpGhosts((v) => v + 1);
    loopRef.current?.flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // 减少动态效果时补一帧，直接落到终态
  useEffect(() => {
    loopRef.current?.flush();
  }, [paused, links]);

  /* ── 高亮集合：悬停节点的一层邻居 + 页面传入的链路 ── */
  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of links) {
      if (!map.has(l.a)) map.set(l.a, new Set());
      if (!map.has(l.b)) map.set(l.b, new Set());
      map.get(l.a)!.add(l.b);
      map.get(l.b)!.add(l.a);
    }
    return map;
  }, [links]);

  const lit = useMemo<Set<string> | null>(() => {
    if (hoverId) return new Set([hoverId, ...(neighbors.get(hoverId) ?? [])]);
    return highlight?.length ? new Set(highlight) : null;
  }, [hoverId, neighbors, highlight]);

  const linkLit = (l: GraphLink) => !lit || (lit.has(l.a) && lit.has(l.b));
  const isDim = (id: string) => Boolean(lit && !lit.has(id));

  /* ── 最新值给帧循环用（避免重建循环） ── */
  const latest = useRef({
    nodes,
    links,
    allNodes,
    ghostIds,
    activeId,
    lit,
    isStage,
    network,
    networkFocus,
    networkAlpha,
    orbits,
  });
  latest.current = {
    nodes,
    links,
    allNodes,
    ghostIds,
    activeId,
    lit,
    isStage,
    network,
    networkFocus,
    networkAlpha,
    orbits,
  };

  const sizeRef = useRef(size);
  sizeRef.current = size;

  const colorOf = (p: StagePalette, cat?: number, tone?: string) =>
    tone === "danger" ? p.danger : tone === "lime" ? p.lime : cat ? p.cat[cat] : p.accent;

  /* ── 连线几何 ── */
  const geometry = (l: GraphLink, t: number, live: boolean): Curve | null => {
    const A = statesRef.current.get(l.a);
    const B = statesRef.current.get(l.b);
    if (!A || !B) return null;
    const x1 = A.x.x;
    const y1 = A.y.x;
    const x2 = B.x.x;
    const y2 = B.y.x;
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (l.shape === "h") {
      // 起点贴源节点右缘（表盘/珍珠球的线从边缘引出，不再穿过盘面）；
      // 引出段自适应：目标越远（|dy| 大）水平段越长，形成「先横出、再平滑弯入」的
      // 组织树形态——同一源点的扇出按目标 y 单调，天然互不交叉。
      const srcSize = lastNodesRef.current.get(l.a)?.size;
      const dstSize = lastNodesRef.current.get(l.b)?.size;
      const sx = x1 + (srcSize ? srcSize / 2 + 6 : 14);
      const ex = x2 - (dstSize ? dstSize / 2 + 6 : 14);
      const sdx = ex - sx;
      const sway = live ? Math.sin(t * 1.1 + y2 * 0.017) * 3 : 0;
      // lead：水平引出段长度——随 |dy| 增长让曲线「先横后弯」；但不越过两点半程（防反绕）
      const maxLead = Math.max(sdx / 2 - 6, 12);
      const lead = Math.min(Math.max(Math.abs(dy) * 0.55, sdx * 0.35), maxLead, 150);
      return {
        x1: sx,
        y1,
        c1x: sx + lead,
        c1y: y1 + sway,
        c2x: ex - lead,
        c2y: y2 - sway * 0.5,
        x2: ex,
        y2,
      };
    }
    if (l.shape === "v") return { x1, y1, c1x: x1, c1y: y1 + dy * 0.5, c2x: x2, c2y: y2 - dy * 0.5, x2, y2 };
    const d = Math.hypot(dx, dy) || 1;
    const bend = (live ? 14 * Math.sin(t * 0.5 + (x1 + y2) * 0.01) : 0) + d * 0.08;
    const ux = dx / d;
    const uy = dy / d;
    return {
      x1,
      y1,
      c1x: x1 + dx * 0.35 - uy * bend,
      c1y: y1 + dy * 0.35 + ux * bend,
      c2x: x1 + dx * 0.7 - uy * bend,
      c2y: y1 + dy * 0.7 + ux * bend,
      x2,
      y2,
    };
  };

  /* ── 图谱舞台：一张 Canvas 画背景网络、连线、脉冲、珍珠球与刻度表盘 ── */
  const drawStage = (t: number, live: boolean) => {
    const canvas = canvasRef.current;
    const { w, h } = sizeRef.current;
    if (!canvas || !w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!paintRef.current.palette && rootRef.current) {
      paintRef.current.palette = readStagePalette(rootRef.current);
    }
    const p = paintRef.current.palette!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const L = latest.current;
    const now = performance.now();

    if (L.orbits?.length) {
      const core = L.nodes.find((n) => n.kind === "core");
      const st = core ? statesRef.current.get(core.id) : null;
      if (st) {
        L.orbits.forEach((o) =>
          paintOrbit(ctx, st.x.x, st.y.x, o.rx, o.ry, t, p, Math.min(1, st.o.x))
        );
      }
    }

    if (L.network) {
      paintNetwork(ctx, L.network, {
        t,
        since: (now - paintRef.current.start) / 1000,
        live,
        palette: p,
        focusCat: L.networkFocus,
        alpha: L.networkAlpha,
        labels: true,
        seedOf,
      });
    }

    // 台阶光柱与地平线
    const slabs = L.allNodes.filter((n) => n.kind === "slab");
    if (slabs.length) {
      const floor = h - 34;
      paintHorizon(ctx, floor, 24, w - 24, p);
      slabs.forEach((node) => {
        const st = statesRef.current.get(node.id);
        if (!st) return;
        const o = Math.max(0, Math.min(1, st.o.x));
        const hot = node.id === hoverIdRef.current || node.id === L.activeId;
        paintPillar(
          ctx,
          st.x.x,
          st.y.x + 40,
          floor,
          (node.size ?? 140) - 8,
          colorOf(p, node.cat, node.tone),
          o * (isDimRef.current(node.id) ? 0.35 : node.tone === "off" ? 0.5 : 1),
          hot
        );
      });
    }

    // 连线与脉冲
    L.links.forEach((l, i) => {
      const g = geometry(l, t, live);
      const A = statesRef.current.get(l.a);
      const B = statesRef.current.get(l.b);
      if (!g || !A || !B) return;
      const vis = Math.max(0, Math.min(A.o.x, B.o.x, 1));
      if (vis < 0.01) return;
      const on = linkLitRef.current(l);
      const active = Boolean(L.activeId && (l.a === L.activeId || l.b === L.activeId));
      const c = colorOf(p, l.cat, l.tone);
      const a = vis * (on ? (L.lit || active ? 0.85 : 0.42) : 0.1);
      paintThread(ctx, g, c, a, on && (L.lit || active) ? 1.6 : 1.1, l.dashed);
      if (!live || vis < 0.5 || !l.flow || l.flow === "none") return;
      const lanes = l.flow === "both" ? 2 : 1;
      for (let k = 0; k < lanes; k += 1) {
        let u = (t * (k ? 0.24 : 0.3) + i * 0.137 + k * 0.5) % 1;
        if (k === 1) u = 1 - u;
        paintPulse(
          ctx,
          bezierAt(g.x1, g.c1x, g.c2x, g.x2, u),
          bezierAt(g.y1, g.c1y, g.c2y, g.y2, u),
          k ? p.lime : c,
          Math.sin(u * Math.PI) * vis * (on ? 1 : 0.2),
          3,
          p.paper
        );
      }
    });

    // 珍珠球 / 刻度表盘 / 圆点
    L.allNodes.forEach((node) => {
      const st = statesRef.current.get(node.id);
      if (!st) return;
      const o = Math.max(0, Math.min(1, st.o.x));
      if (o < 0.01) return;
      const dim = isDimRef.current(node.id);
      const hot = node.id === hoverIdRef.current || node.id === L.activeId;
      const x = st.x.x;
      const y = st.y.x;
      if (node.kind === "core") {
        paintOrb(ctx, x, y, ((node.size ?? 96) / 2) * st.s.x, t, p, {
          alpha: o * (dim ? 0.45 : 1),
          live,
        });
      } else if (node.kind === "hub") {
        paintDial(ctx, x, y, (node.size ?? 104) * st.s.x, t, colorOf(p, node.cat, node.tone), p, {
          alpha: o * (dim ? 0.35 : node.tone === "off" ? 0.55 : 1),
          ratio: node.ratio,
          live,
          active: hot,
        });
      } else if (node.kind === "dot") {
        paintDot(ctx, x, y, hot ? 4.6 : 3.6, colorOf(p, node.cat, node.tone), o * (dim ? 0.25 : node.tone === "off" ? 0.45 : 1), p, hot);
      }
    });

    // 开场涟漪
    if (paintRef.current.burst >= 0) {
      const k = (now - paintRef.current.burst) / 1800;
      if (k >= 1 || !live) paintRef.current.burst = -1;
      else {
        const core = L.nodes.find((n) => n.kind === "core");
        const st = core ? statesRef.current.get(core.id) : null;
        paintRipple(ctx, st?.x.x ?? w / 2, st?.y.x ?? h / 2, k, Math.min(w, h) * 0.42, p);
      }
    }
  };

  /* 帧循环里用到的「实时值」：避免把 isDim / linkLit / hoverId 提升为每帧依赖 */
  hoverIdRef.current = hoverId;
  isDimRef.current = isDim;
  linkLitRef.current = linkLit;
  pausedRef.current = paused;

  /* ── 帧循环 ── */
  useEffect(() => {
    const loop = createFrameLoop((dt, t) => {
      const L = latest.current;
      const now = performance.now();
      const snap = motionSkipped();
      const live = !snap && !pausedRef.current;
      const states = statesRef.current;

      L.allNodes.forEach((node, i) => {
        const st = states.get(node.id);
        if (!st) return;
        const ghost = L.ghostIds.has(node.id);
        const ready = snap || now - st.born >= (node.delay ?? 0) * 1000;
        const drifts = node.float && live && (node.kind === "hub" || node.kind === "core");
        const dx = drifts ? Math.sin(t * 0.37 + i * 1.7) * 7 : 0;
        const dy = drifts ? Math.sin(t * 0.9 + i * 2.1) * 6 : 0;
        const tx = ready || ghost ? node.x + dx : st.x.x;
        const ty = ready || ghost ? node.y + dy : st.y.x;
        if (snap) {
          st.x.x = tx;
          st.y.x = ty;
          st.o.x = ghost ? 0 : 1;
          st.s.x = 1;
        } else {
          spring(st.x, tx, dt, 70);
          spring(st.y, ty, dt, 70);
          spring(st.o, ghost ? 0 : ready ? 1 : 0, dt, ghost ? 120 : 50);
          spring(st.s, ghost ? 0.5 : ready ? 1 : st.s.x, dt, 60);
        }
        const el = nodeElsRef.current.get(node.id);
        if (el) {
          const o = Math.max(0, Math.min(1, st.o.x));
          el.style.transform = `translate3d(${st.x.x}px, ${st.y.x}px, 0) scale(${st.s.x})`;
          el.style.opacity = String(o);
          el.style.visibility = o < 0.01 ? "hidden" : "";
        }
      });

      // 幽灵退场完毕即移除
      if (
        ghostsRef.current.length &&
        ghostsRef.current.every((g) => (states.get(g.id)?.o.x ?? 0) < 0.02)
      ) {
        ghostsRef.current.forEach((g) => states.delete(g.id));
        ghostsRef.current = [];
        bumpGhosts((v) => v + 1);
      }

      if (L.isStage) {
        drawStage(t, live);
        return;
      }

      // 浅色图谱：连线与脉冲走 SVG
      L.links.forEach((l, i) => {
        const path = pathElsRef.current[i];
        if (!path) return;
        const g = geometry(l, t, live);
        const A = states.get(l.a);
        const B = states.get(l.b);
        if (!g || !A || !B) {
          path.style.opacity = "0";
          return;
        }
        path.setAttribute(
          "d",
          `M${g.x1},${g.y1} C${g.c1x},${g.c1y} ${g.c2x},${g.c2y} ${g.x2},${g.y2}`
        );
        const vis = Math.max(0, Math.min(A.o.x, B.o.x, 1));
        path.style.opacity = String(vis);
        const pulses = pulseElsRef.current[i] ?? [];
        pulses.forEach((c, k) => {
          if (!c) return;
          if (!live || vis < 0.5 || !l.flow || l.flow === "none") {
            c.style.opacity = "0";
            return;
          }
          const speed = k ? 0.24 : 0.3;
          let u = (t * speed + i * 0.137 + k * 0.5) % 1;
          if (k === 1) u = 1 - u;
          c.setAttribute("cx", String(bezierAt(g.x1, g.c1x, g.c2x, g.x2, u)));
          c.setAttribute("cy", String(bezierAt(g.y1, g.c1y, g.c2y, g.y2, u)));
          c.style.opacity = String(
            Math.sin(u * Math.PI) * vis * (linkLitRef.current(l) ? 1 : 0.25)
          );
        });
      });
    });
    loopRef.current = loop;
    loop.start(rootRef.current);
    return () => {
      loop.stop();
      loopRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 重播 ── */
  const replay = () => {
    statesRef.current.clear();
    ghostsRef.current = [];
    const now = performance.now();
    nodes.forEach((n) => ensureState(n, now));
    paintRef.current.start = now;
    paintRef.current.burst = now;
    setPaused(false);
    bumpGhosts((v) => v + 1);
    loopRef.current?.flush();
  };

  useEffect(() => {
    if (burstKey) paintRef.current.burst = performance.now();
  }, [burstKey]);

  /* ── 尺寸回传 ── */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (Math.abs(width - sizeRef.current.w) > 0.5 || Math.abs(height - sizeRef.current.h) > 0.5) {
        onSize({ w: width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    paintRef.current.start = performance.now();
  }, []);

  /* ── 键盘：方向键找该方向最近的节点 ── */
  const onKey = (event: ReactKeyboardEvent, node: GraphNode) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onBack?.();
      return;
    }
    const dir: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const d = dir[event.key];
    if (!d) return;
    event.preventDefault();
    let best: GraphNode | null = null;
    let bestScore = Infinity;
    for (const other of nodes) {
      if (other.id === node.id || other.interactive === false) continue;
      const dx = other.x - node.x;
      const dy = other.y - node.y;
      const along = dx * d[0] + dy * d[1];
      if (along <= 4) continue;
      const across = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
      const score = along + across * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = other;
      }
    }
    if (best) nodeElsRef.current.get((best as GraphNode).id)?.focus();
  };

  const bindNode = (id: string, el: HTMLElement | null) => {
    if (el) nodeElsRef.current.set(id, el);
    else nodeElsRef.current.delete(id);
  };

  const nodeClass = (n: GraphNode) => {
    const classes = ["rg-node", `is-${n.kind ?? "item"}`, `align-${n.align ?? "center"}`];
    if (n.cat) classes.push(`cat-${n.cat}`);
    if (n.tone) classes.push(`tone-${n.tone}`);
    if (n.id === activeId) classes.push("is-active");
    if (ghostIds.has(n.id)) classes.push("is-ghost");
    else if (isDim(n.id)) classes.push("is-dim");
    if (n.interactive === false) classes.push("is-static");
    return classes.join(" ");
  };

  const linkClass = (l: GraphLink) => {
    const classes = ["rg-link"];
    if (l.cat) classes.push(`cat-${l.cat}`);
    if (l.tone) classes.push(`is-${l.tone}`);
    if (l.dashed) classes.push("is-dashed");
    if (lit && linkLit(l)) classes.push("is-lit");
    if (!linkLit(l)) classes.push("is-dim");
    if (activeId && (l.a === activeId || l.b === activeId)) classes.push("is-active");
    return classes.join(" ");
  };

  return (
    <div
      ref={rootRef}
      className={["rg", isStage ? "is-stage" : "", paused ? "is-paused" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      style={style}
      role="group"
      aria-label={label}
    >
      {isStage && <canvas ref={canvasRef} className="rg-stage-canvas" aria-hidden="true" />}

      <div className="rg-layer">
        {!isStage && (
          <svg className="rg-links" aria-hidden="true">
            {links.map((l, i) => (
              <g key={`${l.a}>${l.b}`} className={linkClass(l)}>
                <path
                  ref={(el) => {
                    pathElsRef.current[i] = el;
                  }}
                  className="rg-path"
                />
                <circle
                  ref={(el) => {
                    if (!pulseElsRef.current[i]) pulseElsRef.current[i] = [];
                    pulseElsRef.current[i][0] = el;
                  }}
                  className="rg-pulse"
                  r={3}
                />
                {l.flow === "both" && (
                  <circle
                    ref={(el) => {
                      if (!pulseElsRef.current[i]) pulseElsRef.current[i] = [];
                      pulseElsRef.current[i][1] = el;
                    }}
                    className="rg-pulse is-back"
                    r={2.6}
                  />
                )}
              </g>
            ))}
          </svg>
        )}

        {allNodes.map((n) => {
          const interactive = n.interactive !== false && !ghostIds.has(n.id);
          const Tag = interactive ? "button" : "div";
          return (
            <Tag
              key={n.id}
              ref={(el: HTMLElement | null) => bindNode(n.id, el)}
              type={interactive ? "button" : undefined}
              className={nodeClass(n)}
              style={n.size ? ({ "--size": `${n.size}px` } as CSSProperties) : undefined}
              aria-pressed={interactive ? n.id === activeId : undefined}
              aria-label={
                interactive
                  ? [n.label, n.sub, n.count !== undefined ? String(n.count) : ""]
                      .filter(Boolean)
                      .join("，")
                  : undefined
              }
              title={n.kind === "dot" ? n.title ?? n.label : n.title}
              tabIndex={interactive ? 0 : -1}
              onClick={() => {
                if (interactive) onSelect?.(n);
              }}
              onPointerEnter={() => {
                if (!interactive) return;
                setHoverId(n.id);
                onHover?.(n.id);
              }}
              onPointerLeave={() => {
                setHoverId(null);
                onHover?.(null);
              }}
              onFocus={() => setHoverId(n.id)}
              onBlur={() => setHoverId(null)}
              onKeyDown={(e) => onKey(e, n)}
            >
              <span className="rg-body">
                <span className="rg-dot" aria-hidden="true">
                  {n.icon && n.kind !== "dot" ? n.icon : null}
                </span>
                {n.rank && <span className="rg-rank">{n.rank}</span>}
                {(n.kind === "hub" || n.kind === "slab") && n.count !== undefined && (
                  <span className="rg-count tnum">{n.count}</span>
                )}
                <span className="rg-text">
                  <span className="rg-label">{n.label}</span>
                  {n.sub && <span className="rg-sub">{n.sub}</span>}
                </span>
                {n.kind !== "hub" && n.kind !== "slab" && n.count !== undefined && (
                  <span className="rg-badge tnum">{n.count}</span>
                )}
              </span>
            </Tag>
          );
        })}
      </div>

      <div className="rg-corner is-tl">{tl}</div>
      <div className="rg-corner is-tr">
        {tr}
        {isStage && (
          <div className="rg-tools" role="toolbar" aria-label="动效控制">
            <button type="button" title="重播开场" onClick={replay}>
              重播
            </button>
            <button
              type="button"
              aria-pressed={paused}
              title={paused ? "继续动效" : "暂停动效"}
              onClick={() => setPaused((v) => !v)}
            >
              {paused ? "继续" : "暂停"}
            </button>
          </div>
        )}
      </div>
      <div className="rg-corner is-bl">{bl}</div>
      <div className="rg-corner is-br">{br}</div>
    </div>
  );
}
