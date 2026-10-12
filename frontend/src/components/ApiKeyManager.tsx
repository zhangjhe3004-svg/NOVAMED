/**
 * API Key 管理（个人设置 - API 密钥分区）
 * 供应商卡片列表 + 配置/更换/删除 + 新增供应商弹窗
 */
import { useEffect, useState } from "react";
import {
  Button, Typography, message, Tag, Form, Input, Space, Spin, Modal, Popconfirm, Tooltip,
} from "antd";
import {
  KeyOutlined, PlusOutlined, SearchOutlined, ReloadOutlined, ThunderboltOutlined,
  DeleteOutlined, SaveOutlined, CopyOutlined, LinkOutlined, CloudOutlined, HolderOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import api from "../api/client";

const { Text } = Typography;

const providerMeta: Record<string, { icon: string; color: string; url: string }> = {
  openai:    { icon: "🤖", color: "#1677ff", url: "https://api.openai.com/v1" },
  deepseek:  { icon: "🔍", color: "#4d6bfe", url: "https://api.deepseek.com/v1" },
  qwen:      { icon: "☁️", color: "#615ced", url: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  anthropic: { icon: "🧠", color: "#d97757", url: "https://api.anthropic.com/v1" },
};

const presets: { provider: string; name: string; icon: string }[] = [
  { provider: "openai", name: "OpenAI", icon: "🤖" },
  { provider: "anthropic", name: "Claude", icon: "🧠" },
  { provider: "deepseek", name: "DeepSeek", icon: "🔍" },
  { provider: "qwen", name: "通义千问", icon: "☁️" },
  { provider: "openai", name: "Kimi", icon: "🌙" },
  { provider: "openai", name: "Gemini", icon: "✨" },
  { provider: "openai", name: "Grok", icon: "🄶" },
  { provider: "deepseek", name: "DeepSeek Coder", icon: "🅳" },
];

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<any[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [, setActivePreset] = useState("openai");
  const [presetSearch, setPresetSearch] = useState("");

  const fetchKeys = async () => {
    setKeysLoading(true);
    try {
      const res = await api.get("/ai-keys");
      setKeys(res.data.providers || []);
      if (!selected) {
        const firstCfg = (res.data.providers || []).find((p: any) => p.configured);
        setSelected(firstCfg?.provider || (res.data.providers?.[0]?.provider) || "");
      }
    } catch { /* 忽略 */ } finally { setKeysLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleSaveKey = async (provider: string) => {
    if (!inputKey.trim()) { message.warning("请输入API Key"); return; }
    setSaving(true);
    try {
      await api.post("/ai-keys", { provider, api_key: inputKey.trim() });
      message.success("API Key 已保存");
      setExpandedProvider(null);
      setInputKey("");
      fetchKeys();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "保存失败");
    } finally { setSaving(false); }
  };

  const handleDeleteKey = async (provider: string) => {
    try {
      await api.delete(`/ai-keys/${provider}`);
      message.success("API Key 已删除");
      fetchKeys();
    } catch (err: any) { message.error(err.response?.data?.detail || "删除失败"); }
  };

  const copyKey = (k: any) => {
    if (k.masked_value) {
      navigator.clipboard?.writeText(k.masked_value || "");
      message.success("已复制（脱敏值）");
    }
  };

  const handleTest = (provider: string) => {
    setTesting(provider);
    setTimeout(() => {
      setTesting(null);
      message.success(`${provider} 测速完成（未真正连接，仅示例）`);
    }, 800);
  };

  const pickPreset = (preset: any) => {
    setActivePreset(preset.provider);
    addForm.setFieldsValue({
      provider: preset.provider, name: preset.name,
      url: providerMeta[preset.provider]?.url || "",
    });
  };

  const handleAdd = async () => {
    try {
      const v = await addForm.validateFields();
      await api.post("/ai-keys", { provider: v.provider, api_key: v.api_key });
      message.success("供应商已添加");
      setAddOpen(false);
      addForm.resetFields();
      setActivePreset("openai");
      fetchKeys();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.detail || "添加失败");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#1b2b45" }}>
            <KeyOutlined style={{ marginRight: 8, color: "#2563eb" }} />AI 模型参数
          </h3>
          <Text style={{ fontSize: 12, color: "#78869b", display: "block", marginTop: 2 }}>
            供应商：{keys.length > 0 ? "已接入 " + keys.length + " 家" : "云端 · 自动选择"} · 个人偏好会覆盖系统默认值，仅作用于本人发起的分析
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>新增供应商</Button>
      </div>

      <Spin spinning={keysLoading}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
          {keys.map((k) => {
            const meta = providerMeta[k.provider] || { icon: "🔑", color: "#8c8c8c", url: "" };
            return (
              <Tag
                key={k.provider}
                style={{
                  borderRadius: 8, padding: "5px 14px", cursor: "pointer",
                  background: selected === k.provider ? "#e6f4ff" : "#f6f8fc",
                  border: `1px solid ${selected === k.provider ? "#2563eb" : "#e8ecf2"}`,
                  color: selected === k.provider ? "#2563eb" : "#63718a",
                  fontWeight: selected === k.provider ? 600 : 400, fontSize: 13,
                }}
                onClick={() => setSelected(k.provider)}
              >
                <span style={{ marginRight: 6 }}>{meta.icon}</span>{k.label}
              </Tag>
            );
          })}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: "#52c41a" }} />
            <Text style={{ fontSize: 11, color: "#52c41a" }}>已连接</Text>
            <CloudOutlined style={{ color: "#52c41a", fontSize: 13 }} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {keys.map((k) => {
            const meta = providerMeta[k.provider] || { icon: "🔑", color: "#8c8c8c", url: "" };
            const isSelected = selected === k.provider;
            const isExpanded = expandedProvider === k.provider;
            return (
              <div
                key={k.provider}
                onClick={() => setSelected(k.provider)}
                style={{
                  border: `1px solid ${isSelected ? "#2563eb" : "#edf1f7"}`,
                  borderRadius: 12, padding: "14px 18px",
                  background: isSelected ? "#f0f7ff" : "#ffffff",
                  cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <HolderOutlined style={{ color: "#bfbfbf", cursor: "grab" }} />
                  <div style={{
                    width: 42, height: 42, borderRadius: 10,
                    background: `${meta.color}15`, color: meta.color,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                  }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Space size={8}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{k.label}</span>
                      <Tag color="processing" style={{ borderRadius: 6, fontSize: 11 }}>需要路由</Tag>
                    </Space>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, color: "#2563eb", fontSize: 13 }}>
                      <LinkOutlined /> {meta.url}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Tooltip title="测速">
                      <Button size="small" icon={<ThunderboltOutlined />} loading={testing === k.provider}
                        onClick={(e) => { e.stopPropagation(); handleTest(k.provider); }} />
                    </Tooltip>
                    <Tooltip title="刷新">
                      <Button size="small" icon={<ReloadOutlined />} onClick={(e) => { e.stopPropagation(); fetchKeys(); }} />
                    </Tooltip>
                    {k.configured && (
                      <Tooltip title="复制">
                        <Button size="small" icon={<CopyOutlined />} onClick={(e) => { e.stopPropagation(); copyKey(k); }} />
                      </Tooltip>
                    )}
                    <span style={{
                      display: "inline-block", padding: "2px 10px", borderRadius: 999,
                      fontSize: 11, fontWeight: 600,
                      background: k.configured ? "#e6f4f1" : "#fff1f0",
                      color: k.configured ? "#138d85" : "#c4423e",
                    }}>
                      {k.configured ? "已配置" : "未配置"}
                    </span>
                    <Button
                      size="small"
                      type={isExpanded ? "default" : "primary"}
                      onClick={(e) => { e.stopPropagation(); setExpandedProvider(isExpanded ? null : k.provider); setInputKey(""); }}
                    >
                      {k.configured ? "更换" : "配置"}
                    </Button>
                    {k.configured && (
                      <Popconfirm title="确认删除此API Key？" onConfirm={() => handleDeleteKey(k.provider)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 12, padding: "12px 16px", background: "#f6f8fc", borderRadius: 8, border: "1px solid #e8ecf2" }}>
                    <Space.Compact style={{ width: "100%" }}>
                      <Input.Password
                        placeholder={k.placeholder || "sk-..."}
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        onPressEnter={() => handleSaveKey(k.provider)}
                        style={{ flex: 1 }}
                      />
                      <Button type="primary" loading={saving} icon={<SaveOutlined />} onClick={() => handleSaveKey(k.provider)}>保存</Button>
                    </Space.Compact>
                    <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 6 }}>
                      Key 安全存储在服务器端 .env 文件
                    </Text>
                  </div>
                )}
              </div>
            );
          })}
          {keys.length === 0 && !keysLoading && (
            <Text type="secondary" style={{ textAlign: "center", padding: 24 }}>
              暂无供应商，点击右上角「新增供应商」添加
            </Text>
          )}
        </div>
      </Spin>

      <Modal
        title={
          <Space>
            <Button type="text" shape="circle" icon={<span>←</span>} onClick={() => setAddOpen(false)} />
            <span>添加新供应商</span>
          </Space>
        }
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        width={760}
        footer={[
          <Button key="cancel" onClick={() => setAddOpen(false)}>取消</Button>,
          <Button key="add" type="primary" icon={<CheckOutlined />} loading={saving} onClick={handleAdd}>添加</Button>,
        ]}
      >
        <Form form={addForm} layout="vertical" initialValues={{ provider: "openai", name: "OpenAI", url: "https://api.openai.com/v1", access: "direct" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text strong style={{ display: "block" }}>预设供应商</Text>
            <Input
              size="small" prefix={<SearchOutlined />} placeholder="搜索供应商"
              allowClear style={{ width: 200 }}
              value={presetSearch} onChange={(e) => setPresetSearch(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {presets
              .filter((p) => p.name.toLowerCase().includes(presetSearch.toLowerCase()))
              .map((p) => (
                <Tag
                  key={p.name}
                  style={{
                    borderRadius: 8, padding: "4px 10px", cursor: "pointer",
                    background: addForm.getFieldValue("name") === p.name ? "#e6f4ff" : "#f6f8fc",
                    border: `1px solid ${addForm.getFieldValue("name") === p.name ? "#2563eb" : "#e8ecf2"}`,
                  }}
                  onClick={() => pickPreset(p)}
                >
                  <span style={{ marginRight: 4 }}>{p.icon}</span>{p.name}
                </Tag>
              ))}
          </div>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 16 }}>
            选择预设后，请在下方填写 API Key
          </Text>
          <Form.Item label="供应商名称" name="name" rules={[{ required: true, message: "请输入供应商名称" }]}>
            <Input placeholder="例如：Claude 官方" />
          </Form.Item>
          <Form.Item label="备注" name="note"><Input placeholder="例如：公司专用账号" /></Form.Item>
          <Form.Item label="官网链接" name="url"><Input placeholder="https://example.com（可选）" /></Form.Item>
          <Form.Item label="API Key" name="api_key" rules={[{ required: true, message: "请输入 API Key" }]}>
            <Input.Password placeholder="只需要填这里，下方配置会自动填充" />
          </Form.Item>
          <Form.Item label="请求地址" name="request_url"><Input placeholder="https://your-api-endpoint.com" /></Form.Item>
          <Form.Item label="接入方式" name="access">
            <RadioGroup />
          </Form.Item>
          <Form.Item name="provider" hidden><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function RadioGroup() {
  const [v, setV] = useState("direct");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {[{ value: "direct", label: "直连" }, { value: "proxy", label: "代理" }].map((o) => (
        <div key={o.value} onClick={() => setV(o.value)}
          style={{
            padding: "9px 14px", borderRadius: 9, cursor: "pointer", fontSize: 13, textAlign: "center",
            border: `1px solid ${v === o.value ? "#2563eb" : "#e6ecf3"}`,
            background: v === o.value ? "#eaf1ff" : "#fff",
            color: v === o.value ? "#2563eb" : "#5b6b82",
          }}>
          {v === o.value ? "● " : "○ "}{o.label}
        </div>
      ))}
    </div>
  );
}
