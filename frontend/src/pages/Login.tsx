/**
 * 登录页 —— 双栏布局 + scaffold 登录页动态效果体系（login-fx.css + NeuralNet）：
 *   神经网络画布呼吸/脉冲 → 登录成功迸发收束成对勾；
 *   秒针刻度时钟逐格点亮；服务状态铭牌（/api/health 实测延迟）；
 *   登录卡指针轻倾 + 辉光跟随；开场编排（二次访问 2.4 倍速、点击/按键快进）；
 *   登录成功三拍：按钮收拢 → 圆环描出 → 对勾 → 进入系统。
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, message, Checkbox } from "antd";
import {
  UserOutlined,
  LockOutlined,
  FolderOpenOutlined,
  SafetyOutlined,
  MobileOutlined,
} from "@ant-design/icons";
import { login as loginApi, cardLogin as cardLoginApi } from "../api/auth";
import api from "../api/client";
import { useAuth } from "../stores/auth";
import { prefersReducedMotion } from "../utils/motion";
import NeuralNet from "../components/NeuralNet";

const INTRO_KEY = "medicode.login-intro";

/** 患者端独立 SPA（不同端口 = 不同源，sessionStorage 不共享，走 SSO 落地） */
const PATIENT_ORIGIN: string =
  (import.meta as any).env?.VITE_PATIENT_ORIGIN || "http://localhost:3005";

