/**
 * 系统设置中心 —— NocoBase 风格（左侧功能列表 + 右侧面板）
 * 已有功能建映射；未接入的给出可扩展管理面板（示例）。
 */
import { useState, useEffect } from "react";
import { Card, Menu, Typography, Space, Tag, Button, Table, Empty, Descriptions, Input, Select, List, message, Divider, Modal, Drawer, Popconfirm } from "antd";
import {
  AppstoreOutlined, DatabaseOutlined, TeamOutlined, NodeIndexOutlined, RobotOutlined,
  SafetyCertificateOutlined, BgColorsOutlined, KeyOutlined, FolderOutlined,
  FileProtectOutlined, FileSearchOutlined, BellOutlined, ApartmentOutlined,
  LockOutlined, SettingOutlined, AppstoreAddOutlined, CheckCircleOutlined,
} from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";
import { getPlugins } from "../api/plugins";
import type { PluginInfo } from "../api/plugins";
import { useAuth } from "../stores/auth";
import api from "../api/client";
import { listNotifications, markRead } from "../api/notifications";
import type { NotificationItem } from "../api/notifications";
import { updateWorkflow } from "../api/ai";
import { updateUser, resetUserPassword, deleteUser } from "../api/users";

const { Text } = Typography;

const ITEMS = [
  { key: "plugin", label: "插件管理器", icon: <AppstoreOutlined /> },
  { key: "datasource", label: "数据源", icon: <DatabaseOutlined /> },
  { key: "up", label: "用户与权限", icon: <TeamOutlined /> },
  { key: "workflow", label: "工作流", icon: <NodeIndexOutlined /> },
  { key: "ai", label: "AI 员工", icon: <RobotOutlined /> },
  { key: "auth", label: "认证", icon: <SafetyCertificateOutlined /> },
  { key: "brand", label: "自定义品牌", icon: <BgColorsOutlined /> },
  { key: "vars", label: "变量与密钥", icon: <KeyOutlined /> },
  { key: "file", label: "文件管理", icon: <FolderOutlined /> },
  { key: "license", label: "许可设置", icon: <FileProtectOutlined /> },
  { key: "logger", label: "日志", icon: <FileSearchOutlined /> },
  { key: "notify", label: "通知管理", icon: <BellOutlined /> },
  { key: "routes", label: "路由", icon: <ApartmentOutlined /> },
  { key: "security", label: "安全", icon: <LockOutlined /> },
  { key: "system", label: "系统设置", icon: <SettingOutlined /> },
  { key: "theme", label: "主题编辑器", icon: <BgColorsOutlined /> },
  { key: "ui", label: "UI 模板", icon: <AppstoreAddOutlined /> },
  { key: "verification", label: "验证", icon: <CheckCircleOutlined /> },
];

function Placeholder({ title, desc }: { title: string; desc?: string }) {
  return (
    <Card title={title} style={{ minHeight: 240 }}>
      <Empty description={desc || `「${title}」为示例管理面板，可扩展接入（前端 UI + 后端接口）`} />
    </Card>
  );
}

function LogViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState<string[]>([]);
  const [actFilter, setActFilter] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/audit-logs", {
        params: {
          page,
          page_size: 20,
          action: actFilter.length ? actFilter.join(",") : undefined,
          keyword: keyword || undefined,
        },
      });
      setLogs(r.data.items || []);
      setTotal(r.data.total || 0);
      setActions(r.data.actions || []);
    } catch {
      // 忽略
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, actFilter, keyword]);

  return (
    <Card title="日志（审计）" bodyStyle={{ padding: 12 }}>
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          mode="multiple"
          allowClear
          placeholder="动作（多选）"
          style={{ width: 240 }}
          value={actFilter}
          options={actions.map((a) => ({ value: a, label: a }))}
          onChange={(v) => { setPage(1); setActFilter(v); }}
        />
        <Input.Search placeholder="搜索用户名/摘要" style={{ width: 260 }} allowClear
          onSearch={(v) => { setPage(1); setKeyword(v); }} />
      </Space>
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={logs}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
        columns={[
          { title: "时间", dataIndex: "created_at", width: 170, render: (d: string) => (d ? new Date(d).toLocaleString("zh-CN") : "-") },
          { title: "用户", dataIndex: "username", width: 110 },
          { title: "动作", dataIndex: "action", width: 90, render: (v: string) => <Tag style={{ borderRadius: 6 }}>{v}</Tag> },
          { title: "对象", dataIndex: "resource", width: 90 },
          { title: "摘要", dataIndex: "detail", ellipsis: true },
          { title: "IP", dataIndex: "ip_address", width: 120 },
        ]}
      />
    </Card>
  );
}

