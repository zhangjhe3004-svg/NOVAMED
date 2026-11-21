/**
 * 全局轻提示（toast）—— 替代 antd v6 message 静态实现。
 *
 * 背景：antd 6.6.5 + React 19.3 下，message 静态方法与 App 上下文实例
 * 均静默失效（rc-notification 通知挂载不渲染 DOM，无任何报错）。
 * 全站 40+ 处 message.xxx(...) 的操作反馈因此不可见。
 *
 * 本模块用受控 DOM 自绘提示：样式对齐 NOVAMED 设计语汇
 * （白底胶囊、8px 圆角、柔和阴影、顶部居中、淡入淡出），
 * 并由 components/MessageBridge 回填到 antd 静态 message 对象上，
 * 业务代码零改动恢复可见。
 */

type ToastType = "success" | "error" | "info" | "warning" | "loading";

interface ToastItem {
  id: number;
  el: HTMLElement;
  timer: number;
}

const CONTAINER_ID = "mc-toast-root";
let seq = 0;
let container: HTMLElement | null = null;
const items: ToastItem[] = [];

const ICONS: Record<ToastType, string> = {
  success:
    '<svg viewBox="64 64 896 896" width="16" height="16" fill="#52c41a"><path d="M699 353h-46.9c-10.2 0-19.9 4.9-25.9 13.3L469 584.3l-95.9-111.9c-6-7-14.7-11-23.9-11h-48.3c-8.9 0-17.4 4-23 11-11.2 13.8-9.2 34 4.5 45.1l138.4 161.5c6 7 14.7 11 23.9 11 9.2 0 17.9-4 23.9-11l175.8-215.6c11.2-13.8 9.2-34-4.5-45.1-5.8-4.7-13-7.3-20.4-7.3z"/><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/></svg>',
  error:
    '<svg viewBox="64 64 896 896" width="16" height="16" fill="#ff4d4f"><path d="M685.4 354.8c0-4.4-3.6-8-8-8l-66 .3L512 465.6l-99.3-118.4-66.1-.3c-4.4 0-8 3.5-8 8 0 1.9.7 3.7 1.9 5.2l130.1 155L340.5 670a8.32 8.32 0 0 0-1.9 5.2c0 4.4 3.6 8 8 8l66.1-.3L512 564.4l99.3 118.4 66 .3c4.4 0 8-3.5 8-8 0-1.9-.7-3.7-1.9-5.2L553.5 515l130.1-155c1.2-1.5 1.8-3.3 1.8-5.2z"/><path d="M512 65C264.6 65 64 265.6 64 513s200.6 448 448 448 448-200.6 448-448S759.4 65 512 65zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/></svg>',
  info:
    '<svg viewBox="64 64 896 896" width="16" height="16" fill="#1677ff"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/><path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"/></svg>',
  warning:
    '<svg viewBox="64 64 896 896" width="16" height="16" fill="#faad14"><path d="M955.7 856l-416-720c-6.2-10.7-16.9-16-27.7-16s-21.6 5.3-27.7 16l-416 720C56 877.4 71.4 904 96 904h832c24.6 0 40-26.6 27.7-48zM480 416c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v184c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8V416zm32 352a48.01 48.01 0 0 1 0 96 48.01 48.01 0 0 1 0-96z"/></svg>',
  loading:
    '<svg viewBox="0 0 1024 1024" width="16" height="16" fill="#1677ff" class="mc-toast-spin"><path d="M988 548c-1.3 51.6-13 101.5-34.5 148.7-21.9 47.7-52.5 90.5-90.7 126.4-38.2 35.9-82.5 63.5-130.9 81.6-47.1 17.5-97 25.4-148 23.2-51-2.2-100.3-14.1-145.7-35.1-44.2-20.4-83.6-49.4-116.7-85.2-33.2-35.8-58.8-77.5-75.6-122.8-17.4-46.9-24.3-96.9-20.2-147 4-48.6 17.7-95.5 40-138.4 21.7-41.6 51.2-78.6 87-108.9 35.9-30.4 76.9-52.7 121.3-65.8 46-13.6 94.3-17.8 142-11.4 5.7.8 9.9 5.6 10.4 11.3l1.6 19.5c.6 6.9-4.9 12.8-11.8 12.4-45-2.5-90 3.3-132.4 17.5-39.6 13.3-75.7 34.7-106.2 62.9-30.5 28.2-54.6 62-71.2 99.5-17.2 38.8-25.9 80.6-25.5 123.2.4 42.6 9.8 84.2 27.7 122.2 17.3 36.7 42.1 69.4 72.9 96.1 30.8 26.7 66.3 45.9 104.8 56.7 40.1 11.2 82 13.2 123.3 5.6 39.5-7.3 76.6-24 108.6-48.6 32-24.6 57.5-55.9 75.1-91.6 18.3-37 27.3-77.8 26.1-119.2-.1-4-.1-8 0-12 0-6.4 5.2-11.6 11.6-11.6h22.6c6.4 0 11.6 5.2 11.6 11.6.1 4 .1 8 0 12z"/></svg>',
};

