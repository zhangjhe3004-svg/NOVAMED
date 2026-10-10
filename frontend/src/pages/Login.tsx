/**
 * 登录页 —— 基于 UI 设计稿的双栏布局
 * 支持员工/患者模式切换，不同的主题色
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, message, Checkbox } from "antd";
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
} from "@ant-design/icons";
import { login as loginApi, cardLogin as cardLoginApi } from "../api/auth";
import { useAuth } from "../stores/auth";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"staff" | "patient">("staff");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const theme = {
    staff: {
      primary: "#2563eb",
      bg: "#142d53",
      accent: "#427df1",
      text: "#adc1df",
    },
    patient: {
      primary: "#16887c",
      bg: "#194e50",
      accent: "#218e83",
      text: "#6b9692",
    },
  };

  const currentTheme = theme[mode];

  const onLogin = async (values: any) => {
    setLoading(true);
    try {
      const result = await loginApi(values);
      login(result.user, result.access_token);
      message.success(`欢迎${mode === "staff" ? "回到工作空间" : "来到健康空间"}，${result.user.real_name}！`);
      navigate("/dashboard");
    } catch (err: any) {
      message.error(err.response?.data?.detail || "登录失败");
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
      navigate("/dashboard");
    } catch (err: any) {
      message.error(err.response?.data?.detail || "刷卡登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    // 演示模式登录
    const demoUser = {
      id: 1,
      username: "admin",
      real_name: mode === "staff" ? "陈医生" : "林女士",
      role: mode === "staff" ? "admin" : "patient",
      phone: "13800138000",
      email: "demo@medicode.com",
      department: mode === "staff" ? "全科医学科" : "",
      title: mode === "staff" ? "主治医师" : "",
      work_status: "在职",
    };
    login(demoUser, "demo-token");
    message.success("演示模式登录成功");
    navigate("/dashboard");
  };

  return (
    <div
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
        {/* 品牌 */}
        <div
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

        {/* 故事内容 */}
        <div style={{ marginTop: 64, position: "relative", zIndex: 1 }}>
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

        {/* 特性列表 */}
        <div
          style={{
            display: "flex",
            gap: 22,
            fontSize: 11,
            color: mode === "staff" ? "#b6c9e1" : "#6b9692",
            marginTop: 15,
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "#89d6cc", marginRight: 7 }}>✓</span>
          诊疗信息集中
          <span style={{ color: "#89d6cc", marginRight: 7 }}>✓</span>
          AI 证据核查
          <span style={{ color: "#89d6cc", marginRight: 7 }}>✓</span>
          多端协同服务
        </div>

        {/* 页脚 */}
        <div
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

      {/* 右侧表单区 */}
      <section
        style={{
          padding: "40px 62px 24px",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
        }}
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

        {/* 表单容器 */}
        <div
          style={{
            width: "100%",
            maxWidth: 374,
            margin: "auto",
            padding: "65px 0 55px",
          }}
        >
          {/* 模式切换 */}
          <div
            style={{
              display: "flex",
              padding: 4,
              background: "#f3f6fb",
              borderRadius: 10,
              marginBottom: 37,
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
              fontSize: 28,
              fontWeight: 650,
              margin: "0 0 12px",
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
              marginBottom: 29,
            }}
          >
            {mode === "staff"
              ? "登录 MediCode，开启今天的诊疗工作。"
              : "预约、报到、就诊记录，一处轻松管理。"}
          </div>

          <Form onFinish={onLogin} layout="vertical">
            <div style={{ margin: "19px 0" }}>
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

            <div style={{ margin: "19px 0" }}>
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
                    visibilityToggle={{
                      visible: showPassword,
                      onVisibleChange: setShowPassword,
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
                margin: "19px 0 26px",
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
          </Form>

          {/* 分隔线 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "#a6b2c2",
              fontSize: 10,
              margin: "23px 0",
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
              margin: "19px 0 0",
            }}
          >
            本页用于设计评审，输入内容不上传、不存储。
            <br />
            "保持登录状态"仅展示选项，不启用持久化。
          </p>
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
