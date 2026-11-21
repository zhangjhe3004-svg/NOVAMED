/**
 * GlassEffects —— 全局「光随鼠标」（Light Follow）驱动
 * ---------------------------------------------------------------------------
 * 通过事件委托在 pointermove 时，给命中的玻璃卡片（.ant-card / .stat / .panel /
 * .glass-follow）写入 CSS 变量 --gx/--gy，配合 styles/glassmorphism.css 里的
 * ::after 径向光斑，实现「光标照到哪、卡片局部就亮起来」。
 *
 * 可选 3D 倾斜：给任意卡片加 .glass-tilt，本组件会同步写入 --rx/--ry（≤4°）。
 *
 * 只挂一个全局监听（rAF 节流），不逐卡片绑定，18+ 页面与患者端零改动复用。
 */
import { useEffect } from "react";

const GLASS_SELECTOR = ".ant-card, .stat, .panel, .glass-follow";
const TILT_SELECTOR = ".glass-tilt";
/** 自动挂 3D 倾斜的卡片候选：统计卡（.stat）与指标瓦片（.kpi） */
const TILT_CANDIDATES = ".stat, .kpi";

export default function GlassEffects() {
  useEffect(() => {
    // 把倾斜工具类挂到统计卡 / 指标瓦片上（页面按路由动态挂载，用 MutationObserver 跟进）
    let tagRaf = 0;
    const tagTilt = () => {
      document.querySelectorAll(TILT_CANDIDATES).forEach((el) => {
        if (!el.classList.contains("glass-tilt")) el.classList.add("glass-tilt");
      });
    };
    tagTilt();
    const mo = new MutationObserver(() => {
      if (tagRaf) return;
      tagRaf = requestAnimationFrame(() => {
        tagRaf = 0;
        tagTilt();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    let raf = 0;

    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const target = (e.target as Element | null);
        if (!target || typeof target.closest !== "function") return;

        // 光斑：写到最近的玻璃卡片
        const glass = target.closest(GLASS_SELECTOR) as HTMLElement | null;
        if (glass) {
          const r = glass.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * 100;
          const y = ((e.clientY - r.top) / r.height) * 100;
          glass.style.setProperty("--gx", x.toFixed(2) + "%");
          glass.style.setProperty("--gy", y.toFixed(2) + "%");
        }

        // 3D 倾斜（可选，≤4°）
        const tilt = target.closest(TILT_SELECTOR) as HTMLElement | null;
        if (tilt) {
          const r = tilt.getBoundingClientRect();
          const mx = ((e.clientX - r.left) / r.width) * 100;
          const my = ((e.clientY - r.top) / r.height) * 100;
          tilt.style.setProperty("--rx", (((my - 50) / 50) * -4).toFixed(2) + "deg");
          tilt.style.setProperty("--ry", (((mx - 50) / 50) * 4).toFixed(2) + "deg");
        }
      });
    };

    const onLeave = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const glass = target.closest(GLASS_SELECTOR) as HTMLElement | null;
      if (glass) {
        glass.style.setProperty("--gx", "50%");
        glass.style.setProperty("--gy", "50%");
      }
      const tilt = target.closest(TILT_SELECTOR) as HTMLElement | null;
      if (tilt) {
        tilt.style.setProperty("--rx", "0deg");
        tilt.style.setProperty("--ry", "0deg");
      }
    };

    // pointerout 处理离开卡片（pointerleave 不冒泡，用 pointerout 逐级判断）
    const onOut = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const glass = target.closest(GLASS_SELECTOR) as HTMLElement | null;
      if (glass && !glass.contains(e.relatedTarget as Node)) {
        glass.style.setProperty("--gx", "50%");
        glass.style.setProperty("--gy", "50%");
      }
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      mo.disconnect();
      if (tagRaf) cancelAnimationFrame(tagRaf);
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return null;
}
