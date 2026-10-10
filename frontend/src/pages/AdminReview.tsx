/**
 * 审核中心（仅管理员可见）
 *
 * 两个标签页：
 * - 待审核：admin_reviewed=0（管理员未审）
 * - 已审核：admin_reviewed=1 或 2
 */
import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  message,
  Tabs,
  Popconfirm,
  Descriptions,
  Drawer,
  Empty,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { listRecords, adminReviewRecord, getRecord, searchSimilar } from "../api/records";
import { listPatients } from "../api/patients";
import type { MedicalRecordInfo } from "../api/records";

const { Title, Text, Paragraph } = Typography;

const adminReviewLabels: Record<number, { text: string; color: string }> = {
  0: { text: "待审核", color: "orange" },
  1: { text: "已通过", color: "green" },
  2: { text: "已驳回", color: "red" },
};

export default function AdminReview() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MedicalRecordInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"pending" | "done">("pending");
  const [patients, setPatients] = useState<Map<number, string>>(new Map());

  // 详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<MedicalRecordInfo | null>(null);
  const [similarList, setSimilarList] = useState<any[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 20 };
      if (activeTab === "pending") {
        params.admin_reviewed = 0;
      } else {
        // 已审核：admin_reviewed 不为 0
        // 后端不支持 "!=0"，分两次请求合起来，或者直接用大 page_size 让前端过滤
        // 简单做法：传 admin_reviewed=1 和 admin_reviewed=2 分别请求
        const [approved, rejected] = await Promise.all([
          listRecords({ page, page_size: 10, admin_reviewed: 1 }),
          listRecords({ page, page_size: 10, admin_reviewed: 2 }),
        ]);
        const allItems = [...approved.items, ...rejected.items].sort(
          (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
        );
        setData(allItems);
        setTotal(approved.total + rejected.total);
        setLoading(false);
        return;
      }
      const res = await listRecords(params);
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error("加载审核列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, activeTab]);

  // 加载患者名称映射
  useEffect(() => {
    listPatients({ page: 1, page_size: 100 }).then((res) => {
      const map = new Map<number, string>();
      res.items.forEach((p: any) => map.set(p.id, p.name));
      setPatients(map);
    }).catch(() => {});
  }, []);

  const handleReview = async (recordId: number, action: "confirm" | "reject" | "return") => {
    try {
      const labels = { confirm: "已审核通过", reject: "已驳回", return: "已打回重审" };
      await adminReviewRecord(recordId, action);
      message.success(labels[action]);
      setData((prev) =>
        prev.map((r) =>
          r.id === recordId
            ? { ...r, admin_reviewed: action === "return" ? 0 : action === "confirm" ? 1 : 2 }
            : r
        )
      );
      if (detail?.id === recordId) {
        setDetail({
          ...detail!,
          admin_reviewed: action === "return" ? 0 : action === "confirm" ? 1 : 2,
        });
      }
      setTimeout(fetchData, 500);
    } catch {
      message.error("操作失败");
    }
  };

  const handleView = async (id: number) => {
    try {
      const r = await getRecord(id);
      setDetail(r);
      setSimilarList([]);
      setDrawerOpen(true);

      setSimilarLoading(true);
      const sim = await searchSimilar(r.symptoms);
      setSimilarList(sim.results || []);
    } catch {
      message.error("加载详情失败");
    } finally {
      setSimilarLoading(false);
    }
  };

  const columns = [
    { key: "id", title: "ID", dataIndex: "id", width: 60 },
    {
      key: "patient",
      title: "患者",
      dataIndex: "patient_id",
      width: 80,
      render: (pid: number) => patients.get(pid) || `#${pid}`,
    },
    {
      key: "symptoms",
      title: "症状",
      dataIndex: "symptoms",
      ellipsis: true,
      width: 200,
      render: (v: string) => (
        <Text ellipsis style={{ maxWidth: 200 }}>{v}</Text>
      ),
    },
    {
      key: "diagnosis",
      title: "诊断",
      dataIndex: "diagnosis",
      width: 120,
      ellipsis: true,
      render: (v: string) => v || "-",
    },
    {
      key: "registration_time",
      title: "挂号时间",
      dataIndex: "registration_time",
      width: 140,
      sorter: true,
      defaultSortOrder: "descend" as const,
      render: (d: string) => d ? new Date(d).toLocaleString("zh-CN") : "-",
    },
    {
      key: "visit_date",
      title: "日期",
      dataIndex: "visit_date",
      width: 110,
      render: (d: string) => new Date(d).toLocaleDateString("zh-CN"),
    },
    {
      key: "doctor_name",
      title: "医生",
      dataIndex: "doctor_name",
      width: 80,
    },
    {
      key: "ai_suggestion",
      title: "AI建议",
      dataIndex: "ai_suggestion",
      width: 150,
      ellipsis: true,
      render: (v: string) => v ? <Text ellipsis style={{ maxWidth: 150 }}>{v}</Text> : "-",
    },
    {
      key: "ai_confidence",
      title: "置信度",
      dataIndex: "ai_confidence",
      width: 70,
      render: (v: number) =>
        v ? (
          <Tag color={v >= 0.7 ? "green" : v >= 0.5 ? "orange" : "red"}>
            {(v * 100).toFixed(0)}%
          </Tag>
        ) : "-",
    },
    {
      key: "admin_reviewed",
      title: "审核状态",
      width: 100,
      render: (_: any, r: MedicalRecordInfo) => {
        const label = adminReviewLabels[r.admin_reviewed] || adminReviewLabels[0];
        return <Tag color={label.color}>{label.text}</Tag>;
      },
    },
    {
      key: "action",
      title: "操作",
      width: activeTab === "pending" ? 200 : 140,
      render: (_: any, r: MedicalRecordInfo) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(r.id)}
          >
            查看
          </Button>
          {activeTab === "pending" && (
            <>
              <Popconfirm
                title="确认通过此记录？"
                onConfirm={() => handleReview(r.id, "confirm")}
              >
                <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: "#52c41a" }}>
                  通过
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认驳回此记录？"
                onConfirm={() => handleReview(r.id, "reject")}
              >
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  驳回
                </Button>
              </Popconfirm>
            </>
          )}
          {activeTab === "done" && (
            <Popconfirm
              title="确定打回此记录？医生将收到审核意见"
              onConfirm={() => handleReview(r.id, "return")}
            >
              <Button type="link" size="small" danger icon={<CloseOutlined />}>
                打回
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: "linear-gradient(135deg, #722ed1, #1677ff)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(108,71,255,0.2)",
        }}>
          <SafetyCertificateOutlined style={{ fontSize: 24, color: "#fff" }} />
        </div>
        <div>
          <Title level={4} style={{ margin: 0 }}>审核中心</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            审核医生的诊断结果，确保医疗质量
          </Text>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key as "pending" | "done"); setPage(1); }}
        items={[
          {
            key: "pending",
            label: `待审核`,
            children: (
              <Table
                rowKey="id"
                columns={columns}
                dataSource={data}
                loading={loading}
                pagination={{
                  current: page,
                  total,
                  pageSize: 20,
                  showTotal: (t) => `共 ${t} 条待审核`,
                  onChange: (p) => setPage(p),
                }}
                locale={{ emptyText: <Empty description="暂无待审核记录" /> }}
              />
            ),
          },
          {
            key: "done",
            label: `已审核`,
            children: (
              <Table
                rowKey="id"
                columns={columns.filter((c) => c.key !== "操作" || activeTab === "pending")}
                dataSource={data}
                loading={loading}
                pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
                locale={{ emptyText: <Empty description="暂无已审核记录" /> }}
              />
            ),
          },
        ]}
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
              {detail.admin_reviewed === 0 ? (
                <>
                  <Popconfirm
                    title="确认通过此就诊记录？"
                    onConfirm={() => handleReview(detail.id, "confirm")}
                  >
                    <Button type="primary" icon={<CheckOutlined />}>通过</Button>
                  </Popconfirm>
                  <Popconfirm
                    title="驳回此就诊记录？"
                    onConfirm={() => handleReview(detail.id, "reject")}
                  >
                    <Button danger icon={<CloseOutlined />}>驳回</Button>
                  </Popconfirm>
                </>
              ) : (
                <Popconfirm
                  title="确定打回重审？此记录将退回待审核列表"
                  onConfirm={() => handleReview(detail.id, "return")}
                >
                  <Button danger icon={<CloseOutlined />}>打回重审</Button>
                </Popconfirm>
              )}
            </Space>
          ) : null
        }
      >
        {detail && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="就诊日期">
                {new Date(detail.visit_date).toLocaleDateString("zh-CN")}
              </Descriptions.Item>
              <Descriptions.Item label="患者">
                {patients.get(detail.patient_id) || `#${detail.patient_id}`}
              </Descriptions.Item>
              <Descriptions.Item label="接诊医生">
                {detail.doctor_name || "-"}
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

            {detail.ai_suggestion && (
              <Card
                title="AI 诊断建议"
                size="small"
                style={{ marginTop: 16 }}
                extra={
                  detail.ai_confidence ? (
                    <Tag color={detail.ai_confidence >= 0.7 ? "green" : detail.ai_confidence >= 0.5 ? "orange" : "red"}>
                      {(detail.ai_confidence * 100).toFixed(0)}%
                    </Tag>
                  ) : null
                }
              >
                <Paragraph>{detail.ai_suggestion}</Paragraph>
              </Card>
            )}

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
                  {detail.ai_reviewed === 1 ? (
                    <Tag color="green">已确认</Tag>
                  ) : detail.ai_reviewed === 2 ? (
                    <Tag color="red">已驳回</Tag>
                  ) : (
                    <Tag>未审核</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="管理员审核">
                  {detail.admin_reviewed === 0 ? (
                    <Tag color="orange">等待审核</Tag>
                  ) : detail.admin_reviewed === 1 ? (
                    <Tag color="green">
                      已通过{detail.admin_name ? `（${detail.admin_name}）` : ""}
                    </Tag>
                  ) : (
                    <Tag color="red">
                      已驳回{detail.admin_name ? `（${detail.admin_name}）` : ""}
                    </Tag>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              title="相似病例"
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
                        <span>{s.patient_name || "未知患者"}</span>
                        <Tag color="blue">
                          相似度: {((s.similarity_score || 0) * 100).toFixed(0)}%
                        </Tag>
                      </Space>
                    }
                  >
                    <Paragraph ellipsis={{ rows: 2 }}>
                      <Text type="secondary">症状：</Text>{s.symptoms}
                    </Paragraph>
                    {s.diagnosis && <Text type="secondary">诊断：{s.diagnosis}</Text>}
                  </Card>
                ))
              )}
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
}
