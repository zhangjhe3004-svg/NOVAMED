/**
 * 区块注册表（对齐 NocoBase 的 SchemaComponent 区块注册）
 *
 * 每个区块 = 一个自注册组件，通过 registerBlock(type, component) 登记。
 * 区块既可以是「数据区块」（自己拉数据），也可以是「展示区块」（纯展示）。
 */
import { useEffect, useState } from "react";
import {
  Card, Switch, Tag, Space, Typography, Row, Col, Statistic, message,
  Button, Alert, Table, Modal, Form, Input, InputNumber, Popconfirm, Select,
} from "antd";
import {
  ArrowUpOutlined, ArrowDownOutlined, PlusOutlined, SearchOutlined,
} from "@ant-design/icons";
import { getWorkflow, updateWorkflow, getAIConfig } from "../api/ai";
import type { WorkflowStage, AIConfigSummary } from "../api/ai";
import { getPlugins, enablePlugin, disablePlugin } from "../api/plugins";
import type { PluginInfo } from "../api/plugins";
import { listRows, insertRow, updateRow, deleteRow, listCollections, type DynCollection } from "../api/dyn";
import { listUsers } from "../api/users";
import { listStaffDoctors } from "../api/schedule";
import { useAuth } from "../stores/auth";
import DeptMembersModal, { type DeptMemberTarget } from "../components/dyn/DeptMembersModal";
import LeaveCenter from "../components/dyn/LeaveCenter";

const { Title, Text } = Typography;

export interface BlockProps {
  config?: Record<string, any>;
}

export type BlockMap = Record<string, React.ComponentType<BlockProps>>;

export const blockRegistry: BlockMap = {};

export function registerBlock(type: string, comp: React.ComponentType<BlockProps>) {
  blockRegistry[type] = comp;
}

// ======== 展示区块 ========

function PageHeaderBlock({ config }: BlockProps) {
  return (
    <div style={{ marginBottom: 4 }}>
      <Title level={4} style={{ margin: 0 }}>{config?.title || "页面"}</Title>
      {config?.subtitle && <Text type="secondary">{config.subtitle}</Text>}
    </div>
  );
}
registerBlock("header", PageHeaderBlock);

function StatBlock({ config }: BlockProps) {
  return (
    <Card>
      <Statistic title={config?.title} value={config?.value} suffix={config?.suffix} />
    </Card>
  );
}
registerBlock("stat_card", StatBlock);

// ======== 数据区块：诊断工作流（可开关/排序）========

