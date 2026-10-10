import { useEffect, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, InputNumber, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { listSchedules, type DoctorScheduleItem } from "../api/schedule";
import api from "../api/client";

export default function ScheduleManager() {
  const [items, setItems] = useState<DoctorScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const load = async () => {
    setLoading(true);
    try { const r = await listSchedules(); setItems(r.items); } catch (e: any) { message.error(e?.response?.data?.detail || "加载失败"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const save = async (v: any) => {
    await api.post("/schedule", { ...v, remaining: v.total });
    message.success("已保存"); setOpen(false); form.resetFields(); load();
  };
  return (
    <Card title="号源排班管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新增号源</Button>}>
      <Table rowKey="id" loading={loading} dataSource={items} columns={[
        { title: "医生ID", dataIndex: "doctor_id" }, { title: "科室", dataIndex: "department" },
        { title: "日期", dataIndex: "date" }, { title: "时段", dataIndex: "time_slot" },
        { title: "总量", dataIndex: "total" }, { title: "剩余", dataIndex: "remaining" },
      ]} />
      <Modal open={open} title="新增号源" onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="doctor_id" label="医生ID" rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="department" label="科室"><Input /></Form.Item>
          <Form.Item name="date" label="日期"><Input /></Form.Item>
          <Form.Item name="time_slot" label="时段"><Input /></Form.Item>
          <Form.Item name="total" label="号源总量"><InputNumber style={{ width: "100%" }} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
