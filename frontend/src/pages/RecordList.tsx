/**
 * 就诊记录管理页面 —— 对齐 pages.html 设计规范
 *
 * 行交互对齐 scaffold 的 Users.vue：
 *   · 患者格是**可点的整块**（头像悬停出名片 + 主名/档案号 + 悬停滑出的小箭头），
 *     点它或按 Enter/Space 直接在右侧面板打开这条记录，不必再去操作列找「查看」。
 *   · 操作列退成图标按钮，靠 Tooltip 给名字，列宽从 100 收到 88。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Table, Button, Select, Space, message,
  Popconfirm, Input, Empty, Modal, Form, Popover, Tooltip,
} from "antd";
import {
  EyeOutlined, CheckOutlined, CloseOutlined,
  ExperimentOutlined, EditOutlined,
  FileTextOutlined, ClockCircleOutlined,
  SafetyCertificateOutlined, CheckCircleOutlined,
  SearchOutlined, DownloadOutlined, PlusOutlined,
  FilterOutlined, RightOutlined,
} from "@ant-design/icons";
import {
  listRecords, getRecord, reviewAiSuggestion,
  adminReviewRecord, updateRecord, searchSimilar, createRecord,
} from "../api/records";
import { listPatients, getPatient, type PatientInfo } from "../api/patients";
import { getDoctors } from "../api/users";
import { useAuth } from "../stores/auth";
import type { MedicalRecordInfo } from "../api/records";
import VoiceTextArea from "../components/VoiceTextArea";
import HoverCard, { HoverCardHead, HoverCardRows } from "../components/HoverCard";

const aiReviewLabels: Record<number, { text: string; color: string }> = {
  0: { text: "未审核", color: "default" },
  1: { text: "已确认", color: "green" },
  2: { text: "已驳回", color: "red" },
};

const adminReviewLabels: Record<number, { text: string; color: string }> = {
  0: { text: "待管理员审", color: "orange" },
  1: { text: "已通过", color: "green" },
  2: { text: "管理员驳回", color: "red" },
};

export default function RecordList() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MedicalRecordInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [patientId, setPatientId] = useState<number | undefined>();
  const [patients, setPatients] = useState<{ value: number; label: string }[]>([]);

  /* 悬停名片要展示性别/电话/出生日期，而患者下拉只留了 id+label。
     这里单独存一份「按 id 索引的完整患者档案」：首屏那 100 条在加载下拉时顺手入缓存，
     之后遇到超出首屏的患者，指针进入该格时再按需补一次（带 in-flight 去重，不重复请求）。 */
  const patientCache = useRef(new Map<number, PatientInfo>());
  const patientPending = useRef(new Set<number>());
  const [, bumpPatientCache] = useState(0);

  const ensurePatient = useCallback((id: number) => {
    if (!id) return;
    if (patientCache.current.has(id) || patientPending.current.has(id)) return;
    patientPending.current.add(id);
    getPatient(id)
      .then((res) => {
        if (res?.patient) patientCache.current.set(id, res.patient);
      })
      .catch(() => {})
      .finally(() => {
        patientPending.current.delete(id);
        bumpPatientCache((n) => n + 1);
      });
  }, []);

  const [doctors, setDoctors] = useState<{ value: number; label: string }[]>([]);
  const [aiReviewed, setAiReviewed] = useState<string[]>([]);
  const [adminReviewed, setAdminReviewed] = useState<string[]>([]);

  // 编辑弹窗
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();

  // 新建记录弹窗
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm] = Form.useForm();
  const [exporting, setExporting] = useState(false);

  // 详情面板（右侧）
  const [detail, setDetail] = useState<MedicalRecordInfo | null>(null);
  const [similarList, setSimilarList] = useState<any[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  // segmented 筛选
  const [segFilter, setSegFilter] = useState("全部");
  const [doctorId, setDoctorId] = useState<number | undefined>();
  const [moreFilterOpen, setMoreFilterOpen] = useState(false);
  const [patientKeyword, setPatientKeyword] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await listRecords({
        page, page_size: 20,
        patient_id: patientId,
        doctor_id: doctorId,
        ai_reviewed: aiReviewed.length ? aiReviewed.join(",") : undefined,
        admin_reviewed: adminReviewed.length ? adminReviewed.join(",") : undefined,
      });
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error("加载就诊记录失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, patientId, doctorId, aiReviewed, adminReviewed]);

  /** 顶部快捷筛选 ↔ 审核状态过滤条件 */
  const applySegFilter = (s: string) => {
    setSegFilter(s);
    setPage(1);
    switch (s) {
      case "未审核": setAiReviewed(["0"]); setAdminReviewed([]); break;
      case "已确认": setAiReviewed(["1"]); setAdminReviewed([]); break;
      case "待管理员审": setAiReviewed(["1"]); setAdminReviewed(["0"]); break;
      case "已通过": setAiReviewed(["1"]); setAdminReviewed(["1"]); break;
      case "已驳回": setAiReviewed(["2"]); setAdminReviewed([]); break;
      default: setAiReviewed([]); setAdminReviewed([]);
    }
  };

  const clearFilters = () => {
    setAiReviewed([]);
    setAdminReviewed([]);
    setDoctorId(undefined);
    setPatientId(undefined);
    setSegFilter("全部");
    setPage(1);
  };

  const activeFilterCount =
    (aiReviewed.length ? 1 : 0) + (adminReviewed.length ? 1 : 0) + (patientId ? 1 : 0) + (doctorId ? 1 : 0);

  useEffect(() => {
    listPatients({ page: 1, page_size: 100 }).then((res) => {
      setPatients(res.items.map((p: any) => ({ value: p.id, label: p.name })));
      // 顺手把完整档案灌进名片缓存，首屏这些患者悬停时零请求
      res.items.forEach((p: any) => patientCache.current.set(p.id, p as PatientInfo));
      bumpPatientCache((n) => n + 1);
    });
    getDoctors().then((res) => {
      setDoctors(res.map((u: any) => ({ value: u.id, label: u.name })));
    }).catch(() => {});
  }, []);

  const handleView = async (id: number) => {
    try {
      const r = await getRecord(id);
      setDetail(r);
      setSimilarList([]);
      setSimilarLoading(true);
      const sim = await searchSimilar(r.id);
      setSimilarList(sim.results || []);
    } catch {
      message.error("加载详情失败");
    } finally {
      setSimilarLoading(false);
    }
  };

  const handleReview = async (recordId: number, action: "confirm" | "reject") => {
    try {
      await reviewAiSuggestion(recordId, action);
      message.success(action === "confirm" ? "AI建议已确认" : "AI建议已驳回");
      fetchData();
      if (detail?.id === recordId) setDetail({ ...detail!, ai_reviewed: action === "confirm" ? 1 : 2 });
    } catch { message.error("操作失败"); }
  };

  const handleAdminReview = async (recordId: number, action: "confirm" | "reject") => {
    try {
      await adminReviewRecord(recordId, action);
      message.success(action === "confirm" ? "管理员审核已确认" : "管理员审核已驳回");
      fetchData();
      if (detail?.id === recordId) setDetail({ ...detail!, admin_reviewed: action === "confirm" ? 1 : 2 });
    } catch { message.error("操作失败"); }
  };

  const handleEditOpen = () => {
    if (!detail) return;
    editForm.setFieldsValue({
      symptoms: detail.symptoms, diagnosis: detail.diagnosis,
      prescription: detail.prescription, notes: detail.notes,
      doctor_id: detail.doctor_id, room: detail.room,
    });
    setEditModalOpen(true);
  };

  // 新建记录
  const handleCreateOpen = () => {
    createForm.resetFields();
    setCreateOpen(true);
  };

  const handleCreateSave = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSaving(true);
      await createRecord(values);
      message.success("就诊记录已创建");
      setCreateOpen(false);
      setPage(1);
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || "创建失败");
    } finally {
      setCreateSaving(false);
    }
  };

  // 导出 CSV（含 BOM，Excel 可直接打开）
  const handleExport = async () => {
    try {
      setExporting(true);
      const all: MedicalRecordInfo[] = [];
      let p = 1;
      // 分页拉取全部数据（后端单页上限 100）
      for (;;) {
        const res = await listRecords({
          page: p, page_size: 100,
          patient_id: patientId,
          doctor_id: doctorId,
          ai_reviewed: aiReviewed.length ? aiReviewed.join(",") : undefined,
          admin_reviewed: adminReviewed.length ? adminReviewed.join(",") : undefined,
        });
        all.push(...res.items);
        if (all.length >= res.total || res.items.length === 0) break;
        p += 1;
      }
      if (all.length === 0) {
        message.warning("没有可导出的记录");
        return;
      }
      const header = ["ID", "患者", "就诊日期", "接诊医生", "主诉症状", "诊断结果", "处方", "备注", "医生审核", "管理员审核"];
      const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const reviewText = (n?: number) => n === 1 ? "已确认" : n === 2 ? "已驳回" : "未审核";
      const rows = all.map((r) => [
        r.id,
        r.patient_name || `#${r.patient_id}`,
        r.visit_date ? new Date(r.visit_date).toLocaleDateString("zh-CN") : "-",
        r.doctor_name || "-",
        r.symptoms, r.diagnosis, r.prescription, r.notes,
        r.ai_suggestion ? reviewText(r.ai_reviewed) : "无AI",
        r.ai_reviewed === 1 ? reviewText(r.admin_reviewed) : "—",
      ].map(esc).join(","));
      const csv = "\uFEFF" + header.map(esc).join(",") + "\n" + rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `就诊记录_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`已导出 ${all.length} 条记录`);
    } catch {
      message.error("导出失败");
    } finally {
      setExporting(false);
    }
  };

  const handleEditSave = async () => {
    if (!detail) return;
    try {
      const values = await editForm.validateFields();
      await updateRecord(detail.id, values);
      message.success("就诊记录已更新");
      setEditModalOpen(false);
      const r = await getRecord(detail.id);
      setDetail(r);
      fetchData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error("更新失败");
    }
  };

  // 统计数据
  const allData = data;
  const pendingDoctor = allData.filter((r) => r.ai_suggestion && r.ai_reviewed === 0).length;
  const pendingAdmin = allData.filter((r) => r.ai_reviewed === 1 && r.admin_reviewed === 0).length;
  const confirmed = allData.filter((r) => r.admin_reviewed === 1).length;

  const columns = [
    {
      title: "患者", dataIndex: "patient_id", width: 168,
      /* 患者是身份列：横向滚动时钉在左边，滚到哪儿都知道自己在看谁 */
      fixed: "left" as const,
      render: (_: any, r: MedicalRecordInfo) => {
        const pName = patients.find((p) => p.value === r.patient_id)?.label || `#${r.patient_id}`;
        const info = patientCache.current.get(r.patient_id);
        const code = `P${String(r.patient_id).padStart(8, "0")}`;
        return (
          <div
            className="cell-main cell-click"
            data-cell="record-patient"
            role="button"
            tabIndex={0}
            aria-label={`查看 ${pName} 的就诊记录`}
            onPointerEnter={() => ensurePatient(r.patient_id)}
            onClick={() => handleView(r.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleView(r.id); }
            }}
          >
            <HoverCard
              width={252}
              delay={280}
              card={
                <>
                  <HoverCardHead
                    avatar={<span className="avatar" style={{ width: 40, height: 40, fontSize: 15 }}>{pName[0]}</span>}
                    name={pName}
                    sub={code}
                  />
                  <HoverCardRows
                    rows={[
                      { label: "性别", value: info?.gender },
                      { label: "出生", value: info?.birth_date },
                      { label: "电话", value: info?.phone },
                      { label: "就诊", value: r.visit_date ? new Date(r.visit_date).toLocaleDateString("zh-CN") : "" },
                      { label: "医生", value: r.doctor_name },
                    ]}
                  />
                </>
              }
            >
              <span className="avatar sq">{pName[0]}</span>
            </HoverCard>
            <span className="cell-text">
              <span className="cell-title">{pName}</span>
              <span className="cell-sub">{code}</span>
            </span>
            <RightOutlined className="cell-cue" aria-hidden />
          </div>
        );
      },
    },
    {
      title: "就诊日期", dataIndex: "visit_date", width: 104,
      render: (d: string) => <span className="muted">{d ? new Date(d).toLocaleDateString("zh-CN") : "-"}</span>,
    },
    { title: "接诊医生", dataIndex: "doctor_name", width: 84 },
    { title: "主诉症状", dataIndex: "symptoms", ellipsis: true },
    {
      title: "诊断结果", dataIndex: "diagnosis", width: 140, ellipsis: true,
      render: (v: string) => v || <span style={{ color: "#999" }}>待诊断</span>,
    },
    {
      title: "医生审核", width: 92,
      render: (_: any, r: MedicalRecordInfo) => {
        if (!r.ai_suggestion) return <span className="badge gray">无AI</span>;
        const al = aiReviewLabels[r.ai_reviewed ?? 0] ?? aiReviewLabels[0];
        return <span className={`badge ${r.ai_reviewed === 1 ? "green" : r.ai_reviewed === 2 ? "red" : "gray"}`}>{al.text}</span>;
      },
    },
    {
      title: "管理员审核", width: 100,
      render: (_: any, r: MedicalRecordInfo) => {
        if (r.ai_reviewed !== 1) return <span className="badge gray">—</span>;
        const al = adminReviewLabels[r.admin_reviewed ?? 0] ?? adminReviewLabels[0];
        return <span className={`badge ${r.admin_reviewed === 1 ? "green" : r.admin_reviewed === 2 ? "red" : "amber"}`}>{al.text}</span>;
      },
    },
    {
      title: "操作", width: 84, className: "col-actions",
      /* 同理：钉在右边。不固定的话横向滚动会把它推出可视区，
         图标就变成了点不到的"幽灵按钮"。 */
      fixed: "right" as const,
      render: (_: any, r: MedicalRecordInfo) => {
        const canEdit = user?.role === "admin" || r.doctor_id === user?.id;
        return (
          <div className="row-actions">
            <Tooltip title="查看详情">
              <button
                type="button" className="icon-btn" data-act="view" aria-label="查看详情"
                onClick={(e) => { e.stopPropagation(); handleView(r.id); }}
              >
                <EyeOutlined />
              </button>
            </Tooltip>
            {canEdit && (
              <Tooltip title="编辑记录">
                <button
                  type="button" className="icon-btn" data-act="edit" aria-label="编辑记录"
                  onClick={(e) => { e.stopPropagation(); handleView(r.id); setTimeout(handleEditOpen, 300); }}
                >
                  <EditOutlined />
                </button>
              </Tooltip>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>就诊记录</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>按患者、医生与审核状态检索每一次就诊，保证记录可追溯。</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="lv-btn" type="button" onClick={handleExport}><DownloadOutlined /> 导出</button>
          {user?.role !== "patient" && (
            <button className="lv-btn lv-btn--primary" type="button" onClick={handleCreateOpen}><PlusOutlined /> 新建记录</button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="lv-metrics">
        <div className="lv-metric">
          <span className="lv-metric-label">本月记录</span>
          <span className="lv-metric-figure tnum">{total}</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>本月累计</span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">待医生确认</span>
          <span className="lv-metric-figure tnum" style={{ color: "#b9770a" }}>{pendingDoctor}</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>医生审核</span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">待管理员审</span>
          <span className="lv-metric-figure tnum">{String(pendingAdmin).padStart(2, "0")}</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>管理员审核</span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">已通过</span>
          <span className="lv-metric-figure tnum" style={{ color: "#3f8a1e" }}>{confirmed}</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>通过率 {total > 0 ? ((confirmed / total) * 100).toFixed(1) : "0"}%</span>
        </div>
      </div>

      {/* 主内容区：左侧表格 + 右侧详情 */}
      <div className="split wide">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>记录列表</h2>
              <small>支持按患者、医生、日期与审核状态组合筛选</small>
            </div>
            <div className="segmented">
              {["全部", "未审核", "已确认", "待管理员审", "已通过", "已驳回"].map((s) => (
                <button key={s} className={segFilter === s ? "selected" : ""} onClick={() => applySegFilter(s)}>{s}</button>
              ))}
            </div>
          </div>
          <div className="toolbar">
            <label className="input" style={{ flex: 1 }}>
              <SearchOutlined style={{ color: "#9aa6b6" }} />
              <Input
                placeholder="按患者姓名 / 档案号筛选"
                variant="borderless"
                allowClear
                value={patientKeyword}
                onChange={(e) => {
                  const kw = e.target.value;
                  setPatientKeyword(kw);
                  const p = patients.find((p) => p.label.includes(kw));
                  setPatientId(kw.trim() ? p?.value : undefined);
                  setPage(1);
                }}
              />
            </label>
            <Select
              style={{ width: 150 }} allowClear placeholder="接诊医生 · 全部"
              value={doctorId}
              options={doctors}
              showSearch
              optionFilterProp="label"
              onChange={(v) => { setDoctorId(v as number | undefined); setPage(1); }}
            />
            <Popover
              trigger="click"
              open={moreFilterOpen}
              onOpenChange={setMoreFilterOpen}
              placement="bottomRight"
              content={
                <div style={{ width: 280, display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#8190a4", marginBottom: 6 }}>医生审核状态</div>
                    <Select
                      mode="multiple"
                      style={{ width: "100%" }}
                      placeholder="不限"
                      value={aiReviewed}
                      onChange={(v) => { setAiReviewed(v); setPage(1); setSegFilter("全部"); }}
                      options={[
                        { value: "0", label: "未审核" },
                        { value: "1", label: "已确认" },
                        { value: "2", label: "已驳回" },
                      ]}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#8190a4", marginBottom: 6 }}>管理员审核状态</div>
                    <Select
                      mode="multiple"
                      style={{ width: "100%" }}
                      placeholder="不限"
                      value={adminReviewed}
                      onChange={(v) => { setAdminReviewed(v); setPage(1); setSegFilter("全部"); }}
                      options={[
                        { value: "0", label: "待管理员审" },
                        { value: "1", label: "已通过" },
                        { value: "2", label: "管理员驳回" },
                      ]}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#8190a4" }}>
                      当前筛选出 {total} 条记录
                    </span>
                    <Button size="small" onClick={clearFilters}>清空筛选</Button>
                  </div>
                </div>
              }
            >
              <Button icon={<FilterOutlined />}>
                更多筛选{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
              </Button>
            </Popover>
          </div>
          <div className="table-wrap">
            <Table
              rowKey="id"
              rowSelection={{}}
              columns={columns}
              dataSource={data}
              loading={loading}
              /* 不设 scroll.x 的话 table-layout:auto 会把「主诉症状」压成 0 宽、
                 再把「操作」顶出容器 —— 两列都等于消失。给定宽度让它固定布局，
                 配 fixed 左/右列，才是这张宽表该有的样子。 */
              scroll={{ x: 1000 }}
              pagination={{
                current: page, total, pageSize: 20,
                showTotal: (t) => `共 ${t} 条记录 · 每页 20 条`,
                onChange: (p) => setPage(p),
                size: "small",
              }}
              size="small"
            />
          </div>
        </section>

        {/* 右侧详情面板 */}
        <aside className="stack">
          {detail ? (
            <>
              <section className="panel">
                <div className="panel-body" style={{ paddingTop: 20 }}>
                  <div className="person" style={{ marginBottom: 16 }}>
                    <span className="avatar lg">
                      {patients.find((p) => p.value === detail.patient_id)?.label?.[0] || "患"}
                    </span>
                    <span>
                      <b style={{ fontSize: 16 }}>
                        {patients.find((p) => p.value === detail.patient_id)?.label || `患者#${detail.patient_id}`}
                      </b>
                      <small style={{ display: "block", color: "#8d9aae", marginTop: 4 }}>
                        P{String(detail.patient_id).padStart(8, "0")}
                      </small>
                      <span style={{ display: "inline-block", marginTop: 8 }}>
                        <span className="badge">门诊病历</span>
                        {" "}
                        <span className={`badge ${detail.admin_reviewed === 1 ? "green" : detail.admin_reviewed === 2 ? "red" : "amber"}`}>
                          {detail.admin_reviewed === 1 ? "已通过" : detail.admin_reviewed === 2 ? "已驳回" : "待管理员审"}
                        </span>
                      </span>
                    </span>
                  </div>
                  <dl className="kv">
                    <dt>就诊日期</dt>
                    <dd>{detail.visit_date ? new Date(detail.visit_date).toLocaleDateString("zh-CN") : "-"}</dd>
                    <dt>挂号时间</dt>
                    <dd>{detail.registration_time ? new Date(detail.registration_time).toLocaleString("zh-CN") : "-"}</dd>
                    <dt>接诊医生</dt>
                    <dd>{detail.doctor_name || "-"}</dd>
                    <dt>诊室</dt>
                    <dd>{detail.room || "待分配"}</dd>
                  </dl>
                  <div className="field" style={{ marginTop: 18 }}>
                    <label>主诉症状</label>
                    <div className="sub">{detail.symptoms || "-"}</div>
                  </div>
                  <div className="field">
                    <label>诊断结果</label>
                    <div className="sub">{detail.diagnosis || "-"}</div>
                  </div>
                  <div className="field">
                    <label>处方</label>
                    <div className="sub">{detail.prescription || "-"}</div>
                  </div>
                  <div className="field">
                    <label>备注</label>
                    <div className="sub">{detail.notes || "-"}</div>
                  </div>
                  {/* 操作按钮 */}
                  <div className="actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
                    {(user?.role === "admin" || detail.doctor_id === user?.id) && (
                      <Button icon={<EditOutlined />} onClick={handleEditOpen}>编辑记录</Button>
                    )}
                    {detail.ai_suggestion && detail.ai_reviewed === 0 && (
                      <Space>
                        <Popconfirm title="确认此AI建议？" onConfirm={() => handleReview(detail.id, "confirm")}>
                          <Button type="primary" icon={<CheckOutlined />}>确认AI</Button>
                        </Popconfirm>
                        <Popconfirm title="驳回此AI建议？" onConfirm={() => handleReview(detail.id, "reject")}>
                          <Button danger icon={<CloseOutlined />}>驳回</Button>
                        </Popconfirm>
                      </Space>
                    )}
                    {user?.role === "admin" && detail.ai_reviewed === 1 && detail.admin_reviewed === 0 && (
                      <Space>
                        <Popconfirm title="确认通过？" onConfirm={() => handleAdminReview(detail.id, "confirm")}>
                          <Button type="primary" icon={<CheckOutlined />}>审核通过</Button>
                        </Popconfirm>
                        <Popconfirm title="驳回？" onConfirm={() => handleAdminReview(detail.id, "reject")}>
                          <Button danger icon={<CloseOutlined />}>驳回</Button>
                        </Popconfirm>
                      </Space>
                    )}
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div><h2>审核流程</h2><small>记录经医生确认后进入管理员审核</small></div>
                </div>
                <div className="panel-body">
                  <div className="timeline">
                    <div className="tl done">
                      <b>记录创建</b>
                      <span>{detail.doctor_name || "医生"} · {detail.visit_date ? new Date(detail.visit_date).toLocaleDateString("zh-CN") : "-"}</span>
                    </div>
                    <div className={`tl ${detail.ai_reviewed === 1 || detail.ai_reviewed === 2 ? "done" : detail.ai_suggestion ? "now" : ""}`}>
                      <b>医生确认</b>
                      <span>
                        {detail.ai_reviewed === 1 ? "已确认诊断与处方" : detail.ai_reviewed === 2 ? "已驳回AI建议" : detail.ai_suggestion ? "等待医生确认" : "无AI建议"}
                      </span>
                    </div>
                    <div className={`tl ${detail.admin_reviewed === 1 || detail.admin_reviewed === 2 ? "done" : detail.ai_reviewed === 1 ? "now" : ""}`}>
                      <b>管理员审核</b>
                      <span>
                        {detail.admin_reviewed === 1 ? `已通过${detail.admin_name ? `（${detail.admin_name}）` : ""}` :
                         detail.admin_reviewed === 2 ? `已驳回${detail.admin_name ? `（${detail.admin_name}）` : ""}` :
                         detail.ai_reviewed === 1 ? "等待医务科审核 · 预计 1 个工作日" : "待医生确认后启动"}
                      </span>
                    </div>
                    <div style={{ paddingBottom: 0 }} className="tl">
                      <b>归档</b>
                      <span>审核通过后对患者端可见</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 相似病例 */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2><ExperimentOutlined /> 相似病例</h2>
                    <small>基于向量语义检索，已脱敏</small>
                  </div>
                  <span className="badge gray">{similarList.length} 例</span>
                </div>
                <div className="panel-body">
                  {similarLoading ? (
                    <div style={{ textAlign: "center", padding: 20, color: "#9aa6b6", fontSize: 12 }}>加载中…</div>
                  ) : similarList.length === 0 ? (
                    <Empty description="暂无相似病例" />
                  ) : (
                    similarList.slice(0, 3).map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "11px 0", borderBottom: i < Math.min(similarList.length, 3) - 1 ? "1px solid #f0f3f8" : "none", fontSize: 11, lineHeight: 1.7 }}>
                        <FileTextOutlined style={{ color: "#9aa6b6", flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <b style={{ display: "block", color: "#2d527e", fontWeight: 600, fontSize: 12 }}>
                            相似度 {((s.similarity_score || 0) * 100).toFixed(0)}% · {s.diagnosis || "未知诊断"}
                          </b>
                          <span className="src" style={{ color: "#8d9aae", fontSize: 10 }}>
                            {s.patient_name || "匿名"} · {s.symptoms?.slice(0, 30) || "-"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="panel">
              <div className="panel-body" style={{ paddingTop: 40, textAlign: "center" }}>
                <div style={{ color: "#9aa6b6", fontSize: 12 }}>点击左侧记录查看详情</div>
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* 新建记录弹窗 */}
      <Modal
        title="新建就诊记录"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreateSave}
        confirmLoading={createSaving}
        okText="创建"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="patient_id" label="患者" rules={[{ required: true, message: "请选择患者" }]}>
            <Select
              placeholder="选择患者"
              showSearch
              options={patients}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="symptoms" label="主诉症状"><VoiceTextArea rows={2} /></Form.Item>
          <Form.Item name="diagnosis" label="诊断结果"><VoiceTextArea rows={3} /></Form.Item>
          <Form.Item name="prescription" label="处方"><VoiceTextArea rows={2} /></Form.Item>
          <Form.Item name="notes" label="备注"><VoiceTextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* 管理员编辑弹窗 */}
      <Modal title="修改就诊记录" open={editModalOpen} onCancel={() => setEditModalOpen(false)} onOk={handleEditSave}>
        <Form form={editForm} layout="vertical">
          {user?.role === "admin" && (
            <>
              <Form.Item name="room" label="诊室"><Input placeholder="分配诊室" /></Form.Item>
              <Form.Item name="doctor_id" label="就诊医生">
                <Select placeholder="选择接诊医生" showSearch options={doctors} filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())} />
              </Form.Item>
            </>
          )}
          <Form.Item name="symptoms" label="主诉症状"><VoiceTextArea rows={2} /></Form.Item>
          <Form.Item name="diagnosis" label="诊断结果"><VoiceTextArea rows={3} /></Form.Item>
          <Form.Item name="prescription" label="处方"><VoiceTextArea rows={2} /></Form.Item>
          <Form.Item name="notes" label="备注"><VoiceTextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
