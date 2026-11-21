/**
 * 字典管理 —— 移植自 scaffold Dict.vue（表格 + 样本册双视图）。
 *
 * 语汇：
 *   表格视图 = 字典类型列表（名称可点开数据抽屉 / 类型编码 chip / 状态 / 备注 / 创建时间 / 操作）
 *   样本册视图 = DictSwatchbook 全部字典类型一屏对照，卡片原地展开编辑色调 / 默认项 / 状态
 *
 * 数据来源：/api/dict-types、/api/dict-data、/api/dict-options（sys_dict_types + sys_dict_data）。
 */
import { useCallback, useEffect, useState } from "react";
import {
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Switch,
  Table,
  Tooltip,
  message,
} from "antd";
import {
  AppstoreOutlined,
  CheckOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import DictSwatchbook from "../components/DictSwatchbook";
import DictTag from "../components/DictTag";
import { downloadBlob } from "../utils/download";
import { errText } from "../utils/apiError";
import {
  listDictTypes,
  createDictType,
  updateDictType,
  removeDictType,
  exportDictTypes,
  listDictData,
  createDictData,
  updateDictData,
  removeDictData,
  dictOptions,
  type DictTypeItem,
  type DictDataItem,
} from "../api/dicts";

const TONES = [
  { label: "中性", value: "neutral" },
  { label: "状态（青柠）", value: "ok" },
  { label: "信息（蓝）", value: "info" },
  { label: "警示（红）", value: "danger" },
];

export default function Dict() {
  const [view, setView] = useState<"book" | "table">("table");
  const [rows, setRows] = useState<DictTypeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // 查询
  const [kwInput, setKwInput] = useState("");
  const [kw, setKw] = useState("");
  const [statusInput, setStatusInput] = useState<string | undefined>(undefined);
  const [statusF, setStatusF] = useState<string | undefined>(undefined);
  const [statusOptions, setStatusOptions] = useState<{ label: string; value: string }[]>([]);

  // 字典类型表单
  const [typeOpen, setTypeOpen] = useState(false);
  const [editingType, setEditingType] = useState<DictTypeItem | null>(null);
  const [typeForm] = Form.useForm();
  const [typeSaving, setTypeSaving] = useState(false);

  // 字典数据抽屉
  const [current, setCurrent] = useState<DictTypeItem | null>(null);
  const [items, setItems] = useState<DictDataItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // 字典数据表单
  const [dataOpen, setDataOpen] = useState(false);
  const [editingData, setEditingData] = useState<DictDataItem | null>(null);
  const [dataTarget, setDataTarget] = useState<DictTypeItem | null>(null);
  const [dataForm] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDictTypes({ page: 1, page_size: 100, keyword: kw || undefined, status: statusF });
      setRows(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      message.error(errText(e, "字典类型加载失败"));
    } finally {
      setLoading(false);
    }
  }, [kw, statusF]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    dictOptions("sys_normal_disable")
      .then((o) => setStatusOptions(o.map((x) => ({ label: x.label, value: x.value }))))
      .catch(() => setStatusOptions([]));
  }, []);

  const loadItems = useCallback(async (dictType: string) => {
    setItemsLoading(true);
    try {
      setItems(await listDictData(dictType));
    } catch (e: any) {
      message.error(errText(e, "字典数据加载失败"));
    } finally {
      setItemsLoading(false);
    }
  }, []);

  /* ── 字典类型 ── */
  const openTypeCreate = () => {
    setEditingType(null);
    typeForm.resetFields();
    typeForm.setFieldsValue({ status: true });
    setTypeOpen(true);
  };
  const openTypeEdit = (row: DictTypeItem) => {
    setEditingType(row);
    typeForm.setFieldsValue({ dict_name: row.dict_name, dict_type: row.dict_type, status: row.status === 1, remark: row.remark });
    setTypeOpen(true);
  };
  const submitType = async () => {
    const v = await typeForm.validateFields();
    setTypeSaving(true);
    try {
      const payload = { dict_name: v.dict_name.trim(), dict_type: v.dict_type.trim(), status: v.status ? 1 : 0, remark: v.remark || "" };
      if (editingType) {
        await updateDictType(editingType.id, payload);
        message.success("字典类型已更新");
      } else {
        await createDictType(payload);
        message.success("字典类型已新增");
      }
      setTypeOpen(false);
      await load();
    } catch (e: any) {
      message.error(errText(e, "保存失败"));
    } finally {
      setTypeSaving(false);
    }
  };
  const removeType = async (row: DictTypeItem) => {
    try {
      await removeDictType(row.id);
      message.success("字典类型已删除");
      await load();
    } catch (e: any) {
      message.error(errText(e, "字典类型删除失败"));
    }
  };

  /* ── 字典数据 ── */
  const openData = async (row: DictTypeItem) => {
    setCurrent(row);
    await loadItems(row.dict_type);
  };
  const openDataCreate = (type?: DictTypeItem) => {
    setDataTarget(type ?? current);
    setEditingData(null);
    dataForm.resetFields();
    dataForm.setFieldsValue({ tone: "neutral", sort: items.length + 1, def: false, status: true });
    setDataOpen(true);
  };
  const openDataEdit = (row: DictDataItem, type?: DictTypeItem) => {
    setDataTarget(type ?? current);
    setEditingData(row);
    dataForm.setFieldsValue({
      label: row.label,
      value: row.value,
      tone: row.tone || "neutral",
      sort: row.sort,
      def: row.def,
      status: row.status === 1,
      remark: row.remark,
    });
    setDataOpen(true);
  };
  const submitData = async () => {
    const target = dataTarget;
    if (!target) return;
    const v = await dataForm.validateFields();
    const payload = {
      ...v,
      dict_type: target.dict_type,
      def: !!v.def,
      status: v.status ? 1 : 0,
      sort: v.sort ?? 0,
    };
    try {
      if (editingData) {
        await updateDictData(editingData.id, payload);
      } else {
        await createDictData(payload);
      }
      message.success("字典数据已保存");
      setDataOpen(false);
      if (current?.dict_type === target.dict_type) await loadItems(target.dict_type);
    } catch (e: any) {
      message.error(errText(e, "保存失败"));
    }
  };
  const removeData = async (row: DictDataItem) => {
    try {
      await removeDictData(row.id);
      message.success("字典数据已删除");
      if (current) await loadItems(current.dict_type);
    } catch (e: any) {
      message.error(errText(e, "字典数据删除失败"));
    }
  };

  const doExport = async () => {
    try {
      const blob = await exportDictTypes({ keyword: kw || undefined, status: statusF });
      downloadBlob(blob, `字典类型-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e: any) {
      message.error(errText(e, "导出失败"));
    }
  };

  const panelHead = (title: string, totalN: number, tools?: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderBottom: "1px solid var(--lv-line)" }}>
      <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0, borderRadius: 999 }}>
        <span className="lv-tag-dot" />
      </span>
      <span style={{ fontSize: 14, fontWeight: 650, color: "var(--lv-ink)" }}>{title}</span>
      <span style={{ fontSize: 12, color: "var(--lv-faint)", fontVariantNumeric: "tabular-nums" }}>共 {totalN} 条</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>{tools}</div>
    </div>
  );

  const typeColumns = [
    {
      title: "字典名称", dataIndex: "dict_name", key: "dictName", minWidth: 160,
      render: (_: string, row: DictTypeItem) => (
        <button type="button" className="link-btn" onClick={() => openData(row)}>{row.dict_name}</button>
      ),
    },
    { title: "字典类型", dataIndex: "dict_type", key: "dictType", render: (v: string) => <span className="code-chip">{v}</span> },
    {
      title: "状态", dataIndex: "status", key: "status", width: 96,
      render: (v: number) => (v === 1 ? <DictTag tone="ok">正常</DictTag> : <DictTag tone="neutral">停用</DictTag>),
    },
    {
      title: "备注", dataIndex: "remark", key: "remark",
      render: (v: string) => <span className="muted">{v || "—"}</span>,
    },
    {
      title: "创建时间", dataIndex: "create_time", key: "createTime", width: 150,
      render: (v: string) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{v || "—"}</span>,
    },
    {
      title: "操作", key: "actions", width: 120, className: "col-actions",
      render: (_: unknown, row: DictTypeItem) => (
        <div className="row-actions" style={{ justifyContent: "flex-end" }}>
          <Tooltip title="字典数据">
            <button className="icon-btn" type="button" onClick={() => openData(row)}><EditOutlined /></button>
          </Tooltip>
          <Tooltip title="编辑">
            <button className="icon-btn" type="button" onClick={() => openTypeEdit(row)}><EditOutlined /></button>
          </Tooltip>
          <Popconfirm title={`确认删除「${row.dict_name}」吗？`} onConfirm={() => removeType(row)} okText="删除" cancelText="取消">
            <Tooltip title="删除">
              <button className="icon-btn is-danger" type="button"><DeleteOutlined /></button>
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const itemColumns = [
    {
      title: "标签", dataIndex: "label", key: "label",
      render: (v: string, row: DictDataItem) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <DictTag tone={row.tone}>{v}</DictTag>
          {row.def && <CheckOutlined style={{ fontSize: 13, color: "var(--lv-leaf-text)" }} />}
        </span>
      ),
    },
    { title: "键值", dataIndex: "value", key: "value", render: (v: string) => <span className="code-chip">{v}</span> },
    { title: "排序", dataIndex: "sort", key: "sort", width: 64, align: "right" as const, render: (v: number) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{v}</span> },
    {
      title: "状态", dataIndex: "status", key: "status", width: 90,
      render: (v: number) => (v === 1 ? <DictTag tone="ok">正常</DictTag> : <DictTag tone="neutral">停用</DictTag>),
    },
    {
      title: "操作", key: "actions", width: 84, className: "col-actions",
      render: (_: unknown, row: DictDataItem) => (
        <div className="row-actions" style={{ justifyContent: "flex-end" }}>
          <Tooltip title="编辑">
            <button className="icon-btn" type="button" onClick={() => openDataEdit(row)}><EditOutlined /></button>
          </Tooltip>
          <Popconfirm title={`确认删除「${row.label}」吗？`} onConfirm={() => removeData(row)} okText="删除" cancelText="取消">
            <Tooltip title="删除">
              <button className="icon-btn is-danger" type="button"><DeleteOutlined /></button>
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="lv" style={{ padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>字典管理</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>
            维护各业务页面的下拉选项和状态标签，统一选项名称、取值和显示样式。
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={view}
            onChange={(v) => setView(v as "book" | "table")}
            options={[
              { label: <span><AppstoreOutlined /> 样本册</span>, value: "book" },
              { label: <span><UnorderedListOutlined /> 表格</span>, value: "table" },
            ]}
          />
          <button className="lv-btn lv-btn--primary" type="button" data-act="create" onClick={openTypeCreate}>
            <PlusOutlined /> 新增字典类型
          </button>
        </div>
      </div>

      {/* 查询面板 */}
      <div className="lv-query" style={{ borderRadius: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
          placeholder="字典名称 / 类型"
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          onPressEnter={() => { setKw(kwInput); }}
          className="lv-query-input"
          data-act="keyword"
        />
        <Select
          allowClear
          placeholder="全部状态"
          value={statusInput}
          onChange={(v) => setStatusInput(v)}
          options={statusOptions}
          className="lv-query-select"
          style={{ width: 150 }}
          data-act="status-filter"
        />
        <div className="lv-query-actions">
          <button className="lv-btn" type="button" data-act="reset" onClick={() => { setKwInput(""); setStatusInput(undefined); setKw(""); setStatusF(undefined); }}>
            重置
          </button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="search" onClick={() => { setKw(kwInput); setStatusF(statusInput); }}>
            <SearchOutlined /> 查询
          </button>
        </div>
      </div>

      {/* 视图主体 */}
      {view === "book" ? (
        <div className="lv-panel">
          {panelHead("字典样本册", total, (
            <>
              <Tooltip title="刷新">
                <button className="icon-btn" type="button" data-act="refresh" onClick={load}><ReloadOutlined /></button>
              </Tooltip>
              <Tooltip title="导出当前查询结果">
                <button className="icon-btn" type="button" data-act="export" onClick={doExport}><DownloadOutlined /></button>
              </Tooltip>
            </>
          ))}
          <DictSwatchbook
            types={rows}
            loading={loading}
            onCreateItem={(t) => openDataCreate(t)}
            onEditItem={(t, i) => openDataEdit(i, t)}
            onEditType={openTypeEdit}
          />
        </div>
      ) : (
        <div className="lv-panel">
          {panelHead("字典类型", total, (
            <>
              <Tooltip title="刷新">
                <button className="icon-btn" type="button" data-act="refresh" onClick={load}><ReloadOutlined /></button>
              </Tooltip>
              <Tooltip title="导出当前查询结果">
                <button className="icon-btn" type="button" data-act="export" onClick={doExport}><DownloadOutlined /></button>
              </Tooltip>
            </>
          ))}
          <Table
            rowKey="id"
            loading={loading}
            dataSource={rows}
            columns={typeColumns}
            pagination={false}
            locale={{ emptyText: "还没有字典类型" }}
          />
        </div>
      )}

      {/* 字典类型表单 */}
      <Modal
        title={editingType ? "编辑字典类型" : "新增字典类型"}
        open={typeOpen}
        onCancel={() => setTypeOpen(false)}
        onOk={submitType}
        confirmLoading={typeSaving}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={560}
      >
        <Form form={typeForm} layout="vertical" className="lv-form">
          <div className="lv-form-grid">
            <Form.Item name="dict_name" label="字典名称" rules={[{ required: true, message: "请输入字典名称" }]}>
              <Input placeholder="如：用户性别" />
            </Form.Item>
            <Form.Item
              name="dict_type"
              label="字典类型"
              tooltip="前端按此编码引用"
              rules={[
                { required: true, message: "请输入字典类型" },
                { pattern: /^[a-z][a-z0-9_]*$/, message: "小写字母开头，仅含小写字母、数字、下划线" },
              ]}
            >
              <Input placeholder="如：sys_user_sex" disabled={!!editingType} />
            </Form.Item>
          </div>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="字典用途说明" maxLength={200} />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 字典数据抽屉 */}
      <Drawer
        title={current?.dict_name}
        open={!!current}
        onClose={() => setCurrent(null)}
        size={600}
        extra={current && <span className="code-chip">{current.dict_type}</span>}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--lv-soft)" }}>共 {items.length} 项，按排序显示</span>
          <button className="lv-btn lv-btn--primary" type="button" onClick={() => openDataCreate()}>
            <PlusOutlined /> 新增数据
          </button>
        </div>
        <div className="lv-panel" style={{ boxShadow: "none" }}>
          <Table
            rowKey="id"
            size="small"
            loading={itemsLoading}
            dataSource={items}
            columns={itemColumns}
            pagination={false}
            locale={{ emptyText: "还没有字典数据" }}
          />
        </div>
      </Drawer>

      {/* 字典数据表单 */}
      <Modal
        title={editingData ? "编辑字典数据" : "新增字典数据"}
        open={dataOpen}
        onCancel={() => setDataOpen(false)}
        onOk={submitData}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={560}
      >
        <Form form={dataForm} layout="vertical" className="lv-form">
          <div className="lv-form-grid">
            <Form.Item name="label" label="标签" rules={[{ required: true, message: "请输入标签" }]}>
              <Input placeholder="显示文字，如：男" />
            </Form.Item>
            <Form.Item name="value" label="键值" rules={[{ required: true, message: "请输入键值" }]}>
              <Input placeholder="存储值，如：0" />
            </Form.Item>
          </div>
          <div className="lv-form-grid">
            <Form.Item name="tone" label="标签样式" initialValue="neutral">
              <Select options={TONES} />
            </Form.Item>
            <Form.Item name="sort" label="显示排序" initialValue={1}>
              <InputNumber style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <div className="lv-form-grid">
            <Form.Item name="def" label="默认值" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
            <Form.Item name="status" label="状态" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