function NotificationViewer() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const r = await listNotifications();
      setItems(r.items || []);
    } catch {
      // 忽略
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  return (
    <Card title="通知管理" bodyStyle={{ padding: 12 }} loading={loading}>
      <Button type="primary" size="small" style={{ marginBottom: 12 }}
        onClick={async () => { await markRead(); load(); message.success("已全部标记为已读"); }}>
        全部已读
      </Button>
      <List
        size="small"
        dataSource={items}
        renderItem={(n: NotificationItem) => (
          <div key={n.id} style={{ padding: "8px 4px", borderBottom: "1px solid #f0f0f0" }}>
            <Space>
              <Tag color={n.is_read ? "default" : "blue"}>{n.is_read ? "已读" : "未读"}</Tag>
              <Text strong>{n.title}</Text>
            </Space>
            {n.content && <Text type="secondary" style={{ display: "block", fontSize: 12 }}>{n.content}</Text>}
            {n.created_at && <Text type="secondary" style={{ fontSize: 11 }}>{new Date(n.created_at).toLocaleString("zh-CN")}</Text>}
          </div>
        )}
      />
    </Card>
  );
}

function AuthPanel() {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => {
    api.get("/users", { params: { page: 1, page_size: 100 } }).then((r) => setUsers(r.data.items || [])).catch(() => {});
  }, []);
  const count = (role: string) => users.filter((u) => u.role === role).length;
  return (
    <Card title="认证" bodyStyle={{ padding: 12 }}>
      <Space wrap>
        <Tag color="red">管理员 {count("admin")}</Tag>
        <Tag color="blue">医生 {count("doctor")}</Tag>
        <Tag color="green">药剂师 {count("pharmacist")}</Tag>
        <Tag color="orange">运维 {count("maintainer")}</Tag>
      </Space>
      <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
        基于 JWT 无状态令牌认证；管理员可在「用户管理」维护账号与角色。
      </Text>
    </Card>
  );
}

function VarsPanel() {
  const [keys, setKeys] = useState<any[]>([]);
  const [cfg, setCfg] = useState<any>(null);
  useEffect(() => {
    api.get("/ai-keys").then((r) => setKeys(r.data.providers || [])).catch(() => {});
    api.get("/ai/config").then((r) => setCfg(r.data)).catch(() => {});
  }, []);
  return (
    <Card title="变量与密钥" bodyStyle={{ padding: 12 }}>
      <Text strong>AI 服务商密钥（脱敏）</Text>
      <Table rowKey="provider" size="small" dataSource={keys} pagination={false} style={{ marginTop: 8 }}
        columns={[
          { title: "服务商", dataIndex: "label" },
          { title: "Key", dataIndex: "masked_value", render: (v: string) => v || <Tag>未配置</Tag> },
          { title: "状态", dataIndex: "configured", width: 90, render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "已配置" : "未配置"}</Tag> },
        ]} />
      <Divider />
      <Text strong>AI 生成参数</Text>
      <Space wrap style={{ marginTop: 8 }}>
        <Tag>temperature {cfg?.generation_parameters?.temperature}</Tag>
        <Tag>top_p {cfg?.generation_parameters?.top_p}</Tag>
        <Tag>repetition_penalty {cfg?.generation_parameters?.repetition_penalty}</Tag>
        <Tag>min_p {cfg?.generation_parameters?.min_p}</Tag>
        <Tag>seed {cfg?.generation_parameters?.seed}</Tag>
      </Space>
    </Card>
  );
}

function RoutesPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/system/routes");
      setItems(r.data.items || []);
    } catch {
      // 忽略
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  return (
    <Card title="路由" bodyStyle={{ padding: 12 }} loading={loading}>
      <Table rowKey={(r: any) => r.method + r.path} size="small" dataSource={items} pagination={{ pageSize: 20 }}
        columns={[
          { title: "方法", dataIndex: "method", width: 90, render: (v: string) => <Tag color="blue" style={{ borderRadius: 6 }}>{v}</Tag> },
          { title: "路径", dataIndex: "path" },
        ]} />
    </Card>
  );
}

function VerificationPanel() {
  const [cfg, setCfg] = useState<any>(null);
  useEffect(() => { api.get("/ai/config").then((r) => setCfg(r.data)).catch(() => {}); }, []);
  return (
    <Card title="验证" bodyStyle={{ padding: 12 }}>
      <Text strong>医学证据分级</Text>
      <div style={{ marginTop: 8, marginBottom: 16 }}>
        {Object.entries(cfg?.evidence_tiers || {}).map(([t, d]) => (
          <div key={t} style={{ marginBottom: 4 }}>
            <Tag color={t === "A" ? "green" : t === "B" ? "blue" : "orange"} style={{ borderRadius: 6 }}>{t}</Tag>{String(d)}
          </div>
        ))}
      </div>
      <Text strong>防幻觉机制</Text>
      <div style={{ marginTop: 8 }}>
        {(cfg?.rules || []).map((r: string, i: number) => (
          <div key={i} style={{ fontSize: 12, color: "#666", marginBottom: 3 }}>{r}</div>
        ))}
      </div>
    </Card>
  );
}

