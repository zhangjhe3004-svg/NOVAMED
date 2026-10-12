/**
 * 请假申请中心 —— 复刻「通用后台脚手架」珍珠玻璃板块风格
 *
 * 功能：页头（说明 + 主操作）→ 统计读数条 → 查询区 → 申请记录表格/卡片 → 分页
 *       → 新增/编辑弹窗（日期 / 时长 / 事由 / 审批人）→ 详情抽屉。
 * 状态胶囊：审批中(琥珀) / 已批准(青柠) / 已驳回(红) / 已撤回(灰)，均带圆点。
 * 数字一律走 Odometer；表格宽表固定首列与操作列。
 */
import { useEffect, useMemo, useState } from "react";
import {
  Table, Modal, Form, Input, Select, DatePicker, InputNumber, Tooltip,
  Popconfirm, Segmented, Drawer, Empty, Button, message, Tag,
} from "antd";
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined,
  DeleteOutlined, RollbackOutlined, EyeOutlined, CalendarOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { listRows, insertRow, updateRow, deleteRow } from "../../api/dyn";
import { listUsers, type UserItem } from "../../api/users";
import { cancelInstanceByRow } from "../../api/wf";
import { useAuth } from "../../stores/auth";
import { Odometer } from "../instruments";

const LEAVE_TYPES = ["事假", "病假", "年假", "调休", "婚假", "陪产假", "其他"];

interface LeaveRow {
  id: number;
  employee?: string;
  leave_type?: string;
  start_date?: string;
  days?: number | string;
  reason?: string;
  approver?: string;
  status?: string;
  created_at?: string;
}

const STATUS: Record<string, { text: string; cls: string }> = {
  审批中: { text: "审批中", cls: "lv-tag--amber" },
  已批准: { text: "已批准", cls: "lv-tag--leaf" },
  已驳回: { text: "已驳回", cls: "lv-tag--red" },
  已撤回: { text: "已撤回", cls: "lv-tag--gray" },
};

const AVATAR_PALETTE = ["#3b82f6", "#0ea5a4", "#7c5cff", "#e0708a", "#d6a451"];

