/**
 * 系统设置页面
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Descriptions,
  Button,
  Typography,
  message,
  Tag,
  Form,
  Input,
  Space,
  Statistic,
  Spin,
  Modal,
  Select,
  Popconfirm,
  Tooltip,
  Badge,
} from "antd";
import {
  SettingOutlined,
  ApiOutlined,
  DatabaseOutlined,
  UserOutlined,
  LockOutlined,
  KeyOutlined,
  LogoutOutlined,
  EditOutlined,
  PhoneOutlined,
  MailOutlined,
  SaveOutlined,
  DeleteOutlined,
  SafetyOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  HolderOutlined,
  LinkOutlined,
  CloudOutlined,
  ThunderboltOutlined,
  CheckOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import { getAIProviders, getVectorStats, getAIConfig } from "../api/ai";
import type { AIConfigSummary } from "../api/ai";
import { getKnowledgeStats } from "../api/knowledge";
import { lookupByEmployeeNo, resetUserPassword } from "../api/users";
import { useAuth } from "../stores/auth";
import api from "../api/client";

const { Title, Text } = Typography;

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<string[]>([]);
  const [vectorStats, setVectorStats] = useState<any>({});
  const [knowledgeStats, setKnowledgeStats] = useState<any>({});
  const [aiConfig, setAiConfig] = useState<AIConfigSummary | null>(null);

  // 修改密码
  const [pwdForm] = Form.useForm();
  const [pwdLoading, setPwdLoading] = useState(false);

  // 重置其他用户密码（管理员）
  const [resetKeyword, setResetKeyword] = useState("");
  const [resetFound, setResetFound] = useState<any>(null);
  const [resetNewPass, setResetNewPass] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // 编辑个人信息
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, v, k, c] = await Promise.allSettled([
          getAIProviders(),
          getVectorStats(),
          getKnowledgeStats(),
          getAIConfig(),
        ]);
        if (p.status === "fulfilled") setProviders(p.value.providers || []);
        if (v.status === "fulfilled") setVectorStats(v.value);
        if (k.status === "fulfilled") setKnowledgeStats(k.value);
        if (c.status === "fulfilled") setAiConfig(c.value);
      } catch {
        // 忽略加载失败
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChangePassword = async (values: {
    old_password: string;
    new_password: string;
  }) => {
    setPwdLoading(true);
    try {
      await api.put("/auth/password", values);
      message.success("密码修改成功");
      pwdForm.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "修改失败");
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSearchUser = async () => {
    if (!resetKeyword.trim()) {
      message.warning("请输入工号/用户名");
      return;
    }
    setSearchLoading(true);
    setResetFound(null);
    try {
      const u = await lookupByEmployeeNo(resetKeyword.trim());
      setResetFound(u);
    } catch (e: any) {
      message.error(e.response?.data?.detail || "未找到该用户");
      setResetFound(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleResetOther = async () => {
    if (!resetFound) {
      message.warning("请先查询到用户");
      return;
    }
    if (!resetNewPass.trim()) {
      message.warning("请输入新密码");
      return;
    }
    setResetLoading(true);
    try {
      await resetUserPassword(resetFound.id, resetNewPass.trim());
      message.success(`已重置 ${resetFound.real_name} 的密码`);
      setResetNewPass("");
      setResetFound(null);
      setResetKeyword("");
    } catch (e: any) {
      message.error(e.response?.data?.detail || "重置失败");
    } finally {
      setResetLoading(false);
    }
  };

  const handleEditProfile = () => {
    editForm.setFieldsValue({
      real_name: user?.real_name,
      phone: user?.phone,
      email: user?.email,
      id_number: user?.id_number,
      employee_no: user?.employee_no,
      department: user?.department,
      title: user?.title,
      work_status: user?.work_status || "在职",
    });
    setEditModalOpen(true);
  };

  const handleSaveProfile = async (values: {
    real_name?: string;
    phone?: string;
    email?: string;
    id_number?: string;
    employee_no?: string;
    department?: string;
    title?: string;
    work_status?: string;
  }) => {
    setEditLoading(true);
    try {
      await api.put("/auth/me", values);
      const saved = localStorage.getItem("user");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (values.real_name !== undefined) parsed.real_name = values.real_name;
        if (values.phone !== undefined) parsed.phone = values.phone;
        if (values.email !== undefined) parsed.email = values.email;
        if (values.id_number !== undefined) parsed.id_number = values.id_number;
        if (values.employee_no !== undefined) parsed.employee_no = values.employee_no;
        if (values.department !== undefined) parsed.department = values.department;
        if (values.title !== undefined) parsed.title = values.title;
        if (values.work_status !== undefined) parsed.work_status = values.work_status;
        localStorage.setItem("user", JSON.stringify(parsed));
      }
      message.success("个人信息已更新");
      setEditModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "更新失败");
    } finally {
      setEditLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          <SettingOutlined /> 系统设置
        </Title>
        <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
          退出登录
        </Button>
      </div>

      <Spin spinning={loading}>
        <Row gutter={[24, 24]} align="stretch">
          {/* 个人信息（管理员时与修改密码并排，否则占满） */}
          <Col xs={24} md={user?.role === "admin" ? 12 : 24}>
            <Card
              title={<><UserOutlined /> 个人信息</>}
              style={{ height: "100%" }}
              extra={
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={handleEditProfile}
                >
                  编辑
                </Button>
              }
            >
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="用户名">{user?.username}</Descriptions.Item>
                <Descriptions.Item label="姓名">{user?.real_name}</Descriptions.Item>
                <Descriptions.Item label="角色">
                  <Tag color="blue">{user?.role}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="电话">
                  {user?.phone || <Text type="secondary">未设置</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="邮箱">
                  {user?.email || <Text type="secondary">未设置</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="身份证号">
                  {user?.id_number || <Text type="secondary">未设置</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="工号">
                  {user?.employee_no || <Text type="secondary">未设置</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="科室">
                  {user?.department || <Text type="secondary">未设置</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="职称">
                  {user?.title || <Text type="secondary">未设置</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="在岗状态">
                  <Tag color={user?.work_status === "在职" ? "green" : user?.work_status === "休息" ? "orange" : "red"}>
                    {user?.work_status || "在职"}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* 修改密码（仅管理员） */}
          {user?.role === "admin" && (
          <Col xs={24} md={12}>
            <Card title={<><LockOutlined /> 修改密码</>} style={{ height: "100%" }}>
              <Form
                form={pwdForm}
                layout="vertical"
                onFinish={handleChangePassword}
              >
                <Form.Item
                  name="old_password"
                  label="当前密码"
                  rules={[{ required: true, message: "请输入当前密码" }]}
                >
                  <Input.Password />
                </Form.Item>
                <Form.Item
                  name="new_password"
                  label="新密码"
                  rules={[
                    { required: true, message: "请输入新密码" },
                    { required: true, message: "请输入新密码" },
                  ]}
                >
                  <Input.Password />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={pwdLoading}
                  >
                    修改密码
                  </Button>
                </Form.Item>
              </Form>

              {/* 重置其他用户密码（管理员） */}
              <div style={{ height: 1, background: "#f0f0f0", margin: "14px 0" }} />
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                重置其他用户密码（按工号/用户名查询）
              </Text>
              <Space.Compact style={{ width: "100%" }}>
                <Input
                  placeholder="输入工号/用户名"
                  value={resetKeyword}
                  onChange={(e) => setResetKeyword(e.target.value)}
                  onPressEnter={handleSearchUser}
                />
                <Button loading={searchLoading} onClick={handleSearchUser}>
                  查询
                </Button>
              </Space.Compact>
              {resetFound && (
                <div style={{ marginTop: 12 }}>
                  <Space wrap>
                    <Tag color="blue">{resetFound.real_name}</Tag>
                    <Tag>{resetFound.department || "未填科室"}</Tag>
                    <Tag>{resetFound.employee_no || "无工号"}</Tag>
                  </Space>
                  <Input.Password
                    style={{ marginTop: 10 }}
                    placeholder="新密码"
                    value={resetNewPass}
                    onChange={(e) => setResetNewPass(e.target.value)}
                  />
                  <Button
                    type="primary"
                    style={{ marginTop: 10 }}
                    loading={resetLoading}
                    onClick={handleResetOther}
                  >
                    重置该用户密码
                  </Button>
                </div>
              )}
            </Card>
          </Col>
          )}
        </Row>

        {/* 统计卡片：AI 服务商状态 / 向量数据库 / 知识库统计（等宽等高） */}
        <Row gutter={[24, 24]} align="stretch" style={{ marginTop: 32 }}>
          {/* AI 服务商状态 */}
          <Col xs={24} md={8}>
            <Card title={<><ApiOutlined /> AI 服务商状态</>} style={{ height: "100%" }}>
              <Statistic title="已配置服务商" value={providers.length} suffix="家" />
              <Text type="secondary" style={{ display: "block", marginTop: 6 }}>
                {providers.length === 0
                  ? "暂无已配置的AI服务商（使用本地规则引擎）"
                  : "已接入：" + providers.join("、")}
              </Text>
              <Tag color="blue" style={{ marginTop: 8 }} icon={<KeyOutlined />}>
                本地规则引擎（始终可用）
              </Tag>
            </Card>
          </Col>

          {/* 向量数据库 */}
          <Col xs={24} md={8}>
            <Card title={<><DatabaseOutlined /> 向量数据库</>} style={{ height: "100%" }}>
              <Statistic
                title="索引文档数"
                value={vectorStats.total_documents || 0}
                suffix="条"
              />
              <Text type="secondary">
                引擎: {vectorStats.engine || "-"} | 维度:{" "}
                {vectorStats.dimension || "-"}
              </Text>
            </Card>
          </Col>

          {/* 知识库统计 */}
          <Col xs={24} md={8}>
            <Card title="知识库统计" style={{ height: "100%" }}>
              <Statistic
                title="文档总数"
                value={knowledgeStats.total_documents || 0}
                suffix="篇"
              />
              <Text type="secondary">
                已发布: {knowledgeStats.published_documents || 0} | 总浏览:{" "}
                {knowledgeStats.total_views || 0}
              </Text>
            </Card>
          </Col>
        </Row>

        {/* AI 防幻觉配置（融合验证专家框架） */}
        <Row style={{ marginTop: 32 }}>
          <Col span={24}>
            <Card
              title={
                <Space>
                  <SafetyOutlined />
                  <span>AI 防幻觉配置</span>
                  {aiConfig?.role && (
                    <Tag color="blue" style={{ borderRadius: 8 }}>{aiConfig.role}</Tag>
                  )}
                </Space>
              }
            >
              {aiConfig ? (
                <Row gutter={[24, 24]}>
                  <Col xs={24} md={8}>
                    <Text style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
                      生成参数（防幻觉低温档）
                    </Text>
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="temperature">
                        {aiConfig.generation_parameters?.temperature ?? "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="top_p">
                        {aiConfig.generation_parameters?.top_p ?? "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="repetition_penalty">
                        {aiConfig.generation_parameters?.repetition_penalty ?? "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="min_p">
                        {aiConfig.generation_parameters?.min_p ?? "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="seed">
                        {aiConfig.generation_parameters?.seed ?? "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="max_tokens">
                        {aiConfig.generation_parameters?.max_tokens ?? "-"}
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>

                  <Col xs={24} md={8}>
                    <Text style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
                      场景参数剖面
                    </Text>
                    <Space direction="vertical" style={{ width: "100%" }}>
                      {Object.entries(aiConfig.scenario_parameter_profiles || {}).map(
                        ([name, prof]: [string, any]) => (
                          <div key={name} style={{
                            background: "#fafafa", borderRadius: 8,
                            padding: "8px 12px", fontSize: 12,
                          }}>
                            <Tag color="default" style={{ marginRight: 6 }}>{name}</Tag>
                            temp={prof.temperature} · top_p={prof.top_p} · rep={prof.repetition_penalty}
                          </div>
                        )
                      )}
                    </Space>
                  </Col>

                  <Col xs={24} md={8}>
                    <Text style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
                      防幻觉机制
                    </Text>
                    <Space direction="vertical" style={{ width: "100%" }}>
                      {aiConfig.rules?.map((r, i) => (
                        <Text key={i} style={{ fontSize: 12, color: "rgba(0,0,0,0.65)", display: "block" }}>
                          {r}
                        </Text>
                      ))}
                    </Space>
                  </Col>

                  {aiConfig.evidence_tiers && Object.keys(aiConfig.evidence_tiers).length > 0 && (
                    <Col xs={24} md={8}>
                      <Text style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
                        医学证据分级
                      </Text>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        {Object.entries(aiConfig.evidence_tiers).map(([tier, desc]) => (
                          <div key={tier} style={{ fontSize: 12 }}>
                            <Tag color={tier === "A" ? "green" : tier === "B" ? "blue" : "orange"} style={{ borderRadius: 6 }}>
                              {tier}
                            </Tag>
                            {desc}
                          </div>
                        ))}
                      </Space>
                    </Col>
                  )}
                </Row>
              ) : (
                <Text type="secondary">
                  暂无防幻觉配置，请确认项目根目录存在 agent_config.json
                </Text>
              )}
            </Card>
          </Col>
        </Row>

        {/* API Key 管理（所有用户可自行配置） */}
        <Row style={{ marginTop: 32 }}>
          <Col span={24}>
            <ApiKeyManager />
          </Col>
        </Row>
      </Spin>

      {/* 编辑个人信息弹窗 */}
      <Modal
        title="编辑个人信息"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={editLoading}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSaveProfile}
        >
          <Form.Item name="real_name" label="真实姓名">
            <Input placeholder="输入真实姓名" />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input prefix={<PhoneOutlined />} placeholder="输入电话号码" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input prefix={<MailOutlined />} placeholder="输入邮箱地址" />
          </Form.Item>
          <Form.Item name="id_number" label="身份证号">
            <Input placeholder="输入身份证号" />
          </Form.Item>
          <Form.Item name="employee_no" label="工号">
            <Input placeholder="输入工号" />
          </Form.Item>
          <Form.Item name="department" label="科室">
            <Input placeholder="输入科室" />
          </Form.Item>
          <Form.Item name="title" label="职称">
            <Input placeholder="输入职称" />
          </Form.Item>
          <Form.Item name="work_status" label="在岗状态">
            <Select
              options={
                user?.role === "admin"
                  ? [{ value: "在职", label: "在职" }, { value: "休息", label: "休息" }, { value: "离岗", label: "离岗" }]
                  : [{ value: "在职", label: "在职" }, { value: "休息", label: "休息" }]
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ======== API Key 管理组件（模型管理 · 参考截图风格） ========

const providerMeta: Record<string, { icon: string; color: string; desc: string; url: string }> = {
  openai:    { icon: "🤖", color: "#1677ff", desc: "GPT-4o 综合诊断分析", url: "https://api.openai.com/v1" },
  deepseek:  { icon: "🔍", color: "#4d6bfe", desc: "中文医疗理解，高性价比", url: "https://api.deepseek.com/v1" },
  qwen:      { icon: "☁️", color: "#615ced", desc: "通义千问，阿里云生态", url: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  anthropic: { icon: "🧠", color: "#d97757", desc: "Claude，长篇病历分析", url: "https://api.anthropic.com/v1" },
};

// 预设供应商（选择后填入下方字段；provider 需映射到后端支持的 4 家之一）
const presets: { provider: string; name: string; icon: string }[] = [
  { provider: "openai", name: "OpenAI", icon: "🤖" },
  { provider: "anthropic", name: "Claude", icon: "🧠" },
  { provider: "deepseek", name: "DeepSeek", icon: "🔍" },
  { provider: "qwen", name: "通义千问", icon: "☁️" },
  { provider: "openai", name: "Kimi", icon: "🌙" },
  { provider: "openai", name: "Kimi For Coding", icon: "🌙" },
  { provider: "openai", name: "PackyCode", icon: "🧩" },
  { provider: "openai", name: "ZetaAPI", icon: "⚡" },
  { provider: "openai", name: "API2D", icon: "🅰️" },
  { provider: "anthropic", name: "Claude Desktop", icon: "🧠" },
  { provider: "openai", name: "Gemini", icon: "✨" },
  { provider: "deepseek", name: "DeepSeek Coder", icon: "🅳" },
  { provider: "openai", name: "Codex", icon: "🄲" },
  { provider: "openai", name: "Grok", icon: "🄶" },
  { provider: "openai", name: "OpenCode", icon: "🅾" },
  { provider: "openai", name: "Pi", icon: "🄿" },
  { provider: "openai", name: "AiCodeMirror", icon: "🄰" },
  { provider: "openai", name: "FennoAI", icon: "🄵" },
];

function ApiKeyManager() {
  const [keys, setKeys] = useState<any[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // 添加弹窗
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [activePreset, setActivePreset] = useState("openai");
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
    } catch {
      // 忽略
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleSaveKey = async (provider: string) => {
    if (!inputKey.trim()) {
      message.warning("请输入API Key");
      return;
    }
    setSaving(true);
    try {
      await api.post("/ai-keys", { provider, api_key: inputKey.trim() });
      message.success("API Key 已保存");
      setExpandedProvider(null);
      setInputKey("");
      fetchKeys();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    try {
      await api.delete(`/ai-keys/${provider}`);
      message.success("API Key 已删除");
      fetchKeys();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "删除失败");
    }
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

  // 添加弹窗：选择预设
  const pickPreset = (preset: any) => {
    setActivePreset(preset.provider);
    addForm.setFieldsValue({
      provider: preset.provider,
      name: preset.name,
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
      if (err?.errorFields) return; // 表单校验失败
      message.error(err.response?.data?.detail || "添加失败");
    }
  };

  return (
    <div>
      {/* 标题 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1f1f1f" }}>
            <KeyOutlined style={{ marginRight: 8, color: "#1677ff" }} />模型管理
          </h3>
          <Text type="secondary" style={{ fontSize: 13 }}>
            管理各 AI 工具的供应商；切换、新增、编辑、复制、测速与故障转移
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          新增供应商
        </Button>
      </div>

      <Spin spinning={keysLoading}>
        {/* 供应商 Tab 行 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
          {keys.map((k) => {
            const meta = providerMeta[k.provider] || { icon: "🔑", color: "#8c8c8c", desc: "", url: "" };
            return (
              <Tag
                key={k.provider}
                style={{
                  borderRadius: 8, padding: "4px 12px", cursor: "pointer",
                  background: selected === k.provider ? "#e6f4ff" : "#fff",
                  border: `1px solid ${selected === k.provider ? "#1677ff" : "#e8e8e8"}`,
                  color: selected === k.provider ? "#1677ff" : "#595959",
                }}
                onClick={() => setSelected(k.provider)}
              >
                <span style={{ marginRight: 6 }}>{meta.icon}</span>
                {k.label}
              </Tag>
            );
          })}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <Badge status="success" />
            <Text style={{ fontSize: 12, color: "#52c41a" }}>已连接</Text>
            <CloudOutlined style={{ color: "#52c41a" }} />
          </div>
        </div>

        {/* 供应商卡片 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {keys.map((k) => {
            const meta = providerMeta[k.provider] || { icon: "🔑", color: "#8c8c8c", desc: "", url: "" };
            const isSelected = selected === k.provider;
            const isExpanded = expandedProvider === k.provider;
            return (
              <div
                key={k.provider}
                onClick={() => setSelected(k.provider)}
                style={{
                  border: `1px solid ${isSelected ? "#1677ff" : "#f0f0f0"}`,
                  borderRadius: 12,
                  padding: "14px 18px",
                  background: isSelected ? "#f0f7ff" : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.2s",
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, color: "#1677ff", fontSize: 13 }}>
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
                    <span className={`status-badge ${k.configured ? "success" : "error"}`}>
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
                  <div style={{ marginTop: 12, padding: "12px 16px", background: "#fff", borderRadius: 8, border: "1px dashed #e6f4ff" }}>
                    <Space.Compact style={{ width: "100%" }}>
                      <Input.Password
                        placeholder={k.placeholder || "sk-..."}
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        onPressEnter={() => handleSaveKey(k.provider)}
                        style={{ flex: 1 }}
                      />
                      <Button type="primary" loading={saving} icon={<SaveOutlined />} onClick={() => handleSaveKey(k.provider)}>
                        保存
                      </Button>
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

      {/* 添加供应商弹窗 */}
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
              size="small"
              prefix={<SearchOutlined />}
              placeholder="搜索供应商"
              allowClear
              style={{ width: 200 }}
              value={presetSearch}
              onChange={(e) => setPresetSearch(e.target.value)}
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
                  background: activePreset === p.provider && addForm.getFieldValue("name") === p.name ? "#e6f4ff" : "#fff",
                  border: `1px solid ${addForm.getFieldValue("name") === p.name ? "#1677ff" : "#e8e8e8"}`,
                }}
                onClick={() => pickPreset(p)}
              >
                <span style={{ marginRight: 4 }}>{p.icon}</span>{p.name}
              </Tag>
            ))}
          </div>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 16 }}>
            选择预设后，请在下填写 API Key 等字段
          </Text>

          <Form.Item label="供应商名称" name="name" rules={[{ required: true, message: "请输入供应商名称" }]}>
            <Input placeholder="例如：Claude 官方" />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input placeholder="例如：公司专用账号" />
          </Form.Item>
          <Form.Item label="官网链接" name="url">
            <Input placeholder="https://example.com（可选）" />
          </Form.Item>
          <Form.Item label="API Key" name="api_key" rules={[{ required: true, message: "请输入 API Key" }]}>
            <Input.Password placeholder="只需要填这里，下方配置会自动填充" />
          </Form.Item>
          <Form.Item label="请求地址" name="request_url">
            <Input placeholder="https://your-api-endpoint.com" />
          </Form.Item>
          <Form.Item label="接入方式" name="access">
            <Select
              options={[
                { value: "direct", label: "直连" },
                { value: "proxy", label: "代理" },
              ]}
              style={{ width: 180 }}
            />
          </Form.Item>
          <Form.Item name="provider" hidden><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
