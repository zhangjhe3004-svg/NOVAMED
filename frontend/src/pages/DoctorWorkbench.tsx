/**
 * 医生工作台 —— 我的接诊(挂号) + 上级查看下级诊断记录(脱敏)
 */
import { useEffect, useState } from "react";
import { Table, Button, Typography, message, Modal, Input, Segmented, Tooltip } from "antd";
import { DownloadOutlined, CheckCircleOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { getMyAppointments, completeAppointment, getSeniorRecords } from "../api/appointment";
import type { DoctorAppointment, SeniorRecord } from "../api/appointment";
import { useAuth } from "../stores/auth";
import VoiceTextArea from "../components/VoiceTextArea";

const { Text } = Typography;

export default function DoctorWorkbench() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<DoctorAppointment[]>([]);
  const [senior, setSenior] = useState<SeniorRecord[]>([]);
  const [tab, setTab] = useState("appointments");
  const [finishId, setFinishId] = useState<number | null>(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [finishing, setFinishing] = useState(false);

  const loadAppts = async () => {
    try { const r = await getMyAppointments(); setAppts(r.items || []); } catch { /* 忽略 */ }
  };
  const loadSenior = async () => {
    try { const r = await getSeniorRecords(); setSenior(r.items || []); } catch { /* 忽略 */ }
  };
  useEffect(() => { loadAppts(); if (user?.role === "admin" || ["主治医师", "副主任医师", "主任医师"].includes(user?.title || "")) loadSenior(); }, []);

  const exportXlsx = (filename: string, header: string[], rows: any[][]) => {
    if (rows.length === 0) { message.warning("暂无可导出的数据"); return; }
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map((h) => ({ wch: Math.max(h.length * 2 + 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}.xlsx`);
    message.success(`已导出 ${rows.length} 条`);
  };

  const exportAppts = () => {
    exportXlsx(
      "我的接诊记录",
      ["患者", "电话", "科室", "日期", "时段", "症状", "状态"],
      appts.map((r) => [r.patient_name || "", r.phone || "", r.department || "", r.date || "", r.time_slot || "", r.symptoms || "", r.status || ""])
    );
  };

  const exportSenior = () => {
    exportXlsx(
      "下级诊断记录",
      ["记录ID", "医生", "职称", "症状", "诊断", "处方", "创建时间"],
      senior.map((r) => [r.record_id, r.doctor_name || "", r.doctor_title || "", r.symptoms || "", r.diagnosis || "", r.prescription || "", r.created_at || ""])
    );
  };

  const finish = (id: number) => { setDiagnosis(""); setFinishId(id); };
  const confirmFinish = async () => {
    if (finishId == null) return;
    setFinishing(true);
    try {
      const r = await completeAppointment(finishId, { diagnosis });
      if (r.ai_suggestion) {
        message.success(`已生成就诊记录，AI 提示最可能诊断：${r.ai_suggestion}${r.ai_confidence ? `（置信度 ${Math.round(r.ai_confidence * 100)}%）` : ""}`, 5);
      } else {
        message.success("已标记完成，并生成就诊记录", 3);
      }
      setFinishId(null);
      loadAppts();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "操作失败");
    } finally { setFinishing(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>医生工作台</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>我的接诊与下级诊断记录；完成接诊自动生成就诊记录。</div>
        </div>
        <button className="lv-btn" type="button" onClick={tab === "senior" ? exportSenior : exportAppts}><DownloadOutlined /> 导出表格</button>
      </div>

      <div className="lv-query">
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as string)}
          options={[
            { label: `我的接诊 (${appts.length})`, value: "appointments" },
            ...((user?.role === "admin" || ["主治医师", "副主任医师", "主任医师"].includes(user?.title || ""))
              ? [{ label: `下级诊断记录 (${senior.length})`, value: "senior" }]
              : []),
          ]}
        />
      </div>

      {tab === "appointments" ? (
        <div className="lv-panel">
          <div className="lv-panel-head">
            <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
            <span className="lv-panel-title">我的接诊</span>
            <span className="lv-panel-meta">共 {appts.length} 条</span>
          </div>
          <Table rowKey="id" size="middle" pagination={false} dataSource={appts}
            columns={[
              { title: "患者", dataIndex: "patient_name", render: (v: string) => <span style={{ fontWeight: 600, color: "var(--lv-ink)" }}>{v}</span> },
              { title: "电话", dataIndex: "phone", render: (v: string) => <span className="tnum">{v}</span> },
              { title: "科室", dataIndex: "department", width: 90 },
              { title: "日期/时段", width: 150, render: (_: any, r: any) => <span className="tnum">{`${r.date || ""} ${r.time_slot || ""}`}</span> },
              { title: "症状", dataIndex: "symptoms", ellipsis: true },
              { title: "状态", dataIndex: "status", width: 100, render: (v: string) =>
                v === "已完成"
                  ? <span className="lv-tag lv-tag--leaf"><span className="lv-tag-dot" />已完成</span>
                  : <span className="lv-tag lv-tag--amber"><span className="lv-tag-dot" />{v || "待接诊"}</span> },
              { title: "操作", width: 80, render: (_: any, r: any) => (
                <Tooltip title="完成接诊"><button className="icon-btn" data-act="finish" style={{ color: "#3f8a1e" }} onClick={() => finish(r.id)}><CheckCircleOutlined /></button></Tooltip>
              ) },
            ]} />
        </div>
      ) : (
        <div className="lv-panel">
          <div className="lv-panel-head">
            <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
            <span className="lv-panel-title">下级诊断记录</span>
            <span className="lv-panel-meta">共 {senior.length} 条</span>
          </div>
          <Table rowKey="record_id" size="middle" pagination={false} dataSource={senior}
            columns={[
              { title: "记录ID", dataIndex: "record_id", width: 90, render: (v: any) => <span className="tnum">{v}</span> },
              { title: "医生", width: 150, render: (_: any, r: any) => `${r.doctor_name || "-"} (${r.doctor_title || "-"})` },
              { title: "症状", dataIndex: "symptoms", ellipsis: true },
              { title: "诊断", dataIndex: "diagnosis", ellipsis: true },
              { title: "患者(脱敏)", width: 120, render: () => <Text type="secondary">患者 / ***</Text> },
            ]} />
        </div>
      )}

      <Modal
        title="完成接诊"
        open={finishId != null}
        onOk={confirmFinish}
        onCancel={() => setFinishId(null)}
        confirmLoading={finishing}
        okText="确认完成"
      >
        <Text type="secondary">
          将标记该挂号已完成，并自动生成一条就诊记录（管理员和医生都可在「就诊记录」中查看）。
        </Text>
        <VoiceTextArea
          rows={3}
          placeholder="诊断结论（选填，可事后再编辑）"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  );
}
