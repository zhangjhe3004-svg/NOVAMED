/**
 * 动效内核 —— 移植自 scaffold 的 composables/motion.ts（珍珠玻璃设计规范）。
 *
 * 设计约定（与源系统一致）：
 *   · 每条动效都要能说出能量语态：放 Discharge / 导 Conduct / 结 Crystallize / 停摆 Halt。
 *     说不出语态的就是装饰，不做。
 *   · 只动 transform / opacity；常驻动画走 createFrameLoop（后台、离屏自动停帧）。
 *   · 减少动态效果（prefers-reduced-motion）时直接进终态，绝不「动画到一半」。
 *
 * 与源系统的差异：本实现不依赖 GSAP，用 Web Animations API + requestAnimationFrame
 * 完成同一套物理与编排，避免给 MedCode 增加运行时依赖。
 */

/* ============================================================
   1. 令牌：缓动曲线与时长
   ============================================================ */

/** 缓动曲线（GSAP 命名 → CSS cubic-bezier 等价形式） */
export const EASE = Object.freeze({
  reveal: "cubic-bezier(0.16, 1, 0.3, 1)",   // expo.out    显现
  glide: "cubic-bezier(0.22, 1, 0.36, 1)",   // power4.out  位移滑行
  exit: "cubic-bezier(0.55, 0, 1, 0.45)",    // power2.in   退场
  swap: "cubic-bezier(0.45, 0, 0.55, 1)",    // power2.inOut 双向交接
  settle: "cubic-bezier(0.34, 1.56, 0.64, 1)", // back.out(1.6) 落定确认
});

/** 时长梯度（毫秒）—— 与 scaffold 的秒值一一对应 */
export const DUR = Object.freeze({
  press: 140,
  release: 460,
  hoverIn: 340,
  hoverOut: 420,
  slide: 520,
  pageOut: 180,
  pageIn: 620,
  overlayIn: 420,
  overlayOut: 200,
});

/* ============================================================
   2. 减少动态效果 / 页面在后台
   ============================================================ */

const reducedQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

export function prefersReducedMotion() {
  return Boolean(reducedQuery?.matches);
}

/** 页面在后台时 rAF 被节流，补间会停在中途：此时直接给终态 */
function skipMotion() {
  return (
    prefersReducedMotion() ||
    (typeof document !== "undefined" && document.hidden)
  );
}

export function motionSkipped() {
  return skipMotion();
}

