/**
 * 用户管理页面 —— 复刻「通用后台脚手架」用户管理板块（案例截图：部门树 + 查询区 + 用户列表）
 *
 * 版式对齐 scaffold Users.vue：
 *   页头（标题/说明 + 列表·看板切换 + 主操作）→ 左侧科室树 → 关键字/状态查询面板
 *   → 用户列表面板（● 共 N 条 + 刷新/导出）→ 案例式分页条（共 N 条，当前 a–b + N 条/页）。
 *   编辑从右侧面板改为弹窗（与新增同款 620px 两列网格）；看板按在岗状态分列，可拖拽改状态。
 * 数据：一次拉取 100 条（/users 的 page_size 上限），科室/关键字/状态均为客户端过滤
 *   ——顺带修复旧版「在职/离岗 tab 传 work_status 但后端不支持、过滤无效」的问题。
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button, Input, Select, Modal, Form, Table, Radio, Upload, Popconfirm,
  Tooltip, Segmented, message,
} from "antd";
import {
  PlusOutlined, UploadOutlined, SafetyCertificateOutlined, ReloadOutlined,
  EditOutlined, KeyOutlined, DeleteOutlined, RightOutlined, DownOutlined, SearchOutlined,
  DownloadOutlined, TeamOutlined, AppstoreOutlined, UnorderedListOutlined,
} from "@ant-design/icons";
import { listUsers, createUser, updateUser, deleteUser, resetUserPassword, type UserItem } from "../api/users";
import { listRows } from "../api/dyn";
import DeptMembersModal, { type DeptMemberTarget } from "../components/dyn/DeptMembersModal";
import HoverCard, { HoverCardHead, HoverCardRows } from "../components/HoverCard";

const roleOptions = [
  { value: "doctor", label: "医生" },
  { value: "nurse", label: "护士" },
  { value: "admin", label: "管理员" },
  { value: "staff", label: "职员" },
  { value: "pharmacist", label: "药剂师" },
  { value: "maintainer", label: "运维" },
];

const workStatusOptions = [
  { value: "在职", label: "在职" },
  { value: "休息", label: "休息" },
  { value: "离岗", label: "离岗" },
];

/** 权限级别 1-9 的名称，与「角色权限」弹窗、权限阶梯页保持同一套说法 */
const LEVEL_NAMES = ["访客", "实习生", "规培生", "住院医师", "主治医师", "副主任", "主任", "副院长", "超级管理员"];

const roleLabel = (r?: string) => roleOptions.find((o) => o.value === r)?.label || r || "";

const ROLE_COLORS: Record<string, string> = {
  admin: "#236de9", doctor: "#0e9488", nurse: "#7c5cff",
  pharmacist: "#7c5cff", staff: "#64748b", maintainer: "#d6a451",
};

const STATUS_CLS: Record<string, string> = {
  "在职": "lv-tag--leaf",
  "休息": "lv-tag--amber",
  "离岗": "lv-tag--gray",
};

function statusTag(v?: string) {
  const s = v || "在职";
  return (
    <span className={`lv-tag ${STATUS_CLS[s] || "lv-tag--gray"}`}>
      <span className="lv-tag-dot" />
      {s}
    </span>
  );
}

function rolePill(v?: string) {
  const c = ROLE_COLORS[v] || "#64748b";
  return (
    <span className="lv-tag" style={{ color: c, background: `${c}14` }}>{roleLabel(v)}</span>
  );
}

function fmtTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const deptOf = (u: UserItem) => (u.department || "").trim() || "未分配";

