import { useEffect, useState } from "react";
import { Card, Table, Descriptions, Drawer, message, Tag } from "antd";
import api from "../api/client";

export default function SuperviseRecords() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  useEffect(() => {
    setLoading(true);
    api.get("/records/senior").then((r) => setItems(r.data.items)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return (
    <Card title="下级诊断记录（患者信息已脱敏）" loading={loading}>
      <Table rowKey="record_id" dataSource={items} columns={[
        { title: "症状", dataIndex: "symptoms" }, { title: "诊断", dataIndex: "diagnosis" },
        { title: "医生", dataIndex: "doctor_name" }, { title: "职称", dataIndex: "doctor_title" },
        { title: "操作", render: (_, r) => <a onClick={() => setDetail(r)}>查看</a> },
      ]} />
      <Drawer open={!!detail} onClose={() => setDetail(null)} title="记录详情" width={480}>
        {detail && <Descriptions column={1}>
          <Descriptions.Item label="患者姓名">{detail.patient?.name}</Descriptions.Item>
          <Descriptions.Item label="身份证号">{detail.patient?.id_card}</Descriptions.Item>
          <Descriptions.Item label="手机号">{detail.patient?.phone}</Descriptions.Item>
          <Descriptions.Item label="症状">{detail.symptoms}</Descriptions.Item>
          <Descriptions.Item label="诊断">{detail.diagnosis}</Descriptions.Item>
          <Descriptions.Item label="处方">{detail.prescription}</Descriptions.Item>
        </Descriptions>}
      </Drawer>
    </Card>
  );
}
