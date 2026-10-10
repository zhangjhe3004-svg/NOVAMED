/**
 * 员工端专用页面 —— 整合四个开箱场景
 * 
 * 四个场景：
 * ├── 院内公告
 * ├── 排班表
 * ├── 请假审批
 * └── 科室组织
 */
import { useState, useEffect } from "react";
import { Tabs, Card, Button, Space, Typography, Tag, message, Badge } from "antd";
import {
  NotificationOutlined,
  CalendarOutlined,
  AuditOutlined,
  ApartmentOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import DynPage from "./dyn/DynPage";

const { Title } = Typography;

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState("announcement");

  const staffMenus = [
    {
      key: "announcement",
      title: "院内公告",
      icon: <NotificationOutlined />,
      collection: "staff_announcement",
      description: "查看院内通知公告",
    },
    {
      key: "schedule",
      title: "排班表",
      icon: <CalendarOutlined />,
      collection: "staff_schedule",
      description: "查看科室排班信息",
    },
    {
      key: "leave",
      title: "请假审批",
      icon: <AuditOutlined />,
      collection: "staff_leave",
      description: "提交与审批请假申请",
    },
    {
      key: "department",
      title: "科室组织",
      icon: <ApartmentOutlined />,
      collection: "department",
      description: "查看科室组织架构",
    },
  ];

  const currentMenu = staffMenus.find((m) => m.key === activeTab);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>员工办公</Title>
        <Typography.Text type="secondary">
          整合院内公告、排班表、请假审批、科室组织四个开箱场景
        </Typography.Text>
      </div>

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
                <DynPage collection={menu.collection} mode="staff" />
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
}
