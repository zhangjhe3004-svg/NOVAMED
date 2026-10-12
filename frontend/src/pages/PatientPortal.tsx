/**
 * 患者自助服务端（公开门户）—— 对齐 docs/设计预览/patient.html 的青绿色「MediCode 健康」设计
 * 独立于员工系统，公开访问，引导登录 / 注册后进入患者工作台。
 */
import { useNavigate } from "react-router-dom";
import { Typography, Button, Row, Col, Space } from "antd";
import {
  MedicineBoxOutlined, CommentOutlined, FileSearchOutlined, RobotOutlined,
  CalendarOutlined, FileTextOutlined, VideoCameraOutlined, FormOutlined,
  TeamOutlined, ExperimentOutlined, ClusterOutlined, RightOutlined,
  LockOutlined, UserOutlined, SafetyCertificateOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

const services = [
  { icon: <FormOutlined />, name: "科室挂号", desc: "选择科室与时段", color: "#27857d" },
  { icon: <MedicineBoxOutlined />, name: "在线问诊", desc: "图文咨询医生", color: "#4c86c8" },
  { icon: <FileSearchOutlined />, name: "报告查询", desc: "查看检验报告", color: "#c3a267" },
  { icon: <RobotOutlined />, name: "智能导诊", desc: "症状智能分诊", color: "#7b7bd0" },
  { icon: <CalendarOutlined />, name: "体检预约", desc: "套餐在线预约", color: "#4fae9c" },
  { icon: <ClusterOutlined />, name: "我的订单", desc: "订单与缴费", color: "#d09a4d" },
  { icon: <VideoCameraOutlined />, name: "影像查询", desc: "影像报告浏览", color: "#4c86c8" },
  { icon: <CommentOutlined />, name: "报告咨询", desc: "专家解读报告", color: "#4fae9c" },
];

const features = [
  { icon: <SafetyCertificateOutlined />, title: "数据隔离", desc: "每位患者数据相互隔离，仅本人可见" },
  { icon: <CalendarOutlined />, title: "号源实时", desc: "号源实时扣减，先到先得" },
  { icon: <FileTextOutlined />, title: "记录归档", desc: "就诊记录自动归档，随时可查" },
];

export default function PatientPortal() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#f4f8f8" }}>
      {/* 顶部导航（对齐 patient.html 的白色 header） */}
      <div style={{ height: 86, background: "#fff", borderBottom: "1px solid #e5eeef", display: "flex", alignItems: "center", padding: "0 max(30px, calc((100vw - 1140px)/2))", gap: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 33, height: 35, background: "#27857d", borderRadius: 10, display: "grid", placeItems: "center", color: "#fff", fontSize: 27 }}>+</div>
          <div style={{ fontSize: 23, fontWeight: 650, color: "#243e59", lineHeight: 1 }}>
            MediCode 健康
            <div style={{ fontSize: 10, color: "#8da8a7", fontWeight: 400, letterSpacing: 1, marginTop: 3 }}>患者服务平台</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 26, marginLeft: 34, height: "100%", alignItems: "center", flex: 1 }}>
          {["首页", "预约挂号", "就诊记录", "个人中心"].map((n, i) => (
            <button key={n} onClick={() => i === 0 ? navigate("/") : navigate("/login")} style={{ height: "100%", border: 0, background: "none", cursor: "pointer", fontSize: 13, color: i === 0 ? "#27857d" : "#819695", fontWeight: i === 0 ? 600 : 400, position: "relative" }}>
              {n}
              {i === 0 && <span style={{ position: "absolute", height: 3, background: "#27857d", left: 0, right: 0, bottom: 0, borderRadius: 4 }} />}
            </button>
          ))}
        </div>
        <Space>
          <Button type="text" icon={<UserOutlined />} onClick={() => navigate("/login")} style={{ color: "#4f6f6d" }}>登录</Button>
          <Button type="primary" icon={<LockOutlined />} onClick={() => navigate("/register")} style={{ background: "#27857d", borderColor: "#27857d" }}>注册</Button>
        </Space>
      </div>

      {/* 主体 */}
      <div style={{ maxWidth: 1140, margin: "38px auto 0", padding: "0 20px" }}>
        {/* 欢迎区 */}
        <div style={{ display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 23, marginBottom: 25 }}>
          <div style={{ background: "#deefeb", borderRadius: 18, padding: "30px 35px", minHeight: 210, position: "relative", overflow: "hidden" }}>
            <Title level={2} style={{ color: "#28645c", margin: "0 0 10px", fontWeight: 550, position: "relative", zIndex: 1 }}>
              让就医更简单，<br />让关怀触手可及。
            </Title>
            <Text style={{ color: "#6e9991", fontSize: 12, position: "relative", zIndex: 1 }}>
              从预约、报到到就诊记录，重要信息一处轻松管理。
            </Text>
            <Space style={{ marginTop: 22, position: "relative", zIndex: 1 }}>
              <Button type="primary" size="large" icon={<RightOutlined />} onClick={() => navigate("/login")} style={{ background: "#27857d", borderColor: "#27857d" }}>立即登录体验</Button>
              <Button size="large" onClick={() => navigate("/register")}>免费注册</Button>
            </Space>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e5eeef", borderRadius: 18, padding: "27px 25px" }}>
            <Title level={5} style={{ margin: "0 0 13px" }}>就诊前准备与提醒</Title>
            <Text style={{ color: "#8a9fa9", fontSize: 12, lineHeight: 2, display: "block" }}>
              01 · 携带有效证件<br />
              02 · 带上相关检查与用药清单<br />
              03 · 就诊前确认时间、地点与号位
            </Text>
          </div>
        </div>

        {/* 核心能力 */}
        <Row gutter={[15, 15]} style={{ marginBottom: 28 }}>
          {features.map((f) => (
            <Col span={8} key={f.title}>
              <div style={{ background: "#fff", border: "1px solid #e5eeef", borderRadius: 13, padding: "22px 20px" }}>
                <div style={{ fontSize: 26, color: "#27857d", marginBottom: 10 }}>{f.icon}</div>
                <Text strong style={{ fontSize: 14 }}>{f.title}</Text>
                <Text type="secondary" style={{ display: "block", fontSize: 12, marginTop: 6 }}>{f.desc}</Text>
              </div>
            </Col>
          ))}
        </Row>

        {/* 服务快捷入口 */}
        <Title level={4} style={{ margin: "0 0 16px", color: "#243e59" }}>常用服务</Title>
        <Row gutter={[15, 15]} style={{ marginBottom: 28 }}>
          {services.map((s) => (
            <Col span={6} key={s.name}>
              <button onClick={() => navigate("/login")} style={{ display: "flex", alignItems: "center", gap: 14, padding: "23px 20px", background: "#fff", border: "1px solid #e5eeef", borderRadius: 13, width: "100%", textAlign: "left", cursor: "pointer" }}>
                <span style={{ width: 42, height: 44, display: "grid", placeItems: "center", borderRadius: 12, background: "#edf7f4", color: s.color, fontSize: 20 }}>{s.icon}</span>
                <span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 550, color: "#243e59" }}>{s.name}</span>
                  <span style={{ display: "block", fontSize: 10, color: "#97a7b3", marginTop: 5 }}>{s.desc}</span>
                </span>
              </button>
            </Col>
          ))}
        </Row>

        {/* 底部说明 */}
        <div style={{ textAlign: "center", padding: "16px 0 48px", color: "#8da8a7", fontSize: 12 }}>
          MediCode 健康 · 专注每一次诊疗 · 演示环境（预约、地点及数据均为虚构）
        </div>
      </div>
    </div>
  );
}
