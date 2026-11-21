/**
 * NOVAMED 星核品牌标 —— 与 Web 客户端 BrandSparkle 1:1 复刻
 *
 * 三部分动画（全部跑在原生驱动上）：
 *  1. 3D 公转 —— 两颗伴星沿「绕 X 轴倾斜 30°」的轨道绕星核运行（地球绕太阳式）。
 *     每帧解算 (x, y, z)，z 轴驱动远近：转到后方 → 缩小 + 变暗，转到前方 → 放大 + 变亮。
 *     由于 x/y/scale/opacity 都是相位的纯正弦函数，这里预采样成查找表，
 *     用 Animated.interpolate 交给原生驱动，避免逐帧 JS 计算。
 *  2. 粒子星云 —— 6 颗紫/青/粉微光粒子环绕星核，缓慢漂移 + 呼吸明暗。
 *  3. 星核呼吸 —— 炽白星核 scale 1→1.06 往复，光晕同步呼吸。
 *
 * 几何严格对齐 Web 的 viewBox 0 0 40 40：
 *   星核 r=10.5 · 伴星A r=3.6（轨道 12，7s）· 伴星B r=2.4（轨道 14，11s）
 */
import React, { useEffect, useMemo, useRef } from "react";
import { View, Animated, Easing, Image } from "react-native";

export interface BrandMarkProps {
  /** 边长（等同 Web 的 size，内部按 viewBox 40 等比换算） */
  size?: number;
  /** 深色底：光晕改冷白；浅色底：品牌蓝光晕 */
  on?: "light" | "dark";
}

const VIEWBOX = 40; // Web viewBox 边长
const TILT_DEG = 30; // 轨道面绕 X 轴倾斜角
const SAMPLES = 64; // 相位查找表采样数

/** 把圆周运动预采样成 4 张查找表（x / y / scale / opacity） */
function orbitTables(radius: number, phaseDeg: number) {
  const tilt = (TILT_DEG * Math.PI) / 180;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const phase = (phaseDeg * Math.PI) / 180;

  const xs: number[] = [];
  const ys: number[] = [];
  const scales: number[] = [];
  const ops: number[] = [];

  for (let i = 0; i <= SAMPLES; i++) {
    const ang = phase + (i / SAMPLES) * Math.PI * 2;
    const x3 = radius * Math.cos(ang); // 水平分量
    const z3 = radius * Math.sin(ang); // 纵深分量
    xs.push(x3);
    ys.push(z3 * cosT); // 投影到屏幕：纵深按 cos(30°) 压扁
    const norm = (z3 * sinT) / radius; // -1（最远）.. +1（最近）
    scales.push(0.7 + 0.35 * ((norm + 1) / 2)); // 0.70 .. 1.05
    ops.push(0.62 + 0.38 * ((norm + 1) / 2)); // 0.62 .. 1.00
  }
  return { xs, ys, scales, ops };
}

const INPUT_RANGE = Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES);

/** 粒子星云：位置/半径/颜色与 Web 的 bs-dust 完全一致 */
const DUST = [
  { cx: 6, cy: 12, r: 0.8, fill: "#60a5fa", dur: 4100, delay: 1200 },
  { cx: 34, cy: 8, r: 0.7, fill: "#38bdf8", dur: 5200, delay: 600 },
  { cx: 36, cy: 30, r: 0.9, fill: "#3b82f6", dur: 4100, delay: 1200 },
  { cx: 5, cy: 31, r: 0.6, fill: "#93c5fd", dur: 5800, delay: 1900 },
  { cx: 15, cy: 4, r: 0.6, fill: "#38bdf8", dur: 5200, delay: 600 },
  { cx: 26, cy: 37, r: 0.7, fill: "#60a5fa", dur: 4100, delay: 1200 },
];

/** 漂移关键帧（对应 CSS bs-dust-drift，位移由 u 换算成 px） */
const DUST_KEY = [
  { t: 0.0, x: 0, y: 0, s: 1.0, o: 0.5 },
  { t: 0.25, x: 1.2, y: -1.6, s: 1.15, o: 0.9 },
  { t: 0.5, x: -1.0, y: -0.6, s: 0.9, o: 0.6 },
  { t: 0.75, x: -1.4, y: 1.4, s: 1.05, o: 0.85 },
  { t: 1.0, x: 0, y: 0, s: 1.0, o: 0.5 },
];

const DUST_T = DUST_KEY.map((k) => k.t);

