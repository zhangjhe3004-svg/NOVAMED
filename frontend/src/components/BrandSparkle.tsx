/**
 * 品牌星核 —— NOVAMED 图标标（Nova 新星爆发，全站唯一图标 logo）
 *
 * 设计含义（与品牌名 Nova「新星」严格对应）：
 *   · 炽白星核 —— 新星爆发瞬间：星体中心最亮（白→浅蓝→品牌蓝的径向辉光），
 *     寓意以患者为中心的能量源头 ——「星源」。
 *   · 两颗伴星 —— 双星系统：AI 辅助智慧与数据洞察绕核心公转，
 *     是「辅助而非喧宾」的定位表达。
 *
 * 3D 公转（地球绕太阳式，非 2D 平面）：
 *   伴星在三维空间沿倾斜轨道（绕 X 轴倾 30°）绕核心运行，
 *   requestAnimationFrame 实时解算 (x, y, z)，z 轴驱动远近透视——
 *   转到「后方」→ 缩小 + 变暗；转到「前方」→ 放大 + 变亮，
 *   呈现真实的椭圆纵深轨道，而非平面正圆。
 *   尊重 prefers-reduced-motion，减弱动态时退化为静态椭圆。
 *
 * 用法：
 *   <BrandSparkle size={32} />                    // 侧栏/顶栏
 *   <BrandSparkle size={40} on="dark" />          // 登录页深色 hero（提亮渐变）
 */
import { useEffect, useId, useRef } from "react";

