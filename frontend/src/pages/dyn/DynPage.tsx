import { useEffect, useState } from "react";
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Popconfirm } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useParams } from "react-router-dom";
import { listRows, insertRow, updateRow, deleteRow, listCollections, type DynCollection } from "../../api/dyn";
import { listUsers } from "../../api/users";
import { useAuth } from "../../stores/auth";
import DeptMembersModal, { type DeptMemberTarget } from "../../components/dyn/DeptMembersModal";
import VoiceTextArea from "../../components/VoiceTextArea";

interface DynPageProps {
  collection?: string;
  mode?: string;
}

export default function DynPage({ collection: propCollection }: DynPageProps) {
  const { collection: urlCollection } = useParams();
  const collection = propCollection || urlCollection;

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [cols, setCols] = useState<DynCollection[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  // 科室组织「负责人」下拉：从已有员工中选择（新增员工后自动出现）
  const [employees, setEmployees] = useState<{ id: number; label: string; value: string }[]>([]);
  // 点击子科室后弹出的人员名单
  const [memberTarget, setMemberTarget] = useState<DeptMemberTarget | null>(null);

  const loadMeta = async () => {
    try { const r = await listCollections(); setCols(r.items); } catch { /* 忽略 */ }
  };
  const loadRows = async () => {
    setLoading(true);
    try {
      const r = await listRows(collection!, { page, page_size: 20 });
      setRows(r.items); setTotal(r.total);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载失败（集合可能不存在）");
    } finally { setLoading(false); }
  };
  // 科室组织：加载员工列表作为「负责人」候选；仅管理员可分配
  const loadEmployees = async () => {
    if (collection !== "departments") return;
    try {
      const r = await listUsers({ page: 1, page_size: 200 });
      setEmployees((r.items || []).map((u) => ({
        id: u.id,
        value: u.real_name || u.username,
        label: `${u.real_name || u.username}（${u.department || u.role}）`,
      })));
    } catch { /* 非管理员或加载失败时退回手填 */ }
  };
  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { if (collection) loadRows(); }, [collection, page]);
  useEffect(() => { loadEmployees(); }, [collection]);

  const meta = cols.find((c) => c.name === collection);
  const fields = (meta?.fields || []).filter((f) => !f.primary);
  // 科室组织的负责人只能由系统管理员分配；其他集合保持原行为
  const canEdit = collection !== "departments" || isAdmin;

  const columns = [
    ...fields.map((f) => ({ title: f.label || f.name, dataIndex: f.name, key: f.name, ellipsis: true })),
    ...(canEdit ? [{
      title: "操作", key: "op", width: 140, render: (_: any, r: any) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除该记录？" onConfirm={() => doDelete(r.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  const openEdit = (row?: any) => {
    setEditing(row || {});
    form.resetFields();
    form.setFieldsValue(row || {});
  };

  const save = async (v: any) => {
    try {
      if (editing?.id) await updateRow(collection!, editing.id, v);
      else await insertRow(collection!, v);
      message.success("已保存");
      setEditing(null);
      form.resetFields();
      loadRows();
    } catch (e: any) { message.error(e?.response?.data?.detail || "保存失败"); }
  };

  const doDelete = async (id: number) => {
    try { await deleteRow(collection!, id); message.success("已删除"); loadRows(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "删除失败"); }
  };

  if (collection === "departments") {
    return (
      <Card
        title={meta?.title || "科室组织"}
        loading={loading}
        extra={<Space>
          <Button icon={<ReloadOutlined />} onClick={loadRows} />
          {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>新增记录</Button>}
        </Space>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
          {rows.map((r: any) => (
            <div key={r.id} style={{
              borderRadius: 24, background: "#101b2e", padding: 22, minHeight: 200,
              boxShadow: "12px 12px 24px rgba(0,0,0,0.4)",
              transition: "transform .2s",
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#2c3e50", marginBottom: 8 }}>{r.name}</div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>负责人：{r.leader || "待任命"}</div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 12 }}>{r.description || "—"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 12 }}>
                {Array.from({ length: 10 }, (_, i) => {
                  const sub = `${r.name}${i + 1}`;
                  return (
                    <div key={i} title="点击查看该科室人员名单"
                      onClick={() => setMemberTarget({ dept: r.name, sub })}
                      style={{
                        fontSize: 13, fontWeight: 600, color: "#93c5fd", padding: "14px 10px",
                        background: "#1a2740", borderRadius: 10, cursor: "pointer",
                        border: "1px solid rgba(59, 130, 246, 0.25)", textAlign: "center",
                        boxShadow: "4px 4px 10px rgba(0,0,0,0.35)",
                      }}>
                      {sub}
                    </div>
                  );
                })}
              </div>
              <Space size={4}>
                <Button size="small" type="link" onClick={() => openEdit(r)}>编辑</Button>
                <Popconfirm title="确认删除？" onConfirm={() => doDelete(r.id)}>
                  <Button size="small" type="link" danger>删除</Button>
                </Popconfirm>
              </Space>
            </div>
          ))}
        </div>
        <DeptMembersModal target={memberTarget} onClose={() => setMemberTarget(null)} />
      </Card>
    );
  }

  return (
    <Card
      title={meta?.title || collection || "数据集合"}
      loading={loading}
      extra={<Space>
        <Button icon={<ReloadOutlined />} onClick={loadRows} />
        {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>新增记录</Button>}
      </Space>}
    >
      <Table
        rowKey="id"
        dataSource={rows}
        columns={columns}
        scroll={{ x: true }}
        pagination={{ total, current: page, pageSize: 20, onChange: setPage }}
        expandable={{
          expandedRowRender: (r: any) => {
            const detailFields = fields.filter(f => r[f.name] !== undefined && r[f.name] !== null && r[f.name] !== "");
            if (collection === "staff_announcements") {
              return (
                <div style={{ padding: "8px 16px", background: "#101b2e", borderRadius: 8, fontSize: 14, lineHeight: 1.8 }}>
                  <b style={{ marginRight: 8 }}>详细内容：</b>{r.content || "（无内容）"}
                </div>
              );
            }
            if (collection === "departments") {
              return (
                <div style={{ padding: "8px 16px", background: "#101b2e", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>{r.name || "科室"} · 下属单位</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                    {Array.from({ length: 10 }, (_, i) => {
                      const sub = `${r.name || "科室"}${i + 1}`;
                      return (
                        <div key={i} title="点击查看该科室人员名单"
                          onClick={() => setMemberTarget({ dept: r.name, sub })}
                          style={{
                            padding: "16px 12px", background: "#1a2740", borderRadius: 10,
                            border: "1px solid rgba(59, 130, 246, 0.25)", fontSize: 14, fontWeight: 600,
                            color: "#93c5fd", textAlign: "center", cursor: "pointer",
                            boxShadow: "3px 3px 8px rgba(150,150,150,0.12)",
                          }}>
                          {sub}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return (
              <div style={{ padding: "8px 16px", background: "#101b2e", borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>详细信息</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 24px" }}>
                  {detailFields.length ? detailFields.map((f) => (
                    <div key={f.name} style={{ fontSize: 13 }}>
                      <span style={{ color: "#888", marginRight: 6 }}>{f.label || f.name}：</span>
                      <span style={{ color: "#333" }}>{String(r[f.name])}</span>
                    </div>
                  )) : <span style={{ color: "#aaa" }}>（无更多详情）</span>}
                </div>
              </div>
            );
          },
          expandRowByClick: true,
        }}
      />
      <Modal
        open={!!editing}
        title={editing?.id ? "编辑记录" : "新增记录"}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={save}>
          {fields.map((f) => {
            // 科室组织「负责人」：从已有员工中下拉选择（新增员工后自动出现）
            if (collection === "departments" && f.name === "leader") {
              return (
                <Form.Item key={f.name} name={f.name} label={f.label || f.name}>
                  <Select
                    showSearch
                    allowClear
                    placeholder="从员工中选择负责人"
                    optionFilterProp="label"
                    listHeight={280}
                    options={employees}
                  />
                </Form.Item>
              );
            }
            return (
              <Form.Item key={f.name} name={f.name} label={f.label || f.name}
                rules={f.name !== "id" ? [{ required: false }] : undefined}>
                {f.type === "text" ? (
                  <VoiceTextArea rows={3} placeholder={`请输入 ${f.name}`} />
                ) : f.type === "integer" || f.type === "number" ? (
                  <InputNumber style={{ width: "100%" }} placeholder={`请输入 ${f.name}`} />
                ) : (
                  <Input placeholder={`请输入 ${f.name}`} />
                )}
              </Form.Item>
            );
          })}
        </Form>
      </Modal>
      <DeptMembersModal target={memberTarget} onClose={() => setMemberTarget(null)} />
    </Card>
  );
}
