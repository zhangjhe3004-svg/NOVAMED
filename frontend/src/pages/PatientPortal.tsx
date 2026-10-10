/**
 * 患者自助服务端（预约挂号平台）—— 参考「XX市预约挂号统一平台」截图
 * 独立于员工系统，公开访问。功能为示例数据（医院/号源等需后端+第三方对接）。
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Tag, Button, Row, Col, Space, Typography, Card, Avatar, Drawer, Form, Select, message, Table } from "antd";
import {
  MedicineBoxOutlined, CommentOutlined, FileSearchOutlined, RobotOutlined,
  CalendarOutlined, FileTextOutlined, VideoCameraOutlined, FormOutlined, TeamOutlined,
  ExperimentOutlined, ClusterOutlined, EnvironmentOutlined,
} from "@ant-design/icons";
import { createAppointment, queryAppointments, checkinAppointment } from "../api/appointment";

const { Text } = Typography;

const services = [
  { icon: <FormOutlined />, name: "科室挂号", color: "#1677ff" },
  { icon: <MedicineBoxOutlined />, name: "在线问诊", color: "#36cfc9" },
  { icon: <FileSearchOutlined />, name: "报告查询", color: "#2f54eb" },
  { icon: <RobotOutlined />, name: "智能导诊", color: "#722ed1", badge: "新" },
  { icon: <CalendarOutlined />, name: "体检预约", color: "#13c2c2" },
  { icon: <ClusterOutlined />, name: "我的订单", color: "#fa8c16" },
  { icon: <VideoCameraOutlined />, name: "影像查询", color: "#1677ff" },
  { icon: <CommentOutlined />, name: "报告咨询", color: "#13c2c2" },
  { icon: <TeamOutlined />, name: "候诊排队", color: "#2f54eb" },
  { icon: <ExperimentOutlined />, name: "疫苗接种", color: "#52c41a" },
  { icon: <FileTextOutlined />, name: "在线开药", color: "#1677ff" },
];

const hospitals = [
  { name: "北京医院", grade: "三甲", tags: ["候补挂号", "候诊排队"], dept: "重点科室：内科，外科", area: "东城区", logo: "京" },
  { name: "北京大学人民医院", grade: "三甲", tags: ["候补挂号", "候诊排队"], dept: "重点科室：内科，外科，超声医学科门…", area: "西城区", logo: "人" },
  { name: "北京大学第一医院", grade: "三甲", tags: ["候补挂号", "候诊排队"], dept: "重点科室：临检中心，呼吸内科，西药", area: "西城区", logo: "一" },
  { name: "首都医科大学附属北京朝阳医院", grade: "三甲", tags: ["候补挂号"], dept: "重点科室：呼吸科，心内科", area: "朝阳区", logo: "朝" },
  { name: "中国医学科学院阜外医院", grade: "三甲", tags: ["候补挂号"], dept: "重点科室：心血管内科", area: "西城区", logo: "阜" },
];

export default function PatientPortal() {
  const navigate = useNavigate();
  const [kw, setKw] = useState("");

  const list = hospitals.filter((h) => (h.name + h.dept).includes(kw));

  const [bookingOpen, setBookingOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookForm] = Form.useForm();
  const bookingDoctors = [
    { id: 2, name: "张医生（内科 · 主治医师）" },
    { id: 3, name: "李医生（外科 · 副主任医师）" },
  ];
  const hospitalOptions = ["北京医院", "北京大学人民医院", "北京大学第一医院"];
  const deptOptions = ["内科", "外科", "儿科", "呼吸科", "心血管内科"];
  const timeOptions = ["08:00-09:00", "09:00-10:00", "10:00-11:00", "14:00-15:00", "15:00-16:00"];

  const openBooking = () => setBookingOpen(true);
  const submitBooking = async (v: any) => {
    setSubmitting(true);
    try {
      await createAppointment({ ...v, doctor_id: v.doctor_id });
      message.success("挂号成功！医生将收到您的挂号信息");
      setBookingOpen(false);
      bookForm.resetFields();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "挂号失败");
    } finally { setSubmitting(false); }
  };

  const [myOpen, setMyOpen] = useState(false);
  const [myPhone, setMyPhone] = useState("");
  const [myList, setMyList] = useState<any[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const queryMy = async () => {
    if (!myPhone.trim()) { message.warning("请输入手机号"); return; }
    setMyLoading(true);
    try { const r = await queryAppointments(myPhone.trim()); setMyList(r.items || []); } catch { /* 忽略 */ } finally { setMyLoading(false); }
  };
  const doCheckin = async (id: number) => {
    try { await checkinAppointment(id); message.success("已报到，请候诊"); queryMy(); } catch { /* 忽略 */ }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", background: "#f5f5f5", minHeight: "100vh", paddingBottom: 24 }}>
      {/* 顶部品牌栏 */}
      <div style={{ background: "#000", color: "#fff", textAlign: "center", padding: "10px 16px", position: "relative" }}>
        <Text strong style={{ color: "#fff", fontSize: 17 }}>XX市预约挂号统一平台</Text>
        <div style={{ fontSize: 11, color: "#ccc" }}>www.114yygh.com</div>
        <span style={{ position: "absolute", left: 12, top: 14, fontSize: 18, color: "#fff" }} onClick={() => navigate("/")}>✕</span>
        <span style={{ position: "absolute", right: 12, top: 14, fontSize: 18, color: "#fff" }}>⋯</span>
      </div>

      {/* 关怀版 + 个人中心 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#fff" }}>
        <Space size={8}>
          <Tag style={{ borderRadius: 20, padding: "2px 14px", color: "#1677ff", background: "#e6f4ff", border: "none" }}>关怀版</Tag>
          <Button size="small" type="text" onClick={() => setMyOpen(true)}>我的挂号</Button>
          <Button size="small" type="text" onClick={() => navigate("/register")}>欢迎注册</Button>
        </Space>
        <Button type="primary" shape="round" size="small" onClick={() => navigate("/patient-console")}>个人中心：去登录</Button>
      </div>

      {/* 搜索 */}
      <div style={{ padding: "0 16px", background: "#fff" }}>
        <Input size="large" prefix={<SearchOutlined />} placeholder="搜索医院/科室/医生" allowClear
          value={kw} onChange={(e) => setKw(e.target.value)} style={{ borderRadius: 24 }} />
      </div>

      {/* 安全标签 */}
      <div style={{ display: "flex", gap: 14, padding: "10px 20px", fontSize: 12, color: "#1677ff", background: "#f0f7ff", margin: "10px 0 0" }}>
        <span>☑ 市官方指定挂号平台</span>
        <span>☑ 挂·缴·查·认</span>
        <span>☑ 医院号源同步</span>
      </div>

      {/* 服务宫格 */}
      <Card style={{ margin: "10px 12px", borderRadius: 16 }} bodyStyle={{ padding: "16px 8px" }}>
        <Row gutter={[8, 8]}>
          {services.map((s) => (
            <Col span={5} key={s.name}>
              <div style={{ textAlign: "center", padding: "8px 4px", cursor: "pointer" }}
                onClick={() => ["科室挂号", "在线问诊", "候诊排队"].includes(s.name) ? openBooking() : message.info(`${s.name}（示例）`)}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 18, background: `${s.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: s.color }}>
                    {s.icon}
                  </div>
                  {s.badge && <span style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", color: "#fff", fontSize: 10, borderRadius: 8, padding: "0 5px" }}>{s.badge}</span>}
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>{s.name}</div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 医院区 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginTop: 8 }}>
        <Space size={6}>
          <Text strong style={{ fontSize: 17 }}>全部医院</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>共 {hospitals.length} 家医院</Text>
        </Space>
        <Button size="small" type="text" icon={<EnvironmentOutlined />}>附近医院</Button>
      </div>
      <div style={{ display: "flex", gap: 20, padding: "8px 16px", fontSize: 13, color: "#666" }}>
        <span>全部区域 ▾</span>
        <span>综合排序 ▾</span>
        <span style={{ marginLeft: "auto" }}>筛选 ▾</span>
      </div>

      {/* 医院列表 */}
      <div style={{ padding: "0 12px", marginTop: 8 }}>
        {list.length === 0 ? (
          <Card style={{ borderRadius: 16 }}><Text type="secondary" style={{ display: "block", textAlign: "center", padding: 24 }}>未找到匹配医院</Text></Card>
        ) : list.map((h) => (
          <Card key={h.name} style={{ borderRadius: 16, marginBottom: 10 }} bodyStyle={{ padding: "16px", display: "flex", gap: 12 }}>
            <Avatar shape="square" size={48} style={{ background: "#f5f5f5", color: "#d4380d", fontSize: 22, fontWeight: 700, borderRadius: 10 }}>{h.logo}</Avatar>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text strong style={{ fontSize: 16 }}>{h.name}</Text>
                <span style={{ color: "#1677ff", fontSize: 12 }}>挂 查 认</span>
              </div>
              <Space size={6} style={{ marginTop: 4 }}>
                <Tag color="blue" style={{ borderRadius: 6 }}>{h.grade}</Tag>
                {h.tags.map((t) => <Tag key={t} style={{ borderRadius: 6 }}>{t}</Tag>)}
              </Space>
              <Text type="secondary" style={{ display: "block", fontSize: 12, marginTop: 6 }}>{h.dept}</Text>
              <Text type="secondary" style={{ display: "block", fontSize: 12 }}>{h.area}</Text>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "16px 0", color: "#999", fontSize: 12 }}>
        患者自助服务端 · 示例数据（医院/号源需接入第三方或自建）
      </div>

      {/* 我的挂号 / 报到 */}
      <Drawer title="我的挂号" width={420} open={myOpen} onClose={() => setMyOpen(false)}>
        <Space.Compact style={{ width: "100%" }}>
          <Input placeholder="请输入挂号时的手机号" value={myPhone} onChange={(e) => setMyPhone(e.target.value)} onPressEnter={queryMy} />
          <Button type="primary" onClick={queryMy}>查询</Button>
        </Space.Compact>
        <Table rowKey="id" size="small" style={{ marginTop: 12 }} loading={myLoading} dataSource={myList} pagination={false}
          columns={[
            { title: "医院", dataIndex: "hospital" },
            { title: "科室", dataIndex: "department" },
            { title: "日期/时段", render: (_: any, r: any) => `${r.date || ""} ${r.time_slot || ""}` },
            { title: "状态", dataIndex: "status", width: 80 },
            { title: "报到", width: 70, render: (_: any, r: any) => <Button size="small" onClick={() => doCheckin(r.id)}>报到</Button> },
          ]} />
      </Drawer>

      {/* 预约挂号下单流程 */}
      <Drawer title="预约挂号" width={420} open={bookingOpen} onClose={() => setBookingOpen(false)} destroyOnClose>
        <Form form={bookForm} layout="vertical" onFinish={submitBooking}>
          <Form.Item name="hospital" label="医院" rules={[{ required: true }]}>
            <Select options={hospitalOptions.map((h) => ({ value: h, label: h }))} placeholder="选择医院" />
          </Form.Item>
          <Form.Item name="department" label="科室" rules={[{ required: true }]}>
            <Select options={deptOptions.map((d) => ({ value: d, label: d }))} placeholder="选择科室" />
          </Form.Item>
          <Form.Item name="doctor_id" label="医生" rules={[{ required: true }]}>
            <Select options={bookingDoctors.map((d) => ({ value: d.id, label: d.name }))} placeholder="选择医生" />
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true }]}>
            <Input placeholder="如 2026-09-10" />
          </Form.Item>
          <Form.Item name="time_slot" label="时段" rules={[{ required: true }]}>
            <Select options={timeOptions.map((t) => ({ value: t, label: t }))} placeholder="选择时段" />
          </Form.Item>
          <Form.Item name="patient_name" label="患者姓名" rules={[{ required: true }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话" rules={[{ required: true }]}>
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item name="symptoms" label="症状描述">
            <Input.TextArea rows={3} placeholder="简述症状…" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>提交挂号</Button>
          <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
            挂号成功后，对应医生的「接诊」页面会收到您的患者信息与挂号信息。
          </Text>
        </Form>
      </Drawer>
    </div>
  );
}
