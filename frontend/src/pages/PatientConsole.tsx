/**
 * 患者工作台 —— 对齐 docs/设计预览/patient.html 的青绿色「MediCode 健康」设计
 * 顶部导航：首页 / 预约挂号 / 就诊记录 / 个人中心
 * 功能：号源预约（扣号）、取消挂号（归还号源）、就诊记录详情、个人信息/账号编辑、修改密码。
 */
import { useEffect, useRef, useState } from "react";
import {
  Card, Form, Input, Button, Select, Table, Space, Tag, Typography, message,
  Descriptions, Avatar, Drawer, Row, Col, DatePicker, Empty, Divider, Popconfirm,
} from "antd";
import {
  CalendarOutlined, FileTextOutlined, ProfileOutlined,
  FormOutlined, MedicineBoxOutlined, FileSearchOutlined,
  RobotOutlined, ClusterOutlined, VideoCameraOutlined, CommentOutlined,
  TeamOutlined, ExperimentOutlined, AudioOutlined, LockOutlined, ReloadOutlined,
  HomeOutlined, LogoutOutlined, EyeOutlined, CloseCircleOutlined, DeleteOutlined,
} from "@ant-design/icons";
import {
  getPatientMe, getPatientAppointments, getPatientRecords, updatePatientMe,
  changePatientPassword, cancelPatientAppointment, deletePatientRecord, deleteMyPatientAccount,
} from "../api/patientAuth";
import type { PatientRecord, PatientAppointment } from "../api/patientAuth";
import { createAppointment } from "../api/appointment";
import { listPublicSchedules, listPublicDepartments } from "../api/schedule";
import type { DoctorScheduleItem, DepartmentItem } from "../api/schedule";
import VoiceTextArea from "../components/VoiceTextArea";
import { useNavigate } from "react-router-dom";

const { Text, Title } = Typography;

const NAV = [
  { key: "home", label: "首页" },
  { key: "booking", label: "预约挂号" },
  { key: "records", label: "就诊记录" },
  { key: "me", label: "个人中心" },
];

// 首页「快捷服务」四宫格
const shortcuts = [
  { icon: <CalendarOutlined />, name: "预约挂号", desc: "在线预约门诊号源", color: "#27857d", go: "booking" },
  { icon: <FileTextOutlined />, name: "就诊记录", desc: "查看历史就诊档案", color: "#2f54eb", go: "records" },
  { icon: <FileSearchOutlined />, name: "报告查询", desc: "查看检查检验报告", color: "#13c2c2", go: "records" },
  { icon: <ProfileOutlined />, name: "个人中心", desc: "管理档案与账号", color: "#722ed1", go: "me" },
];


const statusColor: Record<string, string> = { 待就诊: "blue", 已报到: "orange", 已完成: "green", 已取消: "default" };

function openTitle(s: DoctorScheduleItem) {
  return `预约 · ${s.doctor_name || `医生#${s.doctor_id}`}（${s.department || ""}）`;
}

/** 员工端（统一登录入口）地址 */
const STAFF_ORIGIN: string =
  (import.meta as any).env?.VITE_STAFF_ORIGIN || "http://localhost:3051";