function WorkflowBlock(_: BlockProps) {
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const w = await getWorkflow();
      setStages(w.stages);
    } catch { /* 忽略 */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const persist = async (next: WorkflowStage[]) => {
    setStages(next);
    try {
      await updateWorkflow(next);
      message.success("工作流已更新");
    } catch (e: any) {
      message.error(e.response?.data?.detail || "更新失败");
      load();
    }
  };

  const toggle = (key: string, enabled: boolean) =>
    persist(stages.map((s) => (s.key === key ? { ...s, enabled } : s)));

  const move = (key: string, dir: -1 | 1) => {
    const arr = [...stages].sort((a, b) => a.order - b.order);
    const idx = arr.findIndex((s) => s.key === key);
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    persist(arr.map((s, i) => ({ ...s, order: i + 1 })));
  };

  return (
    <Card title="诊断工作流节点" extra={<Text type="secondary">配置驱动 · 可开关/排序</Text>} loading={loading}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stages.sort((a, b) => a.order - b.order).map((s) => (
          <div key={s.key} style={{
            border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <Space style={{ minWidth: 0 }}>
              <Tag style={{ borderRadius: 6 }}>{s.order}</Tag>
              <div style={{ minWidth: 0 }}>
                <Text strong>{s.name}</Text>{" "}
                <Tag style={{ borderRadius: 6 }}>{s.group}</Tag>
                {s.desc && <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>{s.desc}</Text>}
              </div>
            </Space>
            <Space>
              <Button size="small" icon={<ArrowUpOutlined />} onClick={() => move(s.key, -1)} />
              <Button size="small" icon={<ArrowDownOutlined />} onClick={() => move(s.key, 1)} />
              <Switch checked={s.enabled} onChange={(v) => toggle(s.key, v)} />
            </Space>
          </div>
        ))}
      </div>
    </Card>
  );
}
registerBlock("workflow", WorkflowBlock);

// ======== 数据区块：插件市场（启停）========

function PluginsBlock(_: BlockProps) {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getPlugins();
      setPlugins(r.plugins);
    } catch { /* 忽略 */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (p: PluginInfo, enabled: boolean) => {
    try {
      if (enabled) await enablePlugin(p.name);
      else await disablePlugin(p.name);
      message.success(`${p.display_name} ${enabled ? "已启用" : "已禁用"}（重启生效）`);
      load();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "操作失败");
    }
  };

  return (
    <Card title="插件市场" extra={<Text type="secondary">{plugins.filter((p) => p.enabled).length} 已启用 / {plugins.length}</Text>} loading={loading}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plugins.map((p) => (
          <div key={p.name} style={{
            border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <Space>
              <Tag color={p.enabled ? "green" : "default"} style={{ borderRadius: 6 }}>
                {p.enabled ? "已启用" : "已禁用"}
              </Tag>
              <div>
                <Text strong>{p.display_name}</Text>
                <Text type="secondary" style={{ fontSize: 12, display: "block" }}>{p.description}</Text>
              </div>
            </Space>
            <Switch checked={p.enabled} onChange={(v) => toggle(p, v)} />
          </div>
        ))}
      </div>
    </Card>
  );
}
registerBlock("plugins", PluginsBlock);

// ======== 数据区块：AI 防幻觉配置（只读）========

function AgentConfigBlock(_: BlockProps) {
  const [cfg, setCfg] = useState<AIConfigSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAIConfig().then(setCfg).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <Card title="AI 防幻觉配置" loading={loading}>
      {cfg ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Text strong>角色</Text>
            <Text type="secondary">{cfg.role}</Text>
            <Text strong style={{ display: "block", marginTop: 8 }}>生成参数</Text>
            <Space wrap>
              <Tag>temp {cfg.generation_parameters?.temperature}</Tag>
              <Tag>top_p {cfg.generation_parameters?.top_p}</Tag>
              <Tag>rep {cfg.generation_parameters?.repetition_penalty}</Tag>
              <Tag>min_p {cfg.generation_parameters?.min_p}</Tag>
              <Tag>seed {cfg.generation_parameters?.seed}</Tag>
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <Text strong>医学证据分级</Text>
            <div style={{ marginTop: 4 }}>
              {Object.entries(cfg.evidence_tiers || {}).map(([t, d]) => (
                <div key={t} style={{ marginBottom: 4 }}>
                  <Tag color={t === "A" ? "green" : t === "B" ? "blue" : "orange"} style={{ borderRadius: 6 }}>{t}</Tag>
                  {d}
                </div>
              ))}
            </div>
          </Col>
        </Row>
      ) : (
        <Alert type="warning" message="暂无配置，请确认 agent_config.json 存在" showIcon />
      )}
    </Card>
  );
}
registerBlock("agent_config", AgentConfigBlock);


// ======== 数据区块：动态集合表格（可增删改）========

