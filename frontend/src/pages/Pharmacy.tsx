/**
 * 药房管理 —— 药品库存 CRUD + 库存预警 + 入库出库
 * 板块统一为案例设计：页头 + 统计条 + 查询面板 + 列表面板（●共N条）+ 图标操作列。
 */
import { useEffect, useState } from "react";
import {
  Table, Button, Input, Select, Tag, Typography, message, Modal, Form, InputNumber,
  Popconfirm, Tooltip,
} from "antd";
import {
  PlusOutlined, SearchOutlined, MedicineBoxOutlined, WarningOutlined,
  EditOutlined, DeleteOutlined, ReloadOutlined, MinusOutlined, PlusCircleOutlined,
} from "@ant-design/icons";
import {
  listMedicines, getPharmacyStats, createMedicine, updateMedicine,
  adjustStock, deleteMedicine, type MedicineItem, type PharmacyStats,
} from "../api/pharmacy";

const { Text } = Typography;

const CATEGORIES = ["处方药", "OTC", "中成药", "中草药", "保健品", "其他"];

export default function Pharmacy() {
  const [data, setData] = useState<MedicineItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<PharmacyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [kwInput, setKwInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [lowOnly, setLowOnly] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MedicineItem | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        listMedicines({ keyword: keyword || undefined, category, low_stock: lowOnly || undefined, page_size: 100 }),
        getPharmacyStats(),
      ]);
      setData(r.items);
      setTotal(r.total);
      setStats(s);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载失败");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [keyword, category, lowOnly]);

  const doSearch = () => { setKeyword(kwInput); };
  const doReset = () => { setKwInput(""); setKeyword(""); setCategory(undefined); setLowOnly(false); };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ unit: "盒", stock_warning: 10, price: 0 });
    setOpen(true);
  };

  const openEdit = (m: MedicineItem) => {
    setEditing(m);
    form.setFieldsValue({
      name: m.name, spec: m.spec, category: m.category, manufacturer: m.manufacturer,
      unit: m.unit, price: m.price, stock: m.stock, stock_warning: m.stock_warning,
      approval_no: m.approval_no,
    });
    setOpen(true);
  };

  const save = async (v: any) => {
    setSaving(true);
    try {
      if (editing) {
        await updateMedicine(editing.id, v);
        message.success("药品已更新");
      } else {
        await createMedicine(v);
        message.success("药品已入库");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "保存失败");
    } finally { setSaving(false); }
  };

  const doDelete = async (id: number) => {
    try { await deleteMedicine(id); message.success("已删除"); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "删除失败"); }
  };

  const doAdjust = async (m: MedicineItem, delta: number) => {
    try {
      await adjustStock(m.id, delta);
      message.success(`「${m.name}」库存已${delta > 0 ? "入库" : "出库"} ${Math.abs(delta)} ${m.unit}`);
      load();
    } catch (e: any) { message.error(e?.response?.data?.detail || "操作失败"); }
  };

  const columns = [
    { title: "药品名称", dataIndex: "name", width: 180, render: (v: string, r: MedicineItem) => (
      <div>
        <div style={{ fontWeight: 600, color: "var(--lv-ink)" }}>{v}</div>
        <div style={{ fontSize: 11, color: "#9aa6b6" }}>{r.spec || "-"}</div>
      </div>
    ) },
    { title: "分类", dataIndex: "category", width: 100, render: (v: string) => v ? <span className="lv-tag lv-tag--neutral">{v}</span> : "-" },
    { title: "厂家", dataIndex: "manufacturer", width: 150, ellipsis: true },
    { title: "单价", dataIndex: "price_yuan", width: 90, align: "right" as const,
      render: (v: number) => <span className="tnum" style={{ color: "#d6a451", fontWeight: 600 }}>¥{v.toFixed(2)}</span> },
    { title: "库存", dataIndex: "stock", width: 90, align: "center" as const,
      render: (v: number, r: MedicineItem) => (
        <span style={{ fontWeight: 600, color: r.low_stock ? "#c4423e" : "var(--lv-ink)" }}>
          {v} <span style={{ fontSize: 11, color: "#9aa6b6" }}>{r.unit}</span>
        </span>
      ) },
    { title: "状态", width: 110, render: (_: any, r: MedicineItem) =>
      r.low_stock
        ? <span className="lv-tag lv-tag--red"><span className="lv-tag-dot" />库存不足</span>
        : <span className="lv-tag lv-tag--leaf"><span className="lv-tag-dot" />正常</span> },
    {
      title: "操作", key: "op", width: 160, fixed: "right" as const, className: "col-actions",
      render: (_: any, r: MedicineItem) => (
        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="入库 +10"><button className="icon-btn" data-act="in" onClick={() => doAdjust(r, 10)}><PlusCircleOutlined /></button></Tooltip>
          <Tooltip title="出库 -1"><button className="icon-btn" data-act="out" onClick={() => doAdjust(r, -1)}><MinusOutlined /></button></Tooltip>
          <Tooltip title="编辑"><button className="icon-btn" data-act="edit" onClick={() => openEdit(r)}><EditOutlined /></button></Tooltip>
          <Popconfirm title="确认删除该药品？" onConfirm={() => doDelete(r.id)}>
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
          <div style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>药房管理</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>药品库存管理、入库出库与库存预警。</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="lv-btn" type="button" onClick={load}><ReloadOutlined /> 刷新</button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="create" onClick={openCreate}><PlusOutlined /> 新增药品</button>
        </div>
      </div>

      {/* 统计条 */}
      <div className="lv-metrics" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="lv-metric">
          <span className="lv-metric-label">药品种类</span>
          <span className="lv-metric-figure tnum">{stats?.total_medicines ?? 0}</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>共 {stats?.categories?.length ?? 0} 个分类</span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">库存预警</span>
          <span className="lv-metric-figure tnum" style={{ color: stats?.low_stock_count ? "#c4423e" : undefined }}>{stats?.low_stock_count ?? 0}</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>需及时补货</span>
        </div>
        <div className="lv-metric">
          <span className="lv-metric-label">库存总值</span>
          <span className="lv-metric-figure tnum" style={{ fontSize: 24 }}>¥{stats?.stock_value_yuan?.toLocaleString() ?? 0}</span>
          <span style={{ fontSize: 11, color: "var(--lv-faint)" }}>按采购价估算</span>
        </div>
      </div>

      {/* 查询面板 */}
      <div className="lv-query">
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
          placeholder="搜索药品名称"
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          onPressEnter={doSearch}
          className="lv-query-input"
        />
        <Select
          allowClear placeholder="分类 · 全部" style={{ width: 140 }} value={category} onChange={setCategory}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <button
          type="button"
          className="lv-btn"
          data-act="low"
          onClick={() => setLowOnly(!lowOnly)}
          style={lowOnly ? { color: "#c4423e", borderColor: "#f3c0bd", background: "#fdf0ef" } : undefined}
        >
          <WarningOutlined /> 仅看预警
        </button>
        <div className="lv-query-actions">
          <button className="lv-btn" type="button" data-act="reset" onClick={doReset}>重置</button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="search" onClick={doSearch}><SearchOutlined /> 查询</button>
        </div>
      </div>

      {/* 列表面板 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">药品库存</span>
          <span className="lv-panel-meta">共 {total} 种药品</span>
          <div className="lv-panel-tools">
            <Tooltip title="刷新"><button className="icon-btn" data-act="refresh" onClick={load}><ReloadOutlined /></button></Tooltip>
          </div>
        </div>
        <Table rowKey="id" size="middle" columns={columns} dataSource={data} loading={loading} pagination={false} scroll={{ x: 1000 }} />
      </div>

      <Modal
        title={editing ? "编辑药品" : "新增药品"}
        open={open}
        onCancel={() => setOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" loading={saving} className="lv-submit" onClick={() => form.submit()}>保存</Button>,
        ]}
        width={560}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={save} className="lv-form">
          <div className="lv-form-grid">
            <Form.Item name="name" label="药品名称" rules={[{ required: true, message: "请输入药品名称" }]}>
              <Input placeholder="如 布洛芬缓释胶囊" />
            </Form.Item>
            <Form.Item name="category" label="分类">
              <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} placeholder="选择分类" />
            </Form.Item>
            <Form.Item name="spec" label="规格">
              <Input placeholder="如 0.3g×24片" />
            </Form.Item>
            <Form.Item name="manufacturer" label="生产厂家">
              <Input placeholder="如 某某制药" />
            </Form.Item>
            <Form.Item name="unit" label="单位">
              <Select options={["盒", "瓶", "袋", "支", "片"].map((u) => ({ value: u, label: u }))} />
            </Form.Item>
            <Form.Item name="approval_no" label="批准文号">
              <Input placeholder="国药准字 H20000000" />
            </Form.Item>
            <Form.Item name="price" label="单价（分）" rules={[{ required: true, message: "请输入单价" }]}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="如 1500 = ¥15.00" />
            </Form.Item>
            <Form.Item name="stock" label="库存" rules={[{ required: true, message: "请输入库存" }]}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="stock_warning" label="库存预警阈值" extra="低于此值时预警">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
