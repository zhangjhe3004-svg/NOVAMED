/**
 * 品牌字标 —— NOVAMED 纯文字标（SAMSUNG 式粗体字标，无图标无底座）
 *
 * 设计逻辑：Corporate Clean 扁平原则 —— 单色实底字标、无渐变、无装饰底座。
 * light 底上用深蓝实色（蓝白体系内的「黑」），dark 底上用白字。
 *
 * 用法：
 *   <BrandLockup height={34} />                     // 全称字标（侧栏/顶栏）
 *   <BrandLockup height={48} />                     // 登录页
 *   <BrandLockup height={30} variant="monogram" />  // 收窄态单字「M」
 */
export interface BrandLockupProps {
  /** 高度（px），全称字标按 ≈5.25:1 等比换算宽度 */
  height?: number;
  /** full = NOVAMED 全称；monogram = 单字「M」 */
  variant?: "full" | "monogram";
  /** 承载背景明暗：dark 用白字，light 用深蓝实色字 */
  on?: "light" | "dark";
  /** 兼容旧调用签名，无实际作用（纯文字标无投影） */
  shadow?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export default function BrandLockup({
  height = 40,
  variant = "full",
  on = "light",
  className,
  style,
  title = "NOVAMED",
}: BrandLockupProps) {
  const dark = on === "dark";

  // 全称：210×40（≈5.25:1）；单字：48×40
  const vb = variant === "full" ? { w: 210, h: 40 } : { w: 48, h: 40 };
  const width = variant === "full" ? height * (210 / 40) : height * (48 / 40);
  const fill = dark ? "#ffffff" : "#2563eb"; // blue-700：扁平实色，SAMSUNG 式厚重字标

  return (
    <div
      className={className}
      title={title}
      role="img"
      aria-label={title}
      style={{ width, height, flexShrink: 0, ...style }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${vb.w} ${vb.h}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        {variant === "full" ? (
          <text
            x="105"
            y="20"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Bahnschrift, 'Segoe UI', Arial, sans-serif"
            fontWeight="800"
            fontSize="28"
            letterSpacing="1"
            fill={fill}
          >
            NOVAMED
          </text>
        ) : (
          <text
            x="24"
            y="20"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Bahnschrift, 'Segoe UI', Arial, sans-serif"
            fontWeight="800"
            fontSize="30"
            fill={fill}
          >
            M
          </text>
        )}
      </svg>
    </div>
  );
}
