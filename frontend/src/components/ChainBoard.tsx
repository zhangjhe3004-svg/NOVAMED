/**
 * ChainBoard —— 责任链拖拽看板
 *
 * 移植自 scaffold 的 BoardView.vue，用同一套物理与编排：
 *   · 指针拖起卡片 → 幽灵卡跟随（旋转 -2.5°、放大 1.03，放 Discharge）
 *   · 落到有效列   → 提交成功后幽灵卡「弹簧飞向新位置」落定（结 Crystallize，k=72 硬）
 *   · 落到无效列 / 接口拒绝 → 幽灵卡「弹射归位」飞回原处（停摆 Halt，k=50 软）
 *   · 数据变化后其余卡片用 FLIP 平滑让位（自动让位）
 *   · 键盘替代：卡片右上角「移动到…」菜单
 *
 * 只用 transform / opacity；弹簧走 rAF 帧循环，页面在后台或元素离屏时自动停帧。
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  EASE,
  captureRects,
  createFrameLoop,
  motionSkipped,
  playFlip,
  spring,
  springOf,
  type FrameLoop,
} from "../utils/motion";

export interface ChainColumn<T> {
  key: string;
  title: string;
  hint?: string;
  /** 分类色 1..5（列头圆点与上沿） */
  tone?: number;
  items: T[];
  /** 该列是否接受拖入（默认接受） */
  accepts?: boolean;
}

export interface MovePayload<T> {
  item: T;
  from: ChainColumn<T>;
  to: ChainColumn<T>;
}

interface ChainBoardProps<T> {
  columns: ChainColumn<T>[];
  keyOf: (item: T) => string;
  renderCard: (item: T, column: ChainColumn<T>) => ReactNode;
  draggable?: boolean;
  /** 返回 true 表示已移动成功（父层随后刷新数据） */
  onMove?: (payload: MovePayload<T>) => Promise<boolean>;
  /** 每列的「空」提示 */
  emptyText?: string;
  /** 是否正在提交（提交中锁定指针） */
  busy?: boolean;
}

interface DragState<T> {
  id: number;
  item: T;
  from: ChainColumn<T>;
  card: HTMLElement;
  ghost: HTMLElement | null;
  inner: HTMLElement | null;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  gx: number;
  gy: number;
  origin: DOMRect;
}