function avatarColor(name?: string) {
  const s = String(name || "?");
  let n = 0;
  for (let i = 0; i < s.length; i++) n += s.charCodeAt(i);
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

function statusTag(status?: string) {
  const s = STATUS[status || ""] || { text: status || "待处理", cls: "lv-tag--gray" };
  return (
    <span className={`lv-tag ${s.cls}`}>
      <span className="lv-tag-dot" />
      {s.text}
    </span>
  );
}

export default function LeaveCenter({ config }: { config?: Record<string, any> }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const myName = user?.real_name || user?.username || "";
  const myAuthLevel = user?.auth_level ?? 0;

  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "card">("list");
  const [kw, setKw] = useState("");
  const [fType, setFType] = useState<string | undefined>();
  const [fStatus, setFStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editing, setEditing] = useState<LeaveRow | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<LeaveRow | null>(null);
  const [form] = Form.useForm();

  const [allUsers, setAllUsers] = useState<UserItem[]>([]);

  useEffect(() => {
    listUsers({ page: 1, page_size: 100 }).then((r) => setAllUsers(r.items || [])).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listRows("leave_requests", { page: 1, page_size: 100 });
      setRows(r.items || []);
    } catch { /* 忽略 */ } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // 审批人候选：权限等级严格高于本人（或管理员）的在职用户
  const approverOptions = useMemo(
    () =>
      allUsers
        .filter((u) => u.id !== user?.id && u.work_status !== "离职")
        .filter((u) => isAdmin || (u.auth_level ?? 0) > myAuthLevel)
        .map((u) => ({
          value: u.real_name || u.username,
          label: `${u.real_name || u.username}（${u.department || u.role || "—"}${u.title ? " · " + u.title : ""}）`,
        })),
    [allUsers, user?.id, isAdmin, myAuthLevel]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fType && r.leave_type !== fType) return false;
      if (fStatus && r.status !== fStatus) return false;
      if (kw.trim()) {
        const k = kw.trim();
        const hay = `${r.employee || ""} ${r.reason || ""} ${r.approver || ""}`;
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  }, [rows, kw, fType, fStatus]);

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const stat = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.status === "审批中").length,
    approved: rows.filter((r) => r.status === "已批准").length,
    rejected: rows.filter((r) => r.status === "已驳回").length,
  }), [rows]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ employee: myName });
    setOpen(true);
  };

  const openEdit = (row: LeaveRow) => {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue({
      ...row,
      start_date: row.start_date ? dayjs(row.start_date) : undefined,
    });
    setOpen(true);
  };

  const submit = async (v: any) => {
    setSaving(true);
    const payload = {
      employee: v.employee || myName,
      leave_type: v.leave_type,
      start_date: (v.start_date as Dayjs).format("YYYY-MM-DD"),
      days: Number(v.days),
      reason: v.reason,
      approver: v.approver || "",
      status: editing ? editing.status || "审批中" : "审批中",
      created_at: editing?.created_at || new Date().toLocaleString("zh-CN", { hour12: false }),
    };
    try {
      if (editing?.id) await updateRow("leave_requests", editing.id, payload);
      else await insertRow("leave_requests", payload);
      message.success(editing?.id ? "已保存" : "申请已提交，等待审批");
      setOpen(false);
      setEditing(null);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "提交失败");
    } finally {
      setSaving(false);
    }
  };

  const doRevoke = async (row: LeaveRow) => {
    try {
      await cancelInstanceByRow("leave_approval", row.id).catch(() => {});
      await updateRow("leave_requests", row.id, { status: "已撤回" });
      message.success("已撤回申请");
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "撤回失败");
    }
  };

  const doDelete = async (row: LeaveRow) => {
    try {
      await deleteRow("leave_requests", row.id);
      message.success("已删除");
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "删除失败");
    }
  };

  const canEdit = (r: LeaveRow) => isAdmin;
  const canRevoke = (r: LeaveRow) => r.status === "审批中" && (isAdmin || r.employee === myName);

  const columns = [
    {
      title: "员工", dataIndex: "employee", key: "employee", width: 190, fixed: "left" as const,
      render: (_: any, r: LeaveRow) => (
        <div
          className="cell-main cell-click"
          data-cell="employee"
          role="button"
          tabIndex={0}
          onClick={() => setDetail(r)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetail(r); } }}
        >
          <span className="lv-avatar" style={{ background: avatarColor(r.employee) }}>
            {String(r.employee || "?").slice(0, 1)}
          </span>
          <span className="cell-text">
            <span className="cell-title">{r.employee || "—"}</span>
            <span className="cell-sub">员工申请</span>
          </span>
          <span className="cell-cue">›</span>
        </div>
      ),
    },
    {
      title: "请假类型", dataIndex: "leave_type", key: "leave_type", width: 110,
      render: (v: string) => <span className="lv-tag lv-tag--neutral">{v || "—"}</span>,
    },
    {
      title: "开始日期", dataIndex: "start_date", key: "start_date", width: 130,
      render: (v: string) => <span className="tnum">{v || "—"}</span>,
    },
    {
      title: "时长(天)", dataIndex: "days", key: "days", width: 100,
      render: (v: number | string) => <span className="tnum">{v ?? "—"} 天</span>,
    },
    {
      title: "请假事由", dataIndex: "reason", key: "reason", ellipsis: true,
      render: (v: string) => <span style={{ color: "#5b6b82" }}>{v || "—"}</span>,
    },
    {
      title: "审批人", dataIndex: "approver", key: "approver", width: 140,
      render: (v: string) => <span style={{ color: v ? "#33445c" : "#9aa6b7" }}>{v || "上级审批(默认)"}</span>,
    },
    {
      title: "状态", dataIndex: "status", key: "status", width: 110, render: statusTag,
    },
    {
      title: "提交时间", dataIndex: "created_at", key: "created_at", width: 160,
      render: (v: string) => <span className="tnum" style={{ color: "#9aa6b7" }}>{v || "—"}</span>,
    },
    {
      title: "操作", key: "op", width: 150, fixed: "right" as const,
      render: (_: any, r: LeaveRow) => (
        <span className="row-actions">
          <Tooltip title="详情"><button className="icon-btn" data-act="detail" onClick={(e) => { e.stopPropagation(); setDetail(r); }}><EyeOutlined /></button></Tooltip>
          {canEdit(r) && (
            <Tooltip title="编辑"><button className="icon-btn" data-act="edit" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><EditOutlined /></button></Tooltip>
          )}
          {canRevoke(r) && (
            <Popconfirm title="确认撤回该申请？" onConfirm={() => doRevoke(r)}>
              <button className="icon-btn" data-act="revoke" onClick={(e) => e.stopPropagation()}><RollbackOutlined /></button>
            </Popconfirm>
          )}
          {isAdmin && (
            <Popconfirm title="确认删除？" onConfirm={() => doDelete(r)}>
              <button className="icon-btn is-danger" data-act="delete" onClick={(e) => e.stopPropagation()}><DeleteOutlined /></button>
            </Popconfirm>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="lv">
      {/* 页头：说明 + 主操作 */}
      <div className="lv-head">
        <p className="lv-sub">提交请假申请并跟踪审批进度；审批通过后自动计入考勤，支持按类型与状态检索。</p>
        <div className="lv-head-actions">
          <Segmented
            value={view}
            onChange={(v) => setView(v as "list" | "card")}
            options={[{ label: "列表", value: "list" }, { label: "卡片", value: "card" }]}
          />
          <button className="lv-btn lv-btn--primary" data-act="create" onClick={openCreate}>
            <PlusOutlined /> 新增申请
          </button>
        </div>
      </div>

      {/* 统计读数条 */}
      <div className="lv-metrics">
        <div className="lv-metric">
          <span className="lv-metric-label">累计申请</span>
          <span className="lv-metric-figure tnum"><Odometer value={stat.total} /></span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">审批中</span>
          <span className="lv-metric-figure tnum" style={{ color: "#b9770a" }}><Odometer value={stat.pending} /></span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">已批准</span>
          <span className="lv-metric-figure tnum" style={{ color: "#3f8a1e" }}><Odometer value={stat.approved} /></span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">已驳回</span>
          <span className="lv-metric-figure tnum" style={{ color: "#c4423e" }}><Odometer value={stat.rejected} /></span>
        </div>
      </div>

      {/* 查询区 */}
      <div className="lv-query">
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: "#9aa6b7" }} />}
          placeholder="搜索员工 / 事由 / 审批人"
          value={kw}
          onChange={(e) => { setKw(e.target.value); setPage(1); }}
          className="lv-query-input"
        />
        <Select
          allowClear
          placeholder="全部类型"
          value={fType}
          onChange={(v) => { setFType(v); setPage(1); }}
          options={LEAVE_TYPES.map((t) => ({ value: t, label: t }))}
          className="lv-query-select"
        />
        <Select
          allowClear
          placeholder="全部状态"
          value={fStatus}
          onChange={(v) => { setFStatus(v); setPage(1); }}
          options={Object.keys(STATUS).map((s) => ({ value: s, label: STATUS[s].text }))}
          className="lv-query-select"
        />
        <div className="lv-query-actions">
          <button className="lv-btn" onClick={() => { setKw(""); setFType(undefined); setFStatus(undefined); setPage(1); }}>重置</button>
          <button className="lv-btn lv-btn--primary" data-act="search" onClick={() => setPage(1)}>
            <SearchOutlined /> 查询
          </button>
        </div>
      </div>

      {/* 表格 / 卡片面板 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-panel-title">申请记录</span>
          <span className="lv-panel-meta">共 {filtered.length} 条</span>
          <div className="lv-panel-tools">
            <Tooltip title="刷新"><button className="icon-btn" data-act="refresh" onClick={load}><ReloadOutlined /></button></Tooltip>
          </div>
        </div>

        {view === "list" ? (
          <>
            <Table
              rowKey="id"
              size="middle"
              loading={loading}
              dataSource={paged}
              columns={columns as any}
              pagination={false}
              scroll={{ x: 1120 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无申请记录" /> }}
            />
            <div className="lv-pager">
              <span className="lv-pager-meta">
                共 {filtered.length} 条 · 当前 {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} 条
              </span>
              <div className="lv-pager-right">
                <Select
                  size="small"
                  value={pageSize}
                  onChange={(v) => { setPageSize(v); setPage(1); }}
                  options={[10, 20, 50].map((n) => ({ value: n, label: `${n} 条/页` }))}
                  style={{ width: 100 }}
                />
                <div className="lv-pager-btns">
                  <button className="icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
                  <span className="tnum lv-pager-cur">{page} / {Math.max(1, Math.ceil(filtered.length / pageSize))}</span>
                  <button className="icon-btn" disabled={page >= Math.ceil(filtered.length / pageSize)} onClick={() => setPage(page + 1)}>›</button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="lv-cards">
            {loading ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 32 }} />
            ) : filtered.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无申请记录" style={{ padding: 32 }} />
            ) : (
              paged.map((r) => {
                const tone = (STATUS[r.status || ""] || { cls: "lv-tag--gray" }).cls.replace("lv-tag--", "");
                return (
                  <div key={r.id} className={`lv-card lv-card--${tone}`} data-cell="card" onClick={() => setDetail(r)}>
                    <div className="lv-card-top">
                      <span className="lv-avatar" style={{ background: avatarColor(r.employee) }}>{String(r.employee || "?").slice(0, 1)}</span>
                      <span className="lv-card-name">{r.employee || "—"}</span>
                      {statusTag(r.status)}
                    </div>
                    <div className="lv-card-type">{r.leave_type || "—"}</div>
                    <div className="lv-card-reason">{r.reason || "—"}</div>
                    <div className="lv-card-foot">
                      <span className="tnum"><CalendarOutlined /> {r.start_date || "—"}</span>
                      <span className="tnum">{r.days ?? "—"} 天</span>
                      <span>审批人 {r.approver || "上级"}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 新增 / 编辑弹窗 */}
      <Modal
        open={open}
        title={editing?.id ? "编辑请假申请" : "新增请假申请"}
        width={620}
        onCancel={() => setOpen(false)}
        footer={[
          <Button key="cancel" className="lv-btn-ghost" onClick={() => setOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" loading={saving} onClick={() => form.submit()} className="lv-submit">提交申请</Button>,
        ]}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={submit} className="lv-form">
          <div className="lv-form-grid">
            <Form.Item name="leave_type" label="请假类型" rules={[{ required: true, message: "请选择请假类型" }]}>
              <Select placeholder="选择类型" options={LEAVE_TYPES.map((t) => ({ value: t, label: t }))} />
            </Form.Item>
            <Form.Item name="start_date" label="开始日期" rules={[{ required: true, message: "请选择开始日期" }]}>
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="选择日期" />
            </Form.Item>
            <Form.Item name="days" label="时长(天)" rules={[{ required: true, message: "请输入时长" }]}>
              <InputNumber style={{ width: "100%" }} min={0.5} step={0.5} placeholder="如 1" />
            </Form.Item>
            <Form.Item name="approver" label="审批人">
              <Select
                showSearch
                allowClear
                placeholder="默认上级审批"
                optionFilterProp="label"
                options={approverOptions}
                notFoundContent="无更高权限人员可选"
              />
            </Form.Item>
          </div>
          <Form.Item name="reason" label="请假事由" rules={[{ required: true, message: "请填写请假事由" }]}>
            <Input.TextArea rows={4} placeholder="请简要说明请假原因" />
          </Form.Item>
          <Form.Item name="employee" hidden><Input /></Form.Item>
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title="申请详情"
        size={420}
        open={!!detail}
        onClose={() => setDetail(null)}
        extra={detail ? statusTag(detail.status) : null}
      >
        {detail && (
          <div className="lv-detail">
            <div className="lv-detail-row"><span className="lv-detail-k">员工</span><span className="lv-detail-v">{detail.employee || "—"}</span></div>
            <div className="lv-detail-row"><span className="lv-detail-k">请假类型</span><span className="lv-detail-v">{detail.leave_type || "—"}</span></div>
            <div className="lv-detail-row"><span className="lv-detail-k">开始日期</span><span className="lv-detail-v tnum">{detail.start_date || "—"}</span></div>
            <div className="lv-detail-row"><span className="lv-detail-k">时长</span><span className="lv-detail-v tnum">{detail.days ?? "—"} 天</span></div>
            <div className="lv-detail-row"><span className="lv-detail-k">审批人</span><span className="lv-detail-v">{detail.approver || "上级审批(默认)"}</span></div>
            <div className="lv-detail-row"><span className="lv-detail-k">提交时间</span><span className="lv-detail-v tnum">{detail.created_at || "—"}</span></div>
            <div className="lv-detail-block">
              <div className="lv-detail-k">请假事由</div>
              <div className="lv-detail-reason">{detail.reason || "—"}</div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
