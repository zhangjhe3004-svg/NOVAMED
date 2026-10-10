import { useEffect, useState } from "react";
import { Card, Table, Input, Space, Button, Tag, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { listPatients, type PatientInfo } from "../api/patients";

export default function PatientList() {
  const [data, setData] = useState<PatientInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const load = async (kw = keyword, p = page) => {
    setLoading(true);
    try {
      const r = await listPatients({ keyword: kw || undefined, page: p, page_size: 20 });
      setData(r.items); setTotal(r.total);
    } catch (e: any) { message.error(e?.response?.data?.detail || "加载失败"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [page]);

  return (
    <Card title="患者管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/patients/create")}>新增患者</Button>}>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search placeholder="搜索姓名/手机号/身份证" allowClear style={{ width: 320 }}
          onSearch={(v) => { setPage(1); load(v, 1); }} />
      </Space>
      <Table rowKey="id" loading={loading} dataSource={data}
        pagination={{ total, current: page, pageSize: 20, onChange: setPage }}
        onRow={(r) => ({ onClick: () => navigate(`/patients/${r.id}`), style: { cursor: "pointer" } })}
        columns={[
          { title: "姓名", dataIndex: "name" },
          { title: "性别", dataIndex: "gender", render: (v) => <Tag>{v}</Tag> },
          { title: "手机号", dataIndex: "phone" },
          { title: "身份证号", dataIndex: "id_card" },
          { title: "操作", render: (_, r) => <Button size="small" onClick={(e) => { e.stopPropagation(); navigate(`/patients/${r.id}`); }}>详情</Button> },
        ]} />
    </Card>
  );
}
