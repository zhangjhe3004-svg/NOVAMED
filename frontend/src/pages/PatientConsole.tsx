/**
 * 患者工作台 —— 左侧菜单 + 顶栏 + 内容区
 * 挂号改为「真实号源」：展示可约号源（医生/科室/日期/时段/剩余/费用），预约即扣号。
 * 个人信息可编辑 + 改密码。
 */
import { useEffect, useRef, useState } from "react";
import {
  Card, Form, Input, Button, Select, Table, Space, Tag, Typography, message,
  Descriptions, Layout, Menu, Avatar, Drawer, Row, Col, DatePicker,
} from "antd";
import {
  CalendarOutlined, FileTextOutlined, ProfileOutlined, DashboardOutlined,
  FormOutlined, MedicineBoxOutlined, FileSearchOutlined,
  RobotOutlined, ClusterOutlined, VideoCameraOutlined, CommentOutlined,
  TeamOutlined, ExperimentOutlined, AudioOutlined, LockOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { getPatientMe, getPatientAppointments, getPatientRecords, updatePatientMe } from "../api/patientAuth";
import { createAppointment } from "../api/appointment";
import { listPublicSchedules } from "../api/schedule";
import type { DoctorScheduleItem } from "../api/schedule";
import type { PatientRecord } from "../api/patientAuth";
import { useNavigate } from "react-router-dom";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MENU = [
  { key: "dashboard", icon: <DashboardOutlined />, label: "我的工作台" },
  { key: "register", icon: <CalendarOutlined />, label: "科室挂号" },
  { key: "appts", icon: <CalendarOutlined />, label: "我的挂号" },
  { key: "records", icon: <FileTextOutlined />, label: "就诊记录" },
  { key: "me", icon: <ProfileOutlined />, label: "个人信息" },
];

const services = [
  { icon: <FormOutlined />, name: "科室挂号", color: "#fa8c16" },
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

const statusColor: Record<string, string> = { 待就诊: "blue", 候诊: "orange", 已完成: "green" };

function openTitle(s: DoctorScheduleItem) {
  return `预约 · ${s.doctor_name || `医生#${s.doctor_id}`}（${s.department || ""}）`;
}

export default function PatientConsole() {
  const navigate = useNavigate();
  const [me, setMe] = useState<any>(null);
  const [appts, setAppts] = useState<any[]>([]);
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [active, setActive] = useState("dashboard");

  // 真实号源
  const [schedules, setSchedules] = useState<DoctorScheduleItem[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedDept, setSchedDept] = useState("");
  const [schedDate, setSchedDate] = useState("");

  const [bookingOpen, setBookingOpen] = useState(false);
  const [booking, setBooking] = useState<DoctorScheduleItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookForm] = Form.useForm();
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  // 个人信息编辑
  const [meSaving, setMeSaving] = useState(false);
  const [meForm] = Form.useForm();

  const load = async () => {
    try {
      const m = await getPatientMe(); setMe(m);
      meForm.setFieldsValue({ phone: m?.phone, registered_place: m?.registered_place });
      const a = await getPatientAppointments(); setAppts(a.items || []);
      const r = await getPatientRecords(); setRecords(r.items || []);
    } catch { /* 令牌失效 */ }
  };
  useEffect(() => { load(); }, []);

  const loadSchedules = async () => {
    setSchedLoading(true);
    try {
      const r = await listPublicSchedules({ department: schedDept || undefined, date: schedDate || undefined });
      setSchedules(r.items);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载号源失败");
    } finally { setSchedLoading(false); }
  };
  useEffect(() => { loadSchedules(); }, [schedDept, schedDate]);

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { message.warning("当前浏览器不支持语音转文字，请使用 Chrome / Edge"); return; }
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "zh-CN"; rec.interimResults = true; rec.continuous = true;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      bookForm.setFieldsValue({ symptoms: text });
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); message.error("语音识别中断，请重试"); };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); message.error("无法启动录音，请检查麦克风权限"); }
  };

  const logout = () => { localStorage.removeItem("patient_token"); navigate("/login"); };

  const openBooking = (s: DoctorScheduleItem) => {
    setBooking(s);
    bookForm.setFieldsValue({
      patient_name: me?.full_name || "",
      phone: me?.phone || "",
      symptoms: "",
    });
    setBookingOpen(true);
  };

  const submitBooking = async (v: any) => {
    if (!booking) return;
    setSubmitting(true);
    try {
      await createAppointment({
        doctor_id: booking.doctor_id,
        department: booking.department,
        date: booking.date,
        time_slot: booking.time_slot,
        patient_name: v.patient_name,
        phone: v.phone,
        symptoms: v.symptoms,
      });
      message.success("挂号成功！已为您锁定号源");
      setBookingOpen(false);
      bookForm.resetFields();
      setBooking(null);
      await loadSchedules();
      const a = await getPatientAppointments(); setAppts(a.items || []);
    } catch (e: any) {
      message.error(e.response?.data?.detail || "挂号失败");
    } finally { setSubmitting(false); }
  };

  const submitMe = async (v: any) => {
    setMeSaving(true);
    try {
      const payload: any = { phone: v.phone, registered_place: v.registered_place };
      if (v.new_password) {
        payload.old_password = v.old_password;
        payload.new_password = v.new_password;
      }
      const updated = await updatePatientMe(payload);
      setMe(updated);
      meForm.setFieldsValue({ phone: updated.phone, registered_place: updated.registered_place, old_password: "", new_password: "" });
      message.success("个人信息已保存");
    } catch (e: any) {
      message.error(e.response?.data?.detail || "保存失败");
    } finally { setMeSaving(false); }
  };

  const onService = (s: any) => {
    if (s.name === "科室挂号") { setActive("register"); return; }
    if (s.name === "我的订单" || s.name === "候诊排队") { setActive("appts"); return; }
    if (s.name === "报告查询" || s.name === "报告咨询" || s.name === "影像查询") { setActive("records"); return; }
    message.info(`${s.name}（示例功能，可接入第三方或自建）`);
  };

  const deptOptions = Array.from(new Set(schedules.map((s) => s.department).filter(Boolean))) as string[];

  const renderContent = () => {
    if (active === "dashboard") {
      return (
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Card style={{ borderRadius: 16 }}>
            <Space size={16}>
              <Avatar size={52} style={{ background: "#e6f4ff", color: "#1677ff", fontWeight: 700 }}>{me?.full_name?.[0]}</Avatar>
              <div>
                <Text strong style={{ fontSize: 18 }}>{me?.full_name || "患者"}</Text>
                <Text type="secondary" style={{ display: "block", fontSize: 13 }}>{me?.phone} · 患者服务</Text>
              </div>
              <Space style={{ marginLeft: 20 }}>
                <Text><CalendarOutlined /> 挂号 {appts.length}</Text>
                <Text><FileTextOutlined /> 就诊 {records.length}</Text>
              </Space>
            </Space>
          </Card>
          <Card title="常用服务" style={{ borderRadius: 16 }} bodyStyle={{ padding: "16px 8px" }}>
            <Row gutter={[8, 8]}>
              {services.map((s) => (
                <Col span={4} key={s.name}>
                  <div style={{ textAlign: "center", padding: "10px 4px", cursor: "pointer" }} onClick={() => onService(s)}>
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <div style={{ width: 54, height: 54, borderRadius: 16, background: `${s.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: s.color }}>
                        {s.icon}
                      </div>
                      {s.badge && <span style={{ position: "absolute", top: -6, right: -8, background: "#ff4d4f", color: "#fff", fontSize: 10, borderRadius: 8, padding: "0 5px" }}>{s.badge}</span>}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>{s.name}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Space>
      );
    }
    if (active === "register") {
      return (
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Card style={{ borderRadius: 16 }}>
            <Space wrap>
              <Select allowClear placeholder="按科室筛选" style={{ width: 180 }} value={schedDept || undefined}
                onChange={(v) => setSchedDept(v || "")} options={deptOptions.map((d) => ({ value: d, label: d }))} />
              <DatePicker placeholder="按日期筛选" onChange={(d) => setSchedDate(d ? d.format("YYYY-MM-DD") : "")} />
              <Button icon={<ReloadOutlined />} onClick={loadSchedules}>刷新</Button>
              <Text type="secondary" style={{ fontSize: 12 }}>共 {schedules.length} 个可约号源</Text>
            </Space>
          </Card>
          {schedules.length === 0 ? (
            <Card style={{ borderRadius: 16 }} loading={schedLoading}>
              {!schedLoading && <Text type="secondary" style={{ display: "block", textAlign: "center", padding: 24 }}>当前无可用号源（请管理员先排班放号）</Text>}
            </Card>
          ) : (
            <Row gutter={[12, 12]}>
              {schedules.map((s) => (
                <Col xs={24} md={12} key={s.id}>
                  <Card size="small" style={{ borderRadius: 16 }} styles={{ body: { height: "100%" } }}>
                    <Space align="start" style={{ width: "100%" }} direction="vertical">
                      <Space style={{ width: "100%", justifyContent: "space-between" }}>
                        <Text strong style={{ fontSize: 15 }}>{s.doctor_name || `医生#${s.doctor_id}`}</Text>
                        <Tag color="blue">{s.department || "-"}</Tag>
                      </Space>
                      <Text type="secondary">{s.date} · {s.time_slot} · 挂号费 ¥{s.fee}</Text>
                      <Space wrap>
                        <Tag color={s.remain > 3 ? "green" : "orange"}>剩余 {s.remain} 个</Tag>
                        <Text type="secondary">{s.booked} 已约</Text>
                      </Space>
                      <Button type="primary" block disabled={s.remain <= 0} onClick={() => openBooking(s)}>预约挂号</Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Space>
      );
    }
    if (active === "appts") {
      return (
        <Card title={`我的挂号 (${appts.length})`} style={{ borderRadius: 16 }} bodyStyle={{ padding: 8 }}>
          <Table rowKey="id" size="small" pagination={false} dataSource={appts}
            columns={[
              { title: "医院", dataIndex: "hospital", render: (v: string) => v || "本院" },
              { title: "科室", dataIndex: "department", width: 100 },
              { title: "日期/时段", render: (_: any, r: any) => `${r.date || ""} ${r.time_slot || ""}` },
              { title: "症状", dataIndex: "symptoms", ellipsis: true },
              { title: "状态", dataIndex: "status", width: 90, render: (v: string) => <Tag color={statusColor[v] || "blue"}>{v}</Tag> },
            ]} />
        </Card>
      );
    }
    if (active === "records") {
      return (
        <Card title={`我的就诊记录 (${records.length})`} style={{ borderRadius: 16 }} bodyStyle={{ padding: 8 }}>
          <Table rowKey="record_id" size="small" pagination={false} dataSource={records}
            columns={[
              { title: "记录ID", dataIndex: "record_id", width: 80 },
              { title: "医生", dataIndex: "doctor_name", width: 110 },
              { title: "症状", dataIndex: "symptoms", ellipsis: true },
              { title: "诊断", dataIndex: "diagnosis", ellipsis: true },
              { title: "处方", dataIndex: "prescription", ellipsis: true },
              { title: "日期", dataIndex: "visit_date", width: 130, render: (d: string) => (d ? new Date(d).toLocaleString("zh-CN") : "-") },
            ]} />
        </Card>
      );
    }
    // 个人信息（可编辑 + 改密码）
    return (
      <Card title="个人信息" style={{ borderRadius: 16 }}>
        <Form form={meForm} layout="vertical" onFinish={submitMe} style={{ maxWidth: 480 }}>
          <Form.Item label="姓名"><Input disabled value={me?.full_name} /></Form.Item>
          <Form.Item label="证件类型"><Input disabled value={me?.id_type || "-"} /></Form.Item>
          <Form.Item label="证件号码"><Input disabled value={me?.id_number || "-"} /></Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }]}>
            <Input placeholder="手机号" />
          </Form.Item>
          <Form.Item name="registered_place" label="户籍地">
            <Input placeholder="户籍地" />
          </Form.Item>
          <Form.Item label="修改密码（选填）">
            <Space style={{ width: "100%" }} direction="vertical">
              <Form.Item name="old_password" style={{ marginBottom: 8 }}><Input.Password prefix={<LockOutlined />} placeholder="原密码" /></Form.Item>
              <Form.Item name="new_password" style={{ marginBottom: 0 }}><Input.Password prefix={<LockOutlined />} placeholder="新密码（留空则不修改）" /></Form.Item>
            </Space>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={meSaving} block>保存</Button>
        </Form>
        <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
          <Descriptions.Item label="账号状态">{me?.status || "已注册"}</Descriptions.Item>
        </Descriptions>
      </Card>
    );
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={220} style={{ background: "#fff", borderRight: "1px solid #f0f0f0" }}>
        <div style={{ height: 56, display: "flex", alignItems: "center", gap: 8, padding: "0 20px", fontWeight: 700, fontSize: 16 }}>
          <CalendarOutlined style={{ color: "#1677ff" }} /> 患者服务
        </div>
        <Menu mode="inline" selectedKeys={[active]} items={MENU}
          onClick={({ key }) => setActive(key)} style={{ border: "none" }} />
        <div style={{ position: "absolute", bottom: 16, width: "100%", textAlign: "center" }}>
          <Button type="link" size="small" onClick={() => setActive("dashboard")}>工作台首页</Button>
          <Button type="link" size="small" danger onClick={logout}>退出</Button>
        </div>
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 56 }}>
          <Text strong style={{ fontSize: 16 }}>患者工作台</Text>
          <Space>
            <Text>{me?.full_name || "患者"}</Text>
            <Avatar size={32} style={{ background: "#e6f4ff", color: "#1677ff" }}>{me?.full_name?.[0]}</Avatar>
          </Space>
        </Header>
        <Content style={{ margin: 16, padding: 16, background: "#f5f5f5", borderRadius: 8, minHeight: 480 }}>
          {renderContent()}
        </Content>
      </Layout>

      {/* 预约挂号下单（真实号源） */}
      <Drawer title={booking ? openTitle(booking) : "预约挂号"} width={440} open={bookingOpen}
        onClose={() => setBookingOpen(false)} destroyOnClose>
        {booking && (
          <Form form={bookForm} layout="vertical" onFinish={submitBooking}>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="医生">{booking.doctor_name || `#${booking.doctor_id}`}</Descriptions.Item>
              <Descriptions.Item label="科室">{booking.department || "-"}</Descriptions.Item>
              <Descriptions.Item label="时间">{booking.date} · {booking.time_slot}</Descriptions.Item>
              <Descriptions.Item label="费用">¥{booking.fee}</Descriptions.Item>
            </Descriptions>
            <Form.Item name="patient_name" label="患者姓名" rules={[{ required: true }]}>
              <Input placeholder="请输入姓名" />
            </Form.Item>
            <Form.Item name="phone" label="联系电话" rules={[{ required: true }]}>
              <Input placeholder="请输入手机号" />
            </Form.Item>
            <Form.Item name="symptoms" label="症状描述"
              extra={<Button size="small" type="link" icon={<AudioOutlined />} style={{ padding: 0 }} onClick={toggleVoice}>
                {listening ? "停止语音输入（再次点击结束）" : "语音输入"}</Button>}>
              <Input.TextArea rows={3} placeholder="简述症状…（可语音输入）" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block>提交挂号</Button>
            <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
              提交后将从该号源扣除 1 个号；号源实时扣减，先到先得。
            </Text>
          </Form>
        )}
      </Drawer>
    </Layout>
  );
}