export default function PatientConsole() {
  const navigate = useNavigate();
  const [me, setMe] = useState<any>(null);
  const [appts, setAppts] = useState<PatientAppointment[]>([]);
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [active, setActive] = useState("home");

  const [schedules, setSchedules] = useState<DoctorScheduleItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedDept, setSchedDept] = useState("");
  const [schedDate, setSchedDate] = useState("");

  const [bookingOpen, setBookingOpen] = useState(false);
  const [booking, setBooking] = useState<DoctorScheduleItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookForm] = Form.useForm();
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  // 记录详情
  const [recordDetail, setRecordDetail] = useState<PatientRecord | null>(null);

  const [meSaving, setMeSaving] = useState(false);
  const [meForm] = Form.useForm();
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdForm] = Form.useForm();

  const load = async () => {
    try {
      const m = await getPatientMe(); setMe(m);
      meForm.setFieldsValue({
        name: m?.name, gender: m?.gender, phone: m?.phone,
        address: m?.address, birth_date: m?.birth_date,
        medical_history: m?.medical_history, registered_place: m?.registered_place,
      });
      const a = await getPatientAppointments(); setAppts(a.items || []);
      const r = await getPatientRecords(); setRecords(r.items || []);
    } catch { /* 令牌失效 */ }
  };
  useEffect(() => { load(); }, []);

  const loadDepartments = async () => {
    try {
      const r = await listPublicDepartments();
      setDepartments(r.items || []);
    } catch { /* 忽略，科室列表加载失败时回退到号源里的科室 */ }
  };

  const loadSchedules = async () => {
    setSchedLoading(true);
    try {
      const r = await listPublicSchedules({
        date: schedDate || undefined,
        department: schedDept || undefined,
      });
      setSchedules(r.items);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载号源失败");
    } finally { setSchedLoading(false); }
  };
  useEffect(() => { loadDepartments(); }, []);
  useEffect(() => { loadSchedules(); }, [schedDate, schedDept]);

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

  // 患者端已移除独立登录页：退出后回员工端统一登录页
  const logout = () => { sessionStorage.removeItem("patient_token"); sessionStorage.removeItem("token"); window.location.href = STAFF_ORIGIN + "/login"; };

  const openBooking = (s: DoctorScheduleItem) => {
    setBooking(s);
    bookForm.setFieldsValue({ patient_name: me?.name || "", phone: me?.phone || "", symptoms: "" });
    setBookingOpen(true);
  };

  const submitBooking = async (v: any) => {
    if (!booking) return;
    setSubmitting(true);
    try {
      await createAppointment({
        doctor_id: booking.doctor_id,
        patient_id: me?.id,
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

  const doCancel = async (id: number) => {
    try {
      await cancelPatientAppointment(id);
      message.success("已取消挂号");
      const a = await getPatientAppointments(); setAppts(a.items || []);
      await loadSchedules();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "取消失败");
    }
  };

  const submitMe = async (v: any) => {
    setMeSaving(true);
    try {
      const updated = await updatePatientMe(v);
      setMe(updated);
      message.success("个人信息已保存");
    } catch (e: any) {
      message.error(e.response?.data?.detail || "保存失败");
    } finally { setMeSaving(false); }
  };

  const doDeleteRecord = async (id: number) => {
    try {
      await deletePatientRecord(id);
      message.success("已删除就诊记录");
      setRecordDetail(null);
      const r = await getPatientRecords(); setRecords(r.items || []);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "删除失败");
    }
  };

  const submitPwd = async (v: any) => {
    setPwdSaving(true);
    try {
      await changePatientPassword(v.old_password, v.new_password);
      message.success("密码已修改");
      pwdForm.resetFields();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "修改失败");
    } finally { setPwdSaving(false); }
  };

  const doDeleteAccount = async () => {
    try {
      await deleteMyPatientAccount();
      message.success("账号已注销");
      logout();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "注销失败");
    }
  };


  // 科室列表以「医生账号分配的科室」为准（后端自动同步）；号源已按所选科室在服务端过滤
  const deptOptions = departments;
  const filteredSchedules = schedules;

  const apptColumns = (withCancel: boolean) => [
    { title: "医生", dataIndex: "doctor_name", width: 100, render: (v: string, r: PatientAppointment) => v || `医生#${r.doctor_id}` },
    { title: "科室", dataIndex: "department", width: 90 },
    { title: "日期/时段", render: (_: any, r: PatientAppointment) => `${r.date || ""} ${r.time_slot || ""}` },
    { title: "症状", dataIndex: "symptoms", ellipsis: true },
    { title: "状态", dataIndex: "status", width: 90, render: (v: string) => <Tag color={statusColor[v] || "blue"}>{v}</Tag> },
    ...(withCancel ? [{
      title: "操作", width: 90, render: (_: any, r: PatientAppointment) =>
        (r.status === "待就诊" || r.status === "已报到") ? (
          <Popconfirm title="确认取消该挂号？" onConfirm={() => doCancel(r.id)}>
            <Button size="small" danger type="link" icon={<CloseCircleOutlined />}>取消</Button>
          </Popconfirm>
        ) : <Text type="secondary">-</Text>,
    }] : []),
  ];

  const renderContent = () => {
    if (active === "home") {
      const upcoming = appts.filter((a) => a.status === "待就诊" || a.status === "已报到");
      const doneCount = records.filter((r) => r.review_status === "已审核" || r.review_status === "已完成").length;
      const nextAppt = upcoming[0];
      return (
        <>
          {/* 页面标题 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#94aaa6", marginBottom: 8 }}>YOUR HEALTH SPACE</div>
              <h1 style={{ fontSize: 26, letterSpacing: -0.6, margin: 0, fontWeight: 600 }}>您好，{me?.name || "患者"}</h1>
            </div>
            <span style={{ fontSize: 12, color: "#8497ab", lineHeight: 1.9 }}>今天也照顾好自己</span>
          </div>

          {/* 欢迎区 + 健康提示 */}
          <div style={{ display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 23, marginBottom: 25 }}>
            <div style={{ background: "#deefeb", borderRadius: 18, padding: "30px 35px", position: "relative", overflow: "hidden", minHeight: 200 }}>
              <h2 style={{ fontSize: 27, lineHeight: 1.6, margin: "0 0 10px", fontWeight: 550, color: "#28645c", position: "relative", zIndex: 1 }}>
                让就医更简单，<br />让关怀更贴近。
              </h2>
              <p style={{ fontSize: 12, color: "#6e9991", lineHeight: 1.9, position: "relative", zIndex: 1 }}>
                您的预约与就诊信息，随时清晰可见。
              </p>
              <svg style={{ position: "absolute", width: 178, height: 166, right: 18, top: 25, opacity: 0.75 }} viewBox="0 0 180 180" aria-hidden="true">
                <circle cx="97" cy="89" r="69" fill="#c7e6df" />
                <rect x="39" y="40" width="99" height="109" rx="14" fill="#f4fcf9" transform="rotate(-10 89 95)" />
                <path d="M89 59v48 M65 83h48" stroke="#83bfae" strokeWidth="13" strokeLinecap="round" />
                <path d="M64 125h52" stroke="#bddfd4" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5eeef", borderRadius: 18, padding: "27px 25px" }}>
              <h3 style={{ fontSize: 15, margin: "0 0 13px", fontWeight: 600 }}>就诊前，准备好这三件事</h3>
              <p style={{ fontSize: 12, color: "#8a9fa9", lineHeight: 2, margin: 0 }}>
                01 携带有效证件<br />
                02 带上既往检查和用药资料<br />
                03 提前确认时间与诊区位置
              </p>
            </div>
          </div>

          {/* 快捷服务 4 按钮 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, marginBottom: 28 }}>
            {shortcuts.map((s) => (
              <button key={s.name} onClick={() => setActive(s.go)} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "23px 20px",
                background: "#fff", border: "1px solid #e5eeef", borderRadius: 13,
                cursor: "pointer", textAlign: "left", transition: "border-color .15s",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#9fcac4")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5eeef")}>
                <span style={{
                  width: 42, height: 44, display: "grid", placeItems: "center",
                  borderRadius: 12, background: s.color + "1a", color: s.color, fontSize: 20,
                }}>{s.icon}</span>
                <div>
                  <b style={{ fontSize: 13, fontWeight: 550 }}>{s.name}</b>
                  <small style={{ display: "block", fontSize: 10, color: "#97a7b3", marginTop: 5 }}>{s.desc}</small>
                </div>
              </button>
            ))}
          </div>

          {/* 主内容区：我的预约 + 最近就诊 */}
          <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 23 }}>
            {/* 我的预约 */}
            <div style={{ background: "#fff", border: "1px solid #e5eeef", borderRadius: 15, padding: 25, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
                <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>我的预约</h2>
                <span style={{
                  padding: "5px 9px", borderRadius: 5, fontSize: 10,
                  background: nextAppt?.status === "已报到" ? "#ecf7f2" : "#fff6e5",
                  color: nextAppt?.status === "已报到" ? "#59977d" : "#b19150",
                }}>{!nextAppt ? "无预约" : nextAppt.status === "已报到" ? "已报到" : "待就诊"}</span>
              </div>
              {nextAppt ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    <div style={{
                      borderRadius: 12, width: 49, height: 52, display: "grid", placeItems: "center",
                      background: "#e6f2ef", color: "#508d84", fontWeight: 500, fontSize: 18,
                    }}>{nextAppt.doctor_name?.[0] || "医"}</div>
                    <div>
                      <b style={{ fontSize: 15 }}>{nextAppt.doctor_name || `医生#${nextAppt.doctor_id}`}
                        <span style={{ fontSize: 10, color: "#94a3b1", fontWeight: 400, marginLeft: 6 }}>主治医师</span>
                      </b>
                      <small style={{ fontSize: 11, color: "#8497ab", display: "block", marginTop: 7 }}>
                        {nextAppt.department || "-"} · 普通门诊
                      </small>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 11, margin: "21px 0", padding: "19px 0", borderTop: "1px dashed #e5eeef", borderBottom: "1px dashed #e5eeef", fontSize: 12, color: "#79939f" }}>
                    <span>📅 {nextAppt.date || ""} {nextAppt.time_slot || ""}</span>
                    <span>🏥 门诊楼 2 层 · {nextAppt.department || "诊区"}</span>
                    <span>👤 就诊人：{me?.name || "患者"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setActive("booking")} style={{
                      flex: 1, padding: "11px 16px", border: "1px solid #e5eeef", background: "#fff",
                      borderRadius: 8, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 42,
                    }}>重新选择时段</button>
                    <button onClick={() => setActive("booking")} style={{
                      flex: 1, padding: "11px 16px", border: "none", background: "#27857d", color: "#fff",
                      borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 42,
                    }}>查看报到指引 →</button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: 30, color: "#97a7b3" }}>
                  暂无待就诊挂号，可前往预约挂号
                </div>
              )}
            </div>

            {/* 最近就诊 */}
            <div style={{ background: "#fff", border: "1px solid #e5eeef", borderRadius: 15, padding: 25, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
                <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>最近就诊</h2>
                <button onClick={() => setActive("records")} style={{ color: "#27857d", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>全部记录 →</button>
              </div>
              {records.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "#97a7b3", fontSize: 12 }}>暂无就诊记录</div>
              ) : (
                records.slice(0, 3).map((r) => (
                  <div key={r.record_id} style={{ display: "flex", gap: 13, borderBottom: "1px solid #e5eeef", padding: "16px 0" }}>
                    <div style={{ color: "#87a9b4", background: "#eff6f8", padding: 11, borderRadius: 11, height: 44, display: "grid", placeItems: "center", fontSize: 18 }}></div>
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: 12, fontWeight: 550 }}>{r.department || "门诊"}</b>
                      <small style={{ display: "block", fontSize: 10, color: "#8fa1b2", lineHeight: 1.9, marginTop: 6 }}>
                        {r.doctor_name || "-"} · {r.diagnosis || r.symptoms?.slice(0, 20) || "-"}<br />
                        <span style={{ background: "#ecf7f2", color: "#59977d", padding: "2px 6px", borderRadius: 4, fontSize: 9 }}>{r.review_status || "待审核"}</span>
                      </small>
                    </div>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#9cabb8", alignSelf: "center" }}>
                      {r.visit_date ? new Date(r.visit_date).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) : "-"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 温馨提示 */}
          <div style={{ fontSize: 11, lineHeight: 1.9, color: "#99aaaf", margin: "22px 0 0", padding: "15px 19px", borderRadius: 10, background: "#edf3f4" }}>
            温馨提示：请以实际医院和医生的安排为准。此原型用于体验预约、报到和记录查看的交互流程。
          </div>
        </>
      );
    }
    if (active === "booking") {
      return (
        <>
          {/* 页面标题 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#94aaa6", marginBottom: 8 }}>APPOINTMENT</div>
              <h1 style={{ fontSize: 26, letterSpacing: -0.6, margin: 0, fontWeight: 600 }}>预约挂号</h1>
            </div>
            <span style={{ fontSize: 12, color: "#8497ab", lineHeight: 1.9 }}>选择科室与号源，下单即锁定号源</span>
          </div>

          {/* 主体：选择号源 + 预约须知 */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 23 }}>
            {/* 左侧：选择就诊时段 */}
            <div style={{ background: "#fff", border: "1px solid #e5eeef", borderRadius: 15, padding: 25, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
                <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>选择就诊时段</h2>
                <span style={{ padding: "5px 9px", borderRadius: 5, background: "#ecf7f2", fontSize: 10, color: "#59977d" }}>
                  {schedDept || "请选择科室"}
                </span>
              </div>

              {/* 科室选择 */}
              <div style={{ marginBottom: 18 }}>
                {deptOptions.length === 0 ? (
                  <Text type="secondary">暂无可预约科室，请管理员先排班放号。</Text>
                ) : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {deptOptions.map((d) => {
                      const sel = schedDept === d.department;
                      return (
                        <button key={d.department} onClick={() => { setSchedDept(sel ? "" : d.department); setSchedDate(""); }} style={{
                          padding: "10px 18px", borderRadius: 9, border: sel ? "2px solid #27857d" : "1px solid #e5eeef",
                          background: sel ? "#e6f2ef" : "#fff", color: sel ? "#27857d" : "#4f6f6d",
                          fontWeight: sel ? 600 : 400, fontSize: 12, cursor: "pointer", transition: "all .15s",
                        }}>
                          {d.department}
                          <small style={{ display: "block", fontSize: 10, fontWeight: 400, color: "#97a7b3", marginTop: 2 }}>
                            {d.doctor_count} 位医生
                          </small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 日期选择（显示真实余号） */}
              {schedDept && (
                <>
                  <h3 style={{ fontSize: 12, fontWeight: 500, margin: "18px 0 10px" }}>选择日期</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
                    {Array.from({ length: 5 }, (_, i) => {
                      const d = new Date(); d.setDate(d.getDate() + i);
                      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                      const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
                      const isSelected = schedDate === dateStr;
                      const remain = filteredSchedules
                        .filter((s) => s.date === dateStr)
                        .reduce((acc, s) => acc + (s.remaining || 0), 0);
                      return (
                        <button key={dateStr} onClick={() => setSchedDate(dateStr)} style={{
                          border: isSelected ? "1px solid #27857d" : "1px solid #e5eeef",
                          borderRadius: 9, padding: "15px 5px", fontSize: 12, lineHeight: 1.9,
                          background: isSelected ? "#edf7f3" : "#fff", color: isSelected ? "#27857d" : "#243e59",
                          cursor: "pointer",
                        }}>
                          {dayNames[d.getDay()]}
                          <br />
                          {`${d.getMonth() + 1}/${d.getDate()}`}
                          <small style={{ display: "block", fontSize: 10, color: remain > 0 ? "#59977d" : "#c4cdd4" }}>
                            {remain > 0 ? `余 ${remain} 号` : "无号"}
                          </small>
                        </button>
                      );
                    })}
                  </div>

                  {/* 真实号源列表：医生 × 时段 × 余号 */}
                  <h3 style={{ fontSize: 12, fontWeight: 500, margin: "16px 0 10px" }}>可约号源</h3>
                  {schedDate && filteredSchedules.filter((s) => s.date === schedDate).length === 0 ? (
                    <div style={{ textAlign: "center", padding: 24, color: "#97a7b3", fontSize: 12, background: "#fafbfb", borderRadius: 9 }}>
                      该日期暂无号源，请选择其他日期
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 24 }}>
                      {filteredSchedules
                        .filter((s) => s.date === schedDate)
                        .map((s) => {
                          const full = (s.remaining || 0) <= 0;
                          return (
                            <button key={s.id} disabled={full} onClick={() => openBooking(s)} style={{
                              padding: "13px 14px", border: full ? "1px solid #eef1f3" : "1px solid #d8ebe6",
                              borderRadius: 10, textAlign: "left", cursor: full ? "not-allowed" : "pointer",
                              background: full ? "#fafbfb" : "#fff", transition: "border-color .15s",
                              opacity: full ? 0.65 : 1,
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <b style={{ fontSize: 13, color: full ? "#8fa4ac" : "#243e59" }}>
                                  {s.doctor_name || `医生#${s.doctor_id}`}
                                </b>
                                <span style={{
                                  fontSize: 10, padding: "2px 8px", borderRadius: 4,
                                  background: full ? "#f1f3f4" : "#ecf7f2", color: full ? "#a5b5bb" : "#59977d",
                                }}>{full ? "已约满" : `余 ${s.remaining}`}</span>
                              </div>
                              <small style={{ display: "block", fontSize: 11, color: "#8497ab", marginTop: 7 }}>
                                {s.time_slot} · ¥{s.fee ?? 50}
                              </small>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 右侧：预约须知 */}
            <div style={{ background: "#fff", border: "1px solid #e5eeef", borderRadius: 15, padding: 25, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
                <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>预约须知</h2>
              </div>
              {[
                ["就诊人", `${me?.name || "患者"}（${me?.gender || "-"}）`],
                ["当前科室", schedDept || "未选择"],
                ["预约日期", schedDate || "未选择"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "14px 0", borderBottom: "1px solid #eef3f5", fontSize: 12, color: "#78909c" }}>
                  <span>{label}</span>
                  <b style={{ fontWeight: 500, color: "#34555f" }}>{value}</b>
                </div>
              ))}
              <div style={{ fontSize: 12, color: "#54707a", lineHeight: 2.1, margin: "19px 0" }}>
                1. 点击左侧号源卡片，填写就诊信息提交预约。<br />
                2. 提交即锁定号源，余号实时扣减，先到先得。<br />
                3. 如需取消，请在「我的预约挂号」中操作，号源自动归还。<br />
                4. 就诊完成后，医生出具的诊断与处方将在「就诊记录」中同步可见。
              </div>
              <div style={{ fontSize: 11, color: "#91a5ae", lineHeight: 1.9, padding: "12px 15px", borderRadius: 10, background: "#edf3f4" }}>
                号源由管理员/医生在员工端排班放号，预约结果实时同步到接诊医生的工作台。
              </div>
            </div>
          </div>

          {/* 我的预约挂号 */}
          <div style={{ background: "#fff", border: "1px solid #e5eeef", borderRadius: 15, padding: 25, marginTop: 23 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
              <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>我的预约挂号 ({appts.length})</h2>
            </div>
            {appts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "#97a7b3", fontSize: 12 }}>暂无预约挂号记录</div>
            ) : (
              <Table rowKey="id" size="small" pagination={false} dataSource={appts} columns={apptColumns(true)} />
            )}
          </div>
        </>
      );
    }
    if (active === "records") {
      const doneCount = records.filter((r) => r.review_status === "已审核" || r.review_status === "已完成").length;
      return (
        <>
          {/* 页面标题 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#94aaa6", marginBottom: 8 }}>MEDICAL RECORDS</div>
              <h1 style={{ fontSize: 26, letterSpacing: -0.6, margin: 0, fontWeight: 600 }}>我的就诊记录</h1>
            </div>
            <span style={{ fontSize: 12, color: "#8497ab", lineHeight: 1.9 }}>仅展示虚构数据</span>
          </div>

          {/* 记录卡片列表 */}
          <div style={{ background: "#fff", border: "1px solid #e5eeef", borderRadius: 15, padding: 25 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
              <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>已归档记录</h2>
              <span style={{ padding: "5px 9px", borderRadius: 5, background: "#ecf7f2", fontSize: 10, color: "#59977d" }}>
                {doneCount} 份示例
              </span>
            </div>
            {records.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "#97a7b3", fontSize: 12 }}>
                暂无就诊记录（完成就诊后自动生成）
              </div>
            ) : (
              records.map((r) => (
                <div key={r.record_id} style={{ display: "flex", gap: 13, borderBottom: "1px solid #e5eeef", padding: "16px 0" }}>
                  <div style={{ color: "#87a9b4", background: "#eff6f8", padding: 11, borderRadius: 11, height: 44, display: "grid", placeItems: "center", fontSize: 18 }}></div>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 12, fontWeight: 550 }}>{r.department || "门诊"}</b>
                    <small style={{ display: "block", fontSize: 10, color: "#8fa1b2", lineHeight: 1.9, marginTop: 6 }}>
                      {r.visit_date ? new Date(r.visit_date).toLocaleDateString("zh-CN") : "-"} · {r.doctor_name || "-"}<br />
                      {r.diagnosis || r.symptoms?.slice(0, 30) || "-"} · 非真实诊疗结论
                    </small>
                  </div>
                  <button onClick={() => setRecordDetail(r)} style={{
                    padding: "8px 14px", border: "1px solid #e5eeef", background: "#fff", borderRadius: 8,
                    fontSize: 12, cursor: "pointer", alignSelf: "center",
                  }}>查看详情</button>
                </div>
              ))
            )}
          </div>

          <div style={{ fontSize: 11, color: "#91a5ae", lineHeight: 1.9, margin: "22px 0 0", padding: "15px 19px", borderRadius: 10, background: "#edf3f4" }}>
            正式系统只显示当前登录患者获准查看的记录。未发布的诊疗信息不应因页面入口变化而提前可见。
          </div>
        </>
      );
    }
    // 个人中心
    return (
      <div>
        {/* 顶部个人横幅 */}
        <div style={{
          background: "linear-gradient(120deg,#1f6f67 0%,#2a8a80 55%,#37a092 100%)",
          borderRadius: 18, padding: "30px 34px", color: "#fff", position: "relative", overflow: "hidden",
          marginBottom: 22,
        }}>
          <svg style={{ position: "absolute", right: 24, top: -10, width: 180, height: 180, opacity: 0.16 }} viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="70" fill="#fff" />
            <path d="M60 90h60M90 60v60" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative", zIndex: 1 }}>
            <Avatar size={72} style={{ background: "rgba(255,255,255,0.22)", color: "#fff", fontSize: 30, fontWeight: 600, border: "2px solid rgba(255,255,255,0.4)" }}>
              {me?.name?.[0] || "患"}
            </Avatar>
            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 650 }}>{me?.name || "患者"}</h2>
              <div style={{ fontSize: 12, opacity: 0.9, display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span>{me?.gender || "-"}</span>
                <span>{me?.phone || "-"}</span>
                <span style={{ padding: "2px 10px", background: "rgba(255,255,255,0.18)", borderRadius: 20 }}>{me?.status || "已注册"}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 26, marginTop: 24, position: "relative", zIndex: 1 }}>
            {[
              { label: "待就诊", value: appts.filter((a) => a.status === "待就诊" || a.status === "已报到").length },
              { label: "就诊记录", value: records.length },
              { label: "已完成", value: records.filter((r) => r.review_status === "已审核" || r.review_status === "已完成").length },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 24, fontWeight: 650, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 两栏主体 */}
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 20, alignItems: "start" }}>
          {/* 左栏：个人信息 + 账号信息 */}
          <Space direction="vertical" style={{ width: "100%" }} size={20}>
            <Card title="个人信息" style={{ borderRadius: 15 }}>
              <Form form={meForm} layout="vertical" onFinish={submitMe}>
                <Row gutter={16}>
                  <Col span={12}><Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}><Input placeholder="姓名" /></Form.Item></Col>
                  <Col span={12}><Form.Item name="gender" label="性别"><Select options={[{ value: "男", label: "男" }, { value: "女", label: "女" }, { value: "其他", label: "其他" }]} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}><Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }]}><Input placeholder="手机号" /></Form.Item></Col>
                  <Col span={12}><Form.Item name="birth_date" label="出生日期"><Input placeholder="如 1990-01-01" /></Form.Item></Col>
                </Row>
                <Form.Item name="address" label="住址"><Input placeholder="住址" /></Form.Item>
                <Form.Item name="medical_history" label="既往病史"><VoiceTextArea rows={3} placeholder="既往病史（选填，可语音输入）" /></Form.Item>
                <Button type="primary" htmlType="submit" loading={meSaving} style={{ borderRadius: 8 }}>保存个人信息</Button>
              </Form>
            </Card>

            <Card title="账号信息" style={{ borderRadius: 15 }}>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="证件类型">{me?.id_type || "-"}</Descriptions.Item>
                <Descriptions.Item label="证件号码">{me?.id_number || "-"}</Descriptions.Item>
                <Descriptions.Item label="户籍地">{me?.registered_place || "-"}</Descriptions.Item>
                <Descriptions.Item label="账号状态">{me?.status || "已注册"}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>

          {/* 右栏：修改密码 + 账号管理 */}
          <Space direction="vertical" style={{ width: "100%" }} size={20}>
            <Card title="修改密码" style={{ borderRadius: 15 }}>
              <Form form={pwdForm} layout="vertical" onFinish={submitPwd}>
                <Form.Item name="old_password" label="原密码" rules={[{ required: true, message: "请输入原密码" }]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="原密码" />
                </Form.Item>
                <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6, message: "至少 6 位" }]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="新密码（至少 6 位）" />
                </Form.Item>
                <Form.Item name="confirm" label="确认新密码" dependencies={["new_password"]}
                  rules={[{ required: true, message: "请再次输入新密码" }, ({ getFieldValue }) => ({
                    validator(_, value) { return !value || getFieldValue("new_password") === value ? Promise.resolve() : Promise.reject(new Error("两次密码不一致")); },
                  })]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={pwdSaving} style={{ borderRadius: 8 }}>修改密码</Button>
              </Form>
            </Card>

            <Card title="账号管理" style={{ borderRadius: 15, borderColor: "#ffe1e1" }}>
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                <Text type="secondary">注销后将永久删除您的账号、预约挂号与就诊记录，且不可恢复。</Text>
                <Popconfirm title="注销账号" description="确定注销当前账号吗？此操作不可恢复。" okText="确认注销" cancelText="取消" onConfirm={doDeleteAccount}>
                  <Button danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }}>注销账号</Button>
                </Popconfirm>
              </Space>
            </Card>
          </Space>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f8f8" }}>
      {/* 顶部导航 */}
      <div style={{ height: 86, background: "#fff", borderBottom: "1px solid #e5eeef", display: "flex", alignItems: "center", padding: "0 max(30px, calc((100vw - 1140px)/2))", gap: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }} onClick={() => setActive("home")}>
          <div style={{ width: 33, height: 35, background: "#27857d", borderRadius: 10, display: "grid", placeItems: "center", color: "#fff", fontSize: 27 }}>+</div>
          <div style={{ fontSize: 23, fontWeight: 650, color: "#243e59", lineHeight: 1 }}>
            MediCode 健康
            <div style={{ fontSize: 10, color: "#8da8a7", fontWeight: 400, letterSpacing: 1, marginTop: 3 }}>您的随身就医助手</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 26, marginLeft: 34, height: "100%", alignItems: "center", flex: 1 }}>
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setActive(n.key)} style={{ height: "100%", border: 0, background: "none", cursor: "pointer", fontSize: 13, color: active === n.key ? "#27857d" : "#819695", fontWeight: active === n.key ? 600 : 400, position: "relative" }}>
              {n.label}
              {active === n.key && <span style={{ position: "absolute", height: 3, background: "#27857d", left: 0, right: 0, bottom: 0, borderRadius: 4 }} />}
            </button>
          ))}
        </div>
        <Space size={14}>
          <Avatar size={38} style={{ background: "#e6f2ef", color: "#508d84", fontWeight: 600 }}>{me?.name?.[0] || "患"}</Avatar>
          <Text style={{ fontSize: 12, color: "#243e59" }}>{me?.name || "患者"}</Text>
          <Button type="text" size="small" icon={<LogoutOutlined />} onClick={logout} style={{ color: "#8b9eac" }}>退出</Button>
        </Space>
      </div>

      <div style={{ maxWidth: 1140, margin: "38px auto 0", padding: "0 20px 40px" }}>
        {renderContent()}
      </div>

      {/* 预约挂号下单 */}
      <Drawer title={booking ? openTitle(booking) : "预约挂号"} width={440} open={bookingOpen}
        onClose={() => setBookingOpen(false)} destroyOnHidden>
        {booking && (
          <Form form={bookForm} layout="vertical" onFinish={submitBooking}>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="医生">{booking.doctor_name || `#${booking.doctor_id}`}</Descriptions.Item>
              <Descriptions.Item label="科室">{booking.department || "-"}</Descriptions.Item>
              <Descriptions.Item label="时间">{booking.date} · {booking.time_slot}</Descriptions.Item>
              <Descriptions.Item label="费用">¥{booking.fee ?? 50}</Descriptions.Item>
            </Descriptions>
            <Form.Item name="patient_name" label="患者姓名" rules={[{ required: true }]}><Input placeholder="请输入姓名" /></Form.Item>
            <Form.Item name="phone" label="联系电话" rules={[{ required: true }]}><Input placeholder="请输入手机号" /></Form.Item>
            <Form.Item name="symptoms" label="症状描述"
              extra={<Button size="small" type="link" icon={<AudioOutlined />} style={{ padding: 0 }} onClick={toggleVoice}>
                {listening ? "停止语音输入" : "语音输入"}</Button>}>
              <Input.TextArea rows={3} placeholder="简述症状…（可语音输入）" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block>提交挂号</Button>
            <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
              提交后将从该号源扣除 1 个号；号源实时扣减，先到先得。
            </Text>
          </Form>
        )}
      </Drawer>

      {/* 就诊记录详情 */}
      <Drawer title={`就诊记录详情 #${recordDetail?.record_id ?? ""}`} width={520} open={!!recordDetail}
        onClose={() => setRecordDetail(null)}>
        {recordDetail && (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="医生">{recordDetail.doctor_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="就诊日期">{recordDetail.visit_date ? new Date(recordDetail.visit_date).toLocaleString("zh-CN") : "-"}</Descriptions.Item>
              <Descriptions.Item label="审核状态">{recordDetail.review_status || "待审核"}</Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: "4px 0" }} />
            <div><Text strong>主诉 / 症状</Text><Text type="secondary" style={{ display: "block", marginTop: 6, whiteSpace: "pre-wrap" }}>{recordDetail.symptoms || "-"}</Text></div>
            <div><Text strong>诊断</Text><Text type="secondary" style={{ display: "block", marginTop: 6, whiteSpace: "pre-wrap" }}>{recordDetail.diagnosis || "-"}</Text></div>
            <div><Text strong>处方</Text><Text type="secondary" style={{ display: "block", marginTop: 6, whiteSpace: "pre-wrap" }}>{recordDetail.prescription || "-"}</Text></div>
            {recordDetail.notes && <div><Text strong>医嘱 / 备注</Text><Text type="secondary" style={{ display: "block", marginTop: 6, whiteSpace: "pre-wrap" }}>{recordDetail.notes}</Text></div>}
            <Popconfirm title="删除就诊记录" description="删除后不可恢复，确定？" onConfirm={() => doDeleteRecord(recordDetail.record_id)}>
              <Button danger icon={<DeleteOutlined />}>删除该记录</Button>
            </Popconfirm>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