/** 等两帧合成后再起播：避开 backdrop-filter 首次栅格化那一帧 */
export function afterTwoFrames(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

function nextFrames(count: number) {
  return new Promise<void>((resolve) => {
    let left = Math.max(1, count);
    const step = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export { nextFrames };

/* ============================================================
   3. 临界阻尼弹簧（源系统 spring / springOf）
   ============================================================ */

/** 弹簧状态：x 当前值，v 速度 */
export interface SpringState {
  x: number;
  v: number;
}

export const springOf = (x: number): SpringState => ({ x, v: 0 });

/**
 * 临界阻尼弹簧：每帧把 state 推向 target，返回新值。
 * k 越大越硬（62 ≈ 0.5s 落定；72 落位更硬；50 取消回弹稍软）。
 */
export function spring(state: SpringState, target: number, dt: number, k = 62) {
  const c = 2 * Math.sqrt(k);
  state.v += (-k * (state.x - target) - c * state.v) * dt;
  state.x += state.v * dt;
  return state.x;
}

/* ============================================================
   4. 帧循环（源系统 createFrameLoop）
   ============================================================ */

export interface FrameLoop {
  start(el?: Element | null): void;
  stop(): void;
  /** 立即执行一帧（减少动态效果时用来直接画到终态） */
  flush(): void;
  readonly time: number;
}

/**
 * 常驻帧循环：页面隐藏或元素离开视口时停帧（导 Conduct）。
 * 回调拿到 dt（秒，限制在 1/30 内）与累计时间 t；单帧出错只报一次，不让循环停摆。
 */
export function createFrameLoop(step: (dt: number, t: number) => void): FrameLoop {
  let target: Element | null = null;
  let offscreen = false;
  let frames = 0;
  let running = false;
  let last = 0;
  let time = 0;
  let warned = false;
  let raf = 0;

  const run = (force: boolean) => {
    if (typeof document !== "undefined" && document.hidden && !force) {
      last = 0;
      return;
    }
    // 每 20 帧量一次位置：离开视口就停帧
    if (target && (offscreen || frames++ % 20 === 0)) {
      const r = target.getBoundingClientRect();
      offscreen = r.width === 0 || r.bottom < 0 || r.top > window.innerHeight;
    }
    if (offscreen && !force) {
      last = 0;
      return;
    }
    const now = performance.now();
    const dt = last ? Math.max(0, Math.min(1 / 30, (now - last) / 1000)) : 1 / 60;
    last = now;
    time += dt;
    try {
      step(dt, time);
    } catch (error) {
      if (!warned) {
        warned = true;
        console.error("[motion] frame loop step failed", error);
      }
    }
  };

  const tick = () => {
    if (!running) return;
    run(false);
    raf = requestAnimationFrame(tick);
  };

  return {
    start(el?: Element | null) {
      if (running) return;
      running = true;
      last = 0;
      target = el ?? null;
      raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      target = null;
    },
    flush() {
      run(true);
    },
    get time() {
      return time;
    },
  };
}

/* ============================================================
   5. FLIP：自动让位
   数据变更前记录位置，变更后从旧位置滑到新位置
   ============================================================ */

/** 记录 root 下所有带标记元素的包围盒 */
export function captureRects(
  root: Element | null,
  attr = "data-card"
): Map<string, DOMRect> | null {
  if (!root) return null;
  const snap = new Map<string, DOMRect>();
  root.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
    const key = el.getAttribute(attr);
    if (key) snap.set(key, el.getBoundingClientRect());
  });
  return snap;
}

/**
 * 数据变更后调用：其余元素从旧位置滑到新位置（自动让位）。
 * 位移 < 1px 的元素跳过，避免无谓的合成层开销。
 *
 * skipKey：被拖拽的那张卡不要参与让位——它由幽灵卡承担飞行，
 * 而且让位动画会写上 transform，导致随后量到的落点变成「动画中途位置」。
 */
export function playFlip(
  root: Element | null,
  before: Map<string, DOMRect> | null,
  attr = "data-card",
  duration = DUR.slide,
  skipKey?: string
) {
  if (!root || !before || skipMotion()) return;
  root.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
    const key = el.getAttribute(attr);
    if (!key) return;
    if (skipKey && key === skipKey) return;
    const old = before.get(key);
    if (!old) return;
    const now = el.getBoundingClientRect();
    const dx = old.left - now.left;
    const dy = old.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.animate(
      [
        { transform: `translate3d(${dx}px, ${dy}px, 0)` },
        { transform: "translate3d(0, 0, 0)" },
      ],
      { duration, easing: EASE.glide, fill: "none" }
    );
  });
}

/**
 * 共享布局变形（Flip）：先记下 targets 的位置，执行 mutate（改状态并等 DOM 更新），
 * 再从旧位置平滑过渡到新布局。
 */
export async function flipLayout(
  root: Element | null,
  mutate: () => void | Promise<void>,
  attr = "data-card"
) {
  if (skipMotion()) {
    await mutate();
    return;
  }
  const state = captureRects(root, attr);
  await mutate();
  await nextFrames(2);
  playFlip(root, state, attr);
}

/* ============================================================
   6. 进出场编排
   ============================================================ */

