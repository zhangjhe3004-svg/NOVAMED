/**
 * 员工端低代码工作台 —— 复刻 NocoBase 四大能力（全部真实落库）
 *
 * 四个标签页：
 * ├── 数据源：动态集合管理（真建表）+ 字段编辑 + 打开数据页
 * ├── 页面  ：页面 schema 管理（ds_table / wf_inbox 区块）
 * ├── 权限  ：角色 × 集合 × 动作 × 行范围 矩阵
 * └── 工作流：业务流程定义 + 审批工作台
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Tabs, Card, Button, Modal, Form, Input, Select, Switch, Tag, Space,
  Typography, message, Table, Popconfirm, Alert, Checkbox, Row, Col,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, ApartmentOutlined, AppstoreOutlined,
  SafetyCertificateOutlined, SendOutlined, ThunderboltOutlined,
} from "@ant-design/icons";
import {
  listCollections, createCollection, deleteCollection, patchCollection,
} from "../api/dyn";
import type { DynCollection, DynField, FieldType } from "../api/dyn";
import { listPages, createPage, deletePage } from "../api/pages";
import type { PageSchemaItem } from "../api/pages";
import { listRules, createRule } from "../api/acl";
import { listDefs, saveDef, setDefEnabled, deleteDef } from "../api/wf";
import type { WfDef } from "../api/wf";
import WfInbox from "../components/dyn/WfInbox";
import VoiceTextArea from "../components/VoiceTextArea";

const { Title, Text } = Typography;

const ROLES = ["admin", "doctor", "pharmacist", "maintainer"];
const ROLE_LABEL: Record<string, string> = {
  admin: "管理员", doctor: "医生", pharmacist: "药剂师", maintainer: "运维",
};
const ACTIONS = [
  { value: "view", label: "查看" },
  { value: "create", label: "新增" },
  { value: "update", label: "修改" },
  { value: "delete", label: "删除" },
];
const FIELD_TYPES: FieldType[] = ["text", "textarea", "select", "number", "date", "boolean"];
const FIELD_TYPE_LABEL: Record<string, string> = {
  text: "单行文本", textarea: "长文本", select: "下拉选择",
  number: "数字", date: "日期", boolean: "开关",
};

// ================================================================ 数据源 Tab

function DataSourceTab() {
  const navigate = useNavigate();
  const [cols, setCols] = useState<DynCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [fieldRows, setFieldRows] = useState<DynField[]>([{ name: "title", label: "标题", type: "text", required: true, searchable: true }]);
  const [detail, setDetail] = useState<DynCollection | null>(null);
  const [detailForm] = Form.useForm();
  const [extraFields, setExtraFields] = useState<DynField[]>([]);

  const load = async () => {
    setLoading(true);
    try { const r = await listCollections(); setCols(r.items); }
    catch (e: any) { message.error(e?.response?.data?.detail || "加载失败"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openDetail = (c: DynCollection) => {
    setDetail(c);
    setExtraFields([]);
    detailForm.setFieldsValue({ title: c.title, description: c.description });
  };

  const doCreate = async () => {
    const v = await createForm.validateFields();
    try {
      await createCollection({
        name: v.name, title: v.title, icon: "table",
        description: v.description,
        fields: fieldRows.map((f) => ({ ...f, options: f.options || [] })),
      });
      message.success("集合已创建并物理建表");
      setCreateOpen(false);
      createForm.resetFields();
      setFieldRows([{ name: "title", label: "标题", type: "text", required: true, searchable: true }]);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "创建失败");
    }
  };

  const saveDetail = async () => {
    if (!detail) return;
    const v = await detailForm.validateFields();
    try {
      await patchCollection(detail.name, {
        title: v.title, description: v.description,
        fields: detail.fields.concat(extraFields),
      });
      message.success("已保存（新增字段已加列）");
      setDetail(null);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "保存失败");
    }
  };

  const addFieldRow = () => setFieldRows((p) => [...p, { name: "", label: "", type: "text", required: false, searchable: false }]);
  const removeFieldRow = (idx: number) => setFieldRows((p) => p.filter((_, i) => i !== idx));
  const patchFieldRow = (idx: number, patch: Partial<DynField>) =>
    setFieldRows((p) => p.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const updateFieldDef = (idx: number, patch: Partial<DynField>) =>
    setExtraFields((p) => p.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const doDeleteCollection = async (c: DynCollection) => {
    try { await deleteCollection(c.name); message.success("已删除"); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "删除失败"); }
  };

  const colsColumns = [
    { title: "集合", dataIndex: "title", render: (_: any, r: DynCollection) => <Space><Tag icon={<ApartmentOutlined />} style={{ borderRadius: 6 }}>{r.icon || "table"}</Tag><Text strong>{r.title}</Text>{r.options?.system && <Tag color="purple" style={{ borderRadius: 6 }}>系统</Tag>}<Text type="secondary" code>{r.name}</Text></Space> },
    { title: "字段数", width: 90, render: (_: any, r: DynCollection) => r.fields.length },
    { title: "记录数", width: 90, dataIndex: "row_count" },
    {
      title: "操作", width: 260, render: (_: any, r: DynCollection) => (
        <Space wrap>
          <Button size="small" type="link" onClick={() => navigate(`/dyn/${r.name}`)}>打开数据页</Button>
          <Button size="small" type="link" onClick={() => openDetail(r)}>配置字段</Button>
          <Popconfirm title={`确认删除集合「${r.title}」？`} onConfirm={() => doDeleteCollection(r)} disabled={r.row_count > 0 || !!r.options?.system}>
            <Button size="small" type="link" danger disabled={r.row_count > 0 || !!r.options?.system} icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Text type="secondary">在这里创建集合会真实建表（dyn_&lt;name&gt;），并自动获得 CRUD 接口与页面。</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>创建集合</Button>
      </Space>
      <Table rowKey="name" size="middle" loading={loading} dataSource={cols} columns={colsColumns} pagination={false} />

      {/* 创建集合 */}
      <Modal title="创建集合" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={doCreate} width={720}>
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="title" label="集合显示名称" rules={[{ required: true, message: "必填" }]}>
                <Input placeholder="如：工单 / 排班" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="集合名（小写英文）" rules={[{ required: true, message: "必填" }]}>
                <Input placeholder="如 ticket" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="说明"><VoiceTextArea rows={2} /></Form.Item>
          <Title level={5} style={{ marginTop: 4 }}>字段</Title>
          {fieldRows.map((f, i) => (
            <Row gutter={8} key={i} align="middle" style={{ marginBottom: 8 }}>
              <Col span={5}><Input placeholder="字段名" value={f.name} onChange={(e) => patchFieldRow(i, { name: e.target.value.replace(/[^a-z0-9_]/g, "") })} /></Col>
              <Col span={6}><Input placeholder="显示名" value={f.label} onChange={(e) => patchFieldRow(i, { label: e.target.value })} /></Col>
              <Col span={5}>
                <Select value={f.type} onChange={(v) => patchFieldRow(i, { type: v as FieldType })}
                        options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABEL[t] }))} />
              </Col>
              <Col span={3}><Switch checkedChildren="必填" unCheckedChildren="可选" checked={f.required} onChange={(v) => patchFieldRow(i, { required: v })} /></Col>
              <Col span={3}><Switch checkedChildren="搜索" checked={!!f.searchable} onChange={(v) => patchFieldRow(i, { searchable: v })} /></Col>
              <Col span={2}><Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeFieldRow(i)} /></Col>
            </Row>
          ))}
          <Button icon={<PlusOutlined />} onClick={addFieldRow}>添加字段</Button>
        </Form>
      </Modal>

      {/* 配置字段（可加列/改显示，不支持删列/改类型，安全起见） */}
      <Modal title={`配置字段：${detail?.title || ""}`} open={!!detail} onCancel={() => setDetail(null)} onOk={saveDetail} width={760}>
        {detail && (
          <>
            <Form form={detailForm} layout="vertical">
              <Row gutter={12}>
                <Col span={12}><Form.Item name="title" label="显示名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="description" label="说明"><Input /></Form.Item></Col>
              </Row>
            </Form>
            <Table rowKey="name" size="small" pagination={false} dataSource={detail.fields}
                   columns={[{ title: "字段", dataIndex: "label" }, { title: "名", dataIndex: "name" },
                             { title: "类型", dataIndex: "type", render: (t) => FIELD_TYPE_LABEL[t] || t }]} />
            <DividerLite text="新增字段（将 ALTER TABLE 加列）" />
            {extraFields.map((f, i) => (
              <Row gutter={8} key={i} align="middle" style={{ marginBottom: 8 }}>
                <Col span={5}><Input placeholder="字段名" value={f.name} onChange={(e) => updateFieldDef(i, { name: e.target.value.replace(/[^a-z0-9_]/g, "") })} /></Col>
                <Col span={6}><Input placeholder="显示名" value={f.label} onChange={(e) => updateFieldDef(i, { label: e.target.value })} /></Col>
                <Col span={5}><Select value={f.type} onChange={(v) => updateFieldDef(i, { type: v as FieldType })}
                                      options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABEL[t] }))} /></Col>
                <Col span={3}><Switch checked={!!f.required} onChange={(v) => updateFieldDef(i, { required: v })} /></Col>
                <Col span={2}><Button type="text" danger icon={<DeleteOutlined />} onClick={() => setExtraFields((p) => p.filter((_, x) => x !== i))} /></Col>
              </Row>
            ))}
            <Button icon={<PlusOutlined />} onClick={() => setExtraFields((p) => [...p, { name: "", label: "", type: "text", required: false, searchable: false }])}>添加字段</Button>
          </>
        )}
      </Modal>
    </div>
  );
}