function MiniWindow({ kind, onClose }: { kind: string | null; onClose: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [cfg, setCfg] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([
    { display: "用户", name: "users", fields: "username, role, work_status" },
    { display: "患者", name: "patients", fields: "name, gender, blood_type" },
    { display: "就诊记录", name: "medical_records", fields: "symptoms, diagnosis, room" },
    { display: "知识文档", name: "knowledge_docs", fields: "title, category, status" },
    { display: "Token 用量", name: "token_usage", fields: "provider, model, tokens" },
  ]);

  const loadUsers = () => api.get("/users", { params: { page: 1, page_size: 50 } }).then((r) => setUsers(r.data.items || [])).catch(() => {});
  const loadWf = () => api.get("/ai/workflow").then((r) => setStages(r.data.stages || [])).catch(() => {});

  useEffect(() => {
    if (kind === "up") loadUsers();
    if (kind === "workflow") loadWf();
    if (kind === "ai") api.get("/ai/config").then((r) => setCfg(r.data)).catch(() => {});
  }, [kind]);

  const toggleStage = (key: string, enabled: boolean) => {
    const next = stages.map((s) => (s.key === key ? { ...s, enabled } : s));
    setStages(next);
    updateWorkflow(next).then(loadWf).catch(() => {});
  };
  const moveStage = (key: string, dir: number) => {
    const arr = [...stages].sort((a, b) => a.order - b.order);
    const i = arr.findIndex((s) => s.key === key);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const next = arr.map((s, idx) => ({ ...s, order: idx + 1 }));
    setStages(next);
    updateWorkflow(next).then(loadWf).catch(() => {});
  };
  const userChange = (u: any, patch: any) => updateUser(u.id, patch).then(loadUsers).catch((e) => message.error(e.response?.data?.detail || "更新失败"));
  const resetPwd = (u: any) => {
    const p = window.prompt(`为 ${u.real_name} 输入新密码`);
    if (p) resetUserPassword(u.id, p).then(() => { message.success("已重置"); loadUsers(); }).catch(() => {});
  };
  const delUser = (u: any) => deleteUser(u.id).then(() => { message.success("已删除"); loadUsers(); }).catch((e) => message.error(e.response?.data?.detail || "删除失败"));
  const addCollection = () => {
    const n = window.prompt("输入集合名（如 ticket）");
    if (n) setCollections((prev) => [{ display: n, name: n, fields: "待配置" }, ...prev]);
  };

  return (
    <Drawer
      width={700}
      open={!!kind}
      onClose={onClose}
      title={kind === "datasource" ? "数据源" : kind === "up" ? "用户与权限" : kind === "workflow" ? "工作流" : "AI 员工"}
    >
      {kind === "datasource" && (
        <>
          <Button type="primary" size="small" style={{ marginBottom: 12 }} onClick={addCollection}>创建集合</Button>
          <Table rowKey="name" size="small" pagination={false} dataSource={collections}
            columns={[{ title: "集合", dataIndex: "display" }, { title: "名", dataIndex: "name" }, { title: "字段", dataIndex: "fields" }]} />
        </>
      )}
      {kind === "up" && (
        <Table rowKey="id" size="small" pagination={false} dataSource={users}
          columns={[
            { title: "用户", dataIndex: "username" },
            { title: "姓名", dataIndex: "real_name" },
            { title: "角色", dataIndex: "role", render: (v: string, u: any) => (
              <Select size="small" value={v} style={{ width: 100 }} onChange={(val) => userChange(u, { role: val })}
                options={[{ value: "admin", label: "管理员" }, { value: "doctor", label: "医生" }, { value: "pharmacist", label: "药剂师" }, { value: "maintainer", label: "运维" }]} />
            ) },
            { title: "在岗", dataIndex: "work_status", render: (v: string, u: any) => (
              <Select size="small" value={v || "在职"} style={{ width: 90 }} onChange={(val) => userChange(u, { work_status: val })}
                options={[{ value: "在职", label: "在职" }, { value: "休息", label: "休息" }, { value: "离岗", label: "离岗" }]} />
            ) },
            { title: "操作", width: 150, render: (_: any, u: any) => (
              <Space>
                <Button size="small" type="link" onClick={() => resetPwd(u)}>重置密码</Button>
                <Popconfirm title="确认删除该用户？" onConfirm={() => delUser(u)}>
                  <Button size="small" type="link" danger>删除</Button>
                </Popconfirm>
              </Space>
            ) },
          ]} />
      )}
      {kind === "workflow" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {stages.sort((a, b) => a.order - b.order).map((s) => (
            <div key={s.key} style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{s.name}（{s.key}）</span>
              <Space>
                <Button size="small" onClick={() => moveStage(s.key, -1)}>↑</Button>
                <Button size="small" onClick={() => moveStage(s.key, 1)}>↓</Button>
                <Button size="small" type={s.enabled ? "primary" : "default"} onClick={() => toggleStage(s.key, !s.enabled)}>
                  {s.enabled ? "启用" : "禁用"}
                </Button>
              </Space>
            </div>
          ))}
        </div>
      )}
      {kind === "ai" && (
        <div>
          <Text strong>{cfg?.role}</Text>
          <div style={{ marginTop: 8 }}><Text type="secondary">{cfg?.objective}</Text></div>
          <Space wrap style={{ marginTop: 10 }}>
            <Tag>temperature {cfg?.generation_parameters?.temperature}</Tag>
            <Tag>top_p {cfg?.generation_parameters?.top_p}</Tag>
            <Tag>rep {cfg?.generation_parameters?.repetition_penalty}</Tag>
            <Tag>min_p {cfg?.generation_parameters?.min_p}</Tag>
          </Space>
        </div>
      )}
    </Drawer>
  );
}

