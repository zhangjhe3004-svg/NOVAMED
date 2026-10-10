import { useEffect, useState } from "react";
import { Card, Table, Button, Space, Modal, Form, Input, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useParams } from "react-router-dom";
import { listRows, insertRow, updateRow, deleteRow, listCollections, type DynCollection } from "../../api/dyn";

export default function DynPage() {
  const { collection } = useParams();
  const [cols, setCols] = useState<DynCollection[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const loadMeta = async () => {
    const r = await listCollections(); setCols(r.items);
  };
  const loadRows = async () => {
    setLoading(true);
    try { const r = await listRows(collection!, { page, page_size: 20 }); setRows(r.items); setTotal(r.total); }
    catch (e: any) { message.error(e?.response?.data?.detail || "加载失败"); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { if (collection) loadRows(); }, [collection, page]);

  const meta = cols.find((c) => c.name === collection);
  const columns = (meta?.fields || []).map((f) => ({ title: f.name, dataIndex: f.name }));

  const openEdit = (row?: any) => {
    setEditing(row || {});
    form.resetFields();
  };
  const save = async (v: any) => {
    try {
      if (editing?.id) await updateRow(collection!, editing.id, v);
      else await insertRow(collection!, v);
      message.success("已保存"); setEditing(null); loadRows();
    } catch (e: any) { message.error(e?.response?.data?.detail || "保存失败"); }
  };

  return (
    <Card title={meta?.title || collection} loading={loading}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>新增记录</Button>}>
      <Table rowKey="id" dataSource={rows} columns={columns} scroll={{ x: true }}
        pagination={{ total, current: page, pageSize: 20, onChange: setPage }} />
      <Modal open={!!editing} title={editing?.id ? "编辑记录" : "新增记录"} onCancel={() => setEditing(null)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" initialValues={editing} onFinish={save}>
          {(meta?.fields || []).filter((f) => !f.primary).map((f) => (
            <Form.Item key={f.name} name={f.name} label={f.name}><Input /></Form.Item>
          ))}
        </Form>
      </Modal>
    </Card>
  );
}