function DividerLite({ text }: { text: string }) {
  return <div style={{ margin: "16px 0 12px", fontWeight: 600, color: "#666" }}>{text}</div>;
}

// ================================================================ 页面 Tab

function PagesTab() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<PageSchemaItem[]>([]);
  const [cols, setCols] = useState<DynCollection[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    try {
      const [p, c] = await Promise.all([listPages(), listCollections()]);
      setPages(p.items); setCols(c.items);
    } catch (e: any) { message.error(e?.response?.data?.detail || "加载失败"); }
  };
  useEffect(() => { load(); }, []);

  const doCreate = async () => {
    const v = await form.validateFields();
    const collection = v.collection;
    const blocks: any[] = [{
      type: "ds_table",
      props: {
        collection, title: v.pageTitle || undefined,
        searchable: v.searchable ?? true,
        allow_create: v.allow_create ?? true,
        allow_edit: v.allow_edit ?? true,
        allow_delete: v.allow_delete ?? true,
      },
    }];
    if (v.with_inbox && collection === "staff_leave") {
      blocks.push({ type: "wf_inbox", props: { title: "审批工作台", mode: "pending" } });
    }
    try {
      await createPage({ key: v.key, title: v.pageTitle, icon: "appstore", blocks });
      message.success("页面已创建，可在菜单/链接中打开");
      setOpen(false); form.resetFields(); load();
    } catch (e: any) { message.error(e?.response?.data?.detail || "创建失败"); }
  };

  const doDelete = async (key: string) => {
    try { await deletePage(key); message.success("已删除"); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "删除失败"); }
  };

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Text type="secondary">页面由「区块」组成：ds_table = 集合数据网格；wf_inbox = 审批收件箱。</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>创建页面</Button>
      </Space>
      <Table rowKey="key" size="middle" dataSource={pages}
             columns={[
               { title: "页面", dataIndex: "title", render: (_, r: PageSchemaItem) => <Space><Tag style={{ borderRadius: 6 }} icon={<AppstoreOutlined />}>{r.icon || "page"}</Tag><Text strong>{r.title}</Text><Text type="secondary" code>{r.key}</Text></Space> },
               { title: "区块", width: 160, render: (_: any, r: PageSchemaItem) => r.blocks.map((b) => <Tag key={b.type}>{b.type === "ds_table" ? `表:${b.props?.collection}` : b.type}</Tag>) },
               { title: "操作", width: 200, render: (_: any, r: PageSchemaItem) => (
                 <Space>
                   <Button size="small" type="link" onClick={() => navigate(`/lcp/${r.key}`)}>打开</Button>
                   <Popconfirm title="确认删除该页面？" onConfirm={() => doDelete(r.key)}>
                     <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
                   </Popconfirm>
                 </Space>
               ) },
             ]} pagination={false} />

      <Modal title="创建页面" open={open} onCancel={() => setOpen(false)} onOk={doCreate} width={560}>
        <Form form={form} layout="vertical" initialValues={{ searchable: true, allow_create: true, allow_edit: true, allow_delete: true, with_inbox: false }}>
          <Form.Item name="pageTitle" label="页面标题" rules={[{ required: true, message: "必填" }]}><Input placeholder="如：请假审批" /></Form.Item>
          <Form.Item name="key" label="页面 key（路由用）" rules={[{ required: true, message: "必填" }]}><Input placeholder="如 staff-leave" /></Form.Item>
          <Form.Item name="collection" label="绑定的集合" rules={[{ required: true, message: "选择集合" }]}>
            <Select options={cols.map((c) => ({ value: c.name, label: `${c.title}（${c.name}）` }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="searchable" valuePropName="checked"><Switch checkedChildren="搜索" unCheckedChildren="无搜索" /></Form.Item></Col>
            <Col span={12}><Form.Item name="with_inbox" valuePropName="checked"><Switch checkedChildren="加审批收件箱" unCheckedChildren="不加收件箱" /></Form.Item></Col>
          </Row>
          <Space size={16} wrap>
            <Form.Item name="allow_create" valuePropName="checked" noStyle><Switch checkedChildren="可新增" unCheckedChildren="禁新增" /></Form.Item>
            <Form.Item name="allow_edit" valuePropName="checked" noStyle><Switch checkedChildren="可编辑" unCheckedChildren="禁编辑" /></Form.Item>
            <Form.Item name="allow_delete" valuePropName="checked" noStyle><Switch checkedChildren="可删除" unCheckedChildren="禁删除" /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}

// ================================================================ 权限 Tab

function AclCell({ role, collection }: { role: string; collection: string }) {
  const [configured, setConfigured] = useState(false);
  const [actions, setActions] = useState<string[]>([]);
  const [scope, setScope] = useState("none");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let on = true;
    listRules().then((r) => {
      if (!on) return;
      const cur = r.items.find((x) => x.role === role && x.collection === collection);
      setConfigured(!!cur);
      setActions(cur ? cur.actions : role === "admin" ? ["view", "create", "update", "delete"] : []);
      setScope(cur ? cur.scope : role === "admin" ? "all" : "none");
    }).finally(() => on && setReady(true));
    return () => { on = false; };
  }, [role, collection]);

  const persist = async (a: string[], s: string) => {
    setSaving(true);
    try {
      await createRule({ role, collection, actions: a, scope: s });
      setActions(a); setScope(s);
    } catch (e: any) { message.error(e?.response?.data?.detail || "保存失败"); }
    finally { setSaving(false); }
  };

  if (!ready) return null;
  return (
    <Card size="small" style={{ width: 300 }} styles={{ body: { padding: 10 } }}>
      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        <Space><Tag color={role === "admin" ? "red" : "blue"}>{ROLE_LABEL[role] || role}</Tag><Text type="secondary" style={{ fontSize: 11 }}>{configured ? "已配置" : "默认"}</Text></Space>
        <Checkbox.Group
          options={ACTIONS}
          value={actions}
          disabled={saving}
          onChange={(v) => persist(v as string[], scope)}
        />
        <Select
          size="small" style={{ width: "100%" }} value={scope} disabled={saving}
          onChange={(v) => persist(actions, v)}
          options={[
            { value: "none", label: "范围：无" },
            { value: "all", label: "范围：全部" },
            { value: "dept", label: "范围：本科室" },
            { value: "self", label: "范围：仅本人" },
          ]}
        />
      </Space>
    </Card>
  );
}

