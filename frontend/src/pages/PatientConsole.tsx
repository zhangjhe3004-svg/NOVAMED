/**
 * 患者工作台 —— 对齐 docs/设计预览/patient.html 的青绿色「NOVAMED 健康」设计
 * 顶部导航：首页 / 预约挂号 / 就诊记录 / 个人中心
 * 功能：号源预约（扣号）、取消挂号（归还号源）、就诊记录详情、个人信息/账号编辑、修改密码。
 */
import { useEffect, useRef, useState } from "react";
import {
  Card, Form, Input, Button, Select, Table, Space, Tag, Typography, message,
  Descriptions, Avatar, Row, Col, DatePicker, Empty, Divider, Popconfirm,
  Badge, Modal, Timeline, Dropdown,
} from "antd";
import {
  CalendarOutlined, FileTextOutlined, ProfileOutlined,
  FormOutlined, MedicineBoxOutlined, FileSearchOutlined,
  RobotOutlined, ClusterOutlined, VideoCameraOutlined, CommentOutlined,
  TeamOutlined, ExperimentOutlined, AudioOutlined, LockOutlined, ReloadOutlined,
  HomeOutlined, LogoutOutlined, EyeOutlined, CloseCircleOutlined, DeleteOutlined,
  BellOutlined, NotificationOutlined, PlusOutlined, EditOutlined, DownOutlined,
} from "@ant-design/icons";
import {
  getPatientMe, getPatientAppointments, getPatientRecords, updatePatientMe,
  changePatientPassword, cancelPatientAppointment, deletePatientRecord, deleteMyPatientAccount,
  getPatientLabTests, getPatientLabTestDetail,
  getPatientNotifications, markPatientNotificationRead, markAllPatientNotificationsRead,
  getFamilyHistory, createFamilyHistory, updateFamilyHistory, deleteFamilyHistory,
  getPatientOverview,
} from "../api/patientAuth";
import type {
  PatientRecord, PatientAppointment, PatientLabTest, PatientNotificationItem,
  FamilyHistoryItem, PatientOverview,
} from "../api/patientAuth";
import { KpiTile } from "../components/instruments";
import { createAppointment } from "../api/appointment";
import { listPublicSchedules, listPublicDepartments } from "../api/schedule";
import type { DoctorScheduleItem, DepartmentItem } from "../api/schedule";
import VoiceTextArea from "../components/VoiceTextArea";
import BrandSparkle from "../components/BrandSparkle";
import { useNavigate } from "react-router-dom";

const { Text, Title } = Typography;

const NAV = [
  { key: "home", label: "总览控制台", icon: <HomeOutlined /> },
  { key: "booking", label: "预约挂号", icon: <CalendarOutlined /> },
  { key: "records", label: "就诊记录", icon: <FileTextOutlined /> },
  { key: "reports", label: "报告查询", icon: <FileSearchOutlined /> },
  { key: "me", label: "个人中心", icon: <ProfileOutlined /> },
];

// 侧栏分组（参考员工端 MainLayout 分组折叠样式，配色保持患者端薄荷青）
const NAV_GROUPS = [
  { short: "ws", label: "WORKSPACE / 患者空间", keys: ["home", "booking"] },
  { short: "cl", label: "CLINICAL / 就诊档案", keys: ["records", "reports"] },
  { short: "pf", label: "PROFILE / 个人服务", keys: ["me"] },
];

// 首页「快捷服务」四宫格
const shortcuts = [
  { icon: <CalendarOutlined />, name: "预约挂号", desc: "在线预约门诊号源", color: "#5fd0b4", go: "booking" },
  { icon: <FileTextOutlined />, name: "就诊记录", desc: "查看历史就诊档案", color: "#8aa7dd", go: "records" },
  { icon: <FileSearchOutlined />, name: "报告查询", desc: "查看检查检验报告", color: "#8aa7dd", go: "reports" },
  { icon: <ProfileOutlined />, name: "个人中心", desc: "管理档案与账号", color: "#e0857a", go: "me" },
];


