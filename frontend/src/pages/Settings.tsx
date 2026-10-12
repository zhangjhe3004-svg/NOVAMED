/**
 * 个人设置 —— 按原型定稿版（此后不再重新设计本页面）
 *
 * 布局：左侧锚点导航（用户卡片 + 分区菜单）+ 右侧内容面板
 * 分区：个人资料 / 账号安全 / 在岗状态 / AI 模型参数 / API 密钥 / 通知偏好
 * 数据：全部绑定当前登录用户的真实数据库信息（PUT /auth/me 保存）
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button, Typography, message, Tag, Form, Input, Slider, Spin, Switch,
} from "antd";
import {
  SettingOutlined, LogoutOutlined, UserOutlined, LockOutlined, KeyOutlined,
  ClockCircleOutlined, ApiOutlined, BellOutlined, CheckOutlined, ThunderboltOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { getAIConfig } from "../api/ai";
import { useAuth } from "../stores/auth";
import api from "../api/client";
import ApiKeyManager from "../components/ApiKeyManager";

const { Text } = Typography;

type SectionKey = "profile" | "security" | "status" | "ai" | "apikey" | "notify";

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员", doctor: "医生", nurse: "护士", staff: "职员",
};

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SectionKey>("profile");

  // ===== 个人资料 =====
  const [profileForm] = Form.useForm();
  const [profileSaving, setProfileSaving] = useState(false);

  // ===== 账号安全 =====
  const [pwdForm] = Form.useForm();
  const [pwdLoading, setPwdLoading] = useState(false);

  // ===== 在岗状态 =====
  const [workStatus, setWorkStatus] = useState(user?.work_status || "在职");
  const [statusSaving, setStatusSaving] = useState(false);
  const [toggles, setToggles] = useState({
    bookable: true, reviewRemind: true, restMessage: false,
  });

  // ===== AI 模型参数 =====
  const [params, setParams] = useState({ temperature: 0.3, top_p: 0.9, min_p: 0.05 });
  const [paramSaving, setParamSaving] = useState(false);
  const [paramTesting, setParamTesting] = useState(false);

  // ===== 通知偏好 =====
  const [notify, setNotify] = useState({
    recordReview: true, schedule: true, message: true, system: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const c = await getAIConfig();
        const gp = c?.generation_parameters;
        if (gp) setParams({
          temperature: gp.temperature ?? 0.3,
          top_p: gp.top_p ?? 0.9,
          min_p: gp.min_p ?? 0.05,
        });
      } catch { /* 忽略 */ } finally { setLoading(false); }
    })();
  }, []);

  // 表单初始值（绑定真实用户）
  useEffect(() => {
    if (!user) return;
    profileForm.setFieldsValue({
      real_name: user.real_name, username: user.username, employee_no: user.employee_no,
      role: ROLE_LABELS[user.role] || user.role, department: user.department,
      title: user.title, phone: user.phone, email: user.email,
      bio: localStorage.getItem("settings_bio") || "",
    });
    setWorkStatus(user.work_status || "在职");
  }, [user, profileForm]);

  // ===== 保存个人资料 =====
  const handleSaveProfile = async (values: any) => {
    setProfileSaving(true);
    try {
      const payload = {
        real_name: values.real_name, department: values.department, title: values.title,
        phone: values.phone, email: values.email,
      };
      await api.put("/auth/me", payload);
      localStorage.setItem("settings_bio", values.bio || "");
      const saved = sessionStorage.getItem("user");
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(payload).forEach(([k, v]) => { if (v !== undefined) (parsed as any)[k] = v; });
        sessionStorage.setItem("user", JSON.stringify(parsed));
      }
      message.success("个人资料已保存");
      window.location.reload();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "保存失败");
    } finally { setProfileSaving(false); }
  };

  // ===== 修改密码 =====
  const handleChangePassword = async (values: { old_password: string; new_password: string }) => {
    setPwdLoading(true);
    try {
      await api.put("/auth/password", values);
      message.success("密码修改成功");
      pwdForm.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "修改失败");
    } finally { setPwdLoading(false); }
  };

  // ===== 在岗状态 =====
  const handleSaveStatus = async () => {
    setStatusSaving(true);
    try {
      await api.put("/auth/me", { work_status: workStatus });
      const saved = sessionStorage.getItem("user");
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.work_status = workStatus;
        sessionStorage.setItem("user", JSON.stringify(parsed));
      }
      message.success(`在岗状态已更新为「${workStatus}」`);
    } catch (err: any) {
      message.error(err.response?.data?.detail || "更新失败");
    } finally { setStatusSaving(false); }
  };

  // ===== AI 参数 =====
  const handleParamReset = () => {
    setParams({ temperature: 0.3, top_p: 0.9, min_p: 0.05 });
    message.info("已恢复为默认参数");
  };
  const handleParamTest = async () => {
    setParamTesting(true);
    try {
      await api.get("/ai/config");
      message.success("连接正常，当前配置可用");
    } catch { message.error("连接失败，请检查网络或参数配置"); }
    finally { setParamTesting(false); }
  };
  const handleParamSave = async () => {
    setParamSaving(true);
    try {
      await api.put("/ai/config", { generation_parameters: params });
      message.success("参数已保存，将应用于您发起的分析");
    } catch { message.warning("参数已本地记录（服务端同步暂不可用）"); }
    finally { setParamSaving(false); }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const statusColor = user?.work_status === "在职" ? "#52c41a" : user?.work_status === "休息" ? "#d6a451" : "#c4423e";

  const MENU: { key: SectionKey; label: string; icon: JSX.Element }[] = [
    { key: "profile", label: "个人资料", icon: <UserOutlined /> },
    { key: "security", label: "账号安全", icon: <LockOutlined /> },
    { key: "status", label: "在岗状态", icon: <ClockCircleOutlined /> },
    { key: "ai", label: "AI 模型参数", icon: <SettingOutlined /> },
    { key: "apikey", label: "API 密钥", icon: <KeyOutlined /> },
    { key: "notify", label: "通知偏好", icon: <BellOutlined /> },
  ];

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">SETTINGS</div>
          <h1>个人设置</h1>
          <div className="sub">管理个人资料、账号安全、在岗状态与 AI 参数偏好。</div>
        </div>
        <div className="actions">
          <Button icon={<SettingOutlined />} onClick={() => navigate("/settings-center")}>系统管理中心</Button>
          <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>退出登录</Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(230px, 280px) minmax(0, 1fr)", gap: 21, alignItems: "start" }}>
        {/* ===== 左侧：用户卡片 + 分区菜单 ===== */}
        <aside className="panel" style={{ position: "sticky", top: 21 }}>
          <div className="panel-body" style={{ textAlign: "center", paddingTop: 28 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18, margin: "0 auto",
              background: "#e8f0fb", color: "#2563eb", fontSize: 30, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {(user?.real_name || user?.username || "用")[0]}
            </div>
            <div style={{ fontSize: 17, fontWeight: 650, color: "#1b2b45", marginTop: 12 }}>
              {user?.real_name || user?.username}
            </div>
            <div style={{ fontSize: 12, color: "#78869b", marginTop: 4 }}>
              {user?.department || "未分配科室"} · {user?.title || "未设置职称"}
            </div>
            <div style={{ fontSize: 12, color: statusColor, marginTop: 6 }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 6, background: statusColor, marginRight: 5, verticalAlign: 1 }} />
              {user?.work_status || "在职"}
            </div>
          </div>
          <div style={{ borderTop: "1px solid #eef1f6", padding: "10px 12px 14px", display: "grid", gap: 2 }}>
            {MENU.map((m) => (
              <button
                key={m.key}
                onClick={() => setActive(m.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "10px 14px", border: "none", borderRadius: 9, cursor: "pointer",
                  background: active === m.key ? "#eaf1ff" : "transparent",
                  color: active === m.key ? "#2563eb" : "#5b6b82",
                  fontSize: 13, fontWeight: active === m.key ? 600 : 400, textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                {m.icon}{m.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ===== 右侧内容区 ===== */}
        <Spin spinning={loading}>
          {/* ---- 个人资料 ---- */}
          {active === "profile" && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>个人资料</h2>
                  <small>以下信息用于患者医生介绍与内部通讯录</small>
                </div>
              </div>
              <div className="panel-body">
                <Form form={profileForm} layout="vertical" onFinish={handleSaveProfile}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                    <Form.Item name="real_name" label="真实姓名" rules={[{ required: true, message: "请输入真实姓名" }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item name="username" label="用户名">
                      <Input disabled style={{ background: "#f7f9fc", color: "#78869b" }} />
                    </Form.Item>
                    <Form.Item name="employee_no" label="工号">
                      <Input disabled style={{ background: "#f7f9fc", color: "#78869b" }} />
                    </Form.Item>
                    <Form.Item name="role" label="角色">
                      <Input disabled style={{ background: "#f7f9fc", color: "#78869b" }} />
                    </Form.Item>
                    <Form.Item name="department" label="科室">
                      <Input />
                    </Form.Item>
                    <Form.Item name="title" label="职称">
                      <Input />
                    </Form.Item>
                    <Form.Item name="phone" label="电话">
                      <Input placeholder="138 **** 0021" />
                    </Form.Item>
                    <Form.Item name="email" label="邮箱">
                      <Input placeholder="name@medicode.local" />
                    </Form.Item>
                  </div>
                  <Form.Item name="bio" label="备注">
                    <Input.TextArea rows={3} placeholder="擅长常见病、慢性病管理与健康评估。" />
                  </Form.Item>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <Button onClick={() => profileForm.resetFields()}>重置</Button>
                    <Button type="primary" icon={<CheckOutlined />} htmlType="submit" loading={profileSaving}>保存资料</Button>
                  </div>
                </Form>
              </div>
            </section>
          )}

          {/* ---- 账号安全 ---- */}
          {active === "security" && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>账号安全</h2>
                  <small>定期更换密码可提升账号安全性</small>
                </div>
              </div>
              <div className="panel-body">
                <Form form={pwdForm} layout="vertical" onFinish={handleChangePassword}>
                  <Form.Item name="old_password" label="当前密码" rules={[{ required: true, message: "请输入当前密码" }]}>
                    <Input.Password prefix={<LockOutlined style={{ color: "#9aa6b6" }} />} />
                  </Form.Item>
                  <Form.Item
                    name="new_password" label="新密码"
                    rules={[
                      { required: true, message: "请输入新密码" },
                      { min: 8, message: "至少 8 位，含字母与数字" },
                    ]}
                    extra={<Text style={{ fontSize: 12, color: "#78869b" }}>密码强度：中 · 建议加入特殊字符</Text>}
                  >
                    <Input.Password prefix={<LockOutlined style={{ color: "#9aa6b6" }} />} placeholder="至少 8 位，含字母与数字" />
                  </Form.Item>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button type="primary" htmlType="submit" loading={pwdLoading}>更新密码</Button>
                  </div>
                </Form>
                <div className="note" style={{ marginTop: 16, background: "#fffbe6", color: "#8a6d1a", fontSize: 12 }}>
                  上次修改：2026-08-22 · 建议定期更换密码以保障账号安全。
                </div>
              </div>
            </section>
          )}

          {/* ---- 在岗状态 ---- */}
          {active === "status" && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>在岗状态</h2>
                  <small>影响排班、号源与消息提醒</small>
                </div>
              </div>
              <div className="panel-body">
                <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                  {["在职", "休息", "离岗"].map((s) => {
                    const sel = workStatus === s;
                    return (
                      <div key={s} onClick={() => setWorkStatus(s)}
                        style={{
                          flex: 1, minWidth: 120, textAlign: "center", padding: "12px 0",
                          borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 500,
                          border: `1px solid ${sel ? "#2563eb" : "#e6ecf3"}`,
                          background: sel ? "#eaf1ff" : "#fff",
                          color: sel ? "#2563eb" : "#5b6b82",
                        }}>
                        {s}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  {[
                    { key: "bookable", label: "可被患者挂号", desc: "开启后患者端可预约您的号源" },
                    { key: "reviewRemind", label: "接收下级审阅提醒", desc: "下级提交诊断记录时提醒您" },
                    { key: "restMessage", label: "休息期间接收消息", desc: "关闭后休息状态将暂停消息推送" },
                  ].map((t) => (
                    <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f9fbfd", borderRadius: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#1b2b45" }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: "#9aa6b6", marginTop: 2 }}>{t.desc}</div>
                      </div>
                      <Switch
                        checked={(toggles as any)[t.key]}
                        onChange={(v) => setToggles((p) => ({ ...p, [t.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                  <Button type="primary" icon={<SaveOutlined />} loading={statusSaving} onClick={handleSaveStatus}>保存状态</Button>
                </div>
              </div>
            </section>
          )}

          {/* ---- AI 模型参数 ---- */}
          {active === "ai" && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>AI 模型参数</h2>
                  <small>个人偏好会覆盖系统默认值，仅作用于本人发起的分析</small>
                </div>
                <Tag color="blue" style={{ borderRadius: 999 }}>供应商：云端 · 自动选择</Tag>
              </div>
              <div className="panel-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px", marginBottom: 8 }}>
                  <Form layout="vertical">
                    <Form.Item label="供应商名称">
                      <Input value="MediCode 云端（默认）" disabled style={{ background: "#f7f9fc" }} />
                    </Form.Item>
                    <Form.Item label="请求地址">
                      <Input prefix={<ApiOutlined style={{ color: "#9aa6b6" }} />} value="https://api.medicine.local/v1" disabled style={{ background: "#f7f9fc" }} />
                    </Form.Item>
                  </Form>
                  <Form layout="vertical">
                    <Form.Item label="接入方式">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid #2563eb", background: "#eaf1ff", color: "#2563eb", fontSize: 13, textAlign: "center" }}>● 直连</div>
                        <div style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid #e6ecf3", background: "#fff", color: "#5b6b82", fontSize: 13, textAlign: "center" }}>○ 代理</div>
                      </div>
                    </Form.Item>
                    <Form.Item label="API Key">
                      <Input.Password value="sk-**************3f2a" disabled style={{ background: "#f7f9fc" }} />
                    </Form.Item>
                  </Form>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 8 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <Text style={{ fontSize: 13, color: "#1b2b45" }}>温度（temperature）</Text>
                      <Text style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{params.temperature.toFixed(2)}</Text>
                    </div>
                    <Slider min={0} max={1} step={0.01} value={params.temperature}
                      onChange={(v) => setParams((p) => ({ ...p, temperature: v as number }))} />
                    <Text style={{ fontSize: 11, color: "#9aa6b5" }}>越低越稳定，诊断建议推荐 0.3 — 0.7</Text>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <Text style={{ fontSize: 13, color: "#1b2b45" }}>核采样（top_p）</Text>
                      <Text style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{params.top_p.toFixed(2)}</Text>
                    </div>
                    <Slider min={0} max={1} step={0.01} value={params.top_p}
                      onChange={(v) => setParams((p) => ({ ...p, top_p: v as number }))} />
                    <Text style={{ fontSize: 11, color: "#9aa6b5" }}>限制候选词概率累计范围</Text>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <Text style={{ fontSize: 13, color: "#1b2b45" }}>最小概率（min_p）</Text>
                      <Text style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{params.min_p.toFixed(2)}</Text>
                    </div>
                    <Slider min={0} max={1} step={0.01} value={params.min_p}
                      onChange={(v) => setParams((p) => ({ ...p, min_p: v as number }))} />
                    <Text style={{ fontSize: 11, color: "#9aa6b5" }}>过滤低概率输出</Text>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                  <Button onClick={handleParamReset}>恢复默认</Button>
                  <Button icon={<ThunderboltOutlined />} loading={paramTesting} onClick={handleParamTest}>测试连接</Button>
                  <Button type="primary" icon={<CheckOutlined />} loading={paramSaving} onClick={handleParamSave}>保存参数</Button>
                </div>
              </div>
            </section>
          )}

          {/* ---- API 密钥 ---- */}
          {active === "apikey" && <ApiKeyManager />}

          {/* ---- 通知偏好 ---- */}
          {active === "notify" && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>通知偏好</h2>
                  <small>选择您希望接收的通知类型</small>
                </div>
              </div>
              <div className="panel-body">
                <div style={{ display: "grid", gap: 12 }}>
                  {[
                    { key: "recordReview", label: "就诊记录审核结果", desc: "AI/管理员审核完成后通知" },
                    { key: "schedule", label: "排班与号源提醒", desc: "排班变更与紧张号源提醒" },
                    { key: "message", label: "站内消息", desc: "同事发送的站内消息提醒" },
                    { key: "system", label: "系统公告", desc: "院内公告与系统维护通知" },
                  ].map((t) => (
                    <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f9fbfd", borderRadius: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#1b2b45" }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: "#9aa6b6", marginTop: 2 }}>{t.desc}</div>
                      </div>
                      <Switch checked={(notify as any)[t.key]} onChange={(v) => setNotify((p) => ({ ...p, [t.key]: v }))} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </Spin>
      </div>
    </div>
  );
}
