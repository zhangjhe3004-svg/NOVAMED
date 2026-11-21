/**
 * 患者注册档案（员工查看）—— 患者端注册后入库，员工可检索查看
 * 板块统一为案例设计：页头 + 查询面板 + 列表面板（●共N条）+ 案例式分页条 + 图标操作列。
 */
import { useEffect, useState } from "react";
import { Input, Table, Button, Popconfirm, message, Form, Modal, Select, Tooltip } from "antd";
import { getPatientAccounts, deletePatientAccount, updatePatientAccount } from "../api/patientAccount";
import type { PatientAccount } from "../api/patientAccount";
import { DeleteOutlined, EditOutlined, SearchOutlined, ReloadOutlined } from "@ant-design/icons";

export default function PatientAccounts() {
  const [items, setItems] = useState<PatientAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [kwInput, setKwInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<PatientAccount | null>(null);
  const [editForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const r = await getPatientAccounts({ page, page_size: pageSize, keyword: keyword || undefined });
      setItems(r.items || []);
      setTotal(r.total || 0);
    } catch { /* 忽略 */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [page, pageSize, keyword]);

  const doDelete = async (id: number) => {
    try { await deletePatientAccount(id); message.success("已删除账号"); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "删除失败"); }
  };

  const openEdit = (r: PatientAccount) => {
    setEditing(r);
    editForm.setFieldsValue({ surname: r.surname, given_name: r.given_name, id_type: r.id_type, id_number: r.id_number, phone: r.phone, status: r.status, registered_place: r.registered_place, valid_until: r.valid_until });
    setEditOpen(true);
  };

  const saveEdit = async (v: any) => {
    if (!editing) return;
    try { await updatePatientAccount(editing.id, v); message.success("已更新账号"); setEditOpen(false); setEditing(null); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "保存失败"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>患者注册档案</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>客户端自助注册后入库，员工可检索、核对与维护账号信息。</div>
        </div>
      </div>

      {/* 查询面板 */}
      <div className="lv-query">
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
          placeholder="搜索姓名 / 手机号 / 证件号"
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          onPressEnter={() => { setKeyword(kwInput); setPage(1); }}
          className="lv-query-input"
        />
        <div className="lv-query-actions">
          <button className="lv-btn" type="button" data-act="reset" onClick={() => { setKwInput(""); setKeyword(""); setPage(1); }}>重置</button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="search" onClick={() => { setKeyword(kwInput); setPage(1); }}><SearchOutlined /> 查询</button>
        </div>
      </div>

      {/* 列表面板 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">注册账号</span>
          <span className="lv-panel-meta">共 {total} 条</span>
          <div className="lv-panel-tools">
            <Tooltip title="刷新"><button className="icon-btn" data-act="refresh" onClick={load}><ReloadOutlined /></button></Tooltip>
          </div>
        </div>
        <Table rowKey="id" size="middle" loading={loading} dataSource={items} pagination={false} scroll={{ x: 1180 }}
          columns={[
            { title: "姓名", width: 120, render: (_: any, r: any) => <span style={{ fontWeight: 600, color: "var(--lv-ink)" }}>{`${r.surname || ""}${r.given_name || ""}`}</span> },
            { title: "证件类型", dataIndex: "id_type", width: 110, render: (v: string) => <span className="lv-tag lv-tag--neutral">{v || "-"}</span> },
            { title: "证件号码", dataIndex: "id_number", width: 190, render: (v: string) => <span className="tnum">{v || "-"}</span> },
            { title: "手机号", dataIndex: "phone", width: 130, render: (v: string) => <span className="tnum">{v || "-"}</span> },
            { title: "户籍地", dataIndex: "registered_place", width: 150, render: (v: string) => v || "-" },
            { title: "有效期", dataIndex: "valid_until", width: 110, render: (v: string) => <span className="tnum">{v || "-"}</span> },
            { title: "状态", dataIndex: "status", width: 100, render: (v: string) => <span className="lv-tag lv-tag--leaf"><span className="lv-tag-dot" />{v || "已注册"}</span> },
            { title: "注册时间", dataIndex: "created_at", width: 170, render: (d: string) => <span className="tnum" style={{ color: "var(--lv-faint)" }}>{d ? new Date(d).toLocaleString("zh-CN") : "-"}</span> },
            {
              title: "操作", width: 110, fixed: "right" as const, className: "col-actions",
              render: (_: any, r: PatientAccount) => (
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="编辑"><button className="icon-btn" data-act="edit" onClick={() => openEdit(r)}><EditOutlined /></button></Tooltip>
                  <Popconfirm title="删除账号" description="将同时删除关联的患者数据，确定？" onConfirm={() => doDelete(r.id)}>
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

      {/* 编辑弹窗 */}
      <Modal
        title={editing ? `编辑账号 · ${editing.surname || ""}${editing.given_name || ""}` : "编辑账号"}
        open={editOpen}
        width={620}
        onCancel={() => { setEditOpen(false); setEditing(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setEditOpen(false); setEditing(null); }}>取消</Button>,
          <Button key="ok" type="primary" className="lv-submit" onClick={() => editForm.submit()}>保存</Button>,
        ]}
        destroyOnHidden
        forceRender
      >
        <Form form={editForm} layout="vertical" onFinish={saveEdit} className="lv-form">
          <div className="lv-form-grid">
            <Form.Item name="surname" label="姓"><Input /></Form.Item>
            <Form.Item name="given_name" label="名"><Input /></Form.Item>
            <Form.Item name="id_type" label="证件类型"><Input /></Form.Item>
            <Form.Item name="id_number" label="证件号码"><Input /></Form.Item>
            <Form.Item name="phone" label="手机号"><Input /></Form.Item>
            <Form.Item name="status" label="状态"><Select options={[{ value: "已注册", label: "已注册" }, { value: "已停用", label: "已停用" }]} /></Form.Item>
            <Form.Item name="registered_place" label="户籍地"><Input /></Form.Item>
            <Form.Item name="valid_until" label="有效期"><Input placeholder="如 2030-01-01" /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