export default function SettingsCenter() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [active, setActive] = useState(() => searchParams.get("key") || "plugin");
  const [mini, setMini] = useState<string | null>(null);
  const current = ITEMS.find((i) => i.key === active)!;

  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const loadPlugins = () => getPlugins().then((r) => setPlugins(r.plugins)).catch(() => {});
  if (active === "plugin" && plugins.length === 0) loadPlugins();

  const render = () => {
    switch (active) {
      case "plugin":
        return (
          <Card title="插件管理器" extra={<Button type="primary">启用/禁用（重启生效）</Button>} bodyStyle={{ padding: 0 }}>
            <Table rowKey="name" size="small" dataSource={plugins} pagination={false}
              columns={[
                { title: "名称", dataIndex: "display_name" },
                { title: "描述", dataIndex: "description", ellipsis: true },
                { title: "版本", dataIndex: "version", width: 80 },
                { title: "状态", dataIndex: "enabled", width: 90, render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "已启用" : "已禁用"}</Tag> },
              ]} />
          </Card>
        );
      case "datasource":
        return <Card title="数据源"><Empty description={<Button type="primary" onClick={() => setMini("datasource")}>在设置内打开（小窗）</Button>} /></Card>;
      case "up":
        return <Card title="用户与权限"><Empty description={<Button type="primary" onClick={() => setMini("up")}>在设置内打开（小窗）</Button>} /></Card>;
      case "workflow":
        return <Card title="工作流"><Empty description={<Button type="primary" onClick={() => setMini("workflow")}>在设置内打开（小窗）</Button>} /></Card>;
      case "ai":
        return <Card title="AI 员工"><Empty description={<Button onClick={() => setMini("ai")}>在设置内打开（小窗）</Button>} /></Card>;
      case "system":
        return (
          <Card title="系统设置">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="系统名称">MediCode 全域智慧医疗系统</Descriptions.Item>
              <Descriptions.Item label="版本">v1.0.0</Descriptions.Item>
              <Descriptions.Item label="当前登录">{user?.real_name}（{user?.role}）</Descriptions.Item>
              <Descriptions.Item label="说明">本地 / 边缘部署，敏感数据本地处理</Descriptions.Item>
            </Descriptions>
          </Card>
        );
      case "logger":
        return <LogViewer />;
      case "notify":
        return <NotificationViewer />;
      case "auth":
        return <AuthPanel />;
      case "vars":
        return <VarsPanel />;
      case "routes":
        return <RoutesPanel />;
      case "verification":
        return <VerificationPanel />;
      case "theme":
        return (
          <Card title="主题编辑器">
            <Space wrap>
              <Tag color="#1677ff">主色 #1677ff</Tag>
              <Tag>圆角 6/8</Tag>
              <Tag>字体 Inter</Tag>
            </Space>
            <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
              主题在 src/App.tsx 的 AntD ConfigProvider 中配置；当前为 NocoBase 蓝白风格。
            </Text>
          </Card>
        );
      case "brand":
        return (
          <Card title="自定义品牌">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="系统名称">MediCode 全域智慧医疗系统</Descriptions.Item>
              <Descriptions.Item label="副标题">智慧医疗系统</Descriptions.Item>
              <Descriptions.Item label="品牌色">#1677ff</Descriptions.Item>
            </Descriptions>
          </Card>
        );
      case "license":
        return (
          <Card title="许可设置">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="版本">v1.0.0</Descriptions.Item>
              <Descriptions.Item label="授权">本地自托管 · 无商业授权</Descriptions.Item>
              <Descriptions.Item label="技术栈">FastAPI / React / Ant Design 5</Descriptions.Item>
            </Descriptions>
          </Card>
        );
      case "ui":
        return (
          <Card title="UI 模板">
            <Text strong>内置区块类型</Text>
            <Space wrap style={{ marginTop: 8 }}>
              {"header,stat_card,workflow,plugins,agent_config".split(",").map((b) => (
                <Tag key={b} style={{ borderRadius: 6 }}>{b}</Tag>
              ))}
            </Space>
            <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
              页面由这些 schema 区块组成（见 src/blocks）。
            </Text>
          </Card>
        );
      default:
        return <Placeholder title={current.label} desc={`「${current.label}」示例管理面板`} />;
    }
  };

  return (
    <div style={{ display: "flex", gap: 24 }}>
      {/* 左侧功能列表 */}
      <Card size="small" style={{ width: 240, flexShrink: 0 }} bodyStyle={{ padding: 0 }}>
        <Menu
          mode="inline"
          selectedKeys={[active]}
          items={ITEMS.map((i) => ({ key: i.key, icon: i.icon, label: i.label }))}
          onClick={({ key }) => setActive(key)}
          style={{ border: "none" }}
        />
      </Card>
      {/* 右侧内容 */}
      <div style={{ flex: 1 }}>{render()}</div>

      {/* 已存在功能的小窗展示 */}
      <MiniWindow kind={mini} onClose={() => setMini(null)} />
    </div>
  );
}