export default function ChainBoard<T>({
  columns,
  keyOf,
  renderCard,
  draggable = false,
  onMove,
  emptyText = "暂无",
  busy = false,
}: ChainBoardProps<T>) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState<T> | null>(null);
  const settleLoopRef = useRef<FrameLoop | null>(null);
  const flipRef = useRef<Map<string, DOMRect> | null>(null);
  /** 下一次提交后需要测量落点的卡片 key */
  const pendingKeyRef = useRef<string | null>(null);
  const landingRef = useRef<{ key: string; rect: DOMRect } | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  /* ---------- 自动让位：数据变更前记录位置，变更后从旧位置滑过去 ---------- */
  const signature = useMemo(
    () => columns.map((c) => `${c.key}:${c.items.map(keyOf).join(",")}`).join("|"),
    [columns, keyOf]
  );

  // 在 layout 阶段（DOM 已更新、尚未绘制）先量落点，再起让位动画。
  // 顺序反过来会让量到的落点带上让位动画的 transform，变成「动画中途位置」。
  useLayoutEffect(() => {
    const pendingKey = pendingKeyRef.current;
    pendingKeyRef.current = null;
    if (pendingKey) {
      const el = rootRef.current?.querySelector<HTMLElement>(
        `[data-card="${CSS.escape(pendingKey)}"]`
      );
      landingRef.current = el ? { key: pendingKey, rect: el.getBoundingClientRect() } : null;
      // 落位卡先隐去，让幽灵卡读作「那张卡」，落定后再显形
      if (el) el.classList.add("is-placeholder");
    }
    const before = flipRef.current;
    if (!before) return;
    flipRef.current = null;
    playFlip(rootRef.current, before, "data-card", undefined, pendingKey ?? undefined);
  }, [signature]);

  /* ---------- 拖拽 ---------- */

  const columnAt = (x: number, y: number) => {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-column]");
    if (!el || !rootRef.current?.contains(el)) return null;
    return columns.find((c) => c.key === el.dataset.column) ?? null;
  };

  const startGhost = (state: DragState<T>) => {
    // 外层只负责位移，内层只负责旋转与缩放：两条通道互不覆盖
    const ghost = document.createElement("div");
    ghost.className = "cb-ghost";
    ghost.setAttribute("aria-hidden", "true");
    const inner = document.createElement("div");
    inner.className = "cb-ghost-inner";
    inner.style.width = `${state.origin.width}px`;
    const clone = state.card.cloneNode(true) as HTMLElement;
    clone.removeAttribute("data-card");
    clone.classList.remove("is-placeholder");
    inner.appendChild(clone);
    ghost.appendChild(inner);
    document.body.appendChild(ghost);

    ghost.style.width = `${state.origin.width}px`;
    ghost.style.height = `${state.origin.height}px`;
    ghost.style.transform = `translate3d(${state.origin.left}px, ${state.origin.top}px, 0)`;
    if (!motionSkipped()) {
      inner.style.transform = "rotate(-2.5deg) scale(1.03)";
    }
    state.card.classList.add("is-placeholder");
    state.ghost = ghost;
    state.inner = inner;
  };

  const finish = (state: DragState<T>) => {
    state.ghost?.remove();
    state.card.classList.remove("is-placeholder");
    const key = keyOf(state.item);
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-card="${CSS.escape(key)}"]`)
      ?.classList.remove("is-placeholder");
  };

  /** 松手：要么落位，要么弹射归位 */
  const settle = async (state: DragState<T>, target: ChainColumn<T> | null) => {
    const ghost = state.ghost;
    if (!ghost) return;

    let moved = false;
    if (target && onMove) {
      flipRef.current = captureRects(rootRef.current, "data-card");
      pendingKeyRef.current = keyOf(state.item);
      try {
        moved = await onMove({ item: state.item, from: state.from, to: target });
      } catch {
        moved = false;
      }
      if (!moved) {
        flipRef.current = null;
        pendingKeyRef.current = null;
      }
    }

    // 等 React 提交新布局并跑完 layout 阶段（落点已在其中量好）
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const key = keyOf(state.item);
    const measured = landingRef.current?.key === key ? landingRef.current.rect : null;
    landingRef.current = null;
    const landing = moved && measured ? measured : state.origin;

    if (motionSkipped()) {
      finish(state);
      return;
    }

    // 弹簧飞回：落位更硬、取消回弹稍软，速度与位移双收敛即收尾
    const st = { x: springOf(state.gx), y: springOf(state.gy) };
    const inner = state.inner;
    inner?.animate(
      [
        { transform: "rotate(-2.5deg) scale(1.03)" },
        { transform: "rotate(0deg) scale(1)" },
      ],
      { duration: moved ? 380 : 460, easing: EASE.glide, fill: "forwards" }
    );

    let elapsed = 0;
    settleLoopRef.current?.stop();
    settleLoopRef.current = createFrameLoop((dt) => {
      elapsed += dt;
      const k = moved ? 72 : 50;
      spring(st.x, landing.left, dt, k);
      spring(st.y, landing.top, dt, k);
      ghost.style.transform = `translate3d(${st.x.x}px, ${st.y.x}px, 0)`;
      const settled =
        Math.abs(st.x.x - landing.left) < 1.2 &&
        Math.abs(st.y.x - landing.top) < 1.2 &&
        Math.abs(st.x.v) < 24 &&
        Math.abs(st.y.v) < 24;
      if (settled || elapsed > 0.9) {
        settleLoopRef.current?.stop();
        settleLoopRef.current = null;
        finish(state);
      }
    });
    settleLoopRef.current.start(ghost);
  };

  // 处理函数放在 ref 里，监听只挂一次，避免拖拽期间的 setState 造成闭包过期
  const handlerRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  }>({ move: () => {}, up: () => {} });

  handlerRef.current = {
    move: (event) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.id) return;
      if (!drag.ghost) {
        if (Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) < 5) return;
        startGhost(drag);
      }
      drag.gx = event.clientX - drag.ox;
      drag.gy = event.clientY - drag.oy;
      if (drag.ghost) {
        drag.ghost.style.transform = `translate3d(${drag.gx}px, ${drag.gy}px, 0)`;
      }
      const col = columnAt(event.clientX, event.clientY);
      // 锁定列同样高亮（红色）：让「拖不进去」在松手之前就看得见
      const next = col && col.key !== drag.from.key ? col.key : null;
      setOverKey((prev) => (prev === next ? prev : next));
    },
    up: (event) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.id) return;
      dragRef.current = null;
      const target =
        overKey === null ? null : columns.find((c) => c.key === overKey) ?? null;
      setOverKey(null);
      if (!drag.ghost) return;
      void settle(drag, target && target.accepts !== false ? target : null);
    },
  };

  useEffect(() => {
    const move = (e: PointerEvent) => handlerRef.current.move(e);
    const up = (e: PointerEvent) => handlerRef.current.up(e);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  useEffect(
    () => () => {
      settleLoopRef.current?.stop();
      dragRef.current?.ghost?.remove();
      dragRef.current?.card?.classList.remove("is-placeholder");
    },
    []
  );

  const onPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    item: T,
    column: ChainColumn<T>
  ) => {
    if (!draggable || busy || event.button !== 0) return;
    if ((event.target as Element).closest("button, a, input, select, textarea")) return;
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    dragRef.current = {
      id: event.pointerId,
      item,
      from: column,
      card,
      ghost: null,
      inner: null,
      sx: event.clientX,
      sy: event.clientY,
      ox: event.clientX - rect.left,
      oy: event.clientY - rect.top,
      gx: rect.left,
      gy: rect.top,
      origin: rect,
    };
  };

  /* ---------- 键盘替代：移动到… ---------- */
  const moveVia = async (item: T, from: ChainColumn<T>, to: ChainColumn<T>) => {
    setMenuFor(null);
    if (!onMove || busy) return;
    flipRef.current = captureRects(rootRef.current, "data-card");
    let ok = false;
    try {
      ok = await onMove({ item, from, to });
    } catch {
      ok = false;
    }
    if (!ok) flipRef.current = null;
  };

  useEffect(() => {
    if (menuFor === null) return;
    const onDocClick = (event: MouseEvent) => {
      if (!(event.target as Element).closest(".cb-menu, .cb-menu-btn")) setMenuFor(null);
    };
    const timer = window.setTimeout(() =>
      document.addEventListener("click", onDocClick)
    );
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", onDocClick);
    };
  }, [menuFor]);

  return (
    <div
      ref={rootRef}
      className={`cb-board${draggable ? " is-draggable" : ""}${busy ? " is-busy" : ""}`}
    >
      {columns.map((col, ci) => (
        <section
          key={col.key}
          data-column={col.key}
          className={`cb-col cat-${((col.tone ?? ci + 1) % 5) + 1}${
            overKey === col.key ? " is-over" : ""
          }${col.accepts === false ? " is-locked" : ""}`}
          aria-label={`${col.title}，${col.items.length} 项`}
        >
          <header className="cb-col-head">
            <span className="cb-dot" aria-hidden="true" />
            <span className="cb-col-title">{col.title}</span>
            <span className="cb-col-count tnum">{col.items.length}</span>
          </header>
          {col.hint && <p className="cb-col-hint">{col.hint}</p>}
          <div className="cb-col-body">
            {col.items.map((item) => {
              const key = keyOf(item);
              return (
                <article
                  key={key}
                  data-card={key}
                  className="cb-card"
                  onPointerDown={(e) => onPointerDown(e, item, col)}
                >
                  {renderCard(item, col)}
                  {draggable && onMove && !busy && (
                    <div className="cb-menu-wrap">
                      <button
                        type="button"
                        className="cb-menu-btn"
                        aria-label="移动到其他分组"
                        aria-expanded={menuFor === key}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === key ? null : key);
                        }}
                      >
                        ⋯
                      </button>
                      {menuFor === key && (
                        <div className="cb-menu" role="menu">
                          <span className="cb-menu-label">移动到</span>
                          {columns
                            .filter((c) => c.key !== col.key && c.accepts !== false)
                            .map((to) => (
                              <button
                                key={to.key}
                                type="button"
                                role="menuitem"
                                className="cb-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void moveVia(item, col, to);
                                }}
                              >
                                {to.title}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {col.items.length === 0 && <p className="cb-empty">{emptyText}</p>}
          </div>
        </section>
      ))}
    </div>
  );
}
