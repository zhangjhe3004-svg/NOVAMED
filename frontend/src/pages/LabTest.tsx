/**
 * 检查检验 —— 检查项目开单 + 状态流转 + 结果录入 + 统计
 * 板块统一为案例设计：页头 + 统计条 + 查询面板 + 列表面板（●共N条）+ 图标操作列。
 */
import { useEffect, useState } from "react";
import {
  Table, Button, Input, Select, Typography, message, Modal, Form,
  Popconfirm, Tooltip,
} from "antd";
import {
  PlusOutlined, SearchOutlined, ExperimentOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, FileDoneOutlined, PlayCircleOutlined, StopOutlined, ScanOutlined,
} from "@ant-design/icons";
import {
  listLabTests, getLabTestStats, createLabTest, updateLabTest,
  changeLabTestStatus, deleteLabTest, type LabTestItem, type LabTestStats,
} from "../api/labtest";
import { listPatients } from "../api/patients";
import DocScanner from "../components/DocScanner";
import { uploadDocument } from "../api/documents";

const { Text } = Typography;

const CATEGORIES = ["检验", "影像", "超声", "内镜", "病理", "其他"];
const STATUSES = ["待检查", "已采样", "检查中", "已出报告", "已取消"];

const STATUS_CLS: Record<string, string> = {
  "待检查": "lv-tag--amber",
  "已采样": "lv-tag--neutral",
  "检查中": "lv-tag--amber",
  "已出报告": "lv-tag--leaf",
  "已取消": "lv-tag--gray",
};

