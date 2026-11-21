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
  PlusOutlined, SearchOutlined, DeleteOutlined,
  ReloadOutlined, RollbackOutlined, CreditCardOutlined, CheckCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listBillings, getBillingStats, createBilling, refundBilling, deleteBilling,
  confirmBillingMethod, confirmBillingPaid,
  type BillingRecord, type BillingStats, type BillingItemInput,
} from "../api/pharmacy";
import { listPatients } from "../api/patients";
import PermissionButton from "../components/PermissionButton";

const { Text } = Typography;

const PAY_METHODS = ["现金", "微信支付", "支付宝", "银行卡", "医保结算"];

const STATUS_TAG: Record<string, string> = {
  "待收费": "lv-tag--amber",
  "待到账": "lv-tag--info",
  "已收费": "lv-tag--leaf",
  "已退费": "lv-tag--gray",
};

function billStatusTag(v?: string) {
  const s = v || "待收费";
  return (
    <span className={`lv-tag ${STATUS_TAG[s] || "lv-tag--neutral"}`}>
      <span className="lv-tag-dot" />
      {s}
    </span>
  );
}

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

  // 确认收费方式弹窗
  const [methodTarget, setMethodTarget] = useState<BillingRecord | null>(null);
  const [methodValue, setMethodValue] = useState<string>("");
  const [methodSaving, setMethodSaving] = useState(false);

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
    form.setFieldsValue({ items: [{ name: "", quantity: 1, price: 0 }] });
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
        remark: v.remark,
      });
      message.success("收费单已开具，待确认收费方式");
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

  const openMethod = (r: BillingRecord) => { setMethodTarget(r); setMethodValue(""); };

  const submitMethod = async () => {
    if (!methodTarget) return;
    if (!methodValue) { message.warning("请选择支付方式"); return; }
    setMethodSaving(true);
    try {
      await confirmBillingMethod(methodTarget.id, methodValue);
      message.success("已确认收费方式，等待到账确认");
      setMethodTarget(null);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "确认失败");
    } finally { setMethodSaving(false); }
  };

  const doConfirmPaid = async (id: number) => {
    try { await confirmBillingPaid(id); message.success("已确认到账，收费完成"); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "确认失败"); }
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
      render: (v: number) => <span className="tnum" style={{ color: "#3b82f6", fontWeight: 600 }}>¥{v.toFixed(2)}</span> },
    { title: "支付方式", dataIndex: "payment_method", width: 110, render: (v: string) => v || <span style={{ color: "var(--lv-faint)" }}>未确认</span> },
    { title: "状态", width: 96, render: (_: any, r: BillingRecord) => billStatusTag(r.status) },
    { title: "收费员", dataIndex: "operator", width: 100 },
    { title: "时间", width: 110, render: (_: any, r: BillingRecord) =>
      r.created_at ? <span className="tnum">{dayjs(r.created_at).format("MM-DD HH:mm")}</span> : "-" },
    {
      title: "操作", width: 150, fixed: "right" as const, className: "col-actions",
      render: (_: any, r: BillingRecord) => (
        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
          {r.status === "待收费" && (
            <PermissionButton code="medicode:billing:edit">
              <Tooltip title="确认收费方式">
                <button className="icon-btn" data-act="confirm-method" onClick={() => openMethod(r)}><CreditCardOutlined /></button>
              </Tooltip>
            </PermissionButton>
          )}
          {r.status === "待到账" && (
            <PermissionButton code="medicode:billing:edit">
              <Popconfirm title="确认该笔收费已到账？" okText="确认到账" onConfirm={() => doConfirmPaid(r.id)}>
                <Tooltip title="确认到账">
                  <button className="icon-btn" data-act="confirm-paid" style={{ color: "#34d399" }}><CheckCircleOutlined /></button>
                </Tooltip>
              </Popconfirm>
            </PermissionButton>
          )}
          {r.status === "已收费" && (
            <PermissionButton code="medicode:billing:edit">
              <Popconfirm title="确认退费？" onConfirm={() => doRefund(r.id)}>
                <Tooltip title="退费"><button className="icon-btn" data-act="refund"><RollbackOutlined /></button></Tooltip>
              </Popconfirm>
            </PermissionButton>
          )}
          <PermissionButton code="medicode:billing:remove">
            <Popconfirm title="确认删除？" onConfirm={() => doDelete(r.id)}>
              <Tooltip title="删除"><button className="icon-btn is-danger" data-act="delete"><DeleteOutlined /></button></Tooltip>
            </Popconfirm>
          </PermissionButton>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>财务收费</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>收费开单、退费与收费汇总统计。</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="lv-btn" type="button" onClick={load}><ReloadOutlined /> 刷新</button>
          <PermissionButton code="medicode:billing:add">
            <button className="lv-btn lv-btn--primary" type="button" data-act="create" onClick={openCreate}><PlusOutlined /> 开单收费</button>
          </PermissionButton>
        </div>
      </div>

      {/* 统计条 */}
      <div className="lv-metrics" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="lv-metric">
          <span className="lv-metric-label">收费单数</span>
          <span className="lv-metric-figure tnum">{stats?.total_count ?? 0}</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>已收费 {stats?.paid_count ?? 0} 笔 · 待处理 {stats?.pending_count ?? 0} 笔</span>
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
          options={["待收费", "待到账", "已收费", "已退费"].map((s) => ({ value: s, label: s }))}
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
          <Button key="ok" type="primary" loading={saving} className="lv-submit" onClick={() => form.submit()}>开单</Button>,
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

      <Modal
        title={methodTarget ? `确认收费方式 · ${methodTarget.bill_no}` : "确认收费方式"}
        open={!!methodTarget}
        onCancel={() => setMethodTarget(null)}
        footer={[
          <Button key="cancel" onClick={() => setMethodTarget(null)}>取消</Button>,
          <Button key="ok" type="primary" loading={methodSaving} className="lv-submit" onClick={submitMethod}>确认</Button>,
        ]}
        width={440}
        destroyOnHidden
      >
        {methodTarget && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: "var(--lv-muted)" }}>
              患者：{methodTarget.patient_name || "自费"} · 金额 <b className="tnum" style={{ color: "#3b82f6" }}>¥{methodTarget.total_yuan.toFixed(2)}</b>
            </div>
            <Form layout="vertical" className="lv-form">
              <Form.Item label="支付方式" required>
                <Select
                  placeholder="选择支付方式"
                  value={methodValue || undefined}
                  onChange={setMethodValue}
                  options={PAY_METHODS.map((m) => ({ value: m, label: m }))}
                />
              </Form.Item>
            </Form>
            <div style={{ fontSize: 12, color: "var(--lv-faint)" }}>
              确认后该单进入「待到账」状态，仍需再次确认到账才会记为已收费。
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