const CSS = `
#${CONTAINER_ID} {
  position: fixed;
  top: 8px;
  left: 0;
  right: 0;
  z-index: 2010;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
#${CONTAINER_ID} .mc-toast {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 48px);
  padding: 9px 16px;
  border-radius: 10px;
  /* 纸感白底 + 深字：任何页面上内容都清晰可读 */
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(43, 52, 68, 0.12), 0 1px 3px rgba(43, 52, 68, 0.08);
  border: 1px solid rgba(43, 52, 68, 0.1);
  font-size: 14px;
  line-height: 1.5;
  color: #2b3444;
  pointer-events: auto;
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 0.22s ease, transform 0.22s ease;
}
#${CONTAINER_ID} .mc-toast.is-in {
  opacity: 1;
  transform: translateY(0);
}
#${CONTAINER_ID} .mc-toast.is-out {
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity 0.25s ease, transform 0.25s ease;
}
#${CONTAINER_ID} .mc-toast .mc-toast-ico {
  display: inline-flex;
  flex-shrink: 0;
}
#${CONTAINER_ID} .mc-toast-spin {
  animation: mc-toast-rotate 1s linear infinite;
}
@keyframes mc-toast-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  const el = document.createElement("div");
  el.id = CONTAINER_ID;
  if (!document.getElementById("mc-toast-style")) {
    const style = document.createElement("style");
    style.id = "mc-toast-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  document.body.appendChild(el);
  container = el;
  return el;
}

function show(content: string, type: ToastType = "info", duration = 3000): void {
  if (typeof document === "undefined") return;
  const root = ensureContainer();
  const item = document.createElement("div");
  item.className = "mc-toast";
  item.setAttribute("role", "alert");
  const ico = document.createElement("span");
  ico.className = "mc-toast-ico";
  ico.innerHTML = ICONS[type] || ICONS.info;
  const text = document.createElement("span");
  text.textContent = content;
  item.appendChild(ico);
  item.appendChild(text);
  root.appendChild(item);

  const record: ToastItem = {
    id: ++seq,
    el: item,
    timer: 0,
  };
  items.push(record);
  requestAnimationFrame(() => requestAnimationFrame(() => item.classList.add("is-in")));

  const close = () => {
    record.timer = 0;
    item.classList.remove("is-in");
    item.classList.add("is-out");
    window.setTimeout(() => {
      item.remove();
      const idx = items.indexOf(record);
      if (idx >= 0) items.splice(idx, 1);
    }, 280);
  };
  record.timer = window.setTimeout(close, Math.max(0, duration));
}

export const toast = {
  success: (content: string, duration?: number) => show(content, "success", duration),
  error: (content: string, duration?: number) => show(content, "error", duration),
  info: (content: string, duration?: number) => show(content, "info", duration),
  warning: (content: string, duration?: number) => show(content, "warning", duration),
  loading: (content: string, duration?: number) => show(content, "loading", duration),
};