/** 级联浮现：面板内子元素按阅读序依次显现（结 Crystallize）。gap 单位毫秒。 */
export function revealCascade(
  container: Element | null,
  selector = ":scope > *",
  gap = 75
) {
  if (!container || skipMotion()) return;
  const items = Array.from(container.querySelectorAll(selector)).slice(0, 18);
  items.forEach((el, index) => {
    (el as HTMLElement).animate(
      [
        { opacity: 0, transform: "translate3d(0, 10px, 0)" },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      {
        duration: 560,
        easing: EASE.reveal,
        delay: index * gap,
        fill: "backwards",
      }
    );
  });
}

/** 列表行按阅读序进入（每行 25ms 阶梯） */
export function revealRows(rows: ArrayLike<Element>, each = 25) {
  if (skipMotion() || !rows.length) return;
  Array.from(rows)
    .slice(0, 14)
    .forEach((el, index) => {
      (el as HTMLElement).animate(
        [
          { opacity: 0, transform: "translate3d(0, 6px, 0)" },
          { opacity: 1, transform: "translate3d(0, 0, 0)" },
        ],
        { duration: 500, easing: EASE.reveal, delay: index * each, fill: "backwards" }
      );
    });
}

/** 状态确认：一次 back.out 的 scale 弹入，不用 opacity 脉冲 */
export function settlePop(el: Element | null) {
  if (!el || skipMotion()) return;
  el.animate(
    [{ transform: "scale(0.6)" }, { transform: "scale(1)" }],
    { duration: 420, easing: EASE.settle, fill: "none" }
  );
}

/** 元素从某点「长出」（放 Discharge）：缩放 + 淡入，原点可指定 */
export function growFrom(
  el: Element | null,
  origin = "50% 50%",
  duration = DUR.overlayIn
) {
  if (!el || skipMotion()) return;
  const node = el as HTMLElement;
  node.style.transformOrigin = origin;
  node.animate(
    [
      { opacity: 0, transform: "scale(0.94)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    { duration, easing: EASE.reveal, fill: "none" }
  );
}

/** 底部浮条升起（放 Discharge） / 下沉（停摆 Halt） */
export function floatBarEnter(el: Element | null, duration = 560) {
  if (!el || skipMotion()) return;
  (el as HTMLElement).animate(
    [
      { opacity: 0, transform: "translate3d(0, 40px, 0) scale(0.96)" },
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    ],
    { duration, easing: EASE.settle, fill: "backwards" }
  );
}

/* ============================================================
   7. 指针轨迹（供弹层「从触发点展开」使用）
   ============================================================ */

export const lastPointer = { x: 0, y: 0, at: 0 };
let pointerTracked = false;

export function trackPointer() {
  if (pointerTracked || typeof document === "undefined") return;
  pointerTracked = true;
  document.addEventListener(
    "pointerdown",
    (event) => {
      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
      lastPointer.at = performance.now();
    },
    { capture: true, passive: true }
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" || event.key === " ") lastPointer.at = 0;
    },
    { capture: true, passive: true }
  );
}

/** 刚刚（600ms 内）由指针触发的打开动作才有「来处」 */
export function recentPointer() {
  return lastPointer.at && performance.now() - lastPointer.at < 600
    ? lastPointer
    : null;
}

/* ============================================================
   8. 曲线取样与一次性开场
   ============================================================ */

/** 三次贝塞尔上 u 处的坐标分量（连线脉冲沿线运动用） */
export function bezierAt(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  u: number
) {
  const m = 1 - u;
  return m * m * m * p0 + 3 * m * m * u * p1 + 3 * m * u * u * p2 + u * u * u * p3;
}

/** 本会话是否首次出现某段开场（开场只播一次，刷新后同会话不再重播） */
export function firstTimeInSession(key: string) {
  try {
    const storageKey = `medicode.intro.${key}`;
    if (sessionStorage.getItem(storageKey)) return false;
    sessionStorage.setItem(storageKey, "1");
    return true;
  } catch {
    return false;
  }
}

/* ============================================================
   9. 稳定伪随机（同一 seed 每帧一致，用于点位生长与漂移相位）
   ============================================================ */
export function seedOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
}

/* ============================================================
   10. 打字机（命令面板「问系统」预设问题逐字填入）
   ============================================================ */

/**
 * 逐字写出 text，每次回调最新片段；写完后延迟 180ms 触发 done。
 * 返回取消函数 —— 组件卸载或重新触发时必须调用，否则定时器会继续写旧文本。
 */
export function typeOut(
  text: string,
  write: (value: string) => void,
  done?: () => void,
  speed = 42
): () => void {
  if (skipMotion()) {
    write(text);
    done?.();
    return () => {};
  }
  let i = 0;
  write("");
  const timer = window.setInterval(() => {
    i += 1;
    write(text.slice(0, i));
    if (i >= text.length) {
      window.clearInterval(timer);
      window.setTimeout(() => done?.(), 180);
    }
  }, speed);
  return () => window.clearInterval(timer);
}
