/**
 * 悬停名片 —— 移植自 scaffold 的 `ui/HoverCard.vue`。
 *
 * 只放**只读**信息：指针在触发区停留 `delay` 毫秒（默认 300ms）后，从触发区
 * 的近边（默认下方）浮出一张轻卡片；指针移出后留 120ms 宽限，允许指针从触发区
 * 移进卡片本身（卡内可选中文本），超时才收起。
 *
 * 三个容易踩的点，这里都处理了：
 *
 *  1. **定位层与动画层分离**。卡片用 `position: fixed` + `left/top` 做锚定，
 *     入场动画只写 `transform`（`translateY(-6px) scale(.98)` → `none`）。
 *     若两者都写 `transform`，动画一结束就会把锚定偏移一起清掉，卡片会"跳"一下。
 *
 *  2. **先挂载再量高再摆位**。卡片高度决定它该出现在触发区下方还是上方，
 *     而高度只有渲染后才知道。这里用 `useLayoutEffect` 在提交后同帧量取，
 *     避免"先按 120px 猜、再跳一次"的闪烁。
 *
 *  3. **effect 只依赖 `open`**。`card` 是每次父组件渲染都会新建的 JSX，
 *     把它写进依赖会让「摆位 → setState → 重渲染 → 再摆位」变成死循环。
 *     所以摆位函数放 ref 里，effect 只在开合时跑一次。
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { EASE, motionSkipped } from "../utils/motion";

interface HoverCardProps {
  /** 触发区内容（通常是头像） */
  children: ReactNode;
  /** 名片内容 */
  card: ReactNode;
  /** 悬停多久才浮出（毫秒） */
  delay?: number;
  /** 优先出现在触发区的哪一侧；空间不够会自动翻到另一侧 */
  placement?: "bottom" | "top";
  /** 名片宽度（px） */
  width?: number;
  /** 置 true 时完全不响应指针（例如该行没有可展示的信息） */
  disabled?: boolean;
}

/** 触发区与名片之间的呼吸间距 */
const GAP = 8;
/** 指针离开后允许"反悔"的时间：够它移进卡片 */
const GRACE = 120;
/** 名片与视口边缘的最小留白 */
const EDGE = 12;
/** 入场：与 scaffold 的 GSAP `pop` 同参数（y:-6, scale:.98, 0.32s, expo.out） */
const ENTER_MS = 320;

export default function HoverCard({
  children,
  card,
  delay = 300,
  placement = "bottom",
  width = 260,
  disabled = false,
}: HoverCardProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const cardId = useId();

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** 量触发区矩形 + 名片实际高度，算出 left/top；空间不够就翻面，左右夹进视口。 */
  const place = useCallback(() => {
    const t = triggerRef.current?.getBoundingClientRect();
    if (!t) return;
    const h = cardRef.current?.offsetHeight ?? 120;
    const roomBelow = window.innerHeight - t.bottom - GAP - EDGE;
    const roomAbove = t.top - GAP - EDGE;
    // 优先照顾 placement 指定的那一侧：
    //   两侧都放得下 → 听 placement
    //   只有一侧放得下 → 用放得下的那侧（否则卡片会被视口切掉一截）
    //   两侧都放不下 → 挑宽裕的一侧
    const fitsBelow = roomBelow >= h;
    const fitsAbove = roomAbove >= h;
    let below: boolean;
    if (fitsBelow && fitsAbove) below = placement === "bottom";
    else if (fitsBelow) below = true;
    else if (fitsAbove) below = false;
    else below = roomBelow >= roomAbove;
    const maxLeft = Math.max(EDGE, window.innerWidth - width - EDGE);
    const left = Math.min(Math.max(t.left + t.width / 2 - width / 2, EDGE), maxLeft);
    const top = below ? t.bottom + GAP : t.top - h - GAP;
    // 值没变就不 setState：父组件重渲染时不会因为新建对象把 effect 拖进循环
    setPos((prev) => (prev.left === left && prev.top === top ? prev : { left, top }));
  }, [placement, width]);

  const placeRef = useRef(place);
  placeRef.current = place;

  const show = useCallback(
    (now = false) => {
      if (disabled) return;
      clearTimer();
      timerRef.current = window.setTimeout(
        () => setOpen(true),
        now ? 0 : delay,
      );
    },
    [clearTimer, delay, disabled],
  );

  const hide = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => setOpen(false), GRACE);
  }, [clearTimer]);

  /* 挂载后同帧摆位 + 起播入场动画。只依赖 open，理由见文件头注释。 */
  useLayoutEffect(() => {
    if (!open) return;
    placeRef.current();
    const el = cardRef.current;
    if (!el || motionSkipped()) return;
    // 定位层不写 transform，所以这里的 transform 不会和锚定打架
    el.animate(
      [
        { opacity: 0, transform: "translateY(-6px) scale(0.98)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: ENTER_MS, easing: EASE.reveal, fill: "none" },
    );
  }, [open]);

  /* 开着的时候容器尺寸变了要跟着重新贴边（窗口缩放、侧栏折叠、表格重排） */
  useEffect(() => {
    if (!open) return;
    const onShift = () => placeRef.current();
    window.addEventListener("resize", onShift);
    // capture 阶段收滚动：表格容器自身滚动也要跟
    window.addEventListener("scroll", onShift, true);
    return () => {
      window.removeEventListener("resize", onShift);
      window.removeEventListener("scroll", onShift, true);
    };
  }, [open]);

  useEffect(() => clearTimer, [clearTimer]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape" && open) {
      clearTimer();
      setOpen(false);
      event.stopPropagation();
    }
  };

  return (
    <>
      <span
        ref={triggerRef}
        className="hovercard-trigger"
        aria-describedby={open ? cardId : undefined}
        onPointerEnter={() => show()}
        onPointerLeave={hide}
        onPointerCancel={hide}
        onFocus={() => show(true)}
        onBlur={hide}
        onKeyDown={onKeyDown}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role="tooltip"
            className="hovercard"
            style={{ left: pos.left, top: pos.top, width }}
            onPointerEnter={() => show(true)}
            onPointerLeave={hide}
          >
            {card}
          </div>,
          document.body,
        )}
    </>
  );
}

/** 名片的统一头部：头像 + 主名 + 副名。与 scaffold 的 `.hc-head` 对应。 */
export function HoverCardHead({
  avatar,
  name,
  sub,
}: {
  avatar: ReactNode;
  name: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="hc-head">
      {avatar}
      <div className="hc-names">
        <div className="hc-name">{name}</div>
        {sub ? <div className="hc-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

/** 名片的键值区：与 scaffold 的 `<dl class="hc-rows">` 对应，空值自动显示为「—」。 */
export function HoverCardRows({
  rows,
}: {
  rows: Array<{ label: string; value?: ReactNode }>;
}) {
  return (
    <dl className="hc-rows">
      {rows.map((r) => (
        <Fragment key={r.label}>
          <dt>{r.label}</dt>
          <dd>{r.value === undefined || r.value === null || r.value === "" ? "—" : r.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
