import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Input, Button, Typography, message } from "antd";
import api from "../../src/api/client";

const { Title, Text } = Typography;

export default function PatientRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await api.post("/patient-register", values);
      if (res.data?.id || res.data?.status) {
        message.success("注册成功，请登录");
        navigate("/login");
      } else {
        message.error(res.data?.detail || "注册失败");
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f4f8f8" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, cursor: "pointer" }} onClick={() => navigate("/")}>
        <div style={{ width: 40, height: 42, background: "#27857d", borderRadius: 11, display: "grid", placeItems: "center", color: "#fff", fontSize: 31, fontWeight: 500 }}>+</div>
        <div style={{ fontSize: 25, fontWeight: 650, color: "#243e59", lineHeight: 1 }}>
          MediCode 健康
          <div style={{ fontSize: 10, color: "#8da8a7", fontWeight: 400, letterSpacing: 2, marginTop: 4 }}>患者服务平台</div>
        </div>
      </div>

      <Card style={{ width: 440, borderRadius: 16, border: "1px solid #e5eeef" }}>
        <Title level={3} style={{ textAlign: "center", color: "#243e59" }}>患者注册</Title>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }]}>
            <Input placeholder="请输入手机号" size="large" />
          </Form.Item>
          <Form.Item name="surname" label="姓">
            <Input placeholder="姓" />
          </Form.Item>
          <Form.Item name="given_name" label="名">
            <Input placeholder="名" />
          </Form.Item>
          <Form.Item name="id_number" label="身份证号">
            <Input placeholder="身份证号（可选）" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: "请设置密码" }]}>
            <Input.Password placeholder="请设置密码" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} size="large">
            注册
          </Button>
        </Form>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Text type="secondary">已有账号？</Text>{" "}
          <a onClick={() => navigate("/login")}>去登录</a>
        </div>
        <div style={{ marginTop: 8, textAlign: "center" }}>
          <Button type="link" onClick={() => navigate("/")}>返回首页</Button>
        </div>
      </Card>

      <div style={{ marginTop: 22, fontSize: 11, color: "#8da8a7" }}>MediCode 健康 · 专注每一次诊疗</div>
    </div>
  );
}
