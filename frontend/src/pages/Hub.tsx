/**
 * 专家 · 技能 · 连接器 —— 系统能力中心（WorkBuddy 市场风格）
 *
 * - 专家 = 系统功能插件（真实启停 API）
 * - 技能 = 内置能力 + 可下载技能市场（精选/换一批/分类筛选/搜索/下载安装）
 * - 连接器 = 外部集成市场（同样式卡片，点 + 下载）
 * 卡片：彩色图标块 + 名称 + 描述 + 下载量/安装量统计 + 右上角「+」下载按钮
 * 已安装状态持久化 localStorage（key: hub_installed）
 */
import { useEffect, useMemo, useState } from "react";
import { Tabs, Card, Tag, Button, Switch, Typography, message, Empty, Input, Badge } from "antd";
import {
  RobotOutlined, ThunderboltOutlined, ApiOutlined, CheckCircleOutlined,
  StopOutlined, ReloadOutlined, SearchOutlined, PlusOutlined, DownloadOutlined,
  ArrowUpOutlined, CheckOutlined,
} from "@ant-design/icons";
import { getPlugins, enablePlugin, disablePlugin, type PluginInfo } from "../api/plugins";
import ProviderIcon from "../components/ProviderIcon";

const { Text } = Typography;

// ---------- 数据 ----------

interface MarketItem {
  name: string; desc: string; icon: string; color: string;
  downloads: number; installs: number; category: string;
  /** 有矢量品牌 logo 的项走 ProviderIcon（@lobehub/icons），否则回退 emoji */
  provider?: string;
}

const CATEGORIES = ["全部", "办公协同", "开发工具", "效率工具", "信息资讯", "数据分析", "知识学习"];

// 技能市场（前 8 项为系统真实内置能力，其余为可下载技能）
const SKILLS: MarketItem[] = [
  { name: "AI 辅助诊断", desc: "症状分析 · 相似病例 · 知识库检索 · 防幻觉验证", icon: "🩺", color: "#722ed1", downloads: 365000, installs: 69700, category: "数据分析" },
  { name: "语音转文字", desc: "症状/诊断/处方/备注等大段文本语音输入", icon: "🎤", color: "#1677ff", downloads: 289000, installs: 51200, category: "效率工具" },
  { name: "号源排班同步", desc: "员工排班一键同步号源，预约实时扣号", icon: "📅", color: "#138d85", downloads: 120400, installs: 22800, category: "办公协同" },
  { name: "责任链下级审阅", desc: "上级分配下级 · 脱敏记录审阅 · 站内通知", icon: "🧭", color: "#3b82f6", downloads: 98600, installs: 18400, category: "办公协同" },
  { name: "低代码引擎", desc: "动态集合 · 页面 Schema 构建器 · 数据权限规则", icon: "🧩", color: "#eb2f96", downloads: 88200, installs: 15600, category: "开发工具" },
  { name: "消息中心", desc: "微信式撤回/引用/删除 · 会话未读管理", icon: "💬", color: "#13c2c2", downloads: 210600, installs: 40300, category: "办公协同" },
  { name: "表格导出", desc: "就诊记录/排班/接诊数据一键导出 xlsx", icon: "📊", color: "#2f54eb", downloads: 176300, installs: 33100, category: "效率工具" },
  { name: "定时提醒", desc: "定时任务到点自动发送站内通知", icon: "⏰", color: "#52c41a", downloads: 143700, installs: 26900, category: "效率工具" },
  { name: "检查检验流转", desc: "开单→采样→检查中→出报告全状态机管理", icon: "🔬", color: "#fa8c16", downloads: 76400, installs: 13200, category: "办公协同" },
  { name: "药房库存管理", desc: "药品档案 · 出入库 · 低库存预警", icon: "💊", color: "#f5222d", downloads: 65800, installs: 11100, category: "办公协同" },
  { name: "财务收费台", desc: "开单收费 · 多支付方式 · 一键退费", icon: "💰", color: "#faad14", downloads: 59900, installs: 9800, category: "办公协同" },
  { name: "运营数据看板", desc: "患者/记录/收费/检验多指标趋势分析", icon: "📈", color: "#2f54eb", downloads: 47300, installs: 7600, category: "数据分析" },
  { name: "知识库检索", desc: "医院知识文档全文检索与引用", icon: "📚", color: "#08979c", downloads: 92100, installs: 17600, category: "知识学习" },
  { name: "患者档案管理", desc: "完整档案 · 病史 · 就诊记录联动", icon: "🗂️", color: "#5b8c00", downloads: 198400, installs: 38900, category: "办公协同" },
  { name: "3D 协同拓扑", desc: "责任链 3D 全息可视化 · 旋转缩放定位", icon: "🌐", color: "#00a3ff", downloads: 31200, installs: 4900, category: "开发工具" },
  { name: "审计日志", desc: "操作留痕 · 安全审计追踪", icon: "🛡️", color: "#823189", downloads: 44600, installs: 7100, category: "开发工具" },
];

