/**
 * 审核中心（仅管理员可见）
 * 板块统一为案例设计：页头 + 查询面板（待审核/已审核切换）+ 列表面板 + 案例式分页条 + 图标操作列。
 */
import { useEffect, useState } from "react";
import {
  Card, Table, Button, Space, Tag, Typography, message, Segmented,
  Popconfirm, Descriptions, Drawer, Empty, Tooltip,
} from "antd";
import {
  CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined, RollbackOutlined,
} from "@ant-design/icons";
import { listRecords, adminReviewRecord, getRecord, searchSimilar } from "../api/records";
import { listPatients } from "../api/patients";
import type { MedicalRecordInfo } from "../api/records";

const { Text, Paragraph } = Typography;

const adminReviewLabels: Record<number, { text: string; cls: string }> = {
  0: { text: "待审核", cls: "lv-tag--amber" },
  1: { text: "已通过", cls: "lv-tag--leaf" },
  2: { text: "已驳回", cls: "lv-tag--red" },
};

export default function AdminReview() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MedicalRecordInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"pending" | "done">("pending");
  const [patients, setPatients] = useState<Map<number, string>>(new Map());

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

  useEffect(() => { fetchData(); }, [page, activeTab]);

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
        setDetail({ ...detail!, admin_reviewed: action === "return" ? 0 : action === "confirm" ? 1 : 2 });
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
      const sim = await searchSimilar(r.id);
      setSimilarList(sim.results || []);
    } catch {
      message.error("加载详情失败");
    } finally {
      setSimilarLoading(false);
    }
  };

  const columns = [
    { key: "id", title: "ID", dataIndex: "id", width: 60, render: (v: number) => <span className="tnum">{v}</span> },
    { key: "patient", title: "患者", dataIndex: "patient_id", width: 90, render: (pid: number) => patients.get(pid) || `#${pid}` },
    { key: "symptoms", title: "症状", dataIndex: "symptoms", ellipsis: true, width: 200, render: (v: string) => <span style={{ maxWidth: 200, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span> },
    { key: "diagnosis", title: "诊断", dataIndex: "diagnosis", width: 120, ellipsis: true, render: (v: string) => v || "-" },
    { key: "registration_time", title: "挂号时间", dataIndex: "registration_time", width: 150, render: (d: string) => <span className="tnum">{d ? new Date(d).toLocaleString("zh-CN") : "-"}</span> },
    { key: "visit_date", title: "日期", dataIndex: "visit_date", width: 110, render: (d: string) => <span className="tnum">{new Date(d).toLocaleDateString("zh-CN")}</span> },
    { key: "doctor_name", title: "医生", dataIndex: "doctor_name", width: 90 },
    { key: "ai_suggestion", title: "AI建议", dataIndex: "ai_suggestion", width: 150, ellipsis: true, render: (v: string) => v ? <span style={{ maxWidth: 150, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span> : "-" },
    {
      key: "admin_reviewed", title: "审核状态", width: 100,
      render: (_: any, r: MedicalRecordInfo) => {
        const label = adminReviewLabels[r.admin_reviewed] || adminReviewLabels[0];
        return <span className={`lv-tag ${label.cls}`}><span className="lv-tag-dot" />{label.text}</span>;
      },
    },
    {
      key: "action", title: "操作", width: activeTab === "pending" ? 170 : 130, fixed: "right" as const, className: "col-actions",
      render: (_: any, r: MedicalRecordInfo) => (
        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="查看"><button className="icon-btn" data-act="view" onClick={() => handleView(r.id)}><EyeOutlined /></button></Tooltip>
          {activeTab === "pending" && (
            <>
              <Popconfirm title="确认通过此记录？" onConfirm={() => handleReview(r.id, "confirm")}>
                <Tooltip title="通过"><button className="icon-btn" data-act="approve" style={{ color: "#3f8a1e" }}><CheckOutlined /></button></Tooltip>
              </Popconfirm>
              <Popconfirm title="确认驳回此记录？" onConfirm={() => handleReview(r.id, "reject")}>
                <Tooltip title="驳回"><button className="icon-btn is-danger" data-act="reject"><CloseOutlined /></button></Tooltip>
              </Popconfirm>
            </>
          )}
          {activeTab === "done" && (
            <Popconfirm title="确定打回此记录？医生将收到审核意见" onConfirm={() => handleReview(r.id, "return")}>
              <Tooltip title="打回重审"><button className="icon-btn is-danger" data-act="return"><RollbackOutlined /></button></Tooltip>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>审核中心</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>审核医生的诊断结果，确保医疗质量。</div>
        </div>
      </div>

      {/* 查询面板：待审核/已审核切换 */}
      <div className="lv-query">
        <Segmented
          value={activeTab}
          onChange={(v) => { setActiveTab(v as "pending" | "done"); setPage(1); }}
          options={[{ label: "待审核", value: "pending" }, { label: "已审核", value: "done" }]}
        />
        <div className="lv-query-actions">
          <button className="lv-btn" type="button" onClick={fetchData}><ReloadOutlined /> 刷新</button>
        </div>
      </div>

      {/* 列表面板 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">{activeTab === "pending" ? "待审核记录" : "已审核记录"}</span>
          <span className="lv-panel-meta">共 {total} 条</span>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={false}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description={activeTab === "pending" ? "暂无待审核记录" : "暂无已审核记录"} /> }}
        />
        <div className="lv-pager">
          <span className="lv-pager-meta">共 {total} 条，当前 {total === 0 ? 0 : (page - 1) * 20 + 1}–{Math.min(page * 20, total)}</span>
          <div className="lv-pager-btns">
            <button className="icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
            <span className="tnum lv-pager-cur">{page} / {Math.max(1, Math.ceil(total / 20))}</span>
            <button className="icon-btn" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>›</button>
          </div>
        </div>
      </div>

      {/* 详情抽屉 */}
      <Drawer
        title="就诊记录详情"
        size={640}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          detail ? (
            <Space>
              {detail.admin_reviewed === 0 ? (
                <>
                  <Popconfirm title="确认通过此就诊记录？" onConfirm={() => handleReview(detail.id, "confirm")}>
                    <Button type="primary" className="lv-submit" icon={<CheckOutlined />}>通过</Button>
                  </Popconfirm>
                  <Popconfirm title="驳回此就诊记录？" onConfirm={() => handleReview(detail.id, "reject")}>
                    <Button danger icon={<CloseOutlined />}>驳回</Button>
                  </Popconfirm>
                </>
              ) : (
                <Popconfirm title="确定打回重审？此记录将退回待审核列表" onConfirm={() => handleReview(detail.id, "return")}>
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
              <Descriptions.Item label="就诊日期">{new Date(detail.visit_date).toLocaleDateString("zh-CN")}</Descriptions.Item>
              <Descriptions.Item label="患者">{patients.get(detail.patient_id) || `#${detail.patient_id}`}</Descriptions.Item>
              <Descriptions.Item label="接诊医生">{detail.doctor_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="主诉症状"><Paragraph>{detail.symptoms}</Paragraph></Descriptions.Item>
              <Descriptions.Item label="诊断结果">{detail.diagnosis || "-"}</Descriptions.Item>
              <Descriptions.Item label="处方">{detail.prescription || "-"}</Descriptions.Item>
              <Descriptions.Item label="备注">{detail.notes || "-"}</Descriptions.Item>
            </Descriptions>

            {detail.ai_suggestion && (
              <Card title="AI 诊断建议" size="small" style={{ marginTop: 16 }}
                extra={detail.ai_confidence ? (
                  <Tag color={detail.ai_confidence >= 0.7 ? "green" : detail.ai_confidence >= 0.5 ? "orange" : "red"}>
                    {(detail.ai_confidence * 100).toFixed(0)}%
                  </Tag>
                ) : null}>
                <Paragraph>{detail.ai_suggestion}</Paragraph>
              </Card>
            )}

            <Card title="审核状态" size="small" style={{ marginTop: 16 }}
              extra={<span className={`lv-tag ${adminReviewLabels[detail.admin_reviewed]?.cls}`}><span className="lv-tag-dot" />{adminReviewLabels[detail.admin_reviewed]?.text}</span>}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="医生审核">
                  {detail.ai_reviewed === 1 ? <Tag color="green">已确认</Tag> : detail.ai_reviewed === 2 ? <Tag color="red">已驳回</Tag> : <Tag>未审核</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="管理员审核">
                  {detail.admin_reviewed === 0 ? <Tag color="orange">等待审核</Tag>
                    : detail.admin_reviewed === 1 ? <Tag color="green">已通过{detail.admin_name ? `（${detail.admin_name}）` : ""}</Tag>
                    : <Tag color="red">已驳回{detail.admin_name ? `（${detail.admin_name}）` : ""}</Tag>}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="相似病例" size="small" style={{ marginTop: 16 }} loading={similarLoading}>
              {similarList.length === 0 ? (
                <Empty description="暂无相似病例" />
              ) : (
                similarList.map((s, i) => (
                  <Card key={i} type="inner" size="small" style={{ marginBottom: 8 }}
                    title={<Space><span>{s.patient_name || "未知患者"}</span><Tag color="blue">相似度: {((s.similarity_score || 0) * 100).toFixed(0)}%</Tag></Space>}>
                    <Paragraph ellipsis={{ rows: 2 }}><Text type="secondary">症状：</Text>{s.symptoms}</Paragraph>
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