function TableBlock({ config }: BlockProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [rows, setRows] = useState<any[]>([]);
  const [cols, setCols] = useState<DynCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [leaderKw, setLeaderKw] = useState("");
  // 排班表：可从数据库选择的医生（下拉）
  const [scheduleDoctors, setScheduleDoctors] = useState<any[]>([]);
  // 点击子科室后弹出的人员名单
  const [memberTarget, setMemberTarget] = useState<DeptMemberTarget | null>(null);

  const collection = config?.collection as string | undefined;
  // 科室组织：负责人由权限等级高者任命低者；仅系统管理员可增删改
  const isDept = collection === "departments";
  // 排班表集合
  const isSchedule = collection === "staff_schedules";
  const canEdit = !isDept || isAdmin;
  const myAuthLevel = user?.auth_level ?? 99;

  const load = async () => {
    setLoading(true);
    try {
      if (collection) {
        const r = await listRows(collection, { page: 1, page_size: 100 });
        setRows(r.items || []);
      }
    } catch { /* 忽略 */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [collection]);

  useEffect(() => {
    listCollections().then((r) => setCols(r.items)).catch(() => {});
  }, []);

  // 科室组织：加载全部员工（含 auth_level），下拉按「权限等级低于本人 + 姓名搜索」过滤
  useEffect(() => {
    if (!isDept) return;
    listUsers({ page: 1, page_size: 100 }).then((r) => {
      setAllEmployees(r.items || []);
    }).catch(() => {});
  }, [isDept]);

  // 排班表：加载医生（在职、非管理员）供「员工」字段下拉选择（仅需登录权限）
  useEffect(() => {
    if (!isSchedule) return;
    listStaffDoctors().then((r) => {
      setScheduleDoctors(r.items || []);
    }).catch(() => {});
  }, [isSchedule]);

  // 可被任命的负责人：权限等级严格低于当前登录者；再按姓名/科室关键字过滤
  const leaderOptions = allEmployees
    .filter((u) => (u.auth_level ?? 99) < myAuthLevel)
    .filter((u) => {
      if (!leaderKw.trim()) return true;
      const kw = leaderKw.trim();
      const name = u.real_name || u.username || "";
      return name.includes(kw) || (u.department || "").includes(kw);
    })
    .map((u) => ({
      id: u.id,
      value: u.real_name || u.username,
      label: `${u.real_name || u.username}（${u.department || u.role} · Lv${u.auth_level ?? 0}）`,
    }));

  const meta = cols.find((c) => c.name === collection);
  const fields = (meta?.fields || []).filter((f) => !f.primary);

  const columns = [
    ...fields.map((f) => ({ title: f.label || f.name, dataIndex: f.name, key: f.name, ellipsis: true })),
    ...(canEdit ? [{
      title: "操作", key: "op", width: 150, render: (_: any, r: any) => (
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
    setLeaderKw("");
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
      load();
    } catch (e: any) { message.error(e?.response?.data?.detail || "保存失败"); }
  };

  const doDelete = async (id: number) => {
    try { await deleteRow(collection!, id); message.success("已删除"); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "删除失败"); }
  };

  if (isDept) {
    return (
      <>
      <Card
        title={config?.title || collection}
        loading={loading}
        extra={canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>新增记录</Button> : null}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          {rows.map((r: any) => (
            <div key={r.id} style={{ borderRadius: 24, background: "rgba(59, 130, 246, 0.05)", padding: 22, border: "1px solid rgba(21,58,124,0.11)", boxShadow: "0 16px 40px rgba(3,7,18,0.45), inset 0 1px 0 rgba(21,58,124,0.11)" }}>
              <div style={{ background: "rgba(59, 130, 246, 0.1)", borderRadius: 14, padding: "14px 18px", marginBottom: 14, position: "relative" }}>
                <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 8 }}>
                  <button className="fab-btn" onClick={() => openEdit(r)}>
                    <span>编辑</span><span>✎</span>
                  </button>
                  <Popconfirm title="确认删除？" onConfirm={() => doDelete(r.id)}>
                    <button className="fab-btn fab-btn-danger">
                      <span>删除</span><span>✕</span>
                    </button>
                  </Popconfirm>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#eaf1fb", marginBottom: 6, paddingRight: 160 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: "rgba(232,232,244,0.78)", marginBottom: 4 }}>负责人：{r.leader || "待任命"}</div>
                <div style={{ fontSize: 13, color: "rgba(232,232,244,0.85)", lineHeight: 1.6 }}>{r.description || "—"}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                {Array.from({ length: 10 }, (_, i) => {
                  const sub = `${r.name}${i + 1}`;
                  return (
                    <div key={i} title="点击查看该科室人员名单"
                      onClick={() => setMemberTarget({ dept: r.name, sub })}
                      style={{
                        fontSize: 13, fontWeight: 600, color: "#eaf1fb", padding: "14px 12px",
                        background: "rgba(59, 130, 246, 0.06)", borderRadius: 10, cursor: "pointer",
                        border: "1px solid rgba(21,58,124,0.11)", textAlign: "center",
                        transition: "transform .15s, border-color .15s",
                        transition: "transform .15s, box-shadow .15s",
                      }}>
                      {sub}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Modal
        open={!!editing}
        title={editing?.id ? "编辑记录" : "新增记录"}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={save}>
          {fields.map((f) => {
            if (["leader","deputy_1","deputy_2","deputy_3","deputy_4","deputy_5"].includes(f.name)) {
              return (
                <div key={f.name}>
                  <div style={{ marginBottom: 6 }}>
                    <Input allowClear prefix={<SearchOutlined />} placeholder="搜索姓名 / 科室 筛选可任命人员" value={leaderKw} onChange={(e) => setLeaderKw(e.target.value)} />
                  </div>
                  <Form.Item name={f.name} label={f.label || f.name}>
                    <Select placeholder="选择负责人（权限等级须低于本人）" optionFilterProp="label" listHeight={280} options={leaderOptions} />
                  </Form.Item>
                </div>
              );
            }
            return (
              <Form.Item key={f.name} name={f.name} label={f.label || f.name}>
                {f.type === "text" ? <Input.TextArea rows={3} placeholder={`请输入 ${f.name}`} />
                  : (f.type === "integer" || f.type === "number") ? <InputNumber style={{ width: "100%" }} />
                  : <Input placeholder={`请输入 ${f.name}`} />}
              </Form.Item>
            );
          })}
        </Form>
      </Modal>
      <DeptMembersModal target={memberTarget} onClose={() => setMemberTarget(null)} />
      </>
    );
  }
  return (
    <Card
      title={config?.title || collection}
      loading={loading}
      extra={collection && canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>新增记录</Button> : null}
    >
      <Table
        rowKey="id"
        className={collection === "staff_announcements" ? "announcement-table" : ""}
        size="small"
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ x: true }}
        expandable={{
          expandedRowRender: (r: any) => {
            // 通用：显示该行所有字段详情
            const detailFields = (fields as any[]).filter(f => r[f.name] !== undefined && r[f.name] !== null && r[f.name] !== "");
            if (collection === "departments") {
              // 每个科室默认展开 10 个子科室
              return (
                <div style={{ padding: "8px 16px", background: "rgba(59, 130, 246, 0.04)", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "rgba(232,232,244,0.7)", marginBottom: 8 }}>{r.name || "科室"} · 下属单位</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                    {Array.from({ length: 10 }, (_, i) => {
                      const sub = `${r.name || "科室"}${i + 1}`;
                      return (
                        <div key={i} title="点击查看该科室人员名单"
                          onClick={() => setMemberTarget({ dept: r.name, sub })}
                          style={{
                            padding: "16px 12px", background: "rgba(59, 130, 246, 0.06)", borderRadius: 10,
                            border: "1px solid rgba(21,58,124,0.11)", fontSize: 14, fontWeight: 600,
                            color: "#eaf1fb", textAlign: "center", cursor: "pointer",
                          }}>
                          {sub}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            if (collection === "staff_announcements") {
              return (
                <div style={{ padding: "8px 16px", background: "rgba(59, 130, 246, 0.04)", borderRadius: 8, fontSize: 14, lineHeight: 1.8 }}>
                  <b style={{ marginRight: 8 }}>详细内容：</b>{r.content || "（无内容）"}
                </div>
              );
            }
            // 其他表格：通用字段详情
            return (
              <div style={{ padding: "8px 16px", background: "rgba(59, 130, 246, 0.04)", borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "rgba(232,232,244,0.7)", marginBottom: 8 }}>详细信息</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 24px" }}>
                  {detailFields.length ? detailFields.map((f) => (
                    <div key={f.name} style={{ fontSize: 13 }}>
                      <span style={{ color: "rgba(232,232,244,0.7)", marginRight: 6 }}>{f.label || f.name}：</span>
                      <span style={{ color: "#eaf1fb" }}>{String(r[f.name])}</span>
                    </div>
                  )) : <span style={{ color: "rgba(232,232,244,0.55)" }}>（无更多详情）</span>}
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
            if (isDept && ["leader","deputy_1","deputy_2","deputy_3","deputy_4","deputy_5"].includes(f.name)) {
              return (
                <div key={f.name}>
                  <div style={{ marginBottom: 6 }}>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="搜索姓名 / 科室 筛选可任命人员"
                      value={leaderKw}
                      onChange={(e) => setLeaderKw(e.target.value)}
                    />
                  </div>
                  <Form.Item name={f.name} label={f.label || f.name} style={{ marginBottom: 12 }}>
                    <Select
                      showSearch
                      allowClear
                      placeholder="选择负责人（权限等级须低于本人）"
                      optionFilterProp="label"
                      listHeight={280}
                      options={leaderOptions}
                      notFoundContent="无可任命人员"
                    />
                  </Form.Item>
                </div>
              );
            }
            // 排班表：「员工」字段改为从数据库选择医生
            if (isSchedule && f.name === "employee") {
              return (
                <Form.Item key={f.name} name={f.name} label={f.label || f.name} style={{ marginBottom: 12 }}>
                  <Select
                    showSearch
                    allowClear
                    placeholder="从数据库选择医生"
                    optionFilterProp="label"
                    listHeight={280}
                    options={scheduleDoctors.map((u: any) => ({
                      value: u.real_name || u.username,
                      label: `${u.real_name || u.username}（${u.department || "未分配科室"} · ${u.title || u.role}）`,
                    }))}
                    notFoundContent="暂无可选择的医生"
                  />
                </Form.Item>
              );
            }
            return (
              <Form.Item key={f.name} name={f.name} label={f.label || f.name}>
                {f.type === "text" ? (
                  <Input.TextArea rows={3} placeholder={`请输入 ${f.name}`} />
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
registerBlock("table", TableBlock);

// ======== 数据区块：周视图排班网格（2 小时一格，仿课表，可点击修改）========

const TIME_SLOTS = [
  { key: "00-02", label: "00:00-02:00", group: "night",   color: "#7a6fd6" },
  { key: "02-04", label: "02:00-04:00", group: "night",   color: "#7a6fd6" },
  { key: "04-06", label: "04:00-06:00", group: "night",   color: "#7a6fd6" },
  { key: "06-08", label: "06:00-08:00", group: "night",   color: "#7a6fd6" },
  { key: "08-10", label: "08:00-10:00", group: "morning", color: "#4f86e8" },
  { key: "10-12", label: "10:00-12:00", group: "morning", color: "#4f86e8" },
  { key: "12-14", label: "12:00-14:00", group: "morning", color: "#4f86e8" },
  { key: "14-16", label: "14:00-16:00", group: "morning", color: "#4f86e8" },
  { key: "16-18", label: "16:00-18:00", group: "mid",     color: "#e8a13a" },
  { key: "18-20", label: "18:00-20:00", group: "mid",     color: "#e8a13a" },
  { key: "20-22", label: "20:00-22:00", group: "mid",     color: "#e8a13a" },
  { key: "22-24", label: "22:00-24:00", group: "mid",     color: "#e8a13a" },
];
const GROUP_LABEL = { night: "夜班", morning: "早班", mid: "中班" };
const WEEK_CN = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function WeeklyScheduleBlock(_: BlockProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  if (today.getDay() === 0) monday.setDate(today.getDate() - 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const fmt = (d: Date) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");

  const load = async () => {
    setLoading(true);
    try {
      const r = await listRows("staff_schedules", { page: 1, page_size: 1000 });
      setRows(r.items || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    listStaffDoctors().then((r) => {
      setDoctors(r.items || []);
    }).catch(() => {});
  }, []);

  const cellMap: Record<string, any> = {};
  rows.forEach((r) => {
    const parts = (r.shift || "").split("|");
    cellMap[r.date + "|" + (parts[2] || "")] = r;
  });

  const openCell = (date: string, slotKey: string) => {
    const existing = cellMap[date + "|" + slotKey];
    setEditing({ date, slotKey, row: existing || null });
    form.resetFields();
    if (existing) {
      const parts = (existing.shift || "").split("|");
      form.setFieldsValue({ employee: existing.employee, slotKey: parts[2] || slotKey });
    } else {
      form.setFieldsValue({ slotKey });
    }
  };

  const save = async (v: any) => {
    try {
      const slot = TIME_SLOTS.find((s) => s.key === v.slotKey) || TIME_SLOTS[0];
      const doc = doctors.find((d) => d.real_name === v.employee || d.username === v.employee);
      const shiftStr = slot.label + "|" + GROUP_LABEL[slot.group] + "|" + slot.key + "|" + (doc?.department || "");
      if (editing?.row?.id) {
        await updateRow("staff_schedules", editing.row.id, { employee: v.employee, date: editing.date, shift: shiftStr });
      } else {
        await insertRow("staff_schedules", { employee: v.employee, date: editing.date, shift: shiftStr });
      }
      message.success("排班已保存");
      setEditing(null);
      load();
    } catch (e: any) { message.error(e?.response?.data?.detail || "保存失败"); }
  };

  const del = async () => {
    if (!editing?.row?.id) return;
    try {
      await deleteRow("staff_schedules", editing.row.id);
      message.success("已删除");
      setEditing(null);
      load();
    } catch (e: any) { message.error(e?.response?.data?.detail || "删除失败"); }
  };

  const curSlot = TIME_SLOTS.find((s) => s.key === editing?.slotKey);

  return (
    <Card title="周排班表（2 小时一格 · 点击格子安排/修改）" loading={loading}>
      <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "70px repeat(7, 1fr)", gap: 4, minWidth: 900 }}>
          <div style={{ position: "sticky", top: 0, background: "transparent", zIndex: 2 }} />
          {weekDays.map((d, i) => (
            <div key={i} style={{ textAlign: "center", padding: "6px 0", borderRadius: 6, background: i >= 5 ? "#fff7e6" : "#f0f6ff", position: "sticky", top: 0, zIndex: 2 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{WEEK_CN[i]}</div>
              <div style={{ fontSize: 11, color: "rgba(232,232,244,0.7)" }}>{String(d.getMonth()+1).padStart(2,"0")}-{String(d.getDate()).padStart(2,"0")}</div>
            </div>
          ))}
          {TIME_SLOTS.map((s) => (
            <div key={"row-" + s.key} style={{ display: "contents" }}>
              <div style={{ fontSize: 11, color: "#666", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", borderRight: "1px solid #f0f0f0" }}>
                <div style={{ fontWeight: 600, color: s.color }}>{s.label.split("-")[0]}</div>
                <div style={{ fontSize: 10, color: "#999" }}>{GROUP_LABEL[s.group]}</div>
              </div>
              {weekDays.map((d) => {
                const date = fmt(d);
                const cell = cellMap[date + "|" + s.key];
                return (
                  <div key={date + "-" + s.key}
                    onClick={() => openCell(date, s.key)}
                    style={{
                      minHeight: 44, border: "1px solid #f0f0f0", borderRadius: 6, padding: 3, cursor: "pointer",
                      background: cell ? s.color : "#fafafa", fontSize: 11,
                    }}>
                    {cell ? (
                      <div style={{ color: "#fff", lineHeight: 1.2 }}>
                        <div style={{ fontWeight: 600 }}>{cell.employee}</div>
                      </div>
                    ) : (
                      <div style={{ color: "#ddd", textAlign: "center" }}>+</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={!!editing}
        title={editing ? WEEK_CN[weekDays.findIndex((d) => fmt(d) === editing.date)] + " " + (curSlot?.label || "") : ""}
        onCancel={() => setEditing(null)}
        destroyOnHidden
        footer={[
          editing?.row?.id ? <Button key="del" danger onClick={del}>删除该排班</Button> : null,
          <Button key="cancel" onClick={() => setEditing(null)}>取消</Button>,
          <Button key="ok" type="primary" onClick={() => form.submit()}>完成</Button>,
        ].filter(Boolean)}
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="slotKey" hidden><Input /></Form.Item>
          <Form.Item label="时段">
            <Input value={curSlot?.label || ""} disabled />
          </Form.Item>
          <Form.Item label="班次">
            <Input value={curSlot ? GROUP_LABEL[curSlot.group] : ""} disabled />
          </Form.Item>
          <Form.Item name="employee" label="当班医生" rules={[{ required: true, message: "请选择医生" }]}>
            <Select showSearch placeholder="选择医生" optionFilterProp="label"
              options={doctors.map((d) => ({ value: d.real_name || d.username, label: (d.real_name || d.username) + "（" + (d.department || "") + "）" }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
registerBlock("weekly_schedule", WeeklyScheduleBlock);

// ======== 数据区块：请假申请中心（复刻通用后台脚手架板块风格）========
registerBlock("leave_center", LeaveCenter);

