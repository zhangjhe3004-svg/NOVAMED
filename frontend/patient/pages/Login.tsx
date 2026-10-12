import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Input, Button, Typography, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import api from "../../src/api/client";

const { Title, Text } = Typography;

export default function PatientLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { phone: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.post("/patient-auth/login", values);
      const token = res.data?.access_token;
      if (!token) {
        message.error(res.data?.detail || "登录失败");
        return;
      }
      sessionStorage.setItem("token", token);
      sessionStorage.setItem("patient_token", token);
      message.success("登录成功");
      navigate("/patient-console");
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f4f8f8" }}>
      {/* 品牌（对齐 patient.html 头部） */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, cursor: "pointer" }} onClick={() => navigate("/")}>
        <div style={{ width: 40, height: 42, background: "#27857d", borderRadius: 11, display: "grid", placeItems: "center", color: "#fff", fontSize: 31, fontWeight: 500 }}>+</div>
        <div style={{ fontSize: 25, fontWeight: 650, color: "#243e59", lineHeight: 1 }}>
          MediCode 健康
          <div style={{ fontSize: 10, color: "#8da8a7", fontWeight: 400, letterSpacing: 2, marginTop: 4 }}>患者服务平台</div>
        </div>
      </div>

      <Card style={{ width: 400, borderRadius: 16, border: "1px solid #e5eeef" }}>
        <Title level={3} style={{ textAlign: "center", marginBottom: 8, color: "#243e59" }}>患者登录</Title>
        <Text type="secondary" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
          演示账号：admin / admin
        </Text>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }]}>
            <Input prefix={<UserOutlined />} placeholder="请输入手机号" size="large" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} size="large">
            登录
          </Button>
        </Form>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Text type="secondary">还没有账号？</Text>{" "}
          <a onClick={() => navigate("/register")}>立即注册</a>
        </div>
        <div style={{ marginTop: 8, textAlign: "center" }}>
          <Button type="link" onClick={() => navigate("/")}>返回首页</Button>
        </div>
      </Card>

      <div style={{ marginTop: 22, fontSize: 11, color: "#8da8a7" }}>MediCode 健康 · 专注每一次诊疗</div>
    </div>
  );
}