function AclTab() {
  const [cols, setCols] = useState<DynCollection[]>([]);
  useEffect(() => { listCollections().then((r) => setCols(r.items)).catch(() => {}); }, []);
  if (cols.length === 0) return <Card loading />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Alert type="info" showIcon message="按「角色 × 集合」配置数据权限：动作（查看/新增/修改/删除）与可见范围（全部/本科室/仅本人）。行范围作用于该集合的行数据。管理员未单独配置时默认为全集合全动作。" />
      {cols.map((c) => (
        <Card key={c.name} size="small" title={<Space><ApartmentOutlined />{c.title}<Text type="secondary" code>{c.name}</Text></Space>}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ROLES.map((role) => <AclCell key={role} role={role} collection={c.name} />)}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ================================================================ 工作流 Tab

function WfTab() {
  const [defs, setDefs] = useState<WfDef[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    try { const r = await listDefs(); setDefs(r.items); }
    catch (e: any) { message.error(e?.response?.data?.detail || "加载失败"); }
  };
  useEffect(() => { load(); }, []);

  const doCreate = async () => {
    const v = await form.validateFields();
    try {
      await saveDef({
        key: v.key, title: v.title,
        trigger_collection: v.collection || undefined,
        status_field: v.status_field || undefined,
        nodes: [{ name: v.node_name || "审批", assign_type: "role", assign_value: v.assign_role || "admin" }],
        enabled: true,
      });
      message.success("工作流已创建");
      setOpen(false); form.resetFields(); load();
    } catch (e: any) { message.error(e?.response?.data?.detail || "创建失败"); }
  };

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Text type="secondary">新建动态集合的行若命中「触发集合」，将自动创建流程实例。</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新建流程</Button>
      </Space>
      <Table rowKey="key" dataSource={defs} pagination={false}
             columns={[
               { title: "流程", dataIndex: "title", render: (_, r: WfDef) => <Space><ThunderboltOutlined /><Text strong>{r.title}</Text><Text type="secondary" code>{r.key}</Text></Space> },
               { title: "触发集合", dataIndex: "trigger_collection", render: (v) => v ? <Tag>{v}</Tag> : <Text type="secondary">手动</Text> },
               { title: "节点", dataIndex: "nodes", render: (nodes: any[]) => (nodes || []).map((n) => <Tag key={n.name}>{n.name} → {n.assign_value || n.assign_type}</Tag>) },
               { title: "状态", width: 90, render: (_: any, r: WfDef) => r.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
               { title: "操作", width: 180, render: (_: any, r: WfDef) => (
                 <Space>
                   <Button size="small" type="link"
                           onClick={async () => { try { await setDefEnabled(r.key, !r.enabled); load(); } catch (e: any) { message.error(e?.response?.data?.detail); } }}>
                     {r.enabled ? "停用" : "启用"}
                   </Button>
                   <Popconfirm title="删除流程？" onConfirm={async () => { await deleteDef(r.key); load(); }}>
                     <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
                   </Popconfirm>
                 </Space>
               ) },
             ]} />
      <DividerLite text="审批工作台" />
      <WfInbox mode="pending" title="待我审批" />

      <Modal title="新建业务工作流" open={open} onCancel={() => setOpen(false)} onOk={doCreate}>
        <Form form={form} layout="vertical" initialValues={{ node_name: "审批", assign_role: "admin" }}>
          <Form.Item name="title" label="流程名称" rules={[{ required: true }]}><Input placeholder="请假审批" /></Form.Item>
          <Form.Item name="key" label="唯一标识（key）" rules={[{ required: true }]}><Input placeholder="leave_approval" /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="collection" label="触发集合"><Input placeholder="如 staff_leave" /></Form.Item></Col>
            <Col span={12}><Form.Item name="status_field" label="回写状态字段"><Input placeholder="如 status" /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="node_name" label="节点名"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="assign_role" label="审批角色">
              <Select options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
            </Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

// ================================================================ 主页面

export default function LowCodeStudio() {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>员工端低代码工作台</Title>
        <Text type="secondary">数据源 / 页面 / 权限 / 业务工作流 —— 全部配置驱动、真实落库（NocoBase 风格）</Text>
      </div>
      <Tabs defaultActiveKey="data" items={[
        { key: "data", label: <Space><AppstoreOutlined />数据源</Space>, children: <DataSourceTab /> },
        { key: "pages", label: <Space><SendOutlined />页面</Space>, children: <PagesTab /> },
        { key: "acl", label: <Space><SafetyCertificateOutlined />权限</Space>, children: <AclTab /> },
        { key: "wf", label: <Space><ThunderboltOutlined />工作流</Space>, children: <WfTab /> },
      ]} />
    </div>
  );
}
