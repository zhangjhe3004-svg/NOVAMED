/**
 * 医生工作台 —— 我的接诊(挂号) + 上级查看下级诊断记录(脱敏)
 */
import { useEffect, useState } from "react";
import { Card, Tabs, Table, Button, Space, Tag, Typography, message, Modal, Input } from "antd";
import { getMyAppointments, completeAppointment, getSeniorRecords } from "../api/appointment";
import type { DoctorAppointment, SeniorRecord } from "../api/appointment";
import { useAuth } from "../stores/auth";

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
    <div>
      <Card title="医生工作台" bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          tabBarStyle={{ padding: "0 16px", margin: 0 }}
          items={[
            {
              key: "appointments",
              label: `我的接诊 (${appts.length})`,
              children: (
                <Table rowKey="id" size="small" pagination={false} dataSource={appts}
                  columns={[
                    { title: "患者", dataIndex: "patient_name" },
                    { title: "电话", dataIndex: "phone" },
                    { title: "科室", dataIndex: "department", width: 90 },
                    { title: "日期/时段", width: 150, render: (_: any, r: any) => `${r.date || ""} ${r.time_slot || ""}` },
                    { title: "症状", dataIndex: "symptoms", ellipsis: true },
                    { title: "状态", dataIndex: "status", width: 90, render: (v: string) => <Tag color={v === "已完成" ? "green" : "orange"}>{v}</Tag> },
                    { title: "操作", width: 90, render: (_: any, r: any) => <Button size="small" type="primary" onClick={() => finish(r.id)}>完成</Button> },
                  ]} />
              ),
            },
            ...((user?.role === "admin" || ["主治医师", "副主任医师", "主任医师"].includes(user?.title || "")) ? [{
              key: "senior",
              label: `下级诊断记录 (${senior.length})`,
              children: (
                <Table rowKey="record_id" size="small" pagination={false} dataSource={senior}
                  columns={[
                    { title: "记录ID", dataIndex: "record_id", width: 80 },
                    { title: "医生", width: 130, render: (_: any, r: any) => `${r.doctor_name || "-"} (${r.doctor_title || "-"})` },
                    { title: "症状", dataIndex: "symptoms", ellipsis: true },
                    { title: "诊断", dataIndex: "diagnosis", ellipsis: true },
                    { title: "患者(脱敏)", width: 120, render: () => <Text type="secondary">患者 / ***</Text> },
                  ]} />
              ),
            }] : []),
          ]}
        />
      </Card>

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
        <Input.TextArea
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
