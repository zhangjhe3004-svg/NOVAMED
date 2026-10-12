/**
 * 财务收费 —— 收费记录 + 开单收费 + 退费 + 统计
 * 板块统一为案例设计：页头 + 统计条 + 查询面板 + 列表面板（●共N笔）+ 图标操作列。
 */
import { useEffect, useState } from "react";
import {
  Table, Button, Input, Select, Typography, message, Modal, Form, InputNumber,
  Space, Popconfirm, Tooltip,
} from "antd";
import {
  PlusOutlined, SearchOutlined, AccountBookOutlined, DeleteOutlined,
  ReloadOutlined, WalletOutlined, RollbackOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listBillings, getBillingStats, createBilling, refundBilling, deleteBilling,
  type BillingRecord, type BillingStats, type BillingItemInput,
} from "../api/pharmacy";
import { listPatients } from "../api/patients";

const { Text } = Typography;

const PAY_METHODS = ["现金", "微信支付", "支付宝", "银行卡", "医保结算"];

export default function Billing() {
  const [data, setData] = useState<BillingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [kwInput, setKwInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string | undefined>();

  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<{ value: number; label: string }[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        listBillings({ keyword: keyword || undefined, status, page_size: 100 }),
        getBillingStats(),
      ]);
      setData(r.items);
      setTotal(r.total);
      setStats(s);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载失败");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [keyword, status]);
  useEffect(() => {
    listPatients({ page: 1, page_size: 100 }).then((r) => {
      setPatients(r.items.map((p: any) => ({ value: p.id, label: p.name })));
    }).catch(() => {});
  }, []);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ payment_method: "现金", items: [{ name: "", quantity: 1, price: 0 }] });
    setOpen(true);
  };

  const save = async (v: any) => {
    setSaving(true);
    try {
      const items: BillingItemInput[] = (v.items || []).filter((i: any) => i.name && i.name.trim());
      if (items.length === 0) {
        message.warning("请至少填写一项收费项目");
        setSaving(false);
        return;
      }
      await createBilling({
        patient_id: v.patient_id,
        patient_name: v.patient_name,
        department: v.department,
        items,
        payment_method: v.payment_method,
        remark: v.remark,
      });
      message.success("收费已开具");
      setOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "开具失败");
    } finally { setSaving(false); }
  };

  const doRefund = async (id: number) => {
    try { await refundBilling(id); message.success("已退费"); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "退费失败"); }
  };

  const doDelete = async (id: number) => {
    try { await deleteBilling(id); message.success("已删除"); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "删除失败"); }
  };

  const columns = [
    { title: "收费单号", dataIndex: "bill_no", width: 180, render: (v: string) => <span className="tnum" style={{ color: "#236de9" }}>{v}</span> },
    { title: "患者", dataIndex: "patient_name", width: 110, render: (v: string) => v || <span style={{ color: "#bbb" }}>自费</span> },
    { title: "科室", dataIndex: "department", width: 100 },
    { title: "项目", width: 200, render: (_: any, r: BillingRecord) => (
      <span style={{ fontSize: 12 }}>
        {r.items.slice(0, 2).map((i) => `${i.name}×${i.quantity}`).join("、")}
        {r.items.length > 2 ? ` 等${r.items.length}项` : ""}
      </span>
    ) },
    { title: "金额", dataIndex: "total_yuan", width: 100, align: "right" as const,
      render: (v: number) => <span className="tnum" style={{ color: "#d6a451", fontWeight: 600 }}>¥{v.toFixed(2)}</span> },
    { title: "支付方式", dataIndex: "payment_method", width: 100 },
    { title: "状态", width: 100, render: (_: any, r: BillingRecord) =>
      r.status === "已收费"
        ? <span className="lv-tag lv-tag--leaf"><span className="lv-tag-dot" />已收费</span>
        : <span className="lv-tag lv-tag--amber"><span className="lv-tag-dot" />已退费</span> },
    { title: "收费员", dataIndex: "operator", width: 100 },
    { title: "时间", width: 110, render: (_: any, r: BillingRecord) =>
      r.created_at ? <span className="tnum">{dayjs(r.created_at).format("MM-DD HH:mm")}</span> : "-" },
    {
      title: "操作", width: 110, fixed: "right" as const, className: "col-actions",
      render: (_: any, r: BillingRecord) => (
        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
          {r.status === "已收费" && (
            <Popconfirm title="确认退费？" onConfirm={() => doRefund(r.id)}>
              <Tooltip title="退费"><button className="icon-btn" data-act="refund"><RollbackOutlined /></button></Tooltip>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => doDelete(r.id)}>
            <Tooltip title="删除"><button className="icon-btn is-danger" data-act="delete"><DeleteOutlined /></button></Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>财务收费</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>收费开单、退费与收费汇总统计。</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="lv-btn" type="button" onClick={load}><ReloadOutlined /> 刷新</button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="create" onClick={openCreate}><PlusOutlined /> 开单收费</button>
        </div>
      </div>

      {/* 统计条 */}
      <div className="lv-metrics" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="lv-metric">
          <span className="lv-metric-label">收费单数</span>
          <span className="lv-metric-figure tnum">{stats?.total_count ?? 0}</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>已收费 {stats?.paid_count ?? 0} 笔</span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">收费总额</span>
          <span className="lv-metric-figure tnum" style={{ fontSize: 24 }}>¥{stats?.total_yuan?.toLocaleString() ?? 0}</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>按已收费统计</span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">退费</span>
          <span className="lv-metric-figure tnum" style={{ color: "#c4423e" }}>{stats?.refund_count ?? 0}</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>退费笔数</span>
        </div>
      </div>

      {/* 查询面板 */}
      <div className="lv-query">
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
          placeholder="搜索单号 / 患者"
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          onPressEnter={() => setKeyword(kwInput)}
          className="lv-query-input"
        />
        <Select
          allowClear placeholder="状态 · 全部" style={{ width: 140 }} value={status} onChange={setStatus}
          options={[{ value: "已收费", label: "已收费" }, { value: "已退费", label: "已退费" }]}
        />
        <div className="lv-query-actions">
          <button className="lv-btn" type="button" data-act="reset" onClick={() => { setKwInput(""); setKeyword(""); setStatus(undefined); }}>重置</button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="search" onClick={() => setKeyword(kwInput)}><SearchOutlined /> 查询</button>
        </div>
      </div>

      {/* 列表面板 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">收费记录</span>
          <span className="lv-panel-meta">共 {total} 笔</span>
          <div className="lv-panel-tools">
            <Tooltip title="刷新"><button className="icon-btn" data-act="refresh" onClick={load}><ReloadOutlined /></button></Tooltip>
          </div>
        </div>
        <Table rowKey="id" size="middle" columns={columns} dataSource={data} loading={loading} pagination={false} scroll={{ x: 1180 }} />
      </div>

      <Modal
        title="开单收费"
        open={open}
        onCancel={() => setOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" loading={saving} className="lv-submit" onClick={() => form.submit()}>保存</Button>,
        ]}
        width={640}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={save} className="lv-form">
          <div className="lv-form-grid">
            <Form.Item name="patient_id" label="患者">
              <Select showSearch allowClear placeholder="选择患者（可空=自费）"
                options={patients} filterOption={(i, o) => (o?.label ?? "").toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            <Form.Item name="patient_name" label="患者姓名（未选患者时填写）">
              <Input placeholder="如 自费患者" />
            </Form.Item>
            <Form.Item name="department" label="科室">
              <Input placeholder="如 内科 / 药房" />
            </Form.Item>
            <Form.Item name="payment_method" label="支付方式">
              <Select options={PAY_METHODS.map((m) => ({ value: m, label: m }))} />
            </Form.Item>
          </div>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text strong>收费项目</Text>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => add({ name: "", quantity: 1, price: 0 })}>添加项目</Button>
                </div>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
                    <Form.Item name={[field.name, "name"]} rules={[{ required: true, message: "项目名" }]} noStyle>
                      <Input placeholder="项目名称（如 挂号费 / 布洛芬）" style={{ width: 220 }} />
                    </Form.Item>
                    <Form.Item name={[field.name, "quantity"]} noStyle>
                      <InputNumber min={1} placeholder="数量" style={{ width: 80 }} />
                    </Form.Item>
                    <Form.Item name={[field.name, "price"]} noStyle>
                      <InputNumber min={0} placeholder="单价(分)" style={{ width: 100 }} />
                    </Form.Item>
                    <Button type="link" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                  </Space>
                ))}
              </div>
            )}
          </Form.List>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注（选填）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
