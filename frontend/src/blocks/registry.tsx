/**
 * 区块注册表（对齐 NocoBase 的 SchemaComponent 区块注册）
 *
 * 每个区块 = 一个自注册组件，通过 registerBlock(type, component) 登记。
 * 区块既可以是「数据区块」（自己拉数据），也可以是「展示区块」（纯展示）。
 */
import { useEffect, useState } from "react";
import {
  Card, Switch, Tag, Space, Typography, Row, Col, Statistic, message,
  Button, Alert,
} from "antd";
import {
  ArrowUpOutlined, ArrowDownOutlined,
} from "@ant-design/icons";
import { getWorkflow, updateWorkflow, getAIConfig } from "../api/ai";
import type { WorkflowStage, AIConfigSummary } from "../api/ai";
import { getPlugins, enablePlugin, disablePlugin } from "../api/plugins";
import type { PluginInfo } from "../api/plugins";

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
