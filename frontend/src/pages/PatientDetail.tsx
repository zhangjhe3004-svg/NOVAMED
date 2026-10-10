import { useEffect, useState } from "react";
import { Card, Descriptions, Form, Input, Select, Button, message, Table, Tag, Spin } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { getPatient, createPatient, updatePatient, type PatientInfo } from "../api/patients";

function PatientForm({ initial, onSave, title }: { initial?: PatientInfo; onSave: (v: any) => Promise<void>; title: string }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  return (
    <Card title={title} style={{ maxWidth: 720, margin: "0 auto" }}>
      <Form form={form} layout="vertical" initialValues={initial}
        onFinish={async (v) => { setSaving(true); try { await onSave(v); } finally { setSaving(false); } }}>
        <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="gender" label="性别" initialValue="其他"><Select options={[{ value: "男" }, { value: "女" }, { value: "其他" }]} /></Form.Item>
        <Form.Item name="phone" label="手机号"><Input /></Form.Item>
        <Form.Item name="id_card" label="身份证号"><Input /></Form.Item>
        <Form.Item name="birth_date" label="出生日期"><Input /></Form.Item>
        <Form.Item name="address" label="地址"><Input /></Form.Item>
        <Form.Item name="medical_history" label="病史"><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>保存</Button>
      </Form>
    </Card>
  );
}

export function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPatient(Number(id)).then((r) => { setPatient(r.patient); setRecords(r.records); })
      .catch((e) => message.error(e?.response?.data?.detail || "加载失败")).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin />;
  if (!patient) return <Card>患者不存在</Card>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="患者详情" extra={<Button onClick={() => navigate(`/patients/${id}/edit`)}>编辑</Button>}>
        <Descriptions column={2}>
          <Descriptions.Item label="姓名">{patient.name}</Descriptions.Item>
          <Descriptions.Item label="性别"><Tag>{patient.gender}</Tag></Descriptions.Item>
          <Descriptions.Item label="手机号">{patient.phone || "-"}</Descriptions.Item>
          <Descriptions.Item label="身份证号">{patient.id_card || "-"}</Descriptions.Item>
          <Descriptions.Item label="出生日期">{patient.birth_date || "-"}</Descriptions.Item>
          <Descriptions.Item label="地址">{patient.address || "-"}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="就诊记录">
        <Table rowKey="id" dataSource={records} pagination={false} columns={[
          { title: "症状", dataIndex: "symptoms" }, { title: "诊断", dataIndex: "diagnosis" },
          { title: "处方", dataIndex: "prescription" }, { title: "时间", dataIndex: "created_at" },
        ]} />
      </Card>
    </div>
  );
}

export function PatientCreatePage() {
  const navigate = useNavigate();
  return <PatientForm title="新增患者" onSave={async (v) => { await createPatient(v); message.success("已创建"); navigate("/patients"); }} />;
}

export function PatientEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<PatientInfo>();
  useEffect(() => { getPatient(Number(id)).then((r) => setInitial(r.patient)).catch(() => {}); }, [id]);
  if (!initial) return <Spin />;
  return <PatientForm title="编辑患者" initial={initial} onSave={async (v) => { await updatePatient(Number(id), v); message.success("已保存"); navigate(`/patients/${id}`); }} />;
}