export interface BrandSparkleProps {
  /** 边长（px），SVG 等比缩放 */
  size?: number;
  /** 深色底上用提亮渐变，保证与深蓝 hero 对比 */
  on?: "light" | "dark";
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/** 内凹四角星路径：控制点收向中心形成利落尖角（pinch 越小越尖锐） */
function sparklePath(cx: number, cy: number, r: number, pinch = 0.15): string {
  const k = r * pinch;
  return [
    `M ${cx} ${cy - r}`,
    `Q ${cx + k} ${cy - k} ${cx + r} ${cy}`,
    `Q ${cx + k} ${cy + k} ${cx} ${cy + r}`,
    `Q ${cx - k} ${cy + k} ${cx - r} ${cy}`,
    `Q ${cx - k} ${cy - k} ${cx} ${cy - r}`,
    "Z",
  ].join(" ");
}

const CX = 20;   // 公转中心 x（viewBox 坐标）
const CY = 20;   // 公转中心 y
const TILT = 30; // 轨道面绕 X 轴倾斜角度（度）

/** 伴星轨道参数 */
interface SatelliteMeta {
  el: SVGGElement;
  radius: number;   // 轨道半径
  speed: number;    // 角速度（弧度/秒，正=顺时针）
  phase: number;    // 初始相位（弧度）
}

export default function BrandSparkle({
  size = 32,
  on = "light",
  className,
  style,
  title = "NOVAMED 新星",
}: BrandSparkleProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gCore = `bs-core-${uid}`;
  const gEdge = `bs-edge-${uid}`;
  const dark = on === "dark";
  const planeRef = useRef<SVGGElement>(null);

  const coreStops = dark
    ? [["0%", "#ffffff"], ["36%", "#dbeafe"], ["70%", "#60a5fa"], ["100%", "#3b82f6"]]
    : [["0%", "#ffffff"], ["34%", "#dbeafe"], ["68%", "#60a5fa"], ["100%", "#3b82f6"]];
  const rayStops = dark
    ? [["0%", "#7dd3fc"], ["100%", "#38bdf8"]]
    : [["0%", "#60a5fa"], ["100%", "#3b82f6"]];

  // 3D 轨道动画：rAF 解算 (x,y,z) → 投影 + 远近缩放/明暗
  useEffect(() => {
    const plane = planeRef.current;
    if (!plane) return;

    const els = Array.from(plane.querySelectorAll<SVGGElement>(".bs-sat"));
    // 伴星 A（内轨道四角星，7s）+ 伴星 B（外轨道圆点，11s）—— 均顺时针公转
    const meta: SatelliteMeta[] = [
      { el: els[0], radius: 12, speed: (Math.PI * 2) / 7, phase: -Math.PI / 2 },
      { el: els[1], radius: 14, speed: (Math.PI * 2) / 11, phase: 0 },
    ];

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tiltRad = (TILT * Math.PI) / 180;
    const cosT = Math.cos(tiltRad);
    const sinT = Math.sin(tiltRad);

    /** 投影一颗伴星：由角度得到屏幕坐标 + 深度缩放 */
    const place = (m: SatelliteMeta, ang: number) => {
      const x3 = m.radius * Math.cos(ang);
      const z3 = m.radius * Math.sin(ang);
      // 绕 X 轴倾斜 TILT°（y 分量 = z*cosT，剩余深度 = z*sinT）
      const y = CY + z3 * cosT;
      const x = CX + x3;
      const norm = (z3 * sinT) / m.radius; // -1（最远）.. +1（最近）
      const scale = 0.7 + 0.35 * ((norm + 1) / 2); // 0.7 .. 1.05（后方仍清晰）
      const opacity = 0.62 + 0.38 * ((norm + 1) / 2); // 0.62 .. 1.0（全程可见）
      // 伴星 path 以原点(0,0)为中心；先 translate 到绝对坐标，scale 围绕自身中心缩放，
      // 避免 transform-origin 与 scale 组合导致圆心偏移。
      m.el.setAttribute(
        "transform",
        `translate(${x}, ${y}) scale(${scale})`
      );
      m.el.setAttribute("opacity", opacity.toFixed(3));
    };

    if (reduce) {
      meta.forEach((m) => place(m, m.phase));
      return;
    }

    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      meta.forEach((m) => place(m, m.phase + m.speed * t));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dark]);

  return (
    <div
      className={className}
      title={title}
      role="img"
      aria-label={title}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        filter: dark
          ? `drop-shadow(0 1px 4px rgba(0, 0, 0, 0.5))`
          : `drop-shadow(0 0 8px rgba(59, 130, 246, 0.45))`,
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <defs>
          <radialGradient id={gCore} cx="0.42" cy="0.38" r="0.75">
            {coreStops.map(([o, c]) => (
              <stop key={o} offset={o} stopColor={c} />
            ))}
          </radialGradient>
          <linearGradient id={gEdge} x1="8" y1="32" x2="34" y2="6" gradientUnits="userSpaceOnUse">
            {rayStops.map(([o, c]) => (
              <stop key={o} offset={o} stopColor={c} />
            ))}
          </linearGradient>
        </defs>

        {/* 粒子星云：紫/青/粉微光粒子环绕星核，缓慢呼吸漂移（motionpedia 粒子） */}
        <g className="bs-dust" aria-hidden="true">
          <circle className="bs-dust-p" cx="6" cy="12" r="0.8" fill="#60a5fa" />
          <circle className="bs-dust-c" cx="34" cy="8" r="0.7" fill="#38bdf8" />
          <circle className="bs-dust-p" cx="36" cy="30" r="0.9" fill="#3b82f6" />
          <circle className="bs-dust-k" cx="5" cy="31" r="0.6" fill="#93c5fd" />
          <circle className="bs-dust-c" cx="15" cy="4" r="0.6" fill="#38bdf8" />
          <circle className="bs-dust-p" cx="26" cy="37" r="0.7" fill="#60a5fa" />
        </g>

        {/* 伴星层：两颗伴星沿 3D 倾斜轨道公转（JS 驱动远近缩放） */}
        <g ref={planeRef} className="bs-orbit-plane">
          <g className="bs-sat bs-orbit-a">
            <path d={sparklePath(0, 0, 3.6)} fill={`url(#${gCore})`} />
          </g>
          <g className="bs-sat bs-orbit-b">
            <circle cx="0" cy="0" r="2.4" fill={dark ? "#7dd3fc" : "#38bdf8"} />
          </g>
        </g>

        {/* 新星本体：白热星核（公转中心，保持静止） */}
        <path d={sparklePath(20, 20, 10.5)} fill={`url(#${gCore})`} />
      </svg>
    </div>
  );
}