// 连接器市场
const CONNECTORS: MarketItem[] = [
  { name: "OpenAI", desc: "GPT 系列模型接入，用于辅助诊断", icon: "🤖", color: "#10a37f", downloads: 88400, installs: 52300, category: "开发工具", provider: "openai" },
  { name: "DeepSeek", desc: "DeepSeek 对话模型接入", icon: "🐋", color: "#4d6bfe", downloads: 96700, installs: 61100, category: "开发工具", provider: "deepseek" },
  { name: "通义千问", desc: "阿里千问模型接入", icon: "☁️", color: "#615ced", downloads: 74100, installs: 44800, category: "开发工具", provider: "qwen" },
  { name: "Claude", desc: "Anthropic Claude 模型接入", icon: "🧠", color: "#d97757", downloads: 62800, installs: 35900, category: "开发工具", provider: "claude" },
  { name: "QQ 邮箱", desc: "收发、搜索和整理 QQ 邮件", icon: "📧", color: "#12b7f5", downloads: 45200, installs: 18400, category: "办公协同" },
  { name: "腾讯文档", desc: "创建、编辑和协作腾讯文档", icon: "📄", color: "#2b7fff", downloads: 102300, installs: 58700, category: "办公协同" },
  { name: "腾讯会议", desc: "通过命令行创建、查询和管理会议", icon: "🎥", color: "#2b6fff", downloads: 67400, installs: 29800, category: "办公协同" },
  { name: "企业微信", desc: "企业微信官方 CLI 套件，覆盖消息与组织", icon: "💼", color: "#0082ef", downloads: 78900, installs: 36200, category: "办公协同" },
  { name: "飞书", desc: "通过命令行管理飞书/Lark 全部能力", icon: "🕊️", color: "#3370ff", downloads: 59600, installs: 24700, category: "办公协同" },
  { name: "钉钉", desc: "通过命令行管理钉钉全产品能力", icon: "🔵", color: "#1296db", downloads: 54100, installs: 21300, category: "办公协同" },
  { name: "GitHub", desc: "在 GitHub 上克隆、推送代码", icon: "🐙", color: "#24292f", downloads: 83700, installs: 47600, category: "开发工具", provider: "github" },
  { name: "Notion", desc: "创建、搜索和管理 Notion 工作区", icon: "📓", color: "#111111", downloads: 48800, installs: 22500, category: "知识学习" },
  { name: "百度网盘", desc: "连接百度网盘，支持文件与分享管理", icon: "☁️", color: "#06a7ff", downloads: 39400, installs: 14800, category: "效率工具" },
  { name: "微云", desc: "查看、下载、删除微云文件", icon: "🌐", color: "#12b7a5", downloads: 28700, installs: 9600, category: "效率工具" },
  { name: "金山文档", desc: "金山文档官方能力，对话即协作", icon: "📋", color: "#2f6bff", downloads: 35600, installs: 12700, category: "办公协同" },
  { name: "企查查", desc: "查询和核实企业工商登记信息", icon: "🔍", color: "#e34d59", downloads: 26900, installs: 8400, category: "信息资讯" },
];

// ---------- 工具 ----------

function fmtCount(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(2) + "w";
  return String(n);
}

const INSTALLED_KEY = "hub_installed";

function loadInstalled(): string[] {
  try { return JSON.parse(localStorage.getItem(INSTALLED_KEY) || "[]"); } catch { return []; }
}

// ---------- 市场卡片 ----------