/* 秒针刻度：60 根，主刻度每 5 根 */
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
  const major = i % 5 === 0;
  return {
    i, major,
    x1: 50 + Math.cos(a) * (major ? 40 : 43), y1: 50 + Math.sin(a) * (major ? 40 : 43),
    x2: 50 + Math.cos(a) * 47, y2: 50 + Math.sin(a) * 47,
  };
});

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"staff" | "patient">("staff");
  const navigate = useNavigate();
  const { login } = useAuth();

  const theme = {
    staff: { primary: "#2563eb", bg: "#142d53", accent: "#427df1", text: "#adc1df" },
    patient: { primary: "#16887c", bg: "#194e50", accent: "#218e83", text: "#6b9692" },
  };
  const currentTheme = theme[mode];

  /* ── 实时时钟（秒针刻度逐格推进）与服务健康 ── */
  const [now, setNow] = useState(() => new Date());
  const [health, setHealth] = useState<{ ok: boolean; latency: number | null }>({ ok: false, latency: null });
  const clockStr = now.toTimeString().slice(0, 8);
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")} · ${WEEKDAYS[now.getDay()]}`;

  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) setNow(new Date()); }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const probeHealth = async () => {
    const start = performance.now();
    try {
      const res = await fetch("/api/health");
      setHealth({ ok: res.ok, latency: Math.round(performance.now() - start) });
    } catch {
      setHealth({ ok: false, latency: null });
    }
  };
  useEffect(() => {
    probeHealth();
    const timer = window.setInterval(probeHealth, 30000);
    return () => window.clearInterval(timer);
  }, []);

  /* ── 开场编排：品牌 → 标题 → 刻度逐根点亮 → 能力 → 铭牌 → 登录卡交付。
     本次会话只完整播一次（二次访问 2.4 倍速）；任意点击/按键 6 倍速快进；
     切后台直接走完。 ── */
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO_KEY) === "1"; } catch { /* 忽略 */ }
    try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* 忽略 */ }
    if (prefersReducedMotion() || document.hidden) {
      root.classList.add("is-ready");
      return;
    }
    const els = Array.from(root.querySelectorAll<HTMLElement>(".lf-in"));
    const ticks = Array.from(root.querySelectorAll<SVGLineElement>(".lf-tick"));
    root.classList.add("is-ready");
    const anims: Animation[] = [];
    els.forEach((el) => {
      const delay = Number(el.dataset.lfd || 0);
      anims.push(el.animate(
        [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }],
        { duration: 700, delay, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" }
      ));
    });
    ticks.forEach((tk, i) => {
      anims.push(tk.animate(
        [{ opacity: 0.1 }, { opacity: 1 }],
        { duration: 300, delay: 420 + i * 8, easing: "linear", fill: "backwards" }
      ));
    });
    if (seen) anims.forEach((a) => { a.playbackRate = 2.4; });
    const ff = () => anims.forEach((a) => { a.playbackRate = 6; });
    const onVis = () => { if (document.hidden) anims.forEach((a) => a.finish()); };
    window.addEventListener("pointerdown", ff, { once: true });
    window.addEventListener("keydown", ff, { once: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      anims.forEach((a) => a.cancel());
      window.removeEventListener("pointerdown", ff);
      window.removeEventListener("keydown", ff);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  /* ── 登录卡随指针轻倾（≤4°）+ 辉光跟随；只在可悬停设备启用 ── */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const onTilt = (e: React.PointerEvent) => {
    const card = cardRef.current;
    if (!card || prefersReducedMotion() || !window.matchMedia("(hover: hover)").matches) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const ry = Math.max(-1, Math.min(1, px * 2)) * 4;
    const rx = Math.max(-1, Math.min(1, py * 2)) * -3;
    card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    card.style.setProperty("--gx", `${(px * 100 + 50).toFixed(1)}%`);
    card.style.setProperty("--gy", `${(py * 100 + 50).toFixed(1)}%`);
  };
  const resetTilt = () => {
    const card = cardRef.current;
    if (card) card.style.transform = "";
  };

  /* ── 登录成功三拍：按钮收拢成圆 → 对勾圆环描出 → 画布迸发收束 → 进入系统 ── */
  const [succeeded, setSucceeded] = useState(false);
  const [burst, setBurst] = useState(0);
  const playSuccess = () => new Promise<void>((resolve) => {
    setSucceeded(true);
    setBurst((b) => b + 1);
    if (prefersReducedMotion()) { resolve(); return; }
    window.setTimeout(resolve, 950);
  });

  /* ── 患者登录直通患者端：员工端页面上验证（/patient-auth/login），
     成功后带 token 跳到患者端 /patient-console，患者端落地即建会话（#/sso=）── */
  const gotoPatientPortal = async (phone: string, password: string) => {
    const r = await api.post("/patient-auth/login", { phone: phone.trim(), password });
    const token: string = r.data?.access_token;
    if (!token) throw new Error(r.data?.detail || "登录失败");
    message.success(`欢迎来到健康空间！`);
    await playSuccess();
    window.location.href = `${PATIENT_ORIGIN}/patient-console#/sso=${encodeURIComponent(token)}`;
  };

  const onLogin = async (values: any) => {
    setLoading(true);
    try {
      if (mode === "patient") {
        await gotoPatientPortal(values.username, values.password);
        return;
      }
      const result = await loginApi(values);
      login(result.user, result.access_token);
      message.success(`欢迎回到工作空间，${result.user.real_name}！`);
      await playSuccess();
      navigate("/dashboard");
    } catch (err: any) {
      message.error(err.response?.data?.detail || err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCardLogin = async () => {
    const cardNo = window.prompt("请将员工卡靠近读卡器（读卡器自动输入工号）");
    if (!cardNo) return;
    setLoading(true);
    try {
      const result = await cardLoginApi(cardNo.trim());
      login(result.user, result.access_token);
      message.success(`欢迎，${result.user.real_name}`);
      await playSuccess();
      navigate("/dashboard");
    } catch (err: any) {
      message.error(err.response?.data?.detail || "刷卡登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    // 演示模式登录：患者模式直通患者端（admin/admin），员工模式进工作空间
    setLoading(true);
    try {
      if (mode === "patient") {
        await gotoPatientPortal("admin", "admin");
        return;
      }
      const result = await loginApi({ username: "admin", password: "admin" });
      login(result.user, result.access_token);
      message.success(`欢迎，${result.user.real_name}！`);
      await playSuccess();
      navigate("/dashboard");
    } catch (err: any) {
      message.error(err.response?.data?.detail || err.message || "演示登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className="loginfx"
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "53% 47%",
        fontFamily: "Segoe UI, Microsoft YaHei, sans-serif",
      }}
    >
      {/* 左侧故事区 */}
      <section
        style={{
          background: currentTheme.bg,
          color: "white",
          padding: "48px 62px 30px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 动效背景层：网格 / 光晕 / 神经网络 */}
        <div className="lf-grid" aria-hidden="true" />
        <div className="lf-glow" aria-hidden="true" />
        <NeuralNet burstKey={burst} />

        {/* 品牌 */}
        <div
          className="lf-layer lf-in"
          data-lfd="0"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 26,
            fontWeight: 650,
            letterSpacing: -0.8,
          }}
        >
          <div
            style={{
              display: "grid",
              placeItems: "center",
              background: currentTheme.accent,
              borderRadius: 11,
              width: 38,
              height: 40,
              fontSize: 31,
              fontWeight: 500,
            }}
          >
            +
          </div>
          <div>
            MediCode
            <small
              style={{
                display: "block",
                fontWeight: 400,
                fontSize: 10,
                letterSpacing: 2,
                color: mode === "staff" ? "#9eb7d8" : "#6f9994",
                marginTop: 4,
              }}
            >
              SMART MEDICAL SYSTEM
            </small>
          </div>
        </div>

        {/* 画布主区：文案居左 + 实时时钟刻度盘居右垂直居中 */}
        <div className="lf-layer lf-main" style={{ marginTop: 40 }}>
          <div className="lf-in" data-lfd="120" style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 3,
                color: mode === "staff" ? "#86a5d1" : "#6f9994",
                marginBottom: 20,
              }}
            >
              FOCUS ON CARE. CONNECT WITH CLARITY.
            </div>
            <h1
              style={{
                fontSize: 44,
                lineHeight: 1.5,
                letterSpacing: 1,
                fontWeight: 550,
                margin: "0 0 19px",
              }}
            >
              {mode === "staff" ? (
                <>
                  让信息有序，
                  <br />
                  让诊疗更专注。
                </>
              ) : (
                <>
                  每一步就医，
                  <br />
                  都更安心。
                </>
              )}
            </h1>
            <p
              style={{
                fontSize: 14,
                lineHeight: 2,
                color: currentTheme.text,
                maxWidth: 460,
                margin: 0,
              }}
            >
              {mode === "staff" ? (
                <>
                  连接患者、诊疗与医学知识。
                  <br />
                  以清晰的工作空间，陪伴每一次专业判断。
                </>
              ) : (
                <>
                  从预约到就诊，让重要信息触手可及。
                  <br />
                  简单清楚的指引，陪伴每一次健康之旅。
                </>
              )}
            </p>
          </div>

          {/* 实时时钟：秒针对应的刻度点亮，逐秒推进 */}
          <div className="lf-dial lf-in" data-lfd="340" aria-hidden="true">
            <svg viewBox="0 0 100 100">
              {TICKS.map((t) => (
                <line
                  key={t.i}
                  className={`lf-tick${t.major ? " is-major" : ""}${t.i <= now.getSeconds() ? " is-on" : ""}`}
                  x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                />
              ))}
            </svg>
            <div className="lf-dial-center">
              <span className="lf-time">{clockStr}</span>
              <span className="lf-date">{dateStr}</span>
            </div>
          </div>
        </div>

        {/* 底部铭牌带：服务状态 + 能力列表（对齐 scaffold canvas-plates 排布） */}
        <div className="lf-layer lf-plates">
          <div className="lf-in" data-lfd="440">
            <div className="lf-plate">
              <span className="lf-eyebrow">服务状态</span>
              <span className={`lf-health-dot${health.ok ? " is-ok" : ""}`} aria-hidden="true" />
              <b>{health.ok ? "运行正常" : health.latency === null ? "连接中断" : "状态异常"}</b>
              <span className="lf-lat">{health.latency === null ? "—" : `${health.latency} ms`}</span>
            </div>
          </div>
          <div className="lf-plate lf-caplist lf-in" data-lfd="520">
            <div className="lf-capitem">
              <span className="lf-capico"><FolderOpenOutlined /></span>
              <span>
                <span className="lf-captitle">诊疗信息集中</span>
                <span className="lf-capdesc">患者、诊疗与医学知识在同一个工作空间流转</span>
              </span>
            </div>
            <div className="lf-capitem">
              <span className="lf-capico"><SafetyOutlined /></span>
              <span>
                <span className="lf-captitle">AI 证据核查</span>
                <span className="lf-capdesc">候选诊断可溯源，防幻觉校验后由医生确认</span>
              </span>
            </div>
            <div className="lf-capitem">
              <span className="lf-capico"><MobileOutlined /></span>
              <span>
                <span className="lf-captitle">多端协同服务</span>
                <span className="lf-capdesc">员工端与患者端一体联动，信息随时触达</span>
              </span>
            </div>
          </div>
        </div>

        {/* 页脚 */}
        <div
          className="lf-layer"
          style={{
            fontSize: 10,
            color: mode === "staff" ? "#7995bc" : "#8aada7",
            marginTop: "auto",
            paddingTop: 32,
            letterSpacing: 0.4,
          }}
        >
          MEDICODE / 专注每一次诊疗 · 全域智慧医疗系统
        </div>
      </section>

      {/* 右侧表单区（指针轻倾 + 辉光跟随） */}
      <section
        style={{
          padding: "40px 62px 24px",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
        }}
        onPointerMove={onTilt}
        onPointerLeave={resetTilt}
      >
        {/* 顶部链接 */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 15,
            fontSize: 11,
            alignItems: "center",
          }}
        >
          <span
            style={{
              background: "#fff7e7",
              borderRadius: 5,
              color: "#9e7634",
              padding: "5px 9px",
              fontSize: 10,
            }}
          >
            UI 设计原型 · 不连接真实服务
          </span>
        </div>

        {/* 登录卡 */}
        <div style={{ width: "100%", maxWidth: 400, margin: "auto", padding: "48px 0 40px" }}>
          <div ref={cardRef} className="lf-card lf-in" data-lfd="260" style={{ padding: "30px 30px 26px" }}>
            <span className="lf-card-glow" aria-hidden="true" />
            {/* 模式切换 */}
            <div
              style={{
                display: "flex",
                padding: 4,
                background: "#f3f6fb",
                borderRadius: 10,
                marginBottom: 30,
              }}
            >
              <button
                type="button"
                onClick={() => setMode("staff")}
                style={{
                  width: "50%",
                  padding: 11,
                  border: 0,
                  background: mode === "staff" ? "#fff" : "none",
                  borderRadius: 7,
                  color: mode === "staff" ? currentTheme.primary : "#8390a5",
                  fontWeight: mode === "staff" ? 600 : 400,
                  fontSize: 12,
                  cursor: "pointer",
                  boxShadow: mode === "staff" ? "0 2px 7px rgba(36, 71, 117, 0.04)" : "none",
                }}
              >
                员工登录
              </button>
              <button
                type="button"
                onClick={() => setMode("patient")}
                style={{
                  width: "50%",
                  padding: 11,
                  border: 0,
                  background: mode === "patient" ? "#fff" : "none",
                  borderRadius: 7,
                  color: mode === "patient" ? currentTheme.primary : "#8390a5",
                  fontWeight: mode === "patient" ? 600 : 400,
                  fontSize: 12,
                  cursor: "pointer",
                  boxShadow: mode === "patient" ? "0 2px 7px rgba(36, 71, 117, 0.04)" : "none",
                }}
              >
                患者登录
              </button>
            </div>

            <h2
              style={{
                fontSize: 26,
                fontWeight: 650,
                margin: "0 0 10px",
                letterSpacing: -0.6,
              }}
            >
              {mode === "staff" ? "欢迎回到工作空间" : "欢迎来到健康空间"}
            </h2>
            <div
              style={{
                fontSize: 12,
                color: "#8a98ab",
                lineHeight: 1.9,
                marginBottom: 24,
              }}
            >
              {mode === "staff"
                ? "登录 MediCode，开启今天的诊疗工作。"
                : "预约、报到、就诊记录，一处轻松管理。"}
            </div>

            <Form onFinish={onLogin} layout="vertical">
              <div style={{ margin: "16px 0" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 10,
                  }}
                >
                  {mode === "staff" ? "员工账号" : "患者账号 / 手机号"}
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    border: "1px solid #e4ebf4",
                    borderRadius: 8,
                    padding: "0 13px",
                    height: 48,
                    color: "#9aabc1",
                    background: "#fcfdff",
                  }}
                >
                  <UserOutlined style={{ fontSize: 18 }} />
                  <Form.Item
                    name="username"
                    style={{ margin: 0, flex: 1 }}
                    rules={[{ required: true, message: "请输入账号" }]}
                  >
                    <Input
                      placeholder={
                        mode === "staff"
                          ? "请输入员工账号"
                          : "请输入患者账号或手机号"
                      }
                      style={{
                        border: "none",
                        background: "none",
                        fontSize: 12,
                        color: "#314b6b",
                        height: "100%",
                      }}
                    />
                  </Form.Item>
                </div>
              </div>

              <div style={{ margin: "16px 0" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 10,
                  }}
                >
                  登录密码
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    border: "1px solid #e4ebf4",
                    borderRadius: 8,
                    padding: "0 13px",
                    height: 48,
                    color: "#9aabc1",
                    background: "#fcfdff",
                  }}
                >
                  <LockOutlined style={{ fontSize: 18 }} />
                  <Form.Item
                    name="password"
                    style={{ margin: 0, flex: 1 }}
                    rules={[{ required: true, message: "请输入密码" }]}
                  >
                    <Input.Password
                      placeholder="请输入密码"
                      style={{
                        border: "none",
                        background: "none",
                        fontSize: 12,
                        color: "#314b6b",
                        height: "100%",
                      }}
                    />
                  </Form.Item>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 11,
                  color: "#8292a9",
                  margin: "16px 0 22px",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Checkbox>保持登录状态</Checkbox>
                </label>
                <button
                  type="button"
                  onClick={() => message.info("正式系统中请联系管理员核验身份后重置密码")}
                  style={{
                    padding: 0,
                    background: "none",
                    border: 0,
                    color: currentTheme.primary,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  忘记密码？
                </button>
              </div>

              {/* 登录成功三拍：按钮 → 成功圆环 */}
              <div className="lf-success-slot">
                {succeeded ? (
                  <div className="lf-success-orb" role="status" aria-label="登录成功，正在进入">
                    <svg width="30" height="30" viewBox="0 0 46 46" aria-hidden="true">
                      <circle cx="23" cy="23" r="20" />
                      <path d="m15 23.5 5.5 5.5L31.5 18" />
                    </svg>
                  </div>
                ) : (
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    style={{
                      height: 47,
                      borderRadius: 8,
                      background: currentTheme.primary,
                      border: "none",
                      fontSize: 13,
                      fontWeight: 500,
                      boxShadow: "0 6px 15px rgba(37, 99, 235, 0.1)",
                    }}
                    block
                  >
                    {mode === "staff" ? "登录工作空间 →" : "进入我的健康空间 →"}
                  </Button>
                )}
              </div>
            </Form>

            {/* 分隔线 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "#a6b2c2",
                fontSize: 10,
                margin: "20px 0",
              }}
            >
              <span style={{ height: 1, background: "#edf1f6", flex: 1 }}></span>
              快速预览，无需真实账号
              <span style={{ height: 1, background: "#edf1f6", flex: 1 }}></span>
            </div>

            <Button
              onClick={handleDemoLogin}
              style={{
                width: "100%",
                height: 43,
                background: "white",
                border: "1px solid #e4ebf4",
                borderRadius: 8,
                fontSize: 12,
                color: "#5e779a",
                cursor: "pointer",
              }}
            >
              使用演示身份进入
            </Button>

            {mode === "staff" && (
              <Button
                onClick={handleCardLogin}
                loading={loading}
                style={{
                  width: "100%",
                  height: 43,
                  marginTop: 12,
                  background: "white",
                  border: "1px solid #e4ebf4",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#5e779a",
                  cursor: "pointer",
                }}
              >
                员工刷卡登录（NFC）
              </Button>
            )}

            <p
              style={{
                fontSize: 10,
                color: "#a2aebf",
                lineHeight: 1.9,
                textAlign: "center",
                margin: "16px 0 0",
              }}
            >
              本页用于设计评审，输入内容不上传、不存储。
            </p>
          </div>
        </div>

        <footer
          style={{
            fontSize: 10,
            color: "#a2aec0",
            lineHeight: 1.9,
            textAlign: "center",
          }}
        >
          MediCode 全域智慧医疗系统
          <br />
          登录入口与权限域分离 · 医疗数据访问需遵循实际授权
        </footer>
      </section>
    </div>
  );
}
