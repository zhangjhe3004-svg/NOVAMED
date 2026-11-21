import { useEffect, useState } from "react";
import { Table, Input, Button, message, Popconfirm, Tooltip, Select } from "antd";
import { PlusOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, EditOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { listPatients, getPatient, deletePatient, type PatientInfo } from "../api/patients";
import PatientFormModal from "../components/PatientFormModal";

export default function PatientList() {
  const [data, setData] = useState<PatientInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [kwInput, setKwInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const navigate = useNavigate();

  // 新增 / 编辑都走弹窗；editing 三态：null=关；"new"=新增；PatientInfo=编辑
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PatientInfo | null | "new">(null);

  const load = async (kw = keyword, p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const r = await listPatients({ keyword: kw || undefined, page: p, page_size: ps });
      setData(r.items); setTotal(r.total);
    } catch (e: any) { message.error(e?.response?.data?.detail || "加载失败"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [page, pageSize]);

  const doDelete = async (id: number) => {
    try { await deletePatient(id); message.success("已删除患者"); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "删除失败"); }
  };

  const openEdit = async (id: number) => {
    try {
      const r = await getPatient(id);
      setEditing(r.patient);
      setFormOpen(true);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载患者失败");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>患者档案</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>维护患者基本档案，点击行进入详情，支持新增与编辑。</div>
        </div>
        <button className="lv-btn lv-btn--primary" type="button" data-act="create" onClick={() => { setEditing("new"); setFormOpen(true); }}>
          <PlusOutlined /> 新增患者
        </button>
      </div>

      {/* 查询面板 */}
      <div className="lv-query">
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
          placeholder="搜索姓名 / 手机号 / 身份证"
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          onPressEnter={() => { setKeyword(kwInput); setPage(1); load(kwInput, 1); }}
          className="lv-query-input"
        />
        <div className="lv-query-actions">
          <button className="lv-btn" type="button" data-act="reset" onClick={() => { setKwInput(""); setKeyword(""); setPage(1); load("", 1); }}>重置</button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="search" onClick={() => { setKeyword(kwInput); setPage(1); load(kwInput, 1); }}><SearchOutlined /> 查询</button>
        </div>
      </div>

      {/* 列表面板 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">患者列表</span>
          <span className="lv-panel-meta">共 {total} 条</span>
          <div className="lv-panel-tools">
            <Tooltip title="刷新"><button className="icon-btn" data-act="refresh" onClick={() => load()}><ReloadOutlined /></button></Tooltip>
          </div>
        </div>
        <Table rowKey="id" loading={loading} dataSource={data} pagination={false} size="middle" scroll={{ x: 820 }}
          onRow={(r) => ({ onClick: () => navigate(`/patients/${r.id}`), style: { cursor: "pointer" } })}
          columns={[
            { title: "姓名", dataIndex: "name", width: 140, render: (v: string) => <span style={{ fontWeight: 600, color: "var(--lv-ink)" }}>{v}</span> },
            { title: "性别", dataIndex: "gender", width: 90, render: (v: string) => <span className="lv-tag lv-tag--neutral">{v}</span> },
            { title: "手机号", dataIndex: "phone", width: 140, render: (v: string) => <span className="tnum">{v || "-"}</span> },
            { title: "身份证号", dataIndex: "id_card", width: 200, render: (v: string) => <span className="tnum">{v || "-"}</span> },
            {
              title: "操作", width: 130, fixed: "right" as const, className: "col-actions",
              render: (_: any, r: any) => (
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="详情"><button className="icon-btn" data-act="detail" onClick={() => navigate(`/patients/${r.id}`)}><EyeOutlined /></button></Tooltip>
                  <Tooltip title="编辑"><button className="icon-btn" data-act="edit" onClick={() => openEdit(r.id)}><EditOutlined /></button></Tooltip>
                  <Popconfirm title="删除患者" description={`确定删除 ${r.name} 吗？`} onConfirm={() => doDelete(r.id)}>
                    <Tooltip title="删除"><button className="icon-btn is-danger" data-act="delete"><DeleteOutlined /></button></Tooltip>
                  </Popconfirm>
                </div>
              ),
            },
          ]} />
        {/* 案例式分页条 */}
        <div className="lv-pager">
          <span className="lv-pager-meta">共 {total} 条，当前 {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</span>
          <div className="lv-pager-right">
            <Select size="small" value={pageSize} onChange={(v) => { setPageSize(v); setPage(1); }} options={[10, 20, 50].map((n) => ({ value: n, label: `${n} 条/页` }))} style={{ width: 96 }} />
            <div className="lv-pager-btns">
              <button className="icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
              <span className="tnum lv-pager-cur">{page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
              <button className="icon-btn" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(page + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

      <PatientFormModal
        open={formOpen}
        patient={editing === "new" ? null : editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => load()}
      />
    </div>
  );
}