function DustParticle({ spec, u }: { spec: (typeof DUST)[number]; u: number }) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(p, {
        toValue: 1,
        duration: spec.dur,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      })
    );
    const anim = Animated.sequence([Animated.delay(spec.delay), loop]);
    anim.start();
    return () => anim.stop();
  }, [p, spec.dur, spec.delay]);

  // 小尺寸下 r≈0.6u 会掉到亚像素，设 2px 下限保证粒子可见
  const d = Math.max(spec.r * 2 * u, 2);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: spec.fill,
        left: (spec.cx - spec.r) * u,
        top: (spec.cy - spec.r) * u,
        opacity: p.interpolate({ inputRange: DUST_T, outputRange: DUST_KEY.map((k) => k.o) }),
        transform: [
          { translateX: p.interpolate({ inputRange: DUST_T, outputRange: DUST_KEY.map((k) => k.x * u) }) },
          { translateY: p.interpolate({ inputRange: DUST_T, outputRange: DUST_KEY.map((k) => k.y * u) }) },
          { scale: p.interpolate({ inputRange: DUST_T, outputRange: DUST_KEY.map((k) => k.s) }) },
        ],
      }}
    />
  );
}

/** 把一张查找表绑定到某个相位值 → transform + opacity 样式 */
function orbitStyle(
  phase: Animated.Value,
  orbit: ReturnType<typeof orbitTables>
) {
  return {
    opacity: phase.interpolate({ inputRange: INPUT_RANGE, outputRange: orbit.ops }),
    transform: [
      { translateX: phase.interpolate({ inputRange: INPUT_RANGE, outputRange: orbit.xs }) },
      { translateY: phase.interpolate({ inputRange: INPUT_RANGE, outputRange: orbit.ys }) },
      { scale: phase.interpolate({ inputRange: INPUT_RANGE, outputRange: orbit.scales }) },
    ],
  } as const;
}

export default function BrandMark({ size = 44, on = "light" }: BrandMarkProps) {
  const u = size / VIEWBOX; // 1 个 viewBox 单位对应的像素

  const breath = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.26)).current;
  const phaseA = useRef(new Animated.Value(0)).current;
  const phaseB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anims = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(breath, { toValue: 1.06, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(breath, { toValue: 1.0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 0.50, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.26, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ),
      // 伴星 A：内轨道，7s 一圈，初始相位 -90°（正上方）
      Animated.loop(Animated.timing(phaseA, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true })),
      // 伴星 B：外轨道，11s 一圈，初始相位 0°（正右方）
      Animated.loop(Animated.timing(phaseB, { toValue: 1, duration: 11000, easing: Easing.linear, useNativeDriver: true })),
    ];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [breath, glow, phaseA, phaseB]);

  const orbitA = useMemo(() => orbitTables(12 * u, -90), [u]);
  const orbitB = useMemo(() => orbitTables(14 * u, 0), [u]);

  const dotColor = on === "dark" ? "#7dd3fc" : "#38bdf8";
  const coreW = 21 * u; // 星核 r=10.5 → 直径 21u
  const satPathW = 7.2 * u; // 伴星 r=3.6 → 直径 7.2u
  const satDotW = 4.8 * u; // 伴星圆 r=2.4 → 直径 4.8u

  return (
    <View
      pointerEvents="none"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      {/* —— 轮廓辉光：预模糊的同形星核，模拟 Web 的 drop-shadow —— */}
      <Animated.Image
        source={require("../assets/brand-glow.png")}
        resizeMode="contain"
        style={{
          position: "absolute",
          width: coreW * 1.6,
          height: coreW * 1.6,
          opacity: glow,
          transform: [{ scale: breath }],
        }}
      />

      {/* —— 粒子星云 —— */}
      {DUST.map((d, i) => (
        <DustParticle key={i} spec={d} u={u} />
      ))}

      {/* —— 伴星 A：四角小星（内轨道 7s） —— */}
      <Animated.Image
        source={require("../assets/brand-core.png")}
        resizeMode="contain"
        style={[
          { position: "absolute", width: satPathW, height: satPathW },
          orbitStyle(phaseA, orbitA),
        ]}
      />

      {/* —— 伴星 B：圆点（外轨道 11s） —— */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: satDotW,
            height: satDotW,
            borderRadius: satDotW / 2,
            backgroundColor: dotColor,
          },
          orbitStyle(phaseB, orbitB),
        ]}
      />

      {/* —— 星核本体（公转中心，静止；呼吸脉冲） —— */}
      <Animated.Image
        source={require("../assets/brand-core.png")}
        resizeMode="contain"
        style={{ width: coreW, height: coreW, transform: [{ scale: breath }] }}
      />
    </View>
  );
}
