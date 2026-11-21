/**
 * 品牌标识 —— NOVAMED 信号标（全站唯一实现）
 *
 * 设计逻辑：不画「方块里贴一个加号」，而是从方块本体中雕出医疗十字的负空间。
 * 十字把 36×36 的底座切分成四个等大的方形岛屿，岛屿向外撑到圆角边缘，
 * 于是底座从「装饰底板」升格为图形本体 —— 四个角块 + 十字槽。
 * 单个几何体同时承载「医疗」（十字）与「系统」（四宫格/模块拼装）两层语义，
 * 且因为十字是镂空而非描白，在白底与深色底上都能稳定可读。
 *
 * 用法：
 *   <BrandMark size={36} />                          // 品牌蓝
 *   <BrandMark size={40} accent="teal" />            // 患者端青绿
 *   <BrandMark size={36} on="dark" />                // 深色底（登录页/患者门户）
 */
import { useId } from "react";

/** 品牌蓝：顶面亮 → 右下暗，模拟光源自左上方向下打 */
const ACCENT_BLUE = { hi: "#6BA0FF", mid: "#2A63F0", lo: "#1B3FC4" };
/** 患者端薄荷青：深色 Soft Utility 主行动色 #5fd0b4 同族（亮薄荷 → 主薄荷 → 深青） */
const ACCENT_TEAL = { hi: "#8FE3CC", mid: "#5FD0B4", lo: "#2F8C79" };

export interface BrandMarkProps {
  /** 边长（px），默认 36 —— SVG 按此等比缩放，任意尺寸都不失真 */
  size?: number;
  /** 内置 blue / teal，或任意十六进制主色（自动推导明暗面） */
  accent?: "blue" | "teal" | string;
  /** 承载背景明暗：dark 时描边调亮，避免深色底上边缘发闷 */
  on?: "light" | "dark";
  /** 是否附投影 */
  shadow?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/** 由主色推导同族亮面/暗面 */
function deriveFaces(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return ACCENT_BLUE;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
  const mix = (c: number, to: number, ratio: number) => Math.round(c + (to - c) * ratio);
  const hx = (c: number) => c.toString(16).padStart(2, "0");
  const face = (ratio: number, to: number) =>
    `#${hx(mix(r, to, ratio))}${hx(mix(g, to, ratio))}${hx(mix(b, to, ratio))}`;
  return { hi: face(0.32, 255), mid: `#${hx(r)}${hx(g)}${hx(b)}`, lo: face(0.32, 0) };
}

/* ── 几何常量（36×36 视口，全部参数集中于此便于微调）──
   底座 2→34（32 见方，四周留 2px 呼吸位）；圆角 8.6。
   十字槽：竖槽 x 13.4→22.6、横槽 y 13.4→22.6，臂宽 9.2，
   槽末端口 rx 3.2 收圆，与底座圆角同一种柔和语言。
   四角块：13.4×13.4 见方 —— 与臂宽 9.2 形成 ≈1.46 的对比，
   既保证 16px 小尺寸下十字不糊，又让角块有足够面积承载渐变。*/
const TILE = 2, TILE_SIZE = 32, TILE_R = 8.6;
const SLOT_A = 13.4, SLOT_B = 22.6, SLOT_R = 3.2;

export default function BrandMark({
  size = 36,
  accent = "blue",
  on = "light",
  shadow = true,
  className,
  style,
  title = "NOVAMED",
}: BrandMarkProps) {
  // 同页多实例并存，渐变 id 必须唯一，否则后挂载的会覆盖先前的
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gFace = `bm-face-${uid}`;
  const gShine = `bm-shine-${uid}`;
  const gMask = `bm-mask-${uid}`;

  const faces =
    accent === "blue" ? ACCENT_BLUE : accent === "teal" ? ACCENT_TEAL : deriveFaces(accent);
  const dark = on === "dark";

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
        borderRadius: size * (TILE_R / 36),
        filter: shadow
          ? `drop-shadow(0 ${(size * 0.07).toFixed(2)}px ${(size * 0.16).toFixed(2)}px ${faces.mid}66)`
          : undefined,
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={gFace} x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor={faces.hi} />
            <stop offset="0.52" stopColor={faces.mid} />
            <stop offset="1" stopColor={faces.lo} />
          </linearGradient>

          {/* 顶缘镜面高光：只作用于底座上半部 */}
          <linearGradient id={gShine} x1="8" y1="2" x2="22" y2="19" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity={dark ? 0.34 : 0.42} />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* 镂空遮罩：白 = 保留，黑 = 挖去。十字槽即在此挖出 */}
          <mask id={gMask} maskUnits="userSpaceOnUse" x="0" y="0" width="36" height="36">
            <rect x={TILE} y={TILE} width={TILE_SIZE} height={TILE_SIZE} rx={TILE_R} fill="#fff" />
            <rect x={SLOT_A} y="0" width={SLOT_B - SLOT_A} height="36" rx={SLOT_R} fill="#000" />
            <rect x="0" y={SLOT_A} width="36" height={SLOT_B - SLOT_A} rx={SLOT_R} fill="#000" />
          </mask>
        </defs>

        {/* ① 主体：一个被十字槽切开的渐变底座。
             外层 g 负责投影之外的收边，mask 负责镂空。
             因十字完全贯穿，四角块各自独立成岛 —— 这是刻意的：
             医疗的「十字」与系统的「模块」由同一组形状同时表达。 */}
        <g mask={`url(#${gMask})`}>
          <rect x={TILE} y={TILE} width={TILE_SIZE} height={TILE_SIZE} rx={TILE_R} fill={`url(#${gFace})`} />
          {/* ② 顶缘镜面高光（同样被 mask 裁在底座内，随四角块起伏） */}
          <rect x={TILE} y={TILE} width={TILE_SIZE} height={TILE_SIZE} rx={TILE_R} fill={`url(#${gShine})`} />
          {/* ③ 内描边：深色底上把底座边缘从背景里托出来 */}
          <rect
            x={TILE + 0.45}
            y={TILE + 0.45}
            width={TILE_SIZE - 0.9}
            height={TILE_SIZE - 0.9}
            rx={TILE_R - 0.45}
            stroke={dark ? "rgba(21,58,124,0.22)" : "rgba(232,232,244,0.6)"}
            strokeWidth="0.9"
          />
        </g>

        {/* ④ 十字槽底纹：极淡的白色，让镂空处不是纯透明空腔，
             而是「有底的凹槽」，深色底上尤其明显；同时呼应玻璃材质。 */}
        <rect
          x={SLOT_A}
          y="0"
          width={SLOT_B - SLOT_A}
          height="36"
          rx={SLOT_R}
          fill={dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.30)"}
        />
        <rect
          x="0"
          y={SLOT_A}
          width="36"
          height={SLOT_B - SLOT_A}
          rx={SLOT_R}
          fill={dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.30)"}
        />

        {/* ⑤ 交叉口信号点：唯一的不对称元素，把视线锁在十字中心并暗示「数据/在线」 */}
        <circle cx="18" cy="18" r="2.3" fill={dark ? "#EAF2FF" : "#FFFFFF"} fillOpacity="0.92" />
      </svg>
    </div>
  );
}

export const BRAND_FACES = { blue: ACCENT_BLUE, teal: ACCENT_TEAL } as const;
