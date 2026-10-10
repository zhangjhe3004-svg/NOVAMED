/**
 * 就诊记录管理页面
 */
import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Select,
  Space,
  Tag,
  Typography,
  message,
  Drawer,
  Descriptions,
  Popconfirm,
  Input,
  Empty,
  Modal,
  Form,
} from "antd";
import {
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  ExperimentOutlined,
  EditOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  listRecords,
  getRecord,
  reviewAiSuggestion,
  adminReviewRecord,
  updateRecord,
  searchSimilar,
} from "../api/records";
import { listPatients } from "../api/patients";
import { getDoctors } from "../api/users";
import { useAuth } from "../stores/auth";
import type { MedicalRecordInfo } from "../api/records";

const { Title, Text, Paragraph } = Typography;

const aiReviewLabels: Record<number, { text: string; color: string }> = {
  0: { text: "未审核", color: "default" },
  1: { text: "已确认", color: "green" },
  2: { text: "已驳回", color: "red" },
};

const adminReviewLabels: Record<number, { text: string; color: string }> = {
  0: { text: "待管理员审", color: "orange" },
  1: { text: "已通过", color: "green" },
  2: { text: "管理员驳回", color: "red" },
};

export default function RecordList() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MedicalRecordInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [patientId, setPatientId] = useState<number | undefined>();
  const [patients, setPatients] = useState<{ value: number; label: string }[]>([]);
  const [doctors, setDoctors] = useState<{ value: number; label: string }[]>([]);
  const [aiReviewed, setAiReviewed] = useState<string[]>([]);
  const [adminReviewed, setAdminReviewed] = useState<string[]>([]);

  // 编辑弹窗
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();

  // 详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<MedicalRecordInfo | null>(null);
  const [similarList, setSimilarList] = useState<any[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await listRecords({
        page,
        page_size: 20,
        patient_id: patientId,
        ai_reviewed: aiReviewed.length ? aiReviewed.join(",") : undefined,
        admin_reviewed: adminReviewed.length ? adminReviewed.join(",") : undefined,
      });
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error("加载就诊记录失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, patientId, aiReviewed, adminReviewed]);

  // 加载患者列表用于筛选
  useEffect(() => {
    listPatients({ page: 1, page_size: 100 }).then((res) => {
      setPatients(res.items.map((p: any) => ({ value: p.id, label: p.name })));
    });
    getDoctors().then((res) => {
      setDoctors(res.map((u: any) => ({ value: u.id, label: u.name })));
    }).catch(() => {});
  }, []);

  const handleView = async (id: number) => {
    try {
      const r = await getRecord(id);
      setDetail(r);
      setSimilarList([]);
      setDrawerOpen(true);

      // 异步加载相似病例
      setSimilarLoading(true);
      const sim = await searchSimilar(r.symptoms);
      setSimilarList(sim.results || []);
    } catch {
      message.error("加载详情失败");
    } finally {
      setSimilarLoading(false);
    }
  };

  const handleReview = async (recordId: number, action: "confirm" | "reject") => {
    try {
      await reviewAiSuggestion(recordId, action);
      message.success(action === "confirm" ? "AI建议已确认" : "AI建议已驳回");
      fetchData();
      if (detail?.id === recordId) {
        setDetail({ ...detail!, ai_reviewed: action === "confirm" ? 1 : 2 });
      }
    } catch {
      message.error("操作失败");
    }
  };

  const handleAdminReview = async (recordId: number, action: "confirm" | "reject") => {
    try {
      await adminReviewRecord(recordId, action);
      message.success(action === "confirm" ? "管理员审核已确认" : "管理员审核已驳回");
      fetchData();
      if (detail?.id === recordId) {
        setDetail({ ...detail!, admin_reviewed: action === "confirm" ? 1 : 2 });
      }
    } catch {
      message.error("操作失败");
    }
  };

  // 管理员编辑就诊记录
  const handleEditOpen = () => {
    if (!detail) return;
    editForm.setFieldsValue({
      symptoms: detail.symptoms,
      diagnosis: detail.diagnosis,
      prescription: detail.prescription,
      notes: detail.notes,
      doctor_id: detail.doctor_id,
      room: detail.room,
    });
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!detail) return;
    try {
      const values = await editForm.validateFields();
      await updateRecord(detail.id, values);
      message.success("就诊记录已更新");
      setEditModalOpen(false);
      // 刷新
      const r = await getRecord(detail.id);
      setDetail(r);
      fetchData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error("更新失败");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    {
      title: "患者",
      dataIndex: "patient_id",
      width: 80,
      render: () => patients.find((p) => p.value === patientId)?.label || "-",
    },
    {
      title: "症状",
      dataIndex: "symptoms",
      ellipsis: true,
      render: (v: string) => (
        <Text ellipsis style={{ maxWidth: 300 }}>
          {v}
        </Text>
      ),
    },
    {
      title: "诊断",
      dataIndex: "diagnosis",
      width: 150,
      ellipsis: true,
      render: (v: string) => v || <span style={{ color: "#999" }}>待诊断</span>,
    },
    {
      title: "挂号时间",
      dataIndex: "registration_time",
      width: 130,
      sorter: true,
      defaultSortOrder: "descend" as const,
      render: (d: string) => d ? new Date(d).toLocaleString("zh-CN") : "-",
    },
    {
      title: "就诊日期",
      dataIndex: "visit_date",
      width: 120,
      render: (d: string) => new Date(d).toLocaleDateString("zh-CN"),
    },
    {
      title: "医生",
      dataIndex: "doctor_name",
      width: 80,
    },
    {
      title: "诊室",
      dataIndex: "room",
      width: 90,
      render: (v: string) => v || <span style={{ color: "#999" }}>待分配</span>,
    },
    {
      title: "审核",
      width: 140,
      render: (_: any, r: MedicalRecordInfo) => {
        if (!r.ai_suggestion) {
          return <span style={{ color: "#999" }}>无AI建议</span>;
        }
        // 医生已驳回
        if (r.ai_reviewed === 2) {
          return <Tag color="red">AI已驳回</Tag>;
        }
        // 待医生审核
        if (r.ai_reviewed === 0) {
          return <Tag color="orange">AI待审</Tag>;
        }
        // 医生已确认，看管理员状态
        const al = adminReviewLabels[r.admin_reviewed] || adminReviewLabels[0];
        return <Tag color={al.color}>{al.text}</Tag>;
      },
    },
    {
      title: "操作",
      width: 120,
      render: (_: any, r: MedicalRecordInfo) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleView(r.id)}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4}>就诊记录</Title>
      </div>

      {/* 筛选栏 */}
      <div className="filter-bar">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <Space size="middle" wrap>
            <Select
              style={{ width: 220 }}
              allowClear
              showSearch
              placeholder="按患者筛选"
              options={patients}
              filterOption={(input, option) =>
                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
              onChange={(val) => {
                setPatientId(val);
                setPage(1);
              }}
            />
            <Select
              mode="multiple"
              style={{ minWidth: 200 }}
              allowClear
              placeholder="医生审核状态"
              value={aiReviewed}
              onChange={(v) => { setAiReviewed(v); setPage(1); }}
              options={[
                { value: "0", label: "未审核" },
                { value: "1", label: "已确认" },
                { value: "2", label: "已驳回" },
              ]}
            />
            <Select
              mode="multiple"
              style={{ minWidth: 200 }}
              allowClear
              placeholder="管理员审核"
              value={adminReviewed}
              onChange={(v) => { setAdminReviewed(v); setPage(1); }}
              options={[
                { value: "0", label: "待管理员审" },
                { value: "1", label: "已通过" },
                { value: "2", label: "管理员驳回" },
              ]}
            />
          </Space>
          <Space>
            <Button size="small" icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
            <Button size="small">操作</Button>
            <Button size="small" type="primary">字段</Button>
          </Space>
        </div>
      </div>

      <Table
        rowKey="id"
        rowSelection={{}}
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p) => setPage(p),
        }}
      />

      {/* 详情抽屉 */}
      <Drawer
        title="就诊记录详情"
        width={640}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          detail ? (
            <Space>
              {/* 编辑按钮：管理员 或 接诊医生 */}
              {(user?.role === "admin" || detail?.doctor_id === user?.id) && (
                <Button icon={<EditOutlined />} onClick={handleEditOpen}>
                  修改
                </Button>
              )}
              {/* 医生审核（有AI建议且未审时显示） */}
              {detail.ai_suggestion && detail.ai_reviewed === 0 ? (
                <Space>
                  <Popconfirm
                    title="确认此AI建议？"
                    onConfirm={() => handleReview(detail.id, "confirm")}
                  >
                    <Button type="primary" icon={<CheckOutlined />}>
                      确认AI建议
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title="驳回此AI建议？"
                    onConfirm={() => handleReview(detail.id, "reject")}
                  >
                    <Button danger icon={<CloseOutlined />}>
                      驳回
                    </Button>
                  </Popconfirm>
                </Space>
              ) : null}

              {/* 管理员审核（医生已确认且管理员未审时显示，仅admin可见） */}
              {user?.role === "admin" && detail.ai_reviewed === 1 && detail.admin_reviewed === 0 ? (
                <Space>
                  <Popconfirm
                    title="确认通过此就诊记录？"
                    onConfirm={() => handleAdminReview(detail.id, "confirm")}
                  >
                    <Button type="primary" icon={<CheckOutlined />}>
                      审核通过
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title="驳回此就诊记录？"
                    onConfirm={() => handleAdminReview(detail.id, "reject")}
                  >
                    <Button danger icon={<CloseOutlined />}>
                      驳回
                    </Button>
                  </Popconfirm>
                </Space>
              ) : null}
            </Space>
          ) : null
        }
      >
        {detail && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="挂号时间">
                {detail.registration_time
                  ? new Date(detail.registration_time).toLocaleString("zh-CN")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="就诊日期">
                {new Date(detail.visit_date).toLocaleDateString("zh-CN")}
              </Descriptions.Item>
              <Descriptions.Item label="接诊医生">
                {detail.doctor_name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="诊室">
                {detail.room || <Text type="secondary">待分配</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="主诉症状">
                <Paragraph>{detail.symptoms}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="诊断结果">
                {detail.diagnosis || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="处方">
                {detail.prescription || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="备注">
                {detail.notes || "-"}
              </Descriptions.Item>
            </Descriptions>

            {/* AI 建议部分 */}
            {detail.ai_suggestion && (
              <Card
                title="AI 诊断建议"
                size="small"
                style={{ marginTop: 16 }}
                extra={
                  <Tag color={aiReviewLabels[detail.ai_reviewed]?.color}>
                    {aiReviewLabels[detail.ai_reviewed]?.text}
                  </Tag>
                }
              >
                <Paragraph>{detail.ai_suggestion}</Paragraph>
                {detail.ai_confidence && (
                  <Text type="secondary">
                    AI置信度: {(detail.ai_confidence * 100).toFixed(0)}%
                  </Text>
                )}
              </Card>
            )}

            {/* 管理员审核状态 */}
            {detail.ai_reviewed === 1 && (
              <Card
                title="审核状态"
                size="small"
                style={{ marginTop: 16 }}
                extra={
                  <Tag color={adminReviewLabels[detail.admin_reviewed]?.color}>
                    {adminReviewLabels[detail.admin_reviewed]?.text}
                  </Tag>
                }
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="医生审核">
                    <Tag color="green">已确认</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="管理员审核">
                    {detail.admin_reviewed === 0 ? (
                      <Tag>等待管理员审核</Tag>
                    ) : detail.admin_reviewed === 1 ? (
                      <Tag color="green">
                        已确认{detail.admin_name ? `（${detail.admin_name}）` : ""}
                      </Tag>
                    ) : (
                      <Tag color="red">
                        已驳回{detail.admin_name ? `（${detail.admin_name}）` : ""}
                      </Tag>
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* 相似病例 */}
            <Card
              title={
                <Space>
                  <ExperimentOutlined />
                  <span>相似病例</span>
                </Space>
              }
              size="small"
              style={{ marginTop: 16 }}
              loading={similarLoading}
            >
              {similarList.length === 0 ? (
                <Empty description="暂无相似病例" />
              ) : (
                similarList.map((s, i) => (
                  <Card
                    key={i}
                    type="inner"
                    size="small"
                    style={{ marginBottom: 8 }}
                    title={
                      <Space>
                        <span>{s.patient_name || s.patient_summary || "未知患者"}</span>
                        <Tag color="blue">
                          相似度: {((s.similarity_score || 0) * 100).toFixed(0)}%
                        </Tag>
                      </Space>
                    }
                  >
                    <Paragraph ellipsis={{ rows: 2 }}>
                      <Text type="secondary">症状：</Text>
                      {s.symptoms}
                    </Paragraph>
                    {s.diagnosis && (
                      <Text type="secondary">
                        诊断：{s.diagnosis}
                      </Text>
                    )}
                  </Card>
                ))
              )}
            </Card>
          </>
        )}
      </Drawer>

      {/* 管理员编辑弹窗 */}
      <Modal
        title="修改就诊记录"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEditSave}
      >
        <Form form={editForm} layout="vertical">
          {user?.role === "admin" && (
            <>
              <Form.Item name="room" label="诊室">
                <Input placeholder="分配诊室，如：内科诊室1" />
              </Form.Item>
              <Form.Item name="doctor_id" label="就诊医生">
                <Select
                  placeholder="选择接诊医生"
                  showSearch
                  options={doctors}
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </>
          )}
          <Form.Item name="symptoms" label="主诉症状">
            <Input.TextArea rows={2} placeholder="修改症状..." />
          </Form.Item>
          <Form.Item name="diagnosis" label="诊断结果">
            <Input.TextArea rows={3} placeholder="请输入诊断结果..." />
          </Form.Item>
          <Form.Item name="prescription" label="处方">
            <Input.TextArea rows={2} placeholder="处方..." />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="备注..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