export default function UserManagement() {
  const navigate = useNavigate();

  // ── 数据 ────────────────────────────────────────────────
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "board">("list");

  // ── 查询（关键字/状态走「查询」按钮生效；科室树即时生效）──
  const [kwInput, setKwInput] = useState("");
  const [statusInput, setStatusInput] = useState<string | undefined>();
  const [kw, setKw] = useState("");
  const [statusF, setStatusF] = useState<string | undefined>();
  const [deptKw, setDeptKw] = useState("");
  const [dept, setDept] = useState<string | null>(null); // null = 全部
  const [treeOpen, setTreeOpen] = useState(true);

  // ── 分页 ────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── 弹窗 ────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [addLoading, setAddLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);
  const [permOpen, setPermOpen] = useState(false);

  const dragId = useRef<number | null>(null);

  // 科室树子科室：来自低代码集合 dept_members（department → [sub_department…]）
  const [subDepts, setSubDepts] = useState<Record<string, string[]>>({});
  const [memberDepts, setMemberDepts] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [memberTarget, setMemberTarget] = useState<DeptMemberTarget | null>(null);

  // 一次拉取 100 条（/users 接口 page_size 上限即 100），之后全部客户端过滤
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listUsers({ page: 1, page_size: 100 });
      setUsers(r.items || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // 科室树数据源②：低代码集合 dept_members（科室组织页维护），点科室箭头展开子科室。
  // 同时记录其中出现过的全部科室名 —— 树展示的科室 = 用户表科室 ∪ dept_members 科室，
  // 两处任一增删改，树都会自动跟着更新（可刷新按钮重拉）。
  const loadSubDepts = useCallback(async () => {
    try {
      const r = await listRows("dept_members", { page: 1, page_size: 100 });
      const map: Record<string, string[]> = {};
      const ds = new Set<string>();
      (r.items || []).forEach((row: any) => {
        const d = (row.department || "").trim();
        if (!d) return;
        ds.add(d);
        const s = (row.sub_department || "").trim();
        if (s && !(map[d] || []).includes(s)) (map[d] ||= []).push(s);
      });
      Object.values(map).forEach((arr) => arr.sort());
      setSubDepts(map);
      setMemberDepts([...ds].sort((a, b) => a.localeCompare(b, "zh")));
    } catch {
      // 忽略加载失败，保留现有科室
    }
  }, []);
  useEffect(() => { loadSubDepts(); }, [loadSubDepts]);

  // 科室树：按「目前存在的科室」自动聚合 = 用户表科室 ∪ dept_members 科室
  //（数字 = 该科室在列表里的用户数，暂无用户的科室显示 0）
  const depts = useMemo(() => {
    const m = new Map<string, number>();
    users.forEach((u) => m.set(deptOf(u), (m.get(deptOf(u)) || 0) + 1));
    memberDepts.forEach((d) => { if (!m.has(d)) m.set(d, 0); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh"));
  }, [users, memberDepts]);
  const deptOptions = useMemo(() => depts.map(([d]) => ({ value: d, label: d })), [depts]);
  const visibleDepts = useMemo(
    () => (deptKw.trim() ? depts.filter(([d]) => d.includes(deptKw.trim())) : depts),
    [depts, deptKw]
  );

  const filtered = useMemo(() => users.filter((u) => {
    if (dept && deptOf(u) !== dept) return false;
    if (statusF && (u.work_status || "在职") !== statusF) return false;
    if (kw.trim()) {
      const k = kw.trim();
      const hay = `${u.username} ${u.real_name || ""} ${u.phone || ""} ${u.employee_no || ""}`;
      if (!hay.includes(k)) return false;
    }
    return true;
  }), [users, dept, statusF, kw]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );
  useEffect(() => { setPage(1); }, [dept, statusF, kw, pageSize]);

  // ── 增删改 ──────────────────────────────────────────────
  const handleAdd = async (values: any) => {
    setAddLoading(true);
    try {
      await createUser(values);
      message.success("用户已创建");
      setAddOpen(false);
      addForm.resetFields();
      load();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "创建失败");
    } finally {
      setAddLoading(false);
    }
  };

  const openEdit = (u: UserItem) => {
    setEditUser(u);
    editForm.setFieldsValue({
      real_name: u.real_name,
      employee_no: u.employee_no,
      username: u.username,
      phone: u.phone,
      email: u.email,
      role: u.role,
      department: u.department,
      title: u.title,
      auth_level: u.auth_level,
      superior_id: u.superior_id,
      work_status: u.work_status || "在职",
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      const values = await editForm.validateFields();
      await updateUser(editUser.id, values);
      message.success("用户信息已更新");
      setEditOpen(false);
      setEditUser(null);
      editForm.resetFields();
      load();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.detail || "保存失败");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (u: UserItem) => {
    try {
      await deleteUser(u.id);
      message.success(`已删除 ${u.real_name || u.username}`);
      if (editUser?.id === u.id) { setEditOpen(false); setEditUser(null); }
      load();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "删除失败");
    }
  };

  const resetPwd = async (u: UserItem) => {
    const who = u.real_name || u.username;
    const pwd = window.prompt(`为「${who}」设置新密码（最少 6 位）`);
    if (pwd === null) return;
    if (pwd.length < 6) { message.warning("密码至少 6 位"); return; }
    try {
      await resetUserPassword(u.id, pwd);
      message.success(`「${who}」的密码已重置`);
    } catch (err: any) {
      message.error(err.response?.data?.detail || "重置失败");
    }
  };

  const openTrace = (u: UserItem) => navigate(`/role-trace?trace=user:${u.id}`);

  // 看板拖拽：改在岗状态
  const onDropStatus = async (col: string) => {
    const id = dragId.current;
    dragId.current = null;
    if (id == null) return;
    const u = users.find((x) => x.id === id);
    if (!u || (u.work_status || "在职") === col) return;
    try {
      await updateUser(id, { work_status: col });
      setUsers((prev) => prev.map((x) => (x.id === id ? { ...x, work_status: col } : x)));
      message.success(`「${u.real_name || u.username}」已移至「${col}」`);
    } catch (err: any) {
      message.error(err.response?.data?.detail || "更新失败");
    }
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length <= 1) { message.warning("文件无有效数据行"); return; }
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      let imported = 0;
      Promise.all(lines.slice(1).map(async (line) => {
        const vals = line.split(",").map((v) => v.trim());
        if (vals.length < 2) return;
        const row: any = {};
        header.forEach((h, i) => { if (vals[i]) row[h] = vals[i]; });
        if (!row.username || !row.password) return;
        try {
          await createUser({ ...row, real_name: row.real_name || row.username });
          imported++;
        } catch {}
      })).then(() => {
        if (imported > 0) {
          message.success(`成功导入 ${imported} 名用户`);
          load();
        } else {
          message.warning("没有可导入的数据（需含 username,password 列）");
        }
      });
    };
    reader.readAsText(file);
    return false;
  };

  const exportCsv = () => {
    const header = ["用户名", "姓名", "科室", "岗位", "角色", "手机号", "状态", "创建时间"];
    const rows = filtered.map((u) => [
      u.username, u.real_name || "", deptOf(u), u.title || "", roleLabel(u.role),
      u.phone || "", u.work_status || "在职", fmtTime(u.created_at),
    ]);
    const csv = "\uFEFF" + [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `用户列表-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    message.success(`已导出 ${rows.length} 条`);
  };

  // ── 表格列（对齐案例：用户/科室/岗位/角色/手机号/状态/创建时间/操作）──
  const supName = (id?: number | null, fallback = "—") => {
    if (!id) return fallback;
    const sup = users.find((x) => x.id === id);
    return sup ? sup.real_name || sup.username : `#${id}`;
  };

  const columns = [
    {
      title: "用户", dataIndex: "real_name", key: "name", width: 190, fixed: "left" as const,
      render: (name: string, u: UserItem) => {
        const initial = name?.[0] || "?";
        return (
          <div
            className="cell-main cell-click"
            data-cell="user-name"
            role="button"
            tabIndex={0}
            aria-label={`编辑 ${name || u.username}`}
            onClick={(e) => { e.stopPropagation(); openEdit(u); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(u); }
            }}
          >
            <HoverCard
              width={252}
              delay={280}
              card={
                <>
                  <HoverCardHead
                    avatar={<span className="avatar" style={{ width: 40, height: 40, fontSize: 15 }}>{initial}</span>}
                    name={name || "—"}
                    sub={`@${u.username}`}
                  />
                  <HoverCardRows
                    rows={[
                      { label: "工号", value: u.employee_no },
                      { label: "科室", value: deptOf(u) },
                      { label: "角色", value: roleLabel(u.role) },
                      { label: "职称", value: u.title },
                      { label: "权限", value: u.auth_level ? `L${u.auth_level} · ${LEVEL_NAMES[u.auth_level - 1] ?? ""}` : "" },
                      { label: "上级", value: u.superior_id ? supName(u.superior_id, "") : "" },
                      { label: "邮箱", value: u.email },
                    ]}
                  />
                </>
              }
            >
              <span className="avatar">{initial}</span>
            </HoverCard>
            <span className="cell-text">
              <span className="cell-title">{name || "—"}</span>
              <span className="cell-sub">@{u.username}</span>
            </span>
            <RightOutlined className="cell-cue" aria-hidden />
          </div>
        );
      },
    },
    { title: "科室", dataIndex: "department", key: "department", width: 120, render: (_: any, u: UserItem) => deptOf(u) },
    { title: "岗位", dataIndex: "title", key: "title", width: 130, render: (v: string) => v || "—" },
    { title: "角色", dataIndex: "role", key: "role", width: 110, render: (v: string) => rolePill(v) },
    { title: "手机号", dataIndex: "phone", key: "phone", width: 130, render: (v: string) => <span className="tnum">{v || "—"}</span> },
    { title: "状态", dataIndex: "work_status", key: "status", width: 100, render: (v: string) => statusTag(v) },
    {
      title: "创建时间", dataIndex: "created_at", key: "created_at", width: 150,
      render: (v: string) => <span className="tnum" style={{ color: "#9aa6b7" }}>{fmtTime(v)}</span>,
    },
    {
      title: "操作", key: "action", width: 132, className: "col-actions", fixed: "right" as const,
      render: (_: any, u: UserItem) => (
        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="编辑">
            <button type="button" className="icon-btn" data-act="edit" aria-label="编辑" onClick={() => openEdit(u)}>
              <EditOutlined />
            </button>
          </Tooltip>
          <Tooltip title="权限溯源">
            <button type="button" className="icon-btn" data-act="trace" aria-label="权限溯源" onClick={() => openTrace(u)}>
              <SafetyCertificateOutlined />
            </button>
          </Tooltip>
          <Tooltip title="重置密码">
            <button type="button" className="icon-btn" data-act="reset" aria-label="重置密码" onClick={() => resetPwd(u)}>
              <KeyOutlined />
            </button>
          </Tooltip>
          <Popconfirm title="确定删除该用户？" placement="topRight" onConfirm={() => handleDelete(u)}>
            <Tooltip title="删除">
              <button type="button" className="icon-btn is-danger" data-act="delete" aria-label="删除">
                <DeleteOutlined />
              </button>
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const panelHead = (title: string, total: number, tools?: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderBottom: "1px solid var(--lv-line)" }}>
      <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0, borderRadius: 999 }}>
        <span className="lv-tag-dot" />
      </span>
      <span style={{ fontSize: 14, fontWeight: 650, color: "var(--lv-ink)" }}>{title}</span>
      <span style={{ fontSize: 12, color: "var(--lv-faint)", fontVariantNumeric: "tabular-nums" }}>共 {total} 条</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>{tools}</div>
    </div>
  );

  return (
    <div style={{ padding: "8px 0 32px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── 页头：标题/说明 + 视图切换 + 主操作 ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>用户管理</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>
            维护医院员工账号，所属科室、岗位与角色；停用的账号无法登录。
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={view}
            onChange={(v) => setView(v as "list" | "board")}
            options={[
              { label: <span><UnorderedListOutlined /> 列表</span>, value: "list" },
              { label: <span><AppstoreOutlined /> 看板</span>, value: "board" },
            ]}
          />
          <Upload accept=".csv,.txt" showUploadList={false} beforeUpload={handleImport}>
            <button className="lv-btn" type="button"><UploadOutlined /> 批量导入</button>
          </Upload>
          <button className="lv-btn" type="button" onClick={() => setPermOpen(true)}><SafetyCertificateOutlined /> 角色权限</button>
          <button
            className="lv-btn lv-btn--primary" type="button" data-act="create"
            onClick={() => { addForm.resetFields(); setAddOpen(true); }}
          >
            <PlusOutlined /> 新增用户
          </button>
        </div>
      </div>

      {/* ── 分栏：科室树 + 查询/列表 ── */}
      <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
        {/* 科室树（对齐案例左栏） */}
        <div
          className="lv-panel"
          style={{ width: 256, flex: "none", alignSelf: "flex-start", position: "sticky", top: 84 }}
          data-cell="dept-tree"
        >
          <div style={{ padding: "13px 14px" }}>
            <Input
              allowClear
              size="small"
              prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
              placeholder="搜索科室"
              value={deptKw}
              onChange={(e) => setDeptKw(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            {/* 根节点 */}
            <button
              type="button"
              onClick={() => setDept(null)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px",
                border: 0, borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 13,
                background: dept === null ? "var(--lv-blue-soft)" : "transparent",
                color: dept === null ? "var(--lv-blue)" : "var(--lv-ink)", fontWeight: dept === null ? 650 : 500,
              }}
            >
              <TeamOutlined style={{ fontSize: 12, color: dept === null ? "var(--lv-blue)" : "var(--lv-faint)" }} />
              医院组织
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--lv-faint)" }}>{users.length}</span>
            </button>
            {/* 科室子节点 */}
            {treeOpen && (
              <div style={{ marginTop: 2 }}>
                {visibleDepts.length === 0 && (
                  <div style={{ padding: "6px 8px", fontSize: 12, color: "var(--lv-faint)" }}>无匹配科室</div>
                )}
                {visibleDepts.map(([d, count]) => {
                  const active = dept === d;
                  const subs = subDepts[d] || [];
                  const open = !!expanded[d];
                  return (
                    <div key={d}>
                      <button
                        type="button"
                        data-act="pick-dept"
                        onClick={() => setDept(active ? null : d)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px 7px 12px",
                          border: 0, borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 13,
                          background: active ? "var(--lv-blue-soft)" : "transparent",
                          color: active ? "var(--lv-blue)" : "#4a5a72", fontWeight: active ? 650 : 400,
                          transition: "background-color .15s ease",
                        }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f4f7fb"; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                      >
                        {subs.length > 0 ? (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={open ? `收起${d}的子科室` : `展开${d}的子科室`}
                            data-act="toggle-sub"
                            onClick={(e) => { e.stopPropagation(); setExpanded((p) => ({ ...p, [d]: !open })); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setExpanded((p) => ({ ...p, [d]: !open })); } }}
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 5, color: active ? "var(--lv-blue)" : "var(--lv-faint)", cursor: "pointer", flex: "none", transition: "background-color .15s ease" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(46,58,62,.07)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                          >
                            {open ? <DownOutlined style={{ fontSize: 9 }} /> : <RightOutlined style={{ fontSize: 9 }} />}
                          </span>
                        ) : (
                          <span style={{ width: 18, flex: "none" }} />
                        )}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d}</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--lv-faint)" }}>{count}</span>
                      </button>
                      {/* 子科室：下拉展开（内科1 / 内科2 …），点击查看该子科室人员名单 */}
                      {open && subs.length > 0 && (
                        <div style={{ paddingBottom: 4 }}>
                          {subs.map((s) => (
                            <button
                              key={s}
                              type="button"
                              data-act="pick-sub"
                              onClick={() => setMemberTarget({ dept: d, sub: s })}
                              style={{
                                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "5px 8px 5px 44px",
                                border: 0, borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 12.5,
                                background: "transparent", color: "var(--lv-muted)",
                                transition: "background-color .15s ease",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f7fb"; e.currentTarget.style.color = "var(--lv-blue)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--lv-muted)"; }}
                            >
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</span>
                              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--lv-faint)", opacity: 0, transition: "opacity .18s ease" }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; }}
                              >
                                名单 ›
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DeptMembersModal target={memberTarget} onClose={() => { setMemberTarget(null); loadSubDepts(); }} />

        {/* 右列：查询面板 + 列表/看板 */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 查询面板 */}
          <div className="lv-query" style={{ borderRadius: 16 }}>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
              placeholder="账号 / 姓名 / 手机号"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onPressEnter={() => { setKw(kwInput); setPage(1); }}
              className="lv-query-input"
              data-act="keyword"
            />
            <Select
              allowClear
              placeholder="全部状态"
              value={statusInput}
              onChange={(v) => setStatusInput(v)}
              options={workStatusOptions}
              className="lv-query-select"
              style={{ width: 150 }}
              data-act="status-filter"
            />
            <div className="lv-query-actions">
              <button
                className="lv-btn" type="button" data-act="reset"
                onClick={() => { setKwInput(""); setStatusInput(undefined); setKw(""); setStatusF(undefined); setDept(null); setPage(1); }}
              >
                重置
              </button>
              <button
                className="lv-btn lv-btn--primary" type="button" data-act="search"
                onClick={() => { setKw(kwInput); setStatusF(statusInput); setPage(1); }}
              >
                <SearchOutlined /> 查询
              </button>
            </div>
          </div>

          {view === "list" ? (
            /* 用户列表面板 */
            <div className="lv-panel">
              {panelHead("用户列表", filtered.length, (
                <>
                  <Tooltip title="刷新">
                    <button className="icon-btn" type="button" data-act="refresh" onClick={() => { load(); loadSubDepts(); }}><ReloadOutlined /></button>
                  </Tooltip>
                  <Tooltip title="导出当前查询结果">
                    <button className="icon-btn" type="button" data-act="export" onClick={exportCsv}><DownloadOutlined /></button>
                  </Tooltip>
                </>
              ))}
              <div style={{ padding: "0" }}>
                <Table
                  columns={columns as any}
                  dataSource={paged}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                  size="middle"
                  scroll={{ x: 1020 }}
                  locale={{ emptyText: "暂无用户数据" }}
                />
              </div>
              {/* 案例式分页条 */}
              <div className="lv-pager">
                <span className="lv-pager-meta">
                  共 {filtered.length} 条，当前 {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}
                </span>
                <div className="lv-pager-right">
                  <Select
                    size="small"
                    value={pageSize}
                    onChange={(v) => setPageSize(v)}
                    options={[10, 20, 50].map((n) => ({ value: n, label: `${n} 条/页` }))}
                    style={{ width: 96 }}
                  />
                  <div className="lv-pager-btns">
                    <button className="icon-btn" type="button" aria-label="上一页" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
                    <span className="tnum lv-pager-cur">{page} / {Math.max(1, Math.ceil(filtered.length / pageSize))}</span>
                    <button
                      className="icon-btn" type="button" aria-label="下一页"
                      disabled={page >= Math.ceil(filtered.length / pageSize)} onClick={() => setPage(page + 1)}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 看板：按在岗状态分列，可拖拽改状态 */
            <div className="lv-panel" style={{ padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {workStatusOptions.map((col) => {
                  const colUsers = filtered.filter((u) => (u.work_status || "在职") === col.value);
                  return (
                    <div
                      key={col.value}
                      data-cell={`board-${col.value}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDropStatus(col.value)}
                      style={{ background: "#f7fafd", border: "1px solid var(--lv-line)", borderRadius: 14, padding: 12, minHeight: 320 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        {statusTag(col.value)}
                        <span style={{ fontSize: 12, color: "var(--lv-faint)" }}>{colUsers.length} 人</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {colUsers.map((u) => (
                          <div
                            key={u.id}
                            draggable
                            onDragStart={(e) => { dragId.current = u.id; e.dataTransfer.effectAllowed = "move"; }}
                            onClick={() => openEdit(u)}
                            style={{
                              background: "#fff", border: "1px solid var(--lv-line)", borderRadius: 12,
                              padding: "10px 12px", cursor: "grab", display: "flex", alignItems: "center", gap: 10,
                              transition: "box-shadow .18s ease, transform .14s ease",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 16px rgba(20,45,83,.10)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                          >
                            <span className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{(u.real_name || u.username || "?")[0]}</span>
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--lv-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {u.real_name || "—"}
                              </span>
                              <span style={{ display: "block", fontSize: 11, color: "var(--lv-faint)" }}>@{u.username} · {deptOf(u)}</span>
                            </span>
                            <span style={{ marginLeft: "auto" }}>{rolePill(u.role)}</span>
                          </div>
                        ))}
                        {colUsers.length === 0 && (
                          <div style={{ fontSize: 12, color: "var(--lv-faint)", textAlign: "center", padding: "20px 0" }}>
                            拖拽用户卡片到这一列
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 新增用户弹窗（案例同款：620px 两列网格 + 右下蓝色保存）── */}
      <Modal
        title="新增用户"
        open={addOpen}
        width={620}
        onCancel={() => setAddOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setAddOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" loading={addLoading} className="lv-submit" onClick={() => addForm.submit()}>保存</Button>,
        ]}
        destroyOnHidden
        forceRender
      >
        <Form form={addForm} layout="vertical" onFinish={handleAdd} className="lv-form">
          <div className="lv-form-grid">
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
              <Input placeholder="登录用户名" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password placeholder="最少 6 位" />
            </Form.Item>
            <Form.Item name="real_name" label="真实姓名">
              <Input placeholder="员工真实姓名" />
            </Form.Item>
            <Form.Item name="role" label="角色" initialValue="doctor">
              <Select options={roleOptions} />
            </Form.Item>
            <Form.Item name="department" label="科室">
              <Select placeholder="选择科室" allowClear options={deptOptions} />
            </Form.Item>
            <Form.Item name="title" label="职称">
              <Input placeholder="如：主治医师" />
            </Form.Item>
            <Form.Item name="phone" label="手机号" style={{ gridColumn: "span 2" }}>
              <Input placeholder="手机号" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* ── 编辑用户弹窗（替代原右侧编辑面板，字段不变）── */}
      <Modal
        title={editUser ? `编辑用户 · ${editUser.real_name || editUser.username}` : "编辑用户"}
        open={editOpen}
        width={620}
        onCancel={() => { setEditOpen(false); setEditUser(null); }}
        footer={[
          editUser ? (
            <Button key="reset" danger size="small" style={{ marginRight: "auto" }} onClick={() => resetPwd(editUser)}>重置密码</Button>
          ) : null,
          <Button key="cancel" onClick={() => { setEditOpen(false); setEditUser(null); }}>取消</Button>,
          <Button key="ok" type="primary" loading={editLoading} className="lv-submit" onClick={handleSaveEdit}>保存</Button>,
        ].filter(Boolean)}
        destroyOnHidden
        forceRender
      >
        <Form form={editForm} layout="vertical" className="lv-form">
          <div className="lv-form-grid">
            <Form.Item name="real_name" label="真实姓名">
              <Input placeholder="输入姓名" />
            </Form.Item>
            <Form.Item name="employee_no" label="工号">
              <Input placeholder="输入工号" />
            </Form.Item>
            <Form.Item name="username" label="用户名">
              <Input placeholder="登录用户名" />
            </Form.Item>
            <Form.Item name="role" label="角色">
              <Select placeholder="选择角色" options={roleOptions} />
            </Form.Item>
            <Form.Item name="department" label="科室">
              <Select placeholder="选择科室" allowClear options={deptOptions} />
            </Form.Item>
            <Form.Item name="title" label="职称">
              <Input placeholder="如：主治医师" />
            </Form.Item>
            <Form.Item name="phone" label="电话">
              <Input placeholder="输入电话" />
            </Form.Item>
            <Form.Item name="email" label="邮箱">
              <Input placeholder="输入邮箱" />
            </Form.Item>
            <Form.Item name="auth_level" label="权限级别（1-9）">
              <Select options={Array.from({ length: 9 }, (_, i) => ({ value: i + 1, label: `${i + 1} · ${LEVEL_NAMES[i]}` }))} />
            </Form.Item>
            <Form.Item name="superior_id" label="上级（可输入搜索）">
              <Select
                placeholder="无上级"
                allowClear
                showSearch
                optionFilterProp="label"
                options={users.filter((u) => u.id !== editUser?.id).map((u) => ({ value: u.id, label: `${u.real_name || u.username}（${deptOf(u)} · L${u.auth_level ?? 1}）` }))}
              />
            </Form.Item>
            <Form.Item name="work_status" label="在岗状态" style={{ gridColumn: "span 2" }}>
              <Radio.Group options={workStatusOptions} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* ── 角色权限弹窗（保留既有功能）── */}
      <Modal title="角色权限管理" open={permOpen} onCancel={() => setPermOpen(false)} footer={null} width={560}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
          {[
            { role: "admin", label: "管理员", desc: "完全访问：用户管理、系统设置、所有科室数据、审计日志", color: "#236de9" },
            { role: "doctor", label: "医生", desc: "诊疗权限：患者档案、就诊记录、AI诊断、知识库、排班表", color: "#0e9488" },
            { role: "nurse", label: "护士", desc: "辅助权限：查看患者档案、预约管理、排班表", color: "#7c5cff" },
            { role: "pharmacist", label: "药剂师", desc: "药房权限：药房管理、处方审核、库存查看", color: "#7c5cff" },
            { role: "staff", label: "职员", desc: "基础权限：查看公告、个人排班、请假审批", color: "#64748b" },
            { role: "maintainer", label: "运维", desc: "运维权限：系统监控、数据库维护、日志查看", color: "#d6a451" },
          ].map((r) => (
            <div key={r.role} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid var(--lv-line)", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: `${r.color}15`, color: r.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 }}>
                {r.label[0]}
              </div>
              <div>
                <span style={{ fontWeight: 600, color: "var(--lv-ink)" }}>{r.label}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--lv-muted)" }}>{r.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
