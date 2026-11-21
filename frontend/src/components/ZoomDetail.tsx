/**
 * ZoomDetail —— 就地放大（Expand In Place）
 * ---------------------------------------------------------------------------
 * 点击面板头部的 ⤢ 时，把该模块放大为居中的玻璃详情面板；
 * 底部缩略条可在多个模块间切换（对应切换带轻微上浮动画）。
 * 支持 Esc / 点击遮罩 / 关闭按钮退出；尊重「减弱动态效果」。
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface ZoomModule {
  key: string;
  title: string;
  caption?: string;
  /** 缩略条上的图形（建议用 @ant-design 图标，保持无 emoji） */
  glyph: ReactNode;
  render: () => ReactNode;
}

interface ZoomDetailProps {
  open: boolean;
  index: number;
  modules: ZoomModule[];
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function ZoomDetail({
  open,
  index,
  modules,
  onClose,
  onIndexChange,
}: ZoomDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // 打开时面板「原位放大」入场：缩小上浮 → 轻微过冲 → 落定
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (el && !reducedMotion()) {
      el.animate(
        [
          { transform: "scale(0.86) translateY(24px)", opacity: 0 },
          { transform: "scale(1.02) translateY(-4px)", opacity: 1, offset: 0.7 },
          { transform: "scale(1) translateY(0)", opacity: 1 },
        ],
        { duration: 460, easing: "cubic-bezier(.34,1.3,.4,1)" }
      );
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const mod = modules[index];

  // 用 Portal 挂到 body：祖先的路由转场动画带 transform，会把 fixed 定位
  // 劫持为相对该祖先，导致遮罩盖不住视口、底部缩略条被裁掉。
  return createPortal(
    <div
      className={`md-zoom-overlay${open ? " md-zoom-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
    >
      <div className="md-zoom-backdrop" onClick={onClose} />
      <button type="button" className="md-zoom-close" onClick={onClose} aria-label="关闭">
        ✕
      </button>
      <div className="md-zoom-stage">
        {open && mod && (
          <div className="md-zoom-panel" ref={panelRef}>
            <div className="md-zoom-head">
              <div>
                <h2>{mod.title}</h2>
                {mod.caption && <small>{mod.caption}</small>}
              </div>
            </div>
            {/* key 绑定模块：切换模块时重放上浮动画 */}
            <div className="md-zoom-body" key={mod.key}>
              {mod.render()}
            </div>
          </div>
        )}
      </div>
      {open && (
        <div className="md-zoom-thumbs">
          {modules.map((m, i) => (
            <button
              key={m.key}
              type="button"
              className={`md-zoom-thumb${i === index ? " active" : ""}`}
              onClick={() => onIndexChange(i)}
              title={m.title}
              aria-label={m.title}
            >
              {m.glyph}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
