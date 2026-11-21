/**
 * 员工端专用页面 —— 整合四个开箱场景
 * 
 * 四个场景：
 * ├── 院内公告
 * ├── 排班表
 * ├── 请假审批
 * └── 科室组织
 */
import { useState } from "react";
import { Tabs, Card, Button, Space, Typography, Tag, message, Badge } from "antd";
import {
  NotificationOutlined,
  CalendarOutlined,
  AuditOutlined,
  ApartmentOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import DynPage from "./dyn/DynPage";

const { Title } = Typography;

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState("department");
  // 刷新：递增 key 让当前 Tab 的 DynPage 重新挂载，触发其内部重新拉取数据
  const [reloadKey, setReloadKey] = useState(0);

  const handleRefresh = () => {
    setReloadKey((k) => k + 1);
    message.success("已刷新当前数据");
  };

  const staffMenus = [
    {
      key: "department",
      title: "科室组织",
      icon: <ApartmentOutlined />,
      collection: "departments",
      description: "查看科室组织架构",
    },
    {
      key: "announcement",
      title: "院内公告",
      icon: <NotificationOutlined />,
      collection: "staff_announcements",
      description: "查看院内通知公告",
    },
    {
      key: "schedule",
      title: "排班表",
      icon: <CalendarOutlined />,
      collection: "staff_schedules",
      description: "查看科室排班信息",
    },
    {
      key: "leave",
      title: "请假审批",
      icon: <AuditOutlined />,
      collection: "leave_requests",
      description: "提交与审批请假申请",
    },
  ];

  const currentMenu = staffMenus.find((m) => m.key === activeTab);

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>员工办公</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>整合院内公告、排班表、请假审批、科室组织四个开箱场景</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="lv-btn" type="button" onClick={handleRefresh}><ReloadOutlined /> 刷新</button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="lv-metrics" style={{ marginBottom: 16 }}>
        <div className="lv-metric">
          <span className="lv-metric-label">科室数量</span>
          <span className="lv-metric-figure tnum">12</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>临床科室 · 组织架构</span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">院内公告</span>
          <span className="lv-metric-figure tnum">8</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>已发布 · 通知公告</span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">待审批请假</span>
          <span className="lv-metric-figure tnum" style={{ color: "#b9770a" }}>3</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>需今日处理 · 请假审批</span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">排班记录</span>
          <span className="lv-metric-figure tnum">24</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>本周排班 · 科室排班</span>
        </div>
      </div>

      {/* 主内容区 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={staffMenus.map((menu) => ({
            key: menu.key,
            label: (
              <Space>
                {menu.icon}
                <span>{menu.title}</span>
              </Space>
            ),
            children: (
              <div style={{ minHeight: 400 }}>
                <DynPage key={`${menu.key}-${reloadKey}`} collection={menu.collection} mode="staff" />
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
}
