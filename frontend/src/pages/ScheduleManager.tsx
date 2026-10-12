import { useEffect, useMemo, useState } from "react";
import {
  Button, Modal, Form, Input, InputNumber, Select, Tag, message, Popconfirm,
  Space, Empty, Spin, DatePicker, Segmented, Tooltip,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, EditOutlined, CalendarOutlined, DownloadOutlined,
  LeftOutlined, RightOutlined, ScheduleOutlined, SyncOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import * as XLSX from "xlsx";
import {
  listSchedules, listBookableDoctors, deleteSchedule, updateSchedule, syncFromStaff,
  type DoctorScheduleItem, type BookableDoctor,
} from "../api/schedule";
import api from "../api/client";

type ViewMode = "year" | "month" | "day" | "week";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 24 小时每 2 小时一个时段，并按起止时间区分早 / 午 / 晚班 */
const SHIFT_DEFS: { label: string; slot: string; start: number; end: number; shift: "早班" | "午班" | "晚班" }[] =
  Array.from({ length: 12 }, (_, i) => {
    const start = i * 2;
    const end = (i + 1) * 2;
    const slot = `${String(start).padStart(2, "0")}:00-${String(end).padStart(2, "0")}:00`;
    // 早班 06:00-12:00；午班 12:00-18:00；晚班 18:00-24:00（0-6 为夜班，归到晚班）
    const shift: "早班" | "午班" | "晚班" =
      start >= 6 && end <= 12 ? "早班" : start >= 12 && end <= 18 ? "午班" : "晚班";
    return { label: `${String(start).padStart(2, "0")}:00`, slot, start, end, shift };
  });

const SHIFT_ORDER: ("早班" | "午班" | "晚班")[] = ["早班", "午班", "晚班"];
const SHIFT_COLOR: Record<string, string> = { 早班: "#eaf1ff", 午班: "#e6f4f1", 晚班: "#f6eefc" };
const SHIFT_BORDER: Record<string, string> = { 早班: "#2563eb", 午班: "#138d85", 晚班: "#7c3aed" };

/** 本地时区的日期字符串 yyyy-mm-dd（避免 toISOString 时区偏移） */
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function ScheduleManager() {
  const [items, setItems] = useState<DoctorScheduleItem[]>([]);
  const [doctors, setDoctors] = useState<BookableDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [editing, setDoctorScheduleItem] = useState<DoctorScheduleItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // 日历视图与当前锚点
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState<Dayjs>(dayjs()); // 当前查看的日期锚点

  // 当日排班表弹窗（学习通式，点击日期弹出）
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([listSchedules(), listBookableDoctors()]);
      setItems(r.items);
      setDoctors(d.items);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载失败");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setDoctorScheduleItem(null); form.resetFields(); setOpen(true); };
  const openEdit = (s: DoctorScheduleItem) => {
    setDoctorScheduleItem(s);
    form.setFieldsValue({
      doctor_id: s.doctor_id, department: s.department,
      date: s.date ? dayjs(s.date) : undefined,
      time_slot: s.time_slot, total: s.total, remaining: s.remaining,
    });
    setOpen(true);
  };

  const save = async (v: any) => {
    try {
      // DatePicker 返回 Dayjs，转成 yyyy-mm-dd 字符串
      const payload = { ...v, date: v.date ? dayjs(v.date).format("YYYY-MM-DD") : v.date };
      if (editing) {
        await updateSchedule(editing.id, payload);
        message.success("已更新号源");
      } else {
        await api.post("/schedule", { ...payload, remaining: payload.total });
        message.success("已保存");
      }
      setOpen(false);
      setDoctorScheduleItem(null);
      form.resetFields();
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "保存失败");
    }
  };

  const doctorName = (id: number) => doctors.find((d) => d.id === id)?.real_name || `#${id}`;
  const doctorTitle = (id: number) => doctors.find((d) => d.id === id)?.title || "";

  const doDelete = async (id: number) => {
    try { await deleteSchedule(id); message.success("已删除号源"); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "删除失败"); }
  };

  /* ---------------- 日历视图区间 ---------------- */

  // 当前视图覆盖的日期范围（含首尾）
  const viewRange = useMemo(() => {
    if (viewMode === "day") {
      const d = anchor.toDate();
      return { start: fmtDate(d), end: fmtDate(d), label: anchor.format("YYYY年M月D日 dddd") };
    }
    if (viewMode === "week") {
      // 周一为一周起点
      const startOfWeek = anchor.startOf("week").add(1, "day"); // dayjs startOf week 默认周日，+1 到周一
      const start = fmtDate(startOfWeek.toDate());
      const end = fmtDate(startOfWeek.add(6, "day").toDate());
      return { start, end, label: `${startOfWeek.format("YYYY年M月D日")} — ${startOfWeek.add(6, "day").format("M月D日")}` };
    }
    if (viewMode === "month") {
      const first = anchor.startOf("month");
      const last = anchor.endOf("month");
      return { start: fmtDate(first.toDate()), end: fmtDate(last.toDate()), label: anchor.format("YYYY年M月") };
    }
    // year
    const first = anchor.startOf("year");
    const last = anchor.endOf("year");
    return { start: fmtDate(first.toDate()), end: fmtDate(last.toDate()), label: anchor.format("YYYY年") };
  }, [viewMode, anchor]);

  // 当前视图内的排班
  const inRange = useMemo(
    () => items.filter((s) => s.date >= viewRange.start && s.date <= viewRange.end),
    [items, viewRange]
  );

  /* ---------------- 视图切换与翻页 ---------------- */

  const switchMode = (m: ViewMode) => setViewMode(m);

  const step = (dir: 1 | -1) => {
    if (viewMode === "day") setAnchor((a) => a.add(dir, "day"));
    else if (viewMode === "week") setAnchor((a) => a.add(dir, "week"));
    else if (viewMode === "month") setAnchor((a) => a.add(dir, "month"));
    else setAnchor((a) => a.add(dir, "year"));
  };

  const goToday = () => setAnchor(dayjs());

  const onDatePicker = (d: Dayjs | null) => {
    if (d) {
      setAnchor(d);
      if (viewMode === "year" || viewMode === "month") setViewMode("month");
    }
  };

  /* ---------------- 各视图数据 ---------------- */

  // 周 / 日视图：医生 × 时段网格
  const rangeDays = useMemo(() => {
    if (viewMode === "day") return [fmtDate(anchor.toDate())];
    if (viewMode === "week") {
      const start = anchor.startOf("week").add(1, "day");
      return Array.from({ length: 7 }, (_, i) => fmtDate(start.add(i, "day").toDate()));
    }
    return [];
  }, [viewMode, anchor]);

  const rangeDoctors = useMemo(
    () => Array.from(new Set(inRange.map((s) => s.doctor_id))),
    [inRange]
  );

  const getSchedule = (doctorId: number, date: string, timeSlot: string) =>
    inRange.find((s) => s.doctor_id === doctorId && s.date === date && s.time_slot === timeSlot);

  // 月视图：日历网格
  const monthCells = useMemo(() => {
    const first = anchor.startOf("month");
    const daysInMonth = anchor.daysInMonth();
    const startWeekday = first.day(); // 0=周日
    const cells: (Dayjs | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(first.add(d - 1, "day"));
    return cells;
  }, [anchor]);

  const daySummary = (date: string) => {
    const list = items.filter((s) => s.date === date);
    return {
      total: list.reduce((a, s) => a + s.total, 0),
      booked: list.reduce((a, s) => a + (s.total - s.remaining), 0),
      remaining: list.reduce((a, s) => a + s.remaining, 0),
      doctors: new Set(list.map((s) => s.doctor_id)).size,
      slots: list.length,
    };
  };

  // 年视图：12 个月概览
  const yearMonths = useMemo(() => {
    const y = anchor.year();
    return Array.from({ length: 12 }, (_, i) => {
      const m = dayjs(new Date(y, i, 1));
      const start = fmtDate(m.toDate());
      const end = fmtDate(m.endOf("month").toDate());
      const list = items.filter((s) => s.date >= start && s.date <= end);
      return {
        month: m.format("M月"),
        total: list.reduce((a, s) => a + s.total, 0),
        remaining: list.reduce((a, s) => a + s.remaining, 0),
        days: new Set(list.map((s) => s.date)).size,
      };
    });
  }, [items, anchor]);

  /* ---------------- 统计（当前视图） ---------------- */

  const totalSlots = inRange.reduce((sum, s) => sum + s.total, 0);
  const bookedSlots = inRange.reduce((sum, s) => sum + (s.total - s.remaining), 0);
  const remainingSlots = inRange.reduce((sum, s) => sum + s.remaining, 0);
  const tightSlotCount = inRange.filter((s) => s.remaining <= 2).length;
  const doctorCount = rangeDoctors.length;

  /* ---------------- 导出 ---------------- */

  const handleExport = () => {
    try {
      setExporting(true);
      const rows = [...inRange]
        .sort((a, b) => (a.date + a.time_slot).localeCompare(b.date + b.time_slot))
        .map((s) => [
          doctorName(s.doctor_id), s.department || "", s.date, s.time_slot,
          s.total, s.total - s.remaining, s.remaining,
        ]);
      if (rows.length === 0) { message.warning("当前视图暂无号源可导出"); return; }
      const header = ["医生", "科室", "日期", "时段", "总号源", "已预约", "剩余"];
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "排班表");
      XLSX.writeFile(wb, `号源排班_${viewRange.label.replace(/\s/g, "")}.xlsx`);
      message.success(`已导出 ${rows.length} 条`);
    } catch {
      message.error("导出失败");
    } finally {
      setExporting(false);
    }
  };

  /* ---------------- 同步排班 ---------------- */

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await syncFromStaff();
      if (r.created === 0 && r.unmatched === 0) {
        message.success(`同步完成：已有 ${r.skipped} 条号源，无需新建`);
      } else {
        const parts: string[] = [];
        if (r.created) parts.push(`新建 ${r.created} 条号源`);
        if (r.skipped) parts.push(`跳过 ${r.skipped} 条（已存在）`);
        if (r.unmatched) parts.push(`${r.unmatched} 条排班未匹配到医生`);
        message.success(`同步完成：${parts.join("，")}`);
      }
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "同步失败（需要管理员权限）");
    } finally {
      setSyncing(false);
    }
  };

  /* ---------------- 紧张时段处理 ---------------- */

  const tightSlots = inRange.filter((s) => s.remaining <= 2).slice(0, 3);

  const addSlots = async (s: DoctorScheduleItem) => {
    try {
      await updateSchedule(s.id, { total: s.total + 5, remaining: s.remaining + 5 });
      message.success(`已为 ${doctorName(s.doctor_id)} ${s.date} ${s.time_slot} 加号 5 个`);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加号失败（需要管理员权限）");
    }
  };

  const closeSlots = async (s: DoctorScheduleItem) => {
    try {
      await updateSchedule(s.id, { remaining: 0 });
      message.success(`已停诊 ${doctorName(s.doctor_id)} ${s.date} ${s.time_slot}`);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "停诊失败（需要管理员权限）");
    }
  };

  /* ---------------- 当日排班表（学习通式） ---------------- */

  /** 点击日期：打开当日排班表 */
  const openDayModal = (date: string) => {
    setDayModalDate(date);
    setDayModalOpen(true);
  };

  /** 当日某 2 小时时段的排班记录 */
  const daySlotSchedule = (date: string, slot: string) =>
    items.find((s) => s.date === date && s.time_slot === slot);

  /** 在某 2 小时时段排班（预填日期 + 时段，打开编辑弹窗） */
  const scheduleSlot = (date: string, slot: string) => {
    const existing = daySlotSchedule(date, slot);
    if (existing) {
      openEdit(existing);
    } else {
      setDoctorScheduleItem(null);
      form.resetFields();
      form.setFieldsValue({ date: dayjs(date), time_slot: slot, total: 1, remaining: 1 });
      setOpen(true);
    }
  };

  /** 删除某时段排班 */
  const removeSlot = async (date: string, slot: string) => {
    const s = daySlotSchedule(date, slot);
    if (!s) return;
    try {
      await deleteSchedule(s.id);
      message.success("已删除该时段排班");
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "删除失败");
    }
  };

  /* ---------------- 渲染辅助 ---------------- */

  const todayStr = fmtDate(new Date());

  const slotChip = (schedule: DoctorScheduleItem) => {
    // 按起止时间判断早/午/晚班（06-12 早、12-18 午、其余晚）
    const startHour = parseInt(schedule.time_slot.split("-")[0].split(":")[0], 10);
    const shift = startHour >= 6 && startHour < 12 ? "早班" : startHour >= 12 && startHour < 18 ? "午班" : "晚班";
    const isTight = schedule.remaining <= 2;
    const bgColor = isTight ? "#fff7e9" : SHIFT_COLOR[shift];
    const borderColor = isTight ? "#d6a451" : SHIFT_BORDER[shift];
    const textColor = isTight ? "#b88c38" : SHIFT_BORDER[shift];
    return (
      <div
        key={schedule.time_slot}
        onClick={() => openEdit(schedule)}
        title={`${doctorName(schedule.doctor_id)} · ${schedule.date} ${schedule.time_slot} · 余 ${schedule.remaining}/${schedule.total}`}
        style={{
          fontSize: "10px",
          padding: "5px 7px",
          borderRadius: "6px",
          background: bgColor,
          color: textColor,
          borderLeft: `3px solid ${borderColor}`,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {schedule.time_slot.split("-")[0]}
        <div style={{ fontSize: "9px", marginTop: "2px", opacity: 0.8 }}>
          余{schedule.remaining}/{schedule.total}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>号源排班</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>按年 / 月 / 日 / 周查看排班，配置医生号源，患者端实时同步剩余号源。</div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="lv-btn" type="button" onClick={handleExport}><DownloadOutlined /> 导出</button>
          <button className="lv-btn" type="button" onClick={handleSync}><SyncOutlined /> 同步排班</button>
          <button className="lv-btn lv-btn--primary" type="button" onClick={openCreate}><PlusOutlined /> 新增号源</button>
        </div>
      </div>

      {/* 视图切换 + 翻页 */}
      <div className="panel" style={{ marginBottom: 21 }}>
        <div className="panel-body" style={{ paddingTop: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Segmented
            value={viewMode}
            onChange={(v) => switchMode(v as ViewMode)}
            options={[
              { value: "year", label: "年" },
              { value: "month", label: "月" },
              { value: "week", label: "周" },
              { value: "day", label: "日" },
            ]}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button icon={<LeftOutlined />} onClick={() => step(-1)} size="small" />
            <Button icon={<RightOutlined />} onClick={() => step(1)} size="small" />
            <Tooltip title="回到今天">
              <Button size="small" onClick={goToday}>今天</Button>
            </Tooltip>
          </div>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#1b2b45" }}>{viewRange.label}</div>
          <DatePicker
            picker={viewMode === "year" ? "year" : "month"}
            value={anchor}
            onChange={onDatePicker}
            allowClear={false}
            style={{ width: 140 }}
          />
        </div>
      </div>

      {/* 统计卡片（当前视图） */}
      <div className="stats">
        <div className="stat">
          <div className="stat-top"><span>{viewMode === "year" ? "全年号源" : viewMode === "day" ? "当日号源" : viewMode === "week" ? "本周号源" : "本月号源"}</span><span className="stat-icon"><CalendarOutlined /></span></div>
          <div className="stat-value">{totalSlots}</div>
          <div className="stat-bottom"><em>出诊医生 {doctorCount} 位</em><span> · {viewRange.label}</span></div>
        </div>
        <div className="stat">
          <div className="stat-top"><span>已预约</span><span className="stat-icon teal"><CalendarOutlined /></span></div>
          <div className="stat-value">{bookedSlots}</div>
          <div className="stat-bottom"><em>预约率 {totalSlots > 0 ? ((bookedSlots / totalSlots) * 100).toFixed(0) : 0}%</em><span> · 含患者端预约</span></div>
        </div>
        <div className="stat">
          <div className="stat-top"><span>剩余号源</span><span className="stat-icon gold"><CalendarOutlined /></span></div>
          <div className="stat-value">{remainingSlots}</div>
          <div className="stat-bottom"><em className="warn">可继续放号</em></div>
        </div>
        <div className="stat">
          <div className="stat-top"><span>紧张时段</span><span className="stat-icon red"><CalendarOutlined /></span></div>
          <div className="stat-value">{tightSlotCount}</div>
          <div className="stat-bottom"><em className="warn">剩余 ≤ 2</em><span> · 建议加号</span></div>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.3fr) minmax(300px, 1fr)", gap: "21px" }}>
        {/* 左侧：日历 / 排班网格 */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2><ScheduleOutlined style={{ marginRight: 6 }} />{viewMode === "year" ? "全年概览" : viewMode === "month" ? "月视图" : viewMode === "day" ? "日视图" : "周视图"}</h2>
              <small>
                {viewMode === "year" && "按月份汇总号源，点击月份可进入该月详情"}
                {viewMode === "month" && "点击日期可进入当日排班"}
                {viewMode === "day" && "查看当日各医生的号源时段"}
                {viewMode === "week" && "点击时段可查看和编辑号源详情"}
              </small>
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "10px", color: "#8190a4" }}>
              <span><i style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: "#2563eb", marginRight: "6px", verticalAlign: "-1px" }}></i>上午门诊</span>
              <span><i style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: "#138d85", marginRight: "6px", verticalAlign: "-1px" }}></i>下午门诊</span>
              <span><i style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: "#d6a451", marginRight: "6px", verticalAlign: "-1px" }}></i>紧张</span>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              {viewMode === "year" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: 16 }}>
                  {yearMonths.map((m) => (
                    <div
                      key={m.month}
                      onClick={() => { setAnchor(anchor.month(parseInt(m.month, 10) - 1)); setViewMode("month"); }}
                      style={{
                        border: "1px solid #e6ecf3", borderRadius: 10, padding: 14, cursor: "pointer",
                        background: m.days > 0 ? "#fff" : "#fafbfd",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,.12)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{m.month}</div>
                      <div style={{ fontSize: 11, color: "#8190a4", display: "grid", gap: 4 }}>
                        <span>排班 {m.days} 天 · 号源 {m.total}</span>
                        <span style={{ color: m.remaining > 0 ? "#138d85" : "#8190a4" }}>剩余 {m.remaining}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === "month" && (
                <div style={{ padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
                    {WEEKDAYS.map((w) => (
                      <div key={w} style={{ textAlign: "center", fontSize: 11, color: "#8b98aa", fontWeight: 600, padding: "6px 0" }}>
                        周{w}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                    {monthCells.map((cell, i) => {
                      if (!cell) return <div key={`e${i}`} />;
                      const date = fmtDate(cell.toDate());
                      const s = daySummary(date);
                      const isToday = date === todayStr;
                      const isTight = s.slots > 0 && s.remaining <= 2;
                      return (
                        <div
                          key={date}
                          onClick={() => openDayModal(date)}
                          style={{
                            minHeight: 74, border: "1px solid #eef1f6", borderRadius: 8, padding: 6,
                            cursor: "pointer", background: isToday ? "#eff5ff" : "#fff",
                            borderColor: isToday ? "#2563eb" : "#eef1f6",
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? "#2563eb" : "#1b2b45" }}>
                            {cell.date()}
                          </div>
                          {s.slots > 0 ? (
                            <div style={{ fontSize: 10, color: "#8290a4", marginTop: 4, lineHeight: 1.5 }}>
                              <div style={{ color: "#2f5fc4" }}>{s.doctors} 位医生</div>
                              <div>号 {s.total} · 余 <b style={{ color: isTight ? "#b88c38" : "#138d85" }}>{s.remaining}</b></div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 10, color: "#c3ccd8", marginTop: 6 }}>—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(viewMode === "week" || viewMode === "day") && (
                rangeDoctors.length === 0 ? (
                  <Empty description="该时段暂无排班数据" style={{ padding: 30 }} />
                ) : (
                  <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f9fbfd", color: "#8b98aa" }}>
                        <th style={{ padding: "11px 8px", textAlign: "center", border: "1px solid #f4f6fa", minWidth: "120px" }}>医生</th>
                        {rangeDays.map((date) => {
                          const d = dayjs(date);
                          const isToday = date === todayStr;
                          return (
                            <th key={date} style={{ padding: "11px 8px", textAlign: "center", border: "1px solid #f4f6fa", color: isToday ? "#2563eb" : "#8b98aa", background: isToday ? "#eff5ff" : "#f9fbfd" }}>
                              {viewMode === "week" ? `周${WEEKDAYS[d.day()]}` : ""}
                              <b style={{ display: "block", color: isToday ? "#2563eb" : "#1b2b45", fontSize: "12px", marginTop: "3px" }}>
                                {d.format("MM-DD")}
                              </b>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {rangeDoctors.map((doctorId) => (
                        <tr key={doctorId}>
                          <td style={{ padding: "10px 8px", border: "1px solid #f0f3f8", verticalAlign: "top" }}>
                            <div style={{ display: "flex", gap: "9px", alignItems: "center" }}>
                              <span className="avatar sq" style={{ width: "34px", height: "34px", fontSize: "12px" }}>{doctorName(doctorId)[0]}</span>
                              <span>
                                <div style={{ fontSize: "12px", fontWeight: 500 }}>{doctorName(doctorId)}</div>
                                <small style={{ display: "block", color: "#9aa6b6", fontSize: "10px", marginTop: "3px" }}>{doctorTitle(doctorId)}</small>
                              </span>
                            </div>
                          </td>
                          {rangeDays.map((date) => (
                            <td key={date} style={{ padding: "8px", border: "1px solid #f4f6fa", verticalAlign: "top" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                {SHIFT_DEFS.map((t) => {
                                  const schedule = getSchedule(doctorId, date, t.slot);
                                  return schedule ? slotChip(schedule) : null;
                                })}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          )}
        </section>

        {/* 右侧边栏 */}
        <aside className="stack">
          {/* 当前视图统计 */}
          <section className="panel">
            <div className="panel-head"><div><h2>{viewRange.label} · 统计</h2></div></div>
            <div className="panel-body">
              <div className="mini-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="mini"><small>门诊班次</small><b>{inRange.length}<span>班</span></b></div>
                <div className="mini"><small>预约率</small><b>{totalSlots > 0 ? ((bookedSlots / totalSlots) * 100).toFixed(0) : 0}<span>%</span></b></div>
                <div className="mini"><small>剩余号源</small><b>{remainingSlots}<span>个</span></b></div>
                <div className="mini"><small>紧张时段</small><b style={{ color: "#c4423e" }}>{tightSlotCount}</b></div>
              </div>
              {tightSlotCount > 0 && (
                <div className="note red" style={{ marginTop: 14 }}>
                  {tightSlotCount} 个时段剩余号源 ≤ 2，建议调配或加号。
                </div>
              )}
            </div>
          </section>

          {/* 紧张时段处理（真实写库：加号 / 停诊） */}
          <section className="panel">
            <div className="panel-head">
              <div><h2>紧张时段处理</h2></div>
              <span className={`badge ${tightSlots.length ? "amber" : "gray"}`}>{tightSlots.length} 待处理</span>
            </div>
            <div className="list">
              {tightSlots.length === 0 ? (
                <div className="list-item"><span style={{ flex: 1 }}><strong>暂无紧张时段</strong><p>所有时段剩余号源均大于 2</p></span></div>
              ) : (
                tightSlots.map((s) => (
                  <div key={s.id}>
                    <div className="list-item">
                      <span className="avatar teal">{doctorName(s.doctor_id)[0]}</span>
                      <span style={{ flex: 1 }}>
                        <strong>{doctorName(s.doctor_id)} · {s.date?.slice(5)} {s.time_slot}</strong>
                        <p>剩余 {s.remaining}/{s.total} 号 · {s.department || "未分配科室"}</p>
                      </span>
                    </div>
                    <div style={{ padding: "0 22px 12px", display: "flex", gap: "8px" }}>
                      <Popconfirm title="停诊该时段（剩余号源置 0）？" onConfirm={() => closeSlots(s)}>
                        <Button size="small" style={{ flex: 1 }}>停诊</Button>
                      </Popconfirm>
                      <Button size="small" type="primary" style={{ flex: 1 }} onClick={() => addSlots(s)}>加号 +5</Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* 编辑弹窗 */}
      <Modal
        open={open}
        title={editing ? "编辑号源" : "新增号源（仅非管理员员工可被挂号）"}
        onCancel={() => { setOpen(false); setDoctorScheduleItem(null); }}
        onOk={() => form.submit()}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="doctor_id" label="医生" rules={[{ required: true, message: "请选择医生" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择可被挂号的员工"
              onChange={(id) => {
                const d = doctors.find((x) => x.id === id);
                form.setFieldsValue({ department: d?.department || "" });
              }}
              options={doctors.map((d) => ({
                value: d.id,
                label: `${d.real_name}（${d.department || "未分配科室"} · ${d.title || d.role}）`,
              }))}
            />
          </Form.Item>
          <Form.Item name="department" label="科室"><Input /></Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true, message: "请选择日期" }]}>
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="time_slot" label="时段" rules={[{ required: true, message: "请选择时段" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={SHIFT_DEFS.map((t) => ({
                value: t.slot,
                label: `${t.slot}（${t.shift}）`,
              }))}
              placeholder="选择 24 小时时段"
            />
          </Form.Item>
          <Form.Item name="total" label="号源总量" rules={[{ required: true, message: "请输入号源总量" }]}>
            <InputNumber style={{ width: "100%" }} min={1} />
          </Form.Item>
          <Form.Item name="remaining" label="剩余号源" rules={[{ required: true, message: "请输入剩余号源" }]}>
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 当日排班表（学习通式：24 小时每 2 小时一时段，按早/午/晚班分区） */}
      <Modal
        open={dayModalOpen}
        title={`${dayModalDate ? dayjs(dayModalDate).format("YYYY年M月D日 dddd") : ""} · 当日排班`}
        onCancel={() => setDayModalOpen(false)}
        footer={
          <Button onClick={() => setDayModalOpen(false)}>关闭</Button>
        }
        width={760}
        destroyOnHidden
      >
        <div style={{ fontSize: 12, color: "#8190a4", marginBottom: 14, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {SHIFT_ORDER.map((sh) => (
            <span key={sh}>
              <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: SHIFT_BORDER[sh], marginRight: 6, verticalAlign: "-1px" }} />
              {sh}
            </span>
          ))}
          <span style={{ color: "#b88c38" }}>· 点击空格排班</span>
        </div>

        {SHIFT_ORDER.map((shift) => {
          const slots = SHIFT_DEFS.filter((t) => t.shift === shift);
          return (
            <div key={shift} style={{ marginBottom: 18 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: SHIFT_BORDER[shift],
                padding: "6px 10px", borderRadius: 6, background: SHIFT_COLOR[shift], marginBottom: 10,
              }}>
                {shift}（{slots[0]?.slot.split("-")[0]} — {slots[slots.length - 1]?.slot.split("-")[1]}）
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {slots.map((t) => {
                  const sch = daySlotSchedule(dayModalDate, t.slot);
                  return (
                    <div
                      key={t.slot}
                      onClick={() => scheduleSlot(dayModalDate, t.slot)}
                      style={{
                        border: `1px solid ${sch ? SHIFT_BORDER[shift] : "#e6ecf3"}`,
                        borderRadius: 8,
                        padding: "10px 8px",
                        cursor: "pointer",
                        minHeight: 62,
                        background: sch ? SHIFT_COLOR[shift] : "#fafbfd",
                        transition: "all 0.15s",
                        position: "relative",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 3px 10px rgba(37,99,235,.12)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#1b2b45" }}>{t.label}</div>
                      <div style={{ fontSize: 10, color: "#9aa6b6", marginTop: 2 }}>{t.slot}</div>
                      {sch ? (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: SHIFT_BORDER[shift] }}>
                            {doctorName(sch.doctor_id)}
                          </div>
                          <div style={{ fontSize: 10, color: "#8290a4" }}>
                            余 {sch.remaining}/{sch.total}
                          </div>
                          <div
                            onClick={(e) => { e.stopPropagation(); removeSlot(dayModalDate, t.slot); }}
                            title="删除该时段排班"
                            style={{
                              position: "absolute", top: 6, right: 6, width: 18, height: 18,
                              borderRadius: 9, background: "rgba(217,83,79,.12)", color: "#d9534f",
                              display: "grid", placeItems: "center", fontSize: 12, lineHeight: 1,
                            }}
                          >
                            ×
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: "#c3ccd8", marginTop: 6 }}>+ 排班</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Modal>
    </div>
  );
}
