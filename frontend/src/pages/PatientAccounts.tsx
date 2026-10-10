/**
 * 患者注册档案（员工查看）—— 患者端注册后入库，员工可检索查看
 */
import { useEffect, useState } from "react";
import { Card, Input, Table, Tag, Typography } from "antd";
import { getPatientAccounts } from "../api/patientAccount";
import type { PatientAccount } from "../api/patientAccount";

const { Title } = Typography;

export default function PatientAccounts() {
  const [items, setItems] = useState<PatientAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getPatientAccounts({ page, page_size: 20, keyword: keyword || undefined });
      setItems(r.items || []);
      setTotal(r.total || 0);
    } catch { /* 忽略 */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [page, keyword]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>患者注册档案</Title>
        <Input.Search placeholder="搜索姓名/手机号/证件号" style={{ width: 260 }} allowClear onSearch={(v) => { setPage(1); setKeyword(v); }} />
      </div>
      <Card bodyStyle={{ padding: 0 }}>
        <Table rowKey="id" size="small" loading={loading} dataSource={items}
          pagination={{ current: page, total, pageSize: 20, showTotal: (t) => `共 ${t} 条`, onChange: setPage }}
          columns={[
            { title: "姓名", render: (_: any, r: any) => `${r.surname || ""}${r.given_name || ""}` },
            { title: "证件类型", dataIndex: "id_type", width: 200, render: (v: string) => <Tag style={{ borderRadius: 6 }}>{v || "-"}</Tag> },
            { title: "证件号码", dataIndex: "id_number", width: 180 },
            { title: "手机号", dataIndex: "phone", width: 130 },
            { title: "户籍地", dataIndex: "registered_place", width: 150, render: (v: string) => v || "-" },
            { title: "有效期", dataIndex: "valid_until", width: 110, render: (v: string) => v || "-" },
            { title: "状态", dataIndex: "status", width: 90, render: (v: string) => <Tag color="green">{v || "已注册"}</Tag> },
            { title: "注册时间", dataIndex: "created_at", width: 170, render: (d: string) => (d ? new Date(d).toLocaleString("zh-CN") : "-") },
          ]} />
      </Card>
    </div>
  );
}
