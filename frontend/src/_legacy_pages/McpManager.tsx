import { Card, Table, Tag } from "antd";

const mcps = [
  { name: "EMR 电子病历", transport: "stdio", status: "connected" },
  { name: "LIS 检验系统", transport: "http", status: "connected" },
  { name: "PACS 影像系统", transport: "http", status: "disconnected" },
];

export default function McpManager() {
  return (
    <Card title="MCP 工具服务">
      <Table rowKey="name" dataSource={mcps} pagination={false} columns={[
        { title: "服务", dataIndex: "name" }, { title: "传输", dataIndex: "transport", render: (v) => <Tag>{v}</Tag> },
        { title: "状态", dataIndex: "status", render: (v) => <Tag color={v === "connected" ? "green" : "red"}>{v === "connected" ? "已连接" : "未连接"}</Tag> },
      ]} />
    </Card>
  );
}
