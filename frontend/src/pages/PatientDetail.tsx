import { useEffect, useState } from "react";
import { Card, Descriptions, Form, Input, Select, Button, message, Table, Tag, Spin, Tabs, Modal, Space } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import {
  UserOutlined,
  CalendarOutlined,
  EditOutlined,
  MedicineBoxOutlined,
  FileTextOutlined,
  HeartOutlined,
  ArrowLeftOutlined,
  ScanOutlined,
  FileImageOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { getPatient, createPatient, updatePatient, type PatientInfo } from "../api/patients";
import { createRecord } from "../api/records";
import VoiceTextArea from "../components/VoiceTextArea";
import PatientFormModal from "../components/PatientFormModal";
import DocScanner from "../components/DocScanner";
import {
  listDocuments, uploadDocument, deleteDocument, getDocument,
  type ScannedDocumentMeta,
} from "../api/documents";

function PatientForm({ initial, onSave, title }: { initial?: PatientInfo; onSave: (v: any) => Promise<void>; title: string }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  return (
    <Card
      title={
        <Space>
          <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}
            style={{ paddingLeft: 0, color: "#5b6b83" }} />
          {title}
        </Space>
      }
      style={{ maxWidth: 720, margin: "0 auto" }}
    >
      <Form form={form} layout="vertical" initialValues={initial}
        onFinish={async (v) => { setSaving(true); try { await onSave(v); } finally { setSaving(false); } }}>
        <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="gender" label="性别" initialValue="其他"><Select options={[{ value: "男" }, { value: "女" }, { value: "其他" }]} /></Form.Item>
        <Form.Item name="phone" label="手机号"><Input /></Form.Item>
        <Form.Item name="id_card" label="身份证号"><Input /></Form.Item>
        <Form.Item name="birth_date" label="出生日期"><Input /></Form.Item>
        <Form.Item name="address" label="地址"><Input /></Form.Item>
        <Form.Item name="medical_history" label="病史"><VoiceTextArea rows={3} /></Form.Item>
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
  const [activeTab, setActiveTab] = useState("records");
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitSaving, setVisitSaving] = useState(false);
  const [visitForm] = Form.useForm();
  const [recordDetail, setRecordDetail] = useState<any>(null);
  // 编辑档案改走弹窗，不再跳 /patients/:id/edit 整页表单
  const [editOpen, setEditOpen] = useState(false);
  // 扫描归档
  const [scanOpen, setScanOpen] = useState(false);
  const [patientDocs, setPatientDocs] = useState<ScannedDocumentMeta[]>([]);
  const [docPreview, setDocPreview] = useState<{ title: string; images: string[]; ocr_text: string } | null>(null);

  useEffect(() => {
    getPatient(Number(id)).then((r) => { setPatient(r.patient); setRecords(r.records); })
      .catch((e) => message.error(e?.response?.data?.detail || "加载失败")).finally(() => setLoading(false));
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadDocs = async () => {
    try {
      const r = await listDocuments({ patient_id: Number(id) });
      setPatientDocs(r.items || []);
    } catch {
      setPatientDocs([]);
    }
  };

  const handleScanConfirm = async (result: { title: string; category: string; images: string[]; ocr_text: string }) => {
    setScanOpen(false);
    try {
      await uploadDocument({
        title: result.title || `患者档案扫描件 ${new Date().toLocaleDateString("zh-CN")}`,
        category: result.category,
        patient_id: Number(id),
        images: result.images,
        ocr_text: result.ocr_text,
      });
      message.success("扫描件已归档");
      loadDocs();
    } catch {
      message.error("归档失败");
    }
  };

  const handleDocPreview = async (docId: number) => {
    try {
      const d = await getDocument(docId);
      setDocPreview({ title: d.title, images: d.images, ocr_text: d.ocr_text });
    } catch {
      message.error("加载文档失败");
    }
  };

  const handleDocDelete = async (docId: number) => {
    try {
      await deleteDocument(docId);
      message.success("已删除");
      loadDocs();
    } catch {
      message.error("删除失败");
    }
  };

  if (loading) return <Spin />;
  if (!patient) return <Card>患者不存在</Card>;

  const openNewVisit = () => {
    visitForm.resetFields();
    setVisitOpen(true);
  };

  const submitNewVisit = async () => {
    try {
      const values = await visitForm.validateFields();
      setVisitSaving(true);
      await createRecord({ ...values, patient_id: Number(id) });
      message.success("就诊记录已创建");
      setVisitOpen(false);
      const r = await getPatient(Number(id));
      setPatient(r.patient);
      setRecords(r.records);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || "创建失败");
    } finally {
      setVisitSaving(false);
    }
  };

  // 统计数据
  const recordCount = records.length;
  const pendingRecords = records.filter(r => !r.diagnosis).length;
  const activeAppointments = 0; // 暂时硬编码，后续可从 API 获取

  return (
    <div style={{ padding: "24px" }}>
      {/* 返回按钮 */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 12, paddingLeft: 0, color: "#5b6b83", fontSize: 13 }}
      >
        返回
      </Button>

      {/* 页面标题 */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">PATIENT PROFILE</div>
          <h1>患者详情</h1>
          <div className="sub">完整了解患者的档案、就诊与预约。</div>
        </div>
        <div className="actions">
          <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>编辑档案</Button>
          <Button type="primary" icon={<FileTextOutlined />} onClick={openNewVisit}>新建就诊</Button>
        </div>
      </div>

      {/* Hero 卡片 */}
      <div className="hero-card" style={{ marginBottom: "24px" }}>
        <div style={{
          width: "80px",
          height: "80px",
          borderRadius: "16px",
          background: "rgba(21,58,124,0.13)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "36px",
          color: "#fff",
          flexShrink: 0,
        }}>
          <UserOutlined />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: 600 }}>{patient.name}</h2>
          <div style={{ fontSize: "13px", color: "#b3c7e1", lineHeight: 1.8 }}>
            <span>{patient.gender}</span>
            {patient.birth_date && <span> · {patient.birth_date}</span>}
            {patient.phone && <span> · {patient.phone}</span>}
          </div>
          <div style={{ marginTop: "8px" }}>
            {patient.id_card && <Tag color="blue" style={{ marginRight: "8px" }}>身份证: {patient.id_card.slice(-4)}</Tag>}
            {patient.address && <Tag color="green">{patient.address}</Tag>}
          </div>
        </div>
        <div className="mini-grid" style={{ minWidth: "300px" }}>
          <div className="mini" style={{ background: "rgba(21,58,124,0.1)" }}>
            <small style={{ color: "#b3c7e1" }}>累计就诊</small>
            <b>{recordCount}<span>次</span></b>
          </div>
          <div className="mini" style={{ background: "rgba(21,58,124,0.1)" }}>
            <small style={{ color: "#b3c7e1" }}>待完善记录</small>
            <b>{pendingRecords}<span>份</span></b>
          </div>
          <div className="mini" style={{ background: "rgba(21,58,124,0.1)" }}>
            <small style={{ color: "#b3c7e1" }}>有效预约</small>
            <b>{activeAppointments}<span>个</span></b>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px" }}>
        {/* 左侧：Tab 内容 */}
        <div>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
            {
              key: "records",
              label: (
                <span>
                  <FileTextOutlined />
                  就诊记录
                  <span style={{ marginLeft: "6px", fontSize: "12px", background: "#eef3fb", padding: "1px 6px", borderRadius: "4px" }}>
                    {recordCount}
                  </span>
                </span>
              ),
              children: (
                <Card>
                  <Table
                    rowKey="id"
                    dataSource={records}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      {
                        title: "时间",
                        dataIndex: "created_at",
                        width: 120,
                        render: (v: string) => v ? new Date(v).toLocaleDateString("zh-CN") : "-",
                      },
                      {
                        title: "科室 / 医生",
                        key: "doctor",
                        width: 150,
                        render: (_: any, r: any) => (
                          <span>{r.department || "-"} · {r.doctor_name || "-"}</span>
                        ),
                      },
                      { title: "症状", dataIndex: "symptoms", ellipsis: true },
                      { title: "诊断", dataIndex: "diagnosis", ellipsis: true, render: (v: string) => v || <span style={{ color: "#999" }}>待诊断</span> },
                      { title: "处方", dataIndex: "prescription", ellipsis: true, render: (v: string) => v || "-" },
                      {
                        title: "状态",
                        key: "status",
                        width: 100,
                        render: (_: any, r: any) => (
                          r.diagnosis ? <Tag color="green">已归档</Tag> : <Tag color="orange">待完善</Tag>
                        ),
                      },
                      {
                        title: "操作",
                        key: "action",
                        width: 80,
                        render: (_: any, r: any) => <a className="row-link" onClick={() => setRecordDetail(r)}>查看</a>,
                      },
                    ]}
                  />
                </Card>
              ),
            },
            {
              key: "appointments",
              label: (
                <span>
                  <CalendarOutlined />
                  预约
                  <span style={{ marginLeft: "6px", fontSize: "12px", background: "#eef3fb", padding: "1px 6px", borderRadius: "4px" }}>
                    {activeAppointments}
                  </span>
                </span>
              ),
              children: (
                <Card>
                  <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                    暂无预约记录
                  </div>
                </Card>
              ),
            },
            {
              key: "prescriptions",
              label: (
                <span>
                  <MedicineBoxOutlined />
                  处方
                </span>
              ),
              children: (
                <Card>
                  <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                    暂无处方记录
                  </div>
                </Card>
              ),
            },
          ]} />
        </div>

        {/* 右侧：侧边栏 */}
        <div className="stack">
          {/* 当前预约 */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>当前预约</h2>
              </div>
              <span className="badge amber">无预约</span>
            </div>
            <div className="panel-body">
              <div style={{ textAlign: "center", padding: "20px", color: "var(--muted)", fontSize: "12px" }}>
                暂无待就诊预约
              </div>
            </div>
          </section>

          {/* 健康要点 */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>健康要点</h2>
                <small>最近一次记录的关键指标</small>
              </div>
            </div>
            <div className="panel-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                <div className="mini">
                  <small>血压</small>
                  <b>--<span>mmHg</span></b>
                </div>
                <div className="mini">
                  <small>心率</small>
                  <b>--<span>bpm</span></b>
                </div>
                <div className="mini">
                  <small>体温</small>
                  <b>--<span>°C</span></b>
                </div>
                <div className="mini">
                  <small>BMI</small>
                  <b>--</b>
                </div>
              </div>
              {patient.medical_history && (
                <div style={{
                  padding: "10px 12px",
                  background: "#fff8ed",
                  border: "1px solid #f5e8cc",
                  borderRadius: "7px",
                  color: "#aa8136",
                  fontSize: "11px",
                  lineHeight: 1.8,
                }}>
                  <HeartOutlined style={{ marginRight: "6px" }} />
                  病史：{patient.medical_history}
                </div>
              )}
            </div>
          </section>

          {/* 关联账号 */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>关联账号</h2>
              </div>
            </div>
            <div className="panel-body">
              <dl className="kv">
                <dt>手机号</dt>
                <dd>{patient.phone || "-"}</dd>
                <dt>身份证号</dt>
                <dd>{patient.id_card || "-"}</dd>
                <dt>地址</dt>
                <dd>{patient.address || "-"}</dd>
              </dl>
            </div>
          </section>

          {/* 扫描归档 */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2><FileImageOutlined /> 扫描归档</h2>
                <small>纸质病历 / 检查单 / 证件扫描件</small>
              </div>
              <Button size="small" icon={<ScanOutlined />} onClick={() => setScanOpen(true)}>扫描</Button>
            </div>
            <div className="panel-body">
              {patientDocs.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: "12px 0" }}>
                  暂无扫描件，可点击「扫描」归档
                </div>
              ) : (
                patientDocs.map((d, i) => (
                  <div
                    key={d.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 0", fontSize: 12,
                      borderBottom: i < patientDocs.length - 1 ? "1px solid #f0f3f8" : "none",
                    }}
                  >
                    <FileImageOutlined style={{ color: "#7a88a0", fontSize: 15 }} />
                    <span
                      style={{ flex: 1, color: "#2d527e", cursor: "pointer", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      onClick={() => handleDocPreview(d.id)}
                    >
                      {d.title}
                    </span>
                    <span className="badge gray">{d.image_count} 页</span>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDocDelete(d.id)} />
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* 新建就诊弹窗 */}
      <Modal
        title="新建就诊"
        open={visitOpen}
        onCancel={() => setVisitOpen(false)}
        onOk={submitNewVisit}
        confirmLoading={visitSaving}
        okText="创建"
      >
        <Form form={visitForm} layout="vertical">
          <Form.Item label="患者"><Input value={patient.name} readOnly disabled /></Form.Item>
          <Form.Item name="symptoms" label="主诉症状"><VoiceTextArea rows={2} /></Form.Item>
          <Form.Item name="diagnosis" label="诊断结果"><VoiceTextArea rows={3} /></Form.Item>
          <Form.Item name="prescription" label="处方"><VoiceTextArea rows={2} /></Form.Item>
          <Form.Item name="notes" label="备注"><VoiceTextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* 就诊记录详情 */}
      <Modal
        title="就诊记录详情"
        open={!!recordDetail}
        onCancel={() => setRecordDetail(null)}
        footer={<Button onClick={() => setRecordDetail(null)}>关闭</Button>}
        width={640}
      >
        {recordDetail && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="记录编号">#{recordDetail.id ?? recordDetail.record_id ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="就诊日期">
              {recordDetail.created_at || recordDetail.visit_date
                ? new Date(recordDetail.created_at || recordDetail.visit_date).toLocaleString("zh-CN")
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="接诊医生">{recordDetail.doctor_name || "-"}</Descriptions.Item>
            <Descriptions.Item label="主诉症状">{recordDetail.symptoms || "-"}</Descriptions.Item>
            <Descriptions.Item label="诊断结果">{recordDetail.diagnosis || "-"}</Descriptions.Item>
            <Descriptions.Item label="处方">{recordDetail.prescription || "-"}</Descriptions.Item>
            <Descriptions.Item label="备注">{recordDetail.notes || "-"}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 编辑档案弹窗（原为跳转整页表单）；保存成功后原地刷新详情 */}
      <PatientFormModal
        open={editOpen}
        patient={patient}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          getPatient(Number(id)).then((r) => setPatient(r.patient)).catch(() => {});
        }}
      />

      {/* 扫描文档（通用组件） */}
      <DocScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onConfirm={handleScanConfirm}
        showMeta
        okText="保存归档"
      />

      {/* 扫描件内容预览 */}
      <Modal
        title={docPreview?.title || "扫描件"}
        open={!!docPreview}
        onCancel={() => setDocPreview(null)}
        footer={null}
        width={640}
        destroyOnHidden
      >
        {docPreview && (
          <div style={{ display: "grid", gap: 14 }}>
            {docPreview.images.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 380, overflow: "auto" }}>
                {docPreview.images.map((src, i) => (
                  <img key={i} src={src} alt={`第${i + 1}页`} style={{ width: 210, borderRadius: 8, border: "1px solid #e6ecf3" }} />
                ))}
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, color: "#9a9ab0", marginBottom: 6 }}>识别文本</div>
              <pre style={{ whiteSpace: "pre-wrap", background: "#101b2e", padding: 12, borderRadius: 8, fontSize: 12, margin: 0, maxHeight: 220, overflow: "auto", color: "#c8d0dc" }}>
                {docPreview.ocr_text || "（无识别文本）"}
              </pre>
            </div>
          </div>
        )}
      </Modal>
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