const statusColor: Record<string, string> = { 待就诊: "blue", 已报到: "orange", 已完成: "green", 已取消: "default" };
const labStatusColor: Record<string, string> = { 待检查: "default", 已采样: "cyan", 检查中: "processing", 已出报告: "success", 已取消: "default" };

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
  // 分组折叠：默认只展开当前所在分组，点击标题手动开合（可多开）
  const [openGroups, setOpenGroups] = useState<string[]>(["ws"]);

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

  // 报告 / 通知 / 家族病史 / 概览
  const [labs, setLabs] = useState<PatientLabTest[]>([]);
  const [labDetail, setLabDetail] = useState<PatientLabTest | null>(null);
  const [notifs, setNotifs] = useState<PatientNotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [overview, setOverview] = useState<PatientOverview | null>(null);
  const [family, setFamily] = useState<FamilyHistoryItem[]>([]);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [familyEditing, setFamilyEditing] = useState<FamilyHistoryItem | null>(null);
  const [familySaving, setFamilySaving] = useState(false);
  const [familyForm] = Form.useForm();

  const [meSaving, setMeSaving] = useState(false);
  const [meForm] = Form.useForm();
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdForm] = Form.useForm();

  const load = async () => {
    try {
      const m = await getPatientMe(); setMe(m);
      const a = await getPatientAppointments(); setAppts(a.items || []);
      const r = await getPatientRecords(); setRecords(r.items || []);
      const l = await getPatientLabTests(); setLabs(l.items || []);
      const n = await getPatientNotifications(); setNotifs(n.items || []); setUnread(n.unread || 0);
      const o = await getPatientOverview(); setOverview(o);
      const f = await getFamilyHistory(); setFamily(f.items || []);
    } catch { /* 令牌失效 */ }
  };
  useEffect(() => { load(); }, []);

  // 路由切换时自动展开目标分组（不收起其他已展开分组）
  useEffect(() => {
    const g = NAV_GROUPS.find((x) => x.keys.includes(active));
    if (g) setOpenGroups((s) => (s.includes(g.short) ? s : [...s, g.short]));
  }, [active]);

  // 个人信息表单值在「个人中心」tab 真正挂载后再写入（未挂载时 setFieldsValue 会触发
  // useForm not connected 告警——对齐 RoleTrace 的 destroyOnHidden 表单处理模式）
  useEffect(() => {
    if (active !== "me" || !me) return;
    meForm.setFieldsValue({
      name: me?.name, gender: me?.gender, phone: me?.phone,
      address: me?.address, birth_date: me?.birth_date,
      medical_history: me?.medical_history, registered_place: me?.registered_place,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, me]);

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

  // ── 报告 / 通知 / 家族病史 处理 ──
  const openNotifs = async () => {
    setNotifOpen(true);
    try {
      const n = await getPatientNotifications(); setNotifs(n.items || []); setUnread(n.unread || 0);
    } catch { /* 忽略 */ }
  };

  const markRead = async (id: number) => {
    try {
      await markPatientNotificationRead(id);
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch { /* 忽略 */ }
  };

  const markAllRead = async () => {
    try {
      await markAllPatientNotificationsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
      message.success("已全部标记为已读");
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "操作失败");
    }
  };

  const openLabDetail = async (t: PatientLabTest) => {
    try {
      const d = await getPatientLabTestDetail(t.id);
      setLabDetail(d);
    } catch { setLabDetail(t); }
  };

  const reloadFamily = async () => {
    const f = await getFamilyHistory(); setFamily(f.items || []);
  };

  const openFamily = (item?: FamilyHistoryItem) => {
    setFamilyEditing(item || null);
    setFamilyOpen(true);
  };

  // 家族病史表单值在 Modal 真正挂载后再写入（destroyOnHidden 模式下提前 setFieldsValue
  // 会触发「useForm not connected」告警，对齐 RoleTrace 的表单时序处理）
  useEffect(() => {
    if (!familyOpen) return;
    if (familyEditing) {
      familyForm.setFieldsValue({ relation: familyEditing.relation, disease: familyEditing.disease, onset_age: familyEditing.onset_age, note: familyEditing.note });
    } else {
      familyForm.resetFields();
      familyForm.setFieldsValue({ relation: "", disease: "", onset_age: "", note: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyOpen, familyEditing, familyForm]);

  const submitFamily = async (v: any) => {
    setFamilySaving(true);
    try {
      if (familyEditing) {
        await updateFamilyHistory(familyEditing.id, v);
        message.success("已更新家族病史");
      } else {
        await createFamilyHistory(v);
        message.success("已添加家族病史");
      }
      setFamilyOpen(false);
      familyForm.resetFields();
      await reloadFamily();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "保存失败");
    } finally { setFamilySaving(false); }
  };

  const removeFamily = async (id: number) => {
    try {
      await deleteFamilyHistory(id);
      message.success("已删除");
      await reloadFamily();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "删除失败");
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
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#a5bab5", marginBottom: 8 }}>YOUR HEALTH SPACE</div>
              <h1 style={{ fontSize: 26, letterSpacing: -0.6, margin: 0, fontWeight: 600 }}>您好，{me?.name || "患者"}</h1>
            </div>
            <span style={{ fontSize: 12, color: "#a5bab5", lineHeight: 1.9 }}>今天也照顾好自己</span>
          </div>

          {/* 仪器化指标卡（复用员工端 KpiTile 读数体系，配色走青绿覆盖） */}
          <div className="kpi-grid" style={{ marginBottom: 22 }}>
            <KpiTile
              title="待就诊"
              value={overview?.upcoming ?? upcoming.length}
              icon={<CalendarOutlined />}
              cat={1}
              foot="预约后待就诊"
              onPick={() => setActive("booking")}
            />
            <KpiTile
              title="就诊记录"
              value={overview?.record_count ?? records.length}
              icon={<FileTextOutlined />}
              cat={2}
              foot="累计就诊档案"
              onPick={() => setActive("records")}
            />
            <KpiTile
              title="已完成"
              value={overview?.done_count ?? doneCount}
              icon={<ProfileOutlined />}
              cat={3}
              foot="已审核完成"
              onPick={() => setActive("records")}
            />
            <KpiTile
              title="检验报告"
              value={overview?.lab_count ?? labs.length}
              icon={<ExperimentOutlined />}
              cat={4}
              foot={`已出 ${overview?.lab_done ?? labs.filter((t) => t.status === "已出报告").length} 份报告`}
              onPick={() => setActive("reports")}
            />
          </div>

          {/* 欢迎区 + 健康提示 */}
          <div style={{ display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 23, marginBottom: 25 }}>
            <div className="panel" style={{ background: "linear-gradient(135deg, rgba(95,208,180,0.20), rgba(95,208,180,0.12))", borderRadius: 18, padding: "30px 35px", position: "relative", overflow: "hidden", minHeight: 200 }}>
              <h2 style={{ fontSize: 27, lineHeight: 1.6, margin: "0 0 10px", fontWeight: 550, color: "#e6f0ed", position: "relative", zIndex: 1 }}>
                让就医更简单，<br />让关怀更贴近。
              </h2>
              <p style={{ fontSize: 12, color: "#9ab0ab", lineHeight: 1.9, position: "relative", zIndex: 1 }}>
                您的预约与就诊信息，随时清晰可见。
              </p>
              <svg style={{ position: "absolute", width: 178, height: 166, right: 18, top: 25, opacity: 0.75 }} viewBox="0 0 180 180" aria-hidden="true">
                <circle cx="97" cy="89" r="69" fill="rgba(95,208,180,0.20)" />
                <rect x="39" y="40" width="99" height="109" rx="14" fill="rgba(169,216,204,0.28)" transform="rotate(-10 89 95)" />
                <path d="M89 59v48 M65 83h48" stroke="#5fd0b4" strokeWidth="13" strokeLinecap="round" />
                <path d="M64 125h52" stroke="rgba(169,216,204,0.24)" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="panel" style={{ background: "rgba(30,43,41,0.9)", border: "1px solid rgba(169,216,204,0.18)", borderRadius: 18, padding: "27px 25px" }}>
              <h3 style={{ fontSize: 15, margin: "0 0 13px", fontWeight: 600 }}>就诊前，准备好这三件事</h3>
              <p style={{ fontSize: 12, color: "#a5bab5", lineHeight: 2, margin: 0 }}>
                01 携带有效证件<br />
                02 带上既往检查和用药资料<br />
                03 提前确认时间与诊区位置
              </p>
            </div>
          </div>

          {/* 快捷服务 4 按钮 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, marginBottom: 28 }}>
            {shortcuts.map((s) => (
              <button key={s.name} onClick={() => setActive(s.go)} className="md-clickable" style={{
                display: "flex", alignItems: "center", gap: 14, padding: "23px 20px",
                background: "rgba(30,43,41,0.9)", border: "1px solid rgba(169,216,204,0.18)", borderRadius: 13,
                cursor: "pointer", textAlign: "left", transition: "border-color .15s",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#5fd0b4")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(169,216,204,0.18)")}>
                <span style={{
                  width: 42, height: 44, display: "grid", placeItems: "center",
                  borderRadius: 12, background: s.color + "1a", color: s.color, fontSize: 20,
                }}>{s.icon}</span>
                <div>
                  <b style={{ fontSize: 13, fontWeight: 550, color: "#e6f0ed" }}>{s.name}</b>
                  <small style={{ display: "block", fontSize: 10, color: "#7d9791", marginTop: 5 }}>{s.desc}</small>
                </div>
              </button>
            ))}
          </div>

          {/* 主内容区：我的预约 + 最近就诊 */}
          <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 23 }}>
            {/* 我的预约 */}
            <div className="panel" style={{ background: "rgba(30,43,41,0.9)", border: "1px solid rgba(169,216,204,0.18)", borderRadius: 15, padding: 25, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
                <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>我的预约</h2>
                <span style={{
                  padding: "5px 9px", borderRadius: 5, fontSize: 10,
                  background: nextAppt?.status === "已报到" ? "rgba(95,208,180,0.16)" : "rgba(251,191,36,0.12)",
                  color: nextAppt?.status === "已报到" ? "#5fd0b4" : "#8a6a22",
                }}>{!nextAppt ? "无预约" : nextAppt.status === "已报到" ? "已报到" : "待就诊"}</span>
              </div>
              {nextAppt ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    <div style={{
                      borderRadius: 12, width: 49, height: 52, display: "grid", placeItems: "center",
                      background: "rgba(95,208,180,0.16)", color: "#5fd0b4", fontWeight: 500, fontSize: 18,
                    }}>{nextAppt.doctor_name?.[0] || "医"}</div>
                    <div>
                      <b style={{ fontSize: 15 }}>{nextAppt.doctor_name || `医生#${nextAppt.doctor_id}`}
                        <span style={{ fontSize: 10, color: "#a5bab5", fontWeight: 400, marginLeft: 6 }}>主治医师</span>
                      </b>
                      <small style={{ fontSize: 11, color: "#a5bab5", display: "block", marginTop: 7 }}>
                        {nextAppt.department || "-"} · 普通门诊
                      </small>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 11, margin: "21px 0", padding: "19px 0", borderTop: "1px dashed rgba(169,216,204,0.18)", borderBottom: "1px dashed rgba(169,216,204,0.18)", fontSize: 12, color: "#7d9791" }}>
                    <span>📅 {nextAppt.date || ""} {nextAppt.time_slot || ""}</span>
                    <span>🏥 门诊楼 2 层 · {nextAppt.department || "诊区"}</span>
                    <span>👤 就诊人：{me?.name || "患者"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setActive("booking")} className="md-clickable" style={{
                      flex: 1, padding: "11px 16px", border: "1px solid rgba(169,216,204,0.18)", background: "#243330",
                      borderRadius: 8, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 42,
                    }}>重新选择时段</button>
                    <button onClick={() => setActive("booking")} className="md-clickable" style={{
                      flex: 1, padding: "11px 16px", border: "none", background: "#5fd0b4", color: "#ffffff",
                      borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 42,
                    }}>查看报到指引 →</button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: 30, color: "#7d9791" }}>
                  暂无待就诊挂号，可前往预约挂号
                </div>
              )}
            </div>

            {/* 最近就诊 */}
            <div className="panel" style={{ background: "rgba(30,43,41,0.9)", border: "1px solid rgba(169,216,204,0.18)", borderRadius: 15, padding: 25, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
                <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>最近就诊</h2>
                <button onClick={() => setActive("records")} className="md-clickable" style={{ color: "#5fd0b4", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>全部记录 →</button>
              </div>
              {records.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "#7d9791", fontSize: 12 }}>暂无就诊记录</div>
              ) : (
                records.slice(0, 3).map((r) => (
                  <div key={r.record_id} className="list-item" style={{ display: "flex", gap: 13, borderBottom: "1px solid rgba(169,216,204,0.18)", padding: "16px 0" }}>
                    <div style={{ color: "#7d9791", background: "rgba(95,208,180,0.14)", padding: 11, borderRadius: 11, height: 44, display: "grid", placeItems: "center", fontSize: 18 }}></div>
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: 12, fontWeight: 550 }}>{r.department || "门诊"}</b>
                      <small style={{ display: "block", fontSize: 10, color: "#a5bab5", lineHeight: 1.9, marginTop: 6 }}>
                        {r.doctor_name || "-"} · {r.diagnosis || r.symptoms?.slice(0, 20) || "-"}<br />
                        <span style={{ background: "rgba(95,208,180,0.18)", color: "#5fd0b4", padding: "2px 6px", borderRadius: 4, fontSize: 9 }}>{r.review_status || "待审核"}</span>
                      </small>
                    </div>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#7d9791", alignSelf: "center" }}>
                      {r.visit_date ? new Date(r.visit_date).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) : "-"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 温馨提示 */}
          <div style={{ fontSize: 11, lineHeight: 1.9, color: "#7d9791", margin: "22px 0 0", padding: "15px 19px", borderRadius: 10, background: "rgba(95,208,180,0.14)" }}>
            温馨提示：请以实际医院和医生的安排为准，提前确认时间与诊区位置。
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
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#a5bab5", marginBottom: 8 }}>APPOINTMENT</div>
              <h1 style={{ fontSize: 26, letterSpacing: -0.6, margin: 0, fontWeight: 600 }}>预约挂号</h1>
            </div>
            <span style={{ fontSize: 12, color: "#a5bab5", lineHeight: 1.9 }}>选择科室与号源，下单即锁定号源</span>
          </div>

          {/* 主体：选择号源 + 预约须知 */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 23 }}>
            {/* 左侧：选择就诊时段 */}
            <div className="panel" style={{ background: "rgba(30,43,41,0.9)", border: "1px solid rgba(169,216,204,0.18)", borderRadius: 15, padding: 25, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
                <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>选择就诊时段</h2>
                <span style={{ padding: "5px 9px", borderRadius: 5, background: "rgba(95,208,180,0.18)", fontSize: 10, color: "#5fd0b4" }}>
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
                        <button key={d.department} onClick={() => { setSchedDept(sel ? "" : d.department); setSchedDate(""); }} className="md-clickable" style={{
                          padding: "10px 18px", borderRadius: 9, border: sel ? "2px solid #5fd0b4" : "1px solid rgba(169,216,204,0.18)",
                          background: sel ? "rgba(95,208,180,0.16)" : "#243330", color: sel ? "#5fd0b4" : "#a5bab5",
                          fontWeight: sel ? 600 : 400, fontSize: 12, cursor: "pointer", transition: "all .15s",
                        }}>
                          {d.department}
                          <small style={{ display: "block", fontSize: 10, fontWeight: 400, color: "#7d9791", marginTop: 2 }}>
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
                        <button key={dateStr} onClick={() => setSchedDate(dateStr)} className="md-clickable" style={{
                          border: isSelected ? "1px solid #5fd0b4" : "1px solid rgba(169,216,204,0.18)",
                          borderRadius: 9, padding: "15px 5px", fontSize: 12, lineHeight: 1.9,
                          background: isSelected ? "rgba(95,208,180,0.18)" : "#243330", color: isSelected ? "#5fd0b4" : "#e6f0ed",
                          cursor: "pointer",
                        }}>
                          {dayNames[d.getDay()]}
                          <br />
                          {`${d.getMonth() + 1}/${d.getDate()}`}
                          <small style={{ display: "block", fontSize: 10, color: remain > 0 ? "#5fd0b4" : "#a5bab5" }}>
                            {remain > 0 ? `余 ${remain} 号` : "无号"}
                          </small>
                        </button>
                      );
                    })}
                  </div>

                  {/* 真实号源列表：医生 × 时段 × 余号 */}
                  <h3 style={{ fontSize: 12, fontWeight: 500, margin: "16px 0 10px" }}>可约号源</h3>
                  {schedDate && filteredSchedules.filter((s) => s.date === schedDate).length === 0 ? (
                    <div style={{ textAlign: "center", padding: 24, color: "#7d9791", fontSize: 12, background: "#243330", borderRadius: 9 }}>
                      该日期暂无号源，请选择其他日期
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 24 }}>
                      {filteredSchedules
                        .filter((s) => s.date === schedDate)
                        .map((s) => {
                          const full = (s.remaining || 0) <= 0;
                          return (
                            <button key={s.id} disabled={full} onClick={() => openBooking(s)} className="md-clickable" style={{
                              padding: "13px 14px", border: full ? "1px solid #243330" : "1px solid rgba(169,216,204,0.28)",
                              borderRadius: 10, textAlign: "left", cursor: full ? "not-allowed" : "pointer",
                              background: full ? "#1e2b29" : "#243330", transition: "border-color .15s",
                              opacity: full ? 0.65 : 1,
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <b style={{ fontSize: 13, color: full ? "#a5bab5" : "#e6f0ed" }}>
                                  {s.doctor_name || `医生#${s.doctor_id}`}
                                </b>
                                <span style={{
                                  fontSize: 10, padding: "2px 8px", borderRadius: 4,
                                  background: full ? "#1e2b29" : "rgba(95,208,180,0.18)", color: full ? "#7d9791" : "#5fd0b4",
                                }}>{full ? "已约满" : `余 ${s.remaining}`}</span>
                              </div>
                              <small style={{ display: "block", fontSize: 11, color: "#a5bab5", marginTop: 7 }}>
                                {s.time_slot} · {s.fee ? `¥${(s.fee / 100).toFixed(2)}` : "挂号费待定"}
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
            <div className="panel" style={{ background: "rgba(30,43,41,0.9)", border: "1px solid rgba(169,216,204,0.18)", borderRadius: 15, padding: 25, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
                <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>预约须知</h2>
              </div>
              {[
                ["就诊人", `${me?.name || "患者"}（${me?.gender || "-"}）`],
                ["当前科室", schedDept || "未选择"],
                ["预约日期", schedDate || "未选择"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "14px 0", borderBottom: "1px solid rgba(95,208,180,0.16)", fontSize: 12, color: "#a5bab5" }}>
                  <span>{label}</span>
                  <b style={{ fontWeight: 500, color: "#e6f0ed" }}>{value}</b>
                </div>
              ))}
              <div style={{ fontSize: 12, color: "#9ab0ab", lineHeight: 2.1, margin: "19px 0" }}>
                1. 点击左侧号源卡片，填写就诊信息提交预约。<br />
                2. 提交即锁定号源，余号实时扣减，先到先得。<br />
                3. 如需取消，请在「我的预约挂号」中操作，号源自动归还。<br />
                4. 就诊完成后，医生出具的诊断与处方将在「就诊记录」中同步可见。
              </div>
              <div style={{ fontSize: 11, color: "#7d9791", lineHeight: 1.9, padding: "12px 15px", borderRadius: 10, background: "rgba(95,208,180,0.14)" }}>
                号源由管理员/医生在客户端排班放号，预约结果实时同步到接诊医生的工作台。
              </div>
            </div>
          </div>

          {/* 我的预约挂号 */}
          <div className="panel" style={{ background: "rgba(30,43,41,0.9)", border: "1px solid rgba(169,216,204,0.18)", borderRadius: 15, padding: 25, marginTop: 23 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
              <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>我的预约挂号 ({appts.length})</h2>
            </div>
            {appts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "#7d9791", fontSize: 12 }}>暂无预约挂号记录</div>
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
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#a5bab5", marginBottom: 8 }}>MEDICAL RECORDS</div>
              <h1 style={{ fontSize: 26, letterSpacing: -0.6, margin: 0, fontWeight: 600 }}>我的就诊记录</h1>
            </div>
            <span style={{ fontSize: 12, color: "#a5bab5", lineHeight: 1.9 }}>仅展示虚构数据</span>
          </div>

          {/* 记录卡片列表 */}
          <div className="panel" style={{ background: "rgba(30,43,41,0.9)", border: "1px solid rgba(169,216,204,0.18)", borderRadius: 15, padding: 25 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
              <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>已归档记录</h2>
              <span style={{ padding: "5px 9px", borderRadius: 5, background: "rgba(95,208,180,0.18)", fontSize: 10, color: "#5fd0b4" }}>
                {doneCount} 份示例
              </span>
            </div>
            {records.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "#7d9791", fontSize: 12 }}>
                暂无就诊记录（完成就诊后自动生成）
              </div>
            ) : (
              records.map((r) => (
                <div key={r.record_id} className="list-item" style={{ display: "flex", gap: 13, borderBottom: "1px solid rgba(169,216,204,0.18)", padding: "16px 0" }}>
                  <div style={{ color: "#7d9791", background: "rgba(95,208,180,0.14)", padding: 11, borderRadius: 11, height: 44, display: "grid", placeItems: "center", fontSize: 18 }}></div>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 12, fontWeight: 550 }}>{r.department || "门诊"}</b>
                    <small style={{ display: "block", fontSize: 10, color: "#a5bab5", lineHeight: 1.9, marginTop: 6 }}>
                      {r.visit_date ? new Date(r.visit_date).toLocaleDateString("zh-CN") : "-"} · {r.doctor_name || "-"}<br />
                      {r.diagnosis || r.symptoms?.slice(0, 30) || "-"} · 非真实诊疗结论
                    </small>
                  </div>
                  <button onClick={() => setRecordDetail(r)} className="md-clickable" style={{
                    padding: "8px 14px", border: "1px solid rgba(169,216,204,0.18)", background: "#243330", borderRadius: 8,
                    fontSize: 12, cursor: "pointer", alignSelf: "center",
                  }}>查看详情</button>
                </div>
              ))
            )}
          </div>

          <div style={{ fontSize: 11, color: "#7d9791", lineHeight: 1.9, margin: "22px 0 0", padding: "15px 19px", borderRadius: 10, background: "rgba(95,208,180,0.14)" }}>
            正式系统只显示当前登录患者获准查看的记录。未发布的诊疗信息不应因页面入口变化而提前可见。
          </div>
        </>
      );
    }
    if (active === "reports") {
      const done = labs.filter((t) => t.status === "已出报告").length;
      return (
        <>
          {/* 页面标题 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#a5bab5", marginBottom: 8 }}>LAB REPORTS</div>
              <h1 style={{ fontSize: 26, letterSpacing: -0.6, margin: 0, fontWeight: 600 }}>报告查询</h1>
            </div>
            <span style={{ fontSize: 12, color: "#a5bab5", lineHeight: 1.9 }}>检查检验报告，随时可查</span>
          </div>

          {/* 汇总条 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 15, marginBottom: 22 }}>
            {[
              { label: "报告总数", value: labs.length },
              { label: "已出报告", value: done },
              { label: "待出报告", value: labs.length - done },
            ].map((s) => (
              <div key={s.label} className="panel" style={{ background: "rgba(30,43,41,0.9)", border: "1px solid rgba(169,216,204,0.18)", borderRadius: 14, padding: "20px 22px" }}>
                <div style={{ fontSize: 11, color: "#a5bab5" }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 650, color: "#5fd0b4", marginTop: 6 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* 报告列表 */}
          <div className="panel" style={{ background: "rgba(30,43,41,0.9)", border: "1px solid rgba(169,216,204,0.18)", borderRadius: 15, padding: 25 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 21 }}>
              <h2 style={{ fontSize: 16, margin: 0, fontWeight: 650 }}>检验 / 检查报告</h2>
            </div>
            {labs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "#7d9791", fontSize: 12 }}>
                暂无报告（医生开单后自动同步）
              </div>
            ) : (
              labs.map((t) => (
                <div key={t.id} className="list-item" style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid rgba(169,216,204,0.18)", padding: "16px 0" }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 11, display: "grid", placeItems: "center",
                    background: "rgba(95,208,180,0.16)", color: "#5fd0b4", fontSize: 18, flexShrink: 0,
                  }}><ExperimentOutlined /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 13, fontWeight: 550 }}>{t.item_name}</b>
                    <small style={{ display: "block", fontSize: 10, color: "#a5bab5", lineHeight: 1.9, marginTop: 5 }}>
                      {t.test_no} · {t.category} · {t.department || "门诊部"}
                    </small>
                  </div>
                  <Tag color={labStatusColor[t.status] || "default"} style={{ borderRadius: 6, marginRight: 0 }}>{t.status}</Tag>
                  <button onClick={() => openLabDetail(t)} className="md-clickable" style={{
                    padding: "8px 14px", border: "1px solid rgba(169,216,204,0.28)", background: "rgba(95,208,180,0.14)", borderRadius: 8,
                    fontSize: 12, cursor: "pointer", color: "#7fe0c8", fontWeight: 550,
                  }}>查看报告</button>
                </div>
              ))
            )}
          </div>

          <div style={{ fontSize: 11, color: "#7d9791", lineHeight: 1.9, margin: "22px 0 0", padding: "15px 19px", borderRadius: 10, background: "rgba(95,208,180,0.14)" }}>
            报告由医生 / 检验科出具，出报告后自动同步到您的档案。
          </div>
        </>
      );
    }
    // 个人中心
    return (
      <div>
        {/* 顶部个人横幅 */}
        <div style={{
          background: "linear-gradient(120deg, rgba(95,208,180,0.28) 0%, rgba(95,208,180,0.18) 55%, rgba(138,167,221,0.22) 100%)",
          borderRadius: 18, padding: "30px 34px", color: "#ffffff", position: "relative", overflow: "hidden",
          marginBottom: 22,
        }}>
          <svg style={{ position: "absolute", right: 24, top: -10, width: 180, height: 180, opacity: 0.16 }} viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="70" fill="#fff" />
            <path d="M60 90h60M90 60v60" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative", zIndex: 1 }}>
            <Avatar size={72} style={{ background: "rgba(95,208,180,0.18)", color: "#ffffff", fontSize: 30, fontWeight: 600, border: "2px solid rgba(255,255,255,0.9)" }}>
              {me?.name?.[0] || "患"}
            </Avatar>
            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 650 }}>{me?.name || "患者"}</h2>
              <div style={{ fontSize: 12, opacity: 0.9, display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span>{me?.gender || "-"}</span>
                <span>{me?.phone || "-"}</span>
                <span style={{ padding: "2px 10px", background: "rgba(95,208,180,0.16)", borderRadius: 20 }}>{me?.status || "已注册"}</span>
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

            <Card
              title="家族病史"
              style={{ borderRadius: 15 }}
              extra={<Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openFamily()}>新增</Button>}
            >
              {family.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "#7d9791", fontSize: 12 }}>
                  暂无家族病史记录，可点击右上角「新增」补充
                </div>
              ) : (
                <Space direction="vertical" style={{ width: "100%" }} size={10}>
                  {family.map((f) => (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid rgba(169,216,204,0.18)", borderRadius: 10, background: "#243330" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(95,208,180,0.16)", color: "#5fd0b4", display: "grid", placeItems: "center", flexShrink: 0, fontWeight: 600 }}>
                        {f.relation?.[0] || "亲"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: 12, fontWeight: 550 }}>{f.relation}{f.onset_age ? `（${f.onset_age}）` : ""}</b>
                        <div style={{ fontSize: 11, color: "#a5bab5", marginTop: 3 }}>{f.disease}</div>
                        {f.note && <div style={{ fontSize: 10, color: "#6b827d", marginTop: 3 }}>{f.note}</div>}
                      </div>
                      <Space size={4}>
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openFamily(f)} />
                        <Popconfirm title="删除该条家族病史？" onConfirm={() => removeFamily(f.id)}>
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    </div>
                  ))}
                </Space>
              )}
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

            <Card title="账号管理" style={{ borderRadius: 15, borderColor: "rgba(248,113,113,0.4)" }}>
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
    <div className="patient-app" style={{ minHeight: "100vh", background: "#16201f", color: "#e6f0ed", display: "flex" }}>
      {/* 左侧边栏（参考员工端：品牌区 + 快速跳转 + 分组折叠导航；退出登录在右上角用户胶囊） */}
      <aside style={{
        width: 240, flexShrink: 0, height: "100vh", position: "sticky", top: 0,
        background: "rgba(30,43,41,0.92)", borderRight: "1px solid rgba(169,216,204,0.10)",
        display: "flex", flexDirection: "column", padding: "22px 14px 16px",
      }}>
        {/* 品牌徽章胶囊：深青底 + 星核 + 字标 + 副标 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "stretch", cursor: "pointer" }} onClick={() => setActive("home")}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 12,
            background: "linear-gradient(135deg, #0e2a26 0%, #163833 100%)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(95,208,180,0.14)",
          }}>
            <BrandSparkle size={26} on="dark" />
            <div style={{ fontSize: 19, fontWeight: 800, color: "#ffffff", letterSpacing: 1, lineHeight: 1 }}>NOVAMED</div>
          </div>
          <small style={{ display: "block", fontSize: 10, letterSpacing: 2.6, color: "#7d9791", fontWeight: 600, marginLeft: 4 }}>
            NOVA MEDICAL
          </small>
        </div>

        {/* 快速跳转下拉（参考员工端，显示当前所在页面） */}
        <div style={{ padding: "10px 0 10px" }}>
          <Select
            showSearch
            value={active}
            style={{ width: "100%" }}
            optionFilterProp="label"
            popupMatchSelectWidth={false}
            popupClassName="patient-select-drop"
            onChange={(val: string) => setActive(val)}
            options={NAV_GROUPS.map((g) => ({
              label: g.label,
              options: NAV.filter((n) => g.keys.includes(n.key)).map((n) => ({ value: n.key, label: n.label })),
            }))}
          />
        </div>

        {/* 导航：分组标题可折叠，默认只展开当前分组 */}
        <nav style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 0 16px", marginTop: 4 }}>
          {NAV_GROUPS.map((g) => {
            const activeInGroup = g.keys.includes(active);
            const open = activeInGroup || openGroups.includes(g.short);
            return (
              <div key={g.short}>
                <button
                  type="button"
                  aria-expanded={open}
                  title={open ? "收起分组" : "展开分组"}
                  onClick={() => setOpenGroups((s) => s.includes(g.short) ? s.filter((x) => x !== g.short) : [...s, g.short])}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    width: "calc(100% - 28px)", margin: "16px 14px 8px", padding: 0,
                    fontSize: 11, letterSpacing: 0.6, color: "rgba(230,240,237,0.72)",
                    fontWeight: 600, background: "transparent", border: 0,
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  }}
                >
                  <span>{g.label}</span>
                  <DownOutlined style={{
                    fontSize: 8, color: "rgba(230,240,237,0.5)",
                    transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 0.3s ease",
                  }} />
                </button>
                <div className="md-nav-group-body" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                  <div>
                    {NAV.filter((n) => g.keys.includes(n.key)).map((n) => {
                      const sel = active === n.key;
                      return (
                        <button key={n.key} onClick={() => setActive(n.key)} className="md-clickable" style={{
                          display: "flex", alignItems: "center", textAlign: "left", gap: 12,
                          width: "100%", border: 0, cursor: "pointer", borderRadius: 9, padding: "10px 15px",
                          margin: "2px 0", fontSize: 13, fontWeight: sel ? 600 : 400,
                          color: sel ? "#5fd0b4" : "#a5bab5",
                          background: sel ? "rgba(95,208,180,0.14)" : "transparent",
                          position: "relative", transition: "background 0.2s ease, color 0.2s ease",
                        }}
                          onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "rgba(95,208,180,0.07)"; }}
                          onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}
                        >
                          {sel && <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3, background: "#5fd0b4" }} />}
                          <span style={{ display: "inline-flex", fontSize: 17 }}>{n.icon}</span>
                          <span style={{ flex: 1 }}>{n.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* 右侧：顶栏（通知）+ 内容区 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ height: 64, flexShrink: 0, background: "rgba(30,43,41,0.7)", borderBottom: "1px solid rgba(169,216,204,0.08)", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 28px", position: "sticky", top: 0, zIndex: 10, gap: 6 }}>
          <Badge count={unread} size="small" offset={[-3, 3]}>
            <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 16 }} />} onClick={openNotifs} aria-label="消息通知"
              style={{ color: "#a5bab5", display: "flex", alignItems: "center", width: 38, height: 38 }} />
          </Badge>
          {/* 用户胶囊（参考员工端）：头像 + 姓名 + 角色 chip + 下拉菜单（退出登录） */}
          <Dropdown
            menu={{
              className: "patient-dropdown",
              items: [
                { key: "logout", icon: <LogoutOutlined />, label: "退出登录", danger: true, onClick: logout },
              ],
            }}
            placement="bottomRight"
            trigger={["click"]}
          >
            <div className="md-clickable" style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "5px 14px 5px 6px",
              borderRadius: 999,
              border: "1px solid rgba(95, 208, 180, 0.16)",
              background: "#16201f",
              transition: "all 0.2s ease",
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(95, 208, 180, 0.3)";
                e.currentTarget.style.background = "#243330";
                e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(95, 208, 180, 0.16)";
                e.currentTarget.style.background = "#16201f";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <Avatar
                size={32}
                style={{
                  background: "linear-gradient(135deg, #5fd0b4, #2f8c79)",
                  color: "#0e2a26",
                  fontWeight: 600,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {me?.name?.[0] || "患"}
              </Avatar>
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e6f0ed" }}>
                  {me?.name || "患者"}
                </div>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 3,
                    padding: "0 6px",
                    height: 16,
                    lineHeight: "16px",
                    borderRadius: 4,
                    fontSize: 10,
                    color: "#5fd0b4",
                    background: "rgba(95, 208, 180, 0.14)",
                  }}
                >
                  患者
                </span>
              </div>
              <DownOutlined style={{ fontSize: 9, color: "rgba(230, 240, 237, 0.72)", marginLeft: 2 }} />
            </div>
          </Dropdown>
        </div>
        <div style={{ maxWidth: 1140, width: "100%", margin: "34px auto 0", padding: "0 28px 40px", boxSizing: "border-box" }}>
          {/* key=active：切换 tab 时重挂载，触发 md-stagger 级联进场 */}
          <div key={active} className="md-stagger">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* 预约挂号下单（forceRender：bookForm 常驻连接，避免 useForm not connected 告警） */}
      <Modal rootClassName="mac-drawer" title={booking ? openTitle(booking) : "预约挂号"} width={480} open={bookingOpen}
        onCancel={() => setBookingOpen(false)} destroyOnHidden forceRender
        footer={[
          <Button key="cancel" onClick={() => setBookingOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" loading={submitting} onClick={() => bookForm.submit()}>提交挂号</Button>,
        ]}>
        {booking && (
          <Form form={bookForm} layout="vertical" onFinish={submitBooking}>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="医生">{booking.doctor_name || `#${booking.doctor_id}`}</Descriptions.Item>
              <Descriptions.Item label="科室">{booking.department || "-"}</Descriptions.Item>
              <Descriptions.Item label="时间">{booking.date} · {booking.time_slot}</Descriptions.Item>
              <Descriptions.Item label="费用">{booking.fee ? `¥${(booking.fee / 100).toFixed(2)}` : "待定（由医院设定）"}</Descriptions.Item>
            </Descriptions>
            <Form.Item name="patient_name" label="患者姓名" rules={[{ required: true }]}><Input placeholder="请输入姓名" /></Form.Item>
            <Form.Item name="phone" label="联系电话" rules={[{ required: true }]}><Input placeholder="请输入手机号" /></Form.Item>
            <Form.Item name="symptoms" label="症状描述"
              extra={<Button size="small" type="link" icon={<AudioOutlined />} style={{ padding: 0 }} onClick={toggleVoice}>
                {listening ? "停止语音输入" : "语音输入"}</Button>}>
              <Input.TextArea rows={3} placeholder="简述症状…（可语音输入）" />
            </Form.Item>
            <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
              提交后将从该号源扣除 1 个号；号源实时扣减，先到先得。
            </Text>
          </Form>
        )}
      </Modal>

      {/* 就诊记录详情 */}
      <Modal rootClassName="mac-drawer" title={`就诊记录详情 #${recordDetail?.record_id ?? ""}`} width={560} open={!!recordDetail}
        onCancel={() => setRecordDetail(null)}
        footer={<Button onClick={() => setRecordDetail(null)}>关闭</Button>}>
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
      </Modal>

      {/* 消息通知中心 */}
      <Modal rootClassName="mac-drawer" title="消息通知" width={480} open={notifOpen} onCancel={() => setNotifOpen(false)}
        footer={[
          unread > 0 ? <Button key="read" type="link" onClick={markAllRead}>全部已读</Button> : null,
          <Button key="close" onClick={() => setNotifOpen(false)}>关闭</Button>,
        ]}>
        {notifs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#7d9791", fontSize: 12 }}>
            <NotificationOutlined style={{ fontSize: 34, color: "#4a5b56", display: "block", marginBottom: 12 }} />
            暂无通知
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {notifs.map((n) => (
              <div key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                style={{
                  display: "flex", gap: 12, padding: "14px 6px", borderBottom: "1px solid rgba(95,208,180,0.16)",
                  cursor: n.is_read ? "default" : "pointer", opacity: n.is_read ? 0.62 : 1,
                }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: n.is_read ? "transparent" : "#5fd0b4", flexShrink: 0, marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600 }}>{n.title}</b>
                  <div style={{ fontSize: 12, color: "#a5bab5", whiteSpace: "pre-wrap", marginTop: 4 }}>{n.content}</div>
                  <div style={{ fontSize: 10, color: "#6b827d", marginTop: 6 }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString("zh-CN") : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 报告详情 */}
      <Modal rootClassName="mac-drawer" title="报告详情" width={520} open={!!labDetail} onCancel={() => setLabDetail(null)}
        footer={<Button onClick={() => setLabDetail(null)}>关闭</Button>}>
        {labDetail && (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="报告单号">{labDetail.test_no || "-"}</Descriptions.Item>
              <Descriptions.Item label="项目名称">{labDetail.item_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="分类">{labDetail.category || "-"}</Descriptions.Item>
              <Descriptions.Item label="开单科室">{labDetail.department || "-"}</Descriptions.Item>
              <Descriptions.Item label="开单医生">{labDetail.doctor_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={labStatusColor[labDetail.status] || "default"}>{labDetail.status}</Tag></Descriptions.Item>
            </Descriptions>
            {(() => {
              const steps = ["待检查", "已采样", "检查中", "已出报告"];
              const idx = steps.indexOf(labDetail.status);
              if (idx < 0) return null;
              return (
                <div style={{ margin: "4px 0" }}>
                  <Text strong style={{ fontSize: 13 }}>状态流转</Text>
                  <Timeline style={{ marginTop: 10, marginBottom: 4 }}
                    items={steps.slice(0, idx + 1).map((s, i) => ({
                      color: i === idx ? "#5fd0b4" : "#4a5b56",
                      children: <span style={{ fontSize: 12, color: i === idx ? "#5fd0b4" : "#7d9791", fontWeight: i === idx ? 600 : 400 }}>{s}</span>,
                    }))}
                  />
                </div>
              );
            })()}
            <Divider style={{ margin: "4px 0" }} />
            <div><Text strong>检查结果</Text><Text type="secondary" style={{ display: "block", marginTop: 6, whiteSpace: "pre-wrap" }}>{labDetail.result || "（待出报告）"}</Text></div>
            {labDetail.reference && <div><Text strong>参考范围</Text><Text type="secondary" style={{ display: "block", marginTop: 6, whiteSpace: "pre-wrap" }}>{labDetail.reference}</Text></div>}
            {labDetail.created_at && <div style={{ fontSize: 11, color: "#6b827d" }}>出具时间：{new Date(labDetail.created_at).toLocaleString("zh-CN")}</div>}
          </Space>
        )}
      </Modal>

      {/* 家族病史 新增/编辑 */}
      <Modal rootClassName="mac-drawer"
        title={familyEditing ? "编辑家族病史" : "新增家族病史"}
        open={familyOpen}
        onCancel={() => setFamilyOpen(false)}
        onOk={() => familyForm.submit()}
        confirmLoading={familySaving}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={familyForm} layout="vertical" onFinish={submitFamily}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="relation" label="亲属关系" rules={[{ required: true, message: "请输入亲属关系" }]}>
                <Select
                  placeholder="如：父亲"
                  options={["父亲", "母亲", "祖父", "祖母", "外祖父", "外祖母", "兄弟", "姐妹", "子女"].map((v) => ({ value: v, label: v }))}
                  showSearch
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="onset_age" label="发病年龄"><Input placeholder="如 55 岁" /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="disease" label="疾病名称" rules={[{ required: true, message: "请输入疾病名称" }]}>
            <Input placeholder="如：高血压、糖尿病" />
          </Form.Item>
          <Form.Item name="note" label="备注"><Input.TextArea rows={2} placeholder="补充说明（选填）" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
