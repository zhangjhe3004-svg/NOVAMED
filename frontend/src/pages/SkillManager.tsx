import { Card, Table, Tag, Empty } from "antd";

const skills = [
  { name: "症状分析", kind: "rule", enabled: true, desc: "基于医学规则的症状匹配" },
  { name: "相似病例检索", kind: "vector", enabled: true, desc: "FAISS 向量相似度搜索" },
  { name: "防幻觉验证", kind: "guard", enabled: true, desc: "证据分级与事实核查" },
];

export default function SkillManager() {
  return (
    <Card title="AI 技能管理">
      {skills.length === 0 ? <Empty /> : (
        <Table rowKey="name" dataSource={skills} pagination={false} columns={[
          { title: "技能", dataIndex: "name" }, { title: "类型", dataIndex: "kind", render: (v) => <Tag>{v}</Tag> },
          { title: "状态", dataIndex: "enabled", render: (v) => <Tag color={v ? "green" : "default"}>{v ? "启用" : "禁用"}</Tag> },
          { title: "说明", dataIndex: "desc" },
        ]} />
      )}
    </Card>
  );
}