function MarketCard({ item, installed, onToggle }: {
  item: MarketItem; installed: boolean; onToggle: (name: string, next: boolean) => void;
}) {
  return (
    <div
      style={{
        position: "relative", background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(21,58,124,0.11)", borderRadius: 14,
        padding: "16px 16px 12px", cursor: "default", transition: "box-shadow .2s, transform .2s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(59, 130, 246, 0.18)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* 右上角 + 下载按钮 */}
      <Button
        type="text" size="small"
        icon={installed ? <CheckOutlined style={{ color: "#52c41a" }} /> : <PlusOutlined />}
        onClick={() => onToggle(item.name, !installed)}
        title={installed ? "已安装（点击卸载）" : "点击下载安装"}
        style={{
          position: "absolute", top: 12, right: 12, width: 26, height: 26,
          borderRadius: 8, border: "1px solid rgba(21,58,124,0.12)", display: "grid", placeItems: "center",
          background: installed ? "rgba(126,200,80,0.16)" : "rgba(59, 130, 246, 0.06)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 30 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: item.color + "1a", color: item.color,
          display: "grid", placeItems: "center",
        }}>
          {item.provider ? <ProviderIcon provider={item.provider} size={22} /> : item.icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#eaf1fb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.name}
          </div>
          <div style={{ fontSize: 11, color: "rgba(232,232,244,0.78)", marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
            {item.desc}
          </div>
        </div>
      </div>
      {/* 统计行：下载量 / 安装量 */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: "rgba(232,232,244,0.7)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <DownloadOutlined /> {fmtCount(item.downloads)}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <CheckCircleOutlined /> {fmtCount(item.installs)}
        </span>
        <span style={{ marginLeft: "auto", color: "rgba(232,232,244,0.55)" }}>{item.category}</span>
      </div>
    </div>
  );
}

export default function Hub() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [searchKw, setSearchKw] = useState("");
  const [category, setCategory] = useState("全部");
  const [installed, setInstalled] = useState<string[]>(loadInstalled());
  const [featuredSeed, setFeaturedSeed] = useState(0);
  const [activeTab, setActiveTab] = useState("experts");

  const load = async () => {
    setLoading(true);
    try {
      const r = await getPlugins();
      setPlugins(r.plugins);
      setIsAdmin(true);
    } catch {
      setIsAdmin(false); // 非管理员 403：插件列表仅管理员可见
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (p: PluginInfo, checked: boolean) => {
    try {
      if (checked) await enablePlugin(p.name); else await disablePlugin(p.name);
      message.success(`${p.display_name} 已${checked ? "启用" : "停用"}（重启后完全生效）`);
      load();
    } catch {
      message.error("操作失败");
    }
  };

  // 下载安装 / 卸载（技能与连接器）
  const toggleInstall = (name: string, next: boolean) => {
    setInstalled((prev) => {
      const nextList = next ? [...new Set([...prev, name])] : prev.filter((n) => n !== name);
      localStorage.setItem(INSTALLED_KEY, JSON.stringify(nextList));
      return nextList;
    });
    message.success(next ? `已下载并安装「${name}」` : `已卸载「${name}」`);
  };

  const kw = searchKw.trim().toLowerCase();
  const matchKw = (i: MarketItem) =>
    !kw || i.name.toLowerCase().includes(kw) || i.desc.toLowerCase().includes(kw);

  // 精选技能（换一批）
  const featured = useMemo(() => {
    const pool = SKILLS.filter(() => !kw);
    const start = (featuredSeed * 4) % Math.max(pool.length, 1);
    return [...pool.slice(start), ...pool.slice(0, start)].slice(0, 4);
  }, [featuredSeed, kw]);

  const filteredSkills = SKILLS.filter((s) => matchKw(s) && (category === "全部" || s.category === category));
  const filteredConnectors = CONNECTORS.filter((c) => matchKw(c));
  const installedCount = installed.length;

  // 顶部工具栏（搜索 + 已安装 + 添加）
  const toolbar = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
      <Input
        prefix={<SearchOutlined style={{ color: "rgba(232,232,244,0.7)" }} />}
        placeholder={activeTab === "connectors" ? "搜索连接器" : "搜索技能"}
        allowClear
        value={searchKw}
        onChange={(e) => setSearchKw(e.target.value)}
        style={{ width: 200, borderRadius: 10 }}
        size="small"
      />
      <Badge count={installedCount} size="small" offset={[-2, 2]}>
        <Button size="small" icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
          onClick={() => message.info(`已安装 ${installedCount} 项：${installed.join("、") || "无"}`)}>
          已安装
        </Button>
      </Badge>
      <Button type="primary" size="small" icon={<PlusOutlined />}
        onClick={() => { setActiveTab("skills"); message.info("在下方技能列表中点击卡片右上角 + 下载安装"); }}>
        添加技能
      </Button>
    </div>
  );

  // 分类 chips（技能页）
  const categoryChips = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0 16px" }}>
      {CATEGORIES.map((c) => (
        <span
          key={c}
          onClick={() => setCategory(c)}
          style={{
            fontSize: 12, padding: "4px 14px", borderRadius: 999, cursor: "pointer",
            background: category === c ? "#3b82f6" : "rgba(59, 130, 246, 0.06)",
            color: category === c ? "#eef3fb" : "rgba(232,232,244,0.78)",
            border: `1px solid ${category === c ? "#3b82f6" : "rgba(21,58,124,0.11)"}`,
            transition: "all .15s",
          }}
        >
          {c}
        </span>
      ))}
    </div>
  );

  const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 };

  const skillsTab = (
    <div>
      {/* 精选技能 */}
      {!kw && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 650, color: "#eaf1fb" }}>精选技能</span>
            <Button type="text" size="small" icon={<ReloadOutlined />}
              onClick={() => setFeaturedSeed((s) => s + 1)}>
              换一批
            </Button>
          </div>
          <div style={gridStyle}>
            {featured.map((s) => (
              <MarketCard key={"f-" + s.name} item={s} installed={installed.includes(s.name)} onToggle={toggleInstall} />
            ))}
          </div>
        </div>
      )}
      {/* 推荐 + 分类筛选 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 650, color: "#eaf1fb" }}>推荐</span>
      </div>
      {categoryChips}
      {filteredSkills.length === 0 ? (
        <Empty description="没有匹配的技能" style={{ padding: "30px 0" }} />
      ) : (
        <div style={gridStyle}>
          {filteredSkills.map((s) => (
            <MarketCard key={s.name} item={s} installed={installed.includes(s.name)} onToggle={toggleInstall} />
          ))}
        </div>
      )}
    </div>
  );

  const connectorsTab = (
    <div>
      <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 14 }}>
        点击卡片右上角 <PlusOutlined /> 下载连接器；AI 服务商密钥可在「个人设置 → API 密钥」中配置
      </Text>
      {filteredConnectors.length === 0 ? (
        <Empty description="没有匹配的连接器" style={{ padding: "30px 0" }} />
      ) : (
        <div style={gridStyle}>
          {filteredConnectors.map((c) => (
            <MarketCard key={c.name} item={c} installed={installed.includes(c.name)} onToggle={toggleInstall} />
          ))}
        </div>
      )}
    </div>
  );

  const expertTab = (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          系统功能插件（专家）：每个插件对应一个后端能力模块，可在此启停
        </Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>
      {!isAdmin && !loading ? (
        <Empty description="插件管理仅管理员可见" />
      ) : (
        <div style={gridStyle}>
          {plugins.map((p) => (
            <div key={p.name} style={{
              position: "relative", background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(21,58,124,0.11)", borderRadius: 14,
              padding: "16px 16px 12px",
            }}>
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                <Switch checked={p.enabled} onChange={(v) => toggle(p, v)} size="small" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 50 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                  background: p.enabled ? "rgba(66,125,241,0.16)" : "rgba(59, 130, 246, 0.05)", color: p.enabled ? "#5B8DEF" : "rgba(232,232,244,0.7)",
                  display: "grid", placeItems: "center", fontSize: 20,
                }}>
                  <RobotOutlined />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#eaf1fb" }}>
                    {p.display_name} <Text type="secondary" style={{ fontSize: 10, fontWeight: 400 }}>v{p.version}</Text>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(232,232,244,0.78)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.description}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", marginTop: 12 }}>
                <Tag color={p.enabled ? "green" : "default"} icon={p.enabled ? <CheckCircleOutlined /> : <StopOutlined />}
                  style={{ fontSize: 10.5, borderRadius: 999, border: "none", marginInlineEnd: 0 }}>
                  {p.enabled ? "已启用" : "已停用"}
                </Tag>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: "0 0 24px" }}>
      {/* 顶栏：Tabs + 工具栏 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ flex: 1, minWidth: 320 }}
          items={[
            { key: "experts", label: <span style={{ fontSize: 14 }}><RobotOutlined /> 专家</span> },
            { key: "skills", label: <span style={{ fontSize: 14 }}><ThunderboltOutlined /> 技能</span> },
            { key: "connectors", label: <span style={{ fontSize: 14 }}><ApiOutlined /> 连接器</span> },
          ]}
        />
        {toolbar}
      </div>

      <Card style={{ borderRadius: 14 }} styles={{ body: { padding: "8px 18px 18px" } }}>
        {activeTab === "experts" && expertTab}
        {activeTab === "skills" && skillsTab}
        {activeTab === "connectors" && connectorsTab}
      </Card>

      {/* 底部统计 */}
      <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "rgba(232,232,244,0.7)", display: "flex", justifyContent: "center", gap: 16 }}>
        <span><ArrowUpOutlined /> 已下载安装 {installedCount} 项</span>
        <span>技能市场 {SKILLS.length} 项 · 连接器 {CONNECTORS.length} 项 · 专家插件 {plugins.length} 项</span>
      </div>
    </div>
  );
}
