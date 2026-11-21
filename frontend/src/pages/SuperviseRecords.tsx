/**
 * 下级审阅 —— 只有被上级「分配」后的下级医生才会出现在左侧列表，
 * 其就诊记录才可被上级审阅（后端 /api/supervision 强校验）。
 */
import { useEffect, useMemo, useState } from "react";
import { Table, Button, Input, message, Tag, Empty, Spin, Modal, Form, Popconfirm, List } from "antd";
import {
  CheckOutlined,
  DownloadOutlined,
  MessageOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import api from "../api/client";
import { sendMessage } from "../api/messages";
import {
  listAssignees, listCandidates, assignSubordinate, unassignSubordinate, listSubordinateRecords,
} from "../api/supervision";
import type { AssigneeItem, CandidateItem } from "../api/supervision";
import VoiceTextArea from "../components/VoiceTextArea";

const { TextArea } = Input;

export default function SuperviseRecords() {
  const [assignees, setAssignees] = useState<AssigneeItem[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [segFilter, setSegFilter] = useState("待审阅");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAction, setReviewAction] = useState("同意");
  const [exporting, setExporting] = useState(false);

  // 分配下级弹窗
  const [assignOpen, setAssignOpen] = useState(false);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateKeyword, setCandidateKeyword] = useState("");
  const [assignBusyId, setAssignBusyId] = useState<number | null>(null);

  // 发消息
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgSending, setMsgSending] = useState(false);
  const [msgForm] = Form.useForm();

  const flatten = (rows: any[]) =>
    (rows || []).map((x: any) => ({
      ...x,
      patient_name: x.patient?.name || "",
      patient_phone: x.patient?.phone || "",
      patient_id_card: x.patient?.id_card || "",
      visit_date: x.visit_date || x.created_at,
    }));

  const load = async () => {
    setLoading(true);
    try {
      const [a, r] = await Promise.all([listAssignees(), listSubordinateRecords()]);
      setAssignees(a.items || []);
      const rows = flatten(r.items || []);
      setItems(rows);
      return rows;
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载下级审阅数据失败");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // 默认选中第一位下级；取消分配后回退
  useEffect(() => {
    if (assignees.length && !assignees.some((d) => d.id === selectedDoctorId)) {
      setSelectedDoctorId(assignees[0].id);
    }
    if (assignees.length === 0) setSelectedDoctorId(null);
  }, [assignees]);

  const selectedDoctor = assignees.find((d) => d.id === selectedDoctorId) || null;

  /* ---------------- 分配下级 ---------------- */

  const openAssign = async () => {
    setAssignOpen(true);
    setCandidateLoading(true);
    try {
      const res = await listCandidates();
      setCandidates(res.items || []);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载可分配员工失败");
    } finally {
      setCandidateLoading(false);
    }
  };

  const doAssign = async (u: CandidateItem) => {
    setAssignBusyId(u.id);
    try {
      await assignSubordinate(u.id);
      message.success(`已将 ${u.real_name} 分配为你的下级`);
      const res = await listCandidates(candidateKeyword.trim() || undefined);
      setCandidates(res.items || []);
      const a = await listAssignees();
      setAssignees(a.items || []);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "分配失败");
    } finally {
      setAssignBusyId(null);
    }
  };

  const doUnassign = async (u: CandidateItem) => {
    setAssignBusyId(u.id);
    try {
      await unassignSubordinate(u.id);
      message.success(`已取消分配 ${u.real_name}`);
      const res = await listCandidates(candidateKeyword.trim() || undefined);
      setCandidates(res.items || []);
      const a = await listAssignees();
      setAssignees(a.items || []);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "取消分配失败");
    } finally {
      setAssignBusyId(null);
    }
  };

  /* ---------------- 审阅 ---------------- */

  const submitReview = async () => {
    if (!detail) return;
    if (!reviewComment.trim()) {
      message.warning("请输入审阅意见");
      return;
    }
    const approved = reviewAction === "同意";
    try {
      // 写入真实审核记录（含审计留痕的评论）
      await api.post(`/records/${detail.record_id}/review`, {
        kind: "admin",
        admin_reviewed: approved ? 1 : 2,
        comment: `上级审阅（${reviewAction}）：${reviewComment}`,
      });
      // 通知下级医生
      if (detail.doctor_id) {
        await sendMessage({
          receiver_id: detail.doctor_id,
          title: `就诊记录 #${detail.record_id} 审阅意见（${reviewAction}）`,
          content: reviewComment,
        }).catch(() => {});
      }
      message.success(
        `审阅意见已提交：${reviewAction}${detail.doctor_id ? "，已通知下级医生" : ""}`
      );
      setReviewComment("");
      const rows = await load();
      const updated = rows.find((x: any) => x.record_id === detail.record_id);
      setDetail(updated || null);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "提交失败");
    }
  };

  const openMessage = () => {
    if (!detail) return;
    msgForm.setFieldsValue({
      receiver: detail.doctor_name,
      content: reviewComment.trim() || `关于就诊记录 #${detail.record_id} 的审阅意见，请查收。`,
    });
    setMsgOpen(true);
  };

  const submitMessage = async (values: any) => {
    if (!detail?.doctor_id) {
      message.warning("无法确定下级医生账号，无法发送消息");
      return;
    }
    setMsgSending(true);
    try {
      await sendMessage({
        receiver_id: detail.doctor_id,
        title: `就诊记录 #${detail.record_id} 沟通`,
        content: values.content,
      });
      message.success(`已发送给 ${detail.doctor_name}`);
      setMsgOpen(false);
      msgForm.resetFields();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "发送失败");
    } finally {
      setMsgSending(false);
    }
  };

  // 只有已分配下级的记录会出现；再按选中医生 + 审阅状态过滤
  const filteredItems = items.filter((item) => {
    if (selectedDoctorId && item.doctor_id !== selectedDoctorId) return false;
    if (segFilter === "待审阅") return !item.admin_reviewed;
    if (segFilter === "已审阅") return !!item.admin_reviewed;
    return true;
  });

  const totalPending = useMemo(
    () => assignees.reduce((a, d) => a + d.pending_count, 0),
    [assignees]
  );

  // 导出审阅报告（当前医生列表的已加载记录 → 带 BOM 的 CSV）
  const handleExport = () => {
    if (filteredItems.length === 0) {
      message.warning("没有可导出的审阅记录");
      return;
    }
    try {
      setExporting(true);
      const header = ["记录ID", "患者", "就诊时间", "症状", "诊断", "处方", "医生", "职称"];
      const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = filteredItems.map((r) => [
        r.record_id,
        r.patient_name,
        r.visit_date ? new Date(r.visit_date).toLocaleDateString("zh-CN") : "-",
        r.symptoms, r.diagnosis, r.prescription, r.doctor_name, r.doctor_title,
      ].map(esc).join(","));
      const csv = "\uFEFF" + header.map(esc).join(",") + "\n" + rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `审阅报告_${selectedDoctor?.real_name || "全部下级"}_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`已导出 ${filteredItems.length} 条审阅记录`);
    } catch {
      message.error("导出失败");
    } finally {
      setExporting(false);
    }
  };

  const visibleCandidates = candidates.filter((c) => {
    const kw = candidateKeyword.trim();
    if (!kw) return true;
    return (
      (c.real_name || "").includes(kw) ||
      (c.username || "").includes(kw) ||
      (c.department || "").includes(kw)
    );
  });

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>下级审阅</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>只有由你分配后的下级医生才会出现在列表中；核对诊断与处方并给出意见。</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span className="lv-tag lv-tag--neutral"><TeamOutlined /> 已分配 {assignees.length} 名 · 待审阅 {totalPending} 份</span>
          <button className="lv-btn lv-btn--primary" type="button" onClick={openAssign}><UserAddOutlined /> 分配下级</button>
          <button className="lv-btn" type="button" onClick={handleExport}><DownloadOutlined /> 导出审阅报告</button>
        </div>
      </div>

      {/* 主内容区：左侧医生列表 + 右侧记录 */}
      <div style={{ display: "grid", gridTemplateColumns: "250px minmax(0, 1fr)", gap: "21px" }}>
        {/* 左侧：下级医生列表（仅已分配） */}
        <aside className="panel">
          <div className="panel-head">
            <div>
              <h2>下级医生</h2>
              <small>仅显示已分配给你的下级</small>
            </div>
          </div>
          <div className="side-list">
            {assignees.length === 0 ? (
              <div style={{ padding: "18px 16px" }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ fontSize: 11 }}>
                      尚未分配下级医生
                      <br />点击右上角「分配下级」开始
                    </span>
                  }
                />
              </div>
            ) : (
              assignees.map((doc) => (
                <button
                  key={doc.id}
                  className={selectedDoctorId === doc.id ? "selected" : ""}
                  onClick={() => setSelectedDoctorId(doc.id)}
                >
                  <span className="avatar teal">{doc.real_name[0]}</span>
                  <span className="name">
                    <b>{doc.real_name}</b>
                    <small>{doc.title || doc.role} · {doc.department || "未分配科室"}</small>
                  </span>
                  <span className={`cnt ${doc.pending_count > 0 ? "hot" : ""}`}>{doc.pending_count}</span>
                </button>
              ))
            )}
            <div className="summary">
              <span>共 {items.length} 份下级记录 · 待审阅 {totalPending} 份</span>
            </div>
          </div>
        </aside>

        {/* 右侧：记录列表 + 详情 */}
        <div className="stack">
          {/* 记录列表 */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>{selectedDoctor ? `${selectedDoctor.real_name} · 审阅记录` : "全部下级 · 审阅记录"}</h2>
                <small>仅包含已分配下级医生的就诊记录（患者信息已脱敏）</small>
              </div>
              <div className="segmented">
                {["待审阅", "已审阅", "全部"].map((s) => (
                  <button key={s} className={segFilter === s ? "selected" : ""} onClick={() => setSegFilter(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              {loading ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Spin />
                </div>
              ) : assignees.length === 0 ? (
                <Empty description="尚未分配下级医生，分配后其就诊记录会出现在这里" />
              ) : filteredItems.length === 0 ? (
                <Empty description="暂无符合筛选条件的审阅记录" />
              ) : (
                <Table
                  rowKey="record_id"
                  dataSource={filteredItems}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: "患者",
                      dataIndex: "patient_name",
                      width: 120,
                      render: (name: string, r: any) => (
                        <div className="person">
                          <span className="avatar sq">{name?.[0] || "患"}</span>
                          <span>{name}<small>记录#{r.record_id}</small></span>
                        </div>
                      ),
                    },
                    {
                      title: "就诊时间",
                      dataIndex: "visit_date",
                      width: 110,
                      render: (d: string) => <span className="muted">{d ? new Date(d).toLocaleDateString("zh-CN") : "-"}</span>,
                    },
                    { title: "症状", dataIndex: "symptoms", ellipsis: true },
                    { title: "诊断", dataIndex: "diagnosis", ellipsis: true },
                    { title: "处方", dataIndex: "prescription", ellipsis: true },
                    { title: "医生", dataIndex: "doctor_name", width: 90 },
                    { title: "职称", dataIndex: "doctor_title", width: 100 },
                    {
                      title: "操作",
                      width: 80,
                      render: (_: any, r: any) => (
                        <a className="row-link" onClick={() => setDetail(r)}>查看</a>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </section>

          {/* 详情 + 审阅意见 */}
          {detail && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "21px" }}>
              {/* 记录详情 */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>记录详情</h2>
                    <small>{detail.patient_name} · {detail.visit_date ? new Date(detail.visit_date).toLocaleDateString("zh-CN") : "-"}</small>
                  </div>
                  <span className="badge amber">{detail.admin_reviewed ? "已审阅" : "待审阅"}</span>
                </div>
                <div className="panel-body">
                  <dl className="kv" style={{ gridTemplateColumns: "auto 1fr auto 1fr" }}>
                    <dt>患者姓名</dt>
                    <dd>{detail.patient_name}</dd>
                    <dt>手机号</dt>
                    <dd>{detail.patient_phone || "-"}</dd>
                    <dt>身份证号</dt>
                    <dd>{detail.patient_id_card || "-"}</dd>
                    <dt>接诊医生</dt>
                    <dd>{detail.doctor_name}</dd>
                  </dl>
                  <div className="field" style={{ marginTop: 16 }}>
                    <label>症状</label>
                    <div className="sub">{detail.symptoms || "-"}</div>
                  </div>
                  <div className="field">
                    <label>诊断</label>
                    <div className="sub">{detail.diagnosis || "-"}</div>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>处方</label>
                    <div className="sub">{detail.prescription || "-"}</div>
                  </div>
                </div>
              </section>

              {/* 审阅意见 */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>审阅意见</h2>
                    <small>意见将通知下级医生并记录在审计日志</small>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="field">
                    <label>审阅结论</label>
                    <div className="segmented">
                      {["同意", "建议修订", "需讨论"].map((s) => (
                        <button key={s} className={reviewAction === s ? "selected" : ""} onClick={() => setReviewAction(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label>意见</label>
                    <VoiceTextArea
                      rows={4}
                      placeholder="例如：建议补充糖化血红蛋白检查，并评估肾功能后调整用药…"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    />
                  </div>
                  <div className="actions" style={{ justifyContent: "stretch" }}>
                    <Button icon={<MessageOutlined />} style={{ flex: 1 }} onClick={openMessage}>发消息</Button>
                    <Button type="primary" icon={<CheckOutlined />} onClick={submitReview} style={{ flex: 1 }}>
                      提交审阅
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* 分配下级弹窗 */}
      <Modal
        title="分配下级医生"
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        footer={null}
        width={620}
      >
        <div style={{ marginBottom: 12 }}>
          <Input
            placeholder="搜索姓名 / 账号 / 科室"
            prefix={<SearchOutlined style={{ color: "var(--muted)" }} />}
            allowClear
            value={candidateKeyword}
            onChange={(e) => setCandidateKeyword(e.target.value)}
          />
        </div>
        {candidateLoading ? (
          <div style={{ textAlign: "center", padding: 30 }}><Spin /></div>
        ) : (
          <List
            style={{ maxHeight: 420, overflowY: "auto" }}
            dataSource={visibleCandidates}
            locale={{ emptyText: "没有匹配的在职员工" }}
            renderItem={(u) => (
              <List.Item
                actions={[
                  u.assigned_to_me ? (
                    <Popconfirm
                      key="unassign"
                      title="取消分配后，该医生的记录将不再出现在你的审阅列表，确定？"
                      onConfirm={() => doUnassign(u)}
                    >
                      <Button size="small" danger icon={<UserDeleteOutlined />} loading={assignBusyId === u.id}>
                        取消分配
                      </Button>
                    </Popconfirm>
                  ) : (
                    <Button
                      key="assign"
                      size="small"
                      type="primary"
                      icon={<UserAddOutlined />}
                      loading={assignBusyId === u.id}
                      onClick={() => doAssign(u)}
                    >
                      分配
                    </Button>
                  ),
                ]}
              >
                <List.Item.Meta
                  title={
                    <span style={{ fontSize: 13 }}>
                      {u.real_name}
                      <span style={{ fontSize: 11, color: "#8190a4", marginLeft: 8 }}>
                        {u.title || u.role} · {u.department || "未分配科室"}
                      </span>
                    </span>
                  }
                  description={
                    u.assigned_to_me ? (
                      <Tag color="green" style={{ marginRight: 0 }}>已分配给我 · 待审阅 {u.pending_count} 份</Tag>
                    ) : u.superior_name ? (
                      <Tag color="orange" style={{ marginRight: 0 }}>已归属其他上级：{u.superior_name}</Tag>
                    ) : (
                      <Tag style={{ marginRight: 0 }}>未分配</Tag>
                    )
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>

      {/* 发消息给下级医生 */}
      <Modal
        title={`发消息给 ${detail?.doctor_name || "下级医生"}`}
        open={msgOpen}
        onCancel={() => setMsgOpen(false)}
        onOk={() => msgForm.submit()}
        confirmLoading={msgSending}
        okText="发送"
      >
        <Form form={msgForm} layout="vertical" onFinish={submitMessage}>
          <Form.Item name="receiver" label="接收人">
            <Input disabled />
          </Form.Item>
          <Form.Item name="content" label="消息内容" rules={[{ required: true, message: "请输入消息内容" }]}>
            <VoiceTextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