export default function LabTest() {
  const [data, setData] = useState<LabTestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<LabTestStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [kwInput, setKwInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LabTestItem | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultTarget, setResultTarget] = useState<LabTestItem | null>(null);
  const [resultForm] = Form.useForm();

  // 扫描报告
  const [scanOpen, setScanOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<LabTestItem | null>(null);

  const [patients, setPatients] = useState<{ value: number; label: string }[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        listLabTests({ keyword: keyword || undefined, category, status, page_size: 100 }),
        getLabTestStats(),
      ]);
      setData(r.items);
      setTotal(r.total);
      setStats(s);
    } catch {
      message.error("加载检查数据失败");
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      const r = await listPatients({ page: 1, page_size: 100 });
      setPatients(r.items.map((p) => ({ value: p.id, label: `${p.name}${p.phone ? ` · ${p.phone}` : ""}` })));
    } catch {
      /* 忽略 */
    }
  };

  useEffect(() => { load(); }, [keyword, category, status]);
  useEffect(() => { if (open || resultOpen) loadPatients(); }, [open, resultOpen]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ category: "检验", status: "待检查" });
    setOpen(true);
  };

  const openEdit = (row: LabTestItem) => {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await updateLabTest(editing.id, { ...editing, ...values });
        message.success("已更新检查单");
      } else {
        await createLabTest(values);
        message.success("已开检查单");
      }
      setOpen(false);
      load();
    } catch {
      message.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const openResult = (row: LabTestItem) => {
    setResultTarget(row);
    resultForm.resetFields();
    resultForm.setFieldsValue({ result: row.result, reference: row.reference });
    setResultOpen(true);
  };

  const handleResultSave = async () => {
    const values = await resultForm.validateFields();
    if (!resultTarget) return;
    setSaving(true);
    try {
      await changeLabTestStatus(resultTarget.id, { status: "已出报告", ...values });
      message.success("报告已录入");
      setResultOpen(false);
      load();
    } catch {
      message.error("录入失败");
    } finally {
      setSaving(false);
    }
  };

  // 扫描报告：归档扫描件，并把识别文本回填到结果录入弹窗
  const handleScanConfirm = async (result: { title: string; category: string; images: string[]; ocr_text: string }) => {
    setScanOpen(false);
    const target = scanTarget;
    if (!target) return;
    try {
      await uploadDocument({
        title: result.title || `${target.item_name || "检验"} 报告扫描件`,
        category: result.category || "检验单",
        labtest_id: target.id,
        patient_id: target.patient_id,
        images: result.images,
        ocr_text: result.ocr_text,
      });
      message.success("报告扫描件已归档");
    } catch {
      message.error("归档失败");
    }
    if (result.ocr_text) {
      setResultTarget(target);
      resultForm.resetFields();
      resultForm.setFieldsValue({ result: result.ocr_text, reference: target.reference });
      setResultOpen(true);
      message.info("识别文本已回填，请核对后出报告");
    }
  };

  const advance = async (row: LabTestItem, target: string) => {
    try {
      await changeLabTestStatus(row.id, { status: target });
      message.success(`已变更为「${target}」`);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "操作失败");
    }
  };

  const columns = [
    { title: "检查单号", dataIndex: "test_no", width: 160, render: (v: string) => <span className="tnum" style={{ color: "#236de9" }}>{v}</span> },
    { title: "患者", dataIndex: "patient_name", width: 120, render: (v: string, r: LabTestItem) => <span style={{ fontWeight: 600, color: "var(--lv-ink)" }}>{v || `#${r.patient_id}`}</span> },
    { title: "检查项目", dataIndex: "item_name" },
    { title: "分类", dataIndex: "category", width: 90, render: (v: string) => (v ? <span className="lv-tag lv-tag--neutral">{v}</span> : "-") },
    { title: "科室", dataIndex: "department", width: 110, render: (v: string) => v || "-" },
    { title: "状态", dataIndex: "status", width: 100, render: (v: string) => (
      <span className={`lv-tag ${STATUS_CLS[v] || "lv-tag--gray"}`}><span className="lv-tag-dot" />{v}</span>
    ) },
    { title: "开单医生", dataIndex: "doctor_name", width: 110, render: (v: string) => v || "-" },
    { title: "技师", dataIndex: "operator", width: 100, render: (v: string) => v || "-" },
    { title: "结果", dataIndex: "result", ellipsis: true, render: (v: string) =>
      v ? <span style={{ maxWidth: 160, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
        : <span style={{ color: "var(--lv-faint)" }}>未出报告</span> },
    {
      title: "操作", key: "op", width: 180, fixed: "right" as const, className: "col-actions",
      render: (_: any, r: LabTestItem) => (
        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
          {r.status === "待检查" && <Tooltip title="采样"><button className="icon-btn" data-act="sample" onClick={() => advance(r, "已采样")}><PlayCircleOutlined /></button></Tooltip>}
          {r.status === "已采样" && <Tooltip title="开始检查"><button className="icon-btn" data-act="start" onClick={() => advance(r, "检查中")}><PlayCircleOutlined /></button></Tooltip>}
          {r.status === "检查中" && <Tooltip title="录入报告"><button className="icon-btn" data-act="report" onClick={() => openResult(r)}><FileDoneOutlined /></button></Tooltip>}
          {r.status !== "已取消" && <Tooltip title="扫描报告"><button className="icon-btn" data-act="scan" onClick={() => { setScanTarget(r); setScanOpen(true); }}><ScanOutlined /></button></Tooltip>}
          {r.status !== "已取消" && r.status !== "已出报告" && <Tooltip title="取消"><button className="icon-btn" data-act="cancel" onClick={() => advance(r, "已取消")}><StopOutlined /></button></Tooltip>}
          <Tooltip title="编辑"><button className="icon-btn" data-act="edit" onClick={() => openEdit(r)}><EditOutlined /></button></Tooltip>
          <Popconfirm title="删除该检查单？" onConfirm={async () => { await deleteLabTest(r.id); message.success("已删除"); load(); }}>
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
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>检查检验</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>检查项目开单、状态流转与报告录入。</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="lv-btn" type="button" onClick={load}><ReloadOutlined /> 刷新</button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="create" onClick={openCreate}><PlusOutlined /> 开检查单</button>
        </div>
      </div>

      {/* 统计条 */}
      <div className="lv-metrics">
        <div className="lv-metric"><span className="lv-metric-label">检查总量</span><span className="lv-metric-figure tnum">{stats?.total ?? 0}</span></div>
        <div className="lv-metric"><span className="lv-metric-label">待处理</span><span className="lv-metric-figure tnum" style={{ color: "#b9770a" }}>{stats?.pending ?? 0}</span></div>
        <div className="lv-metric"><span className="lv-metric-label">已出报告</span><span className="lv-metric-figure tnum" style={{ color: "#3f8a1e" }}>{stats?.done ?? 0}</span></div>
        <div className="lv-metric"><span className="lv-metric-label">已取消</span><span className="lv-metric-figure tnum" style={{ color: "#9a9ab0" }}>{stats?.cancelled ?? 0}</span></div>
      </div>

      {/* 查询面板 */}
      <div className="lv-query">
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
          placeholder="搜索单号 / 患者 / 项目"
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          onPressEnter={() => setKeyword(kwInput)}
          className="lv-query-input"
        />
        <Select allowClear placeholder="分类" style={{ width: 120 }} value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <Select allowClear placeholder="状态" style={{ width: 130 }} value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: s }))} />
        <div className="lv-query-actions">
          <button className="lv-btn" type="button" data-act="reset" onClick={() => { setKwInput(""); setKeyword(""); setCategory(undefined); setStatus(undefined); }}>重置</button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="search" onClick={() => setKeyword(kwInput)}><SearchOutlined /> 查询</button>
        </div>
      </div>

      {/* 列表面板 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">检查单</span>
          <span className="lv-panel-meta">共 {total} 条</span>
          <div className="lv-panel-tools">
            <Tooltip title="刷新"><button className="icon-btn" data-act="refresh" onClick={load}><ReloadOutlined /></button></Tooltip>
          </div>
        </div>
        <Table rowKey="id" size="middle" loading={loading} dataSource={data} columns={columns} scroll={{ x: 1200 }} pagination={false} />
      </div>

      {/* 开单/编辑弹窗 */}
      <Modal
        title={editing ? "编辑检查单" : "开检查单"}
        open={open}
        onCancel={() => setOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" loading={saving} className="lv-submit" onClick={handleSave}>保存</Button>,
        ]}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" className="lv-form">
          <Form.Item name="patient_id" label="患者" rules={[{ required: true, message: "请选择患者" }]}>
            <Select showSearch optionFilterProp="label" placeholder="搜索并选择患者" options={patients} />
          </Form.Item>
          <Form.Item name="item_name" label="检查项目" rules={[{ required: true, message: "请输入检查项目" }]}>
            <Input placeholder="如：血常规、胸部 CT、腹部超声" />
          </Form.Item>
          <div className="lv-form-grid">
            <Form.Item name="category" label="分类">
              <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </Form.Item>
            <Form.Item name="department" label="开单科室">
              <Input placeholder="如：内科" />
            </Form.Item>
          </div>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="临床诊断 / 检查要求" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 结果录入弹窗 */}
      <Modal
        title={`录入报告 — ${resultTarget?.item_name || ""}`}
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setResultOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" loading={saving} className="lv-submit" onClick={handleResultSave}>出报告</Button>,
        ]}
        destroyOnHidden
        forceRender
      >
        <Form form={resultForm} layout="vertical" className="lv-form">
          <Form.Item name="result" label="检查结果 / 结论" rules={[{ required: true, message: "请输入结果" }]}>
            <Input.TextArea rows={4} placeholder="检查所见与诊断结论" />
          </Form.Item>
          <Form.Item name="reference" label="参考值 / 正常范围">
            <Input.TextArea rows={2} placeholder="正常参考范围（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 扫描报告（通用组件） */}
      <DocScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onConfirm={handleScanConfirm}
        showMeta
        defaultCategory="检验单"
        okText="识别并回填"
      />
    </div>
  );
}
