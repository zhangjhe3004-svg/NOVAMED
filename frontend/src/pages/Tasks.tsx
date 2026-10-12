/**
 * 定时任务 —— 任务 CRUD + 启停 + 立即执行
 * 板块统一为案例设计：页头 + 列表面板（●共N条）+ 图标操作列。
 */
import { useEffect, useState } from "react";
import {
  Table, Button, Input, Select, Typography, message, Modal, Form,
  Popconfirm, InputNumber, TimePicker, Tooltip,
} from "antd";
import {
  PlusOutlined, PlayCircleOutlined, DeleteOutlined,
  EditOutlined, ReloadOutlined, BellOutlined, PauseCircleOutlined, CaretRightOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listTasks, createTask, updateTask, toggleTask, runTaskNow, deleteTask,
  type ScheduledTask,
} from "../api/tasks";

const { Text } = Typography;

const TYPE_LABEL: Record<string, string> = {
  once: "指定时间", daily: "每天", weekly: "每周", interval: "固定间隔",
};
const WEEKDAY_LABEL = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export default function Tasks() {
  const [data, setData] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledTask | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const typeWatch = Form.useWatch("schedule_type", form);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listTasks();
      setData(r.items);
    } catch {
      message.error("加载任务失败");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ schedule_type: "daily", schedule_time: dayjs("09:00", "HH:mm"), interval_minutes: 60, weekdays: ["1", "2", "3", "4", "5"] });
    setOpen(true);
  };

  const openEdit = (t: ScheduledTask) => {
    setEditing(t);
    form.resetFields();
    form.setFieldsValue({
      ...t,
      schedule_time: t.schedule_time ? dayjs(t.schedule_time, "HH:mm") : dayjs("09:00", "HH:mm"),
      weekdays: t.weekdays ? t.weekdays.split(",") : [],
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const v = await form.validateFields();
    const payload: any = {
      name: v.name,
      schedule_type: v.schedule_type,
      schedule_time: v.schedule_time ? v.schedule_time.format("HH:mm") : "09:00",
      interval_minutes: v.interval_minutes || 60,
      weekdays: (v.weekdays || []).join(","),
      run_at: v.run_at ? v.run_at.format("YYYY-MM-DD HH:mm") : "",
      action: "notify",
      payload: v.payload || "",
      enabled: true,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateTask(editing.id, payload);
        message.success("任务已更新");
      } else {
        await createTask(payload);
        message.success("任务已创建");
      }
      setOpen(false);
      load();
    } catch {
      message.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const desc = (t: ScheduledTask) => {
    if (t.schedule_type === "interval") return `每 ${t.interval_minutes} 分钟`;
    if (t.schedule_type === "daily") return `每天 ${t.schedule_time}`;
    if (t.schedule_type === "once") return t.run_at || "一次性";
    if (t.schedule_type === "weekly") {
      const days = (t.weekdays || "").split(",").filter(Boolean).map((d) => WEEKDAY_LABEL[Number(d)] || d);
      return `${days.join("/")} ${t.schedule_time}`;
    }
    return "-";
  };

  const columns = [
    {
      title: "任务", dataIndex: "name",
      render: (v: string, r: ScheduledTask) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--lv-ink)" }}>{v}</div>
          {r.payload && <small style={{ fontSize: 11, color: "var(--lv-faint)", display: "block", marginTop: 3 }}>{r.payload}</small>}
        </div>
      ),
    },
    { title: "频率", width: 130, render: (_: any, r: ScheduledTask) => <span className="lv-tag lv-tag--neutral">{TYPE_LABEL[r.schedule_type] || r.schedule_type}</span> },
    { title: "计划", width: 180, render: (_: any, r: ScheduledTask) => <span className="tnum" style={{ fontSize: 12 }}>{desc(r)}</span> },
    { title: "状态", dataIndex: "enabled", width: 100, render: (v: boolean) =>
      v ? <span className="lv-tag lv-tag--leaf"><span className="lv-tag-dot" />运行中</span>
        : <span className="lv-tag lv-tag--gray"><span className="lv-tag-dot" />已暂停</span> },
    { title: "下次执行", dataIndex: "next_run", width: 140, render: (v: string) => <span className="tnum">{v ? dayjs(v).format("MM-DD HH:mm") : "-"}</span> },
    { title: "已执行", dataIndex: "run_count", width: 80, render: (v: number) => <span className="tnum">{v || 0}</span> },
    {
      title: "操作", key: "op", width: 150, fixed: "right" as const, className: "col-actions",
      render: (_: any, r: ScheduledTask) => (
        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="立即执行"><button className="icon-btn" data-act="run" onClick={async () => { await runTaskNow(r.id); message.success("已执行一次，请在消息中心查看提醒"); load(); }}><PlayCircleOutlined /></button></Tooltip>
          <Tooltip title={r.enabled ? "暂停" : "启用"}><button className="icon-btn" data-act="toggle" onClick={async () => { await toggleTask(r.id); message.success(r.enabled ? "已暂停" : "已启用"); load(); }}>{r.enabled ? <PauseCircleOutlined /> : <CaretRightOutlined />}</button></Tooltip>
          <Tooltip title="编辑"><button className="icon-btn" data-act="edit" onClick={() => openEdit(r)}><EditOutlined /></button></Tooltip>
          <Popconfirm title="删除该任务？" onConfirm={async () => { await deleteTask(r.id); message.success("已删除"); load(); }}>
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
          <div style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>定时任务</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>到点自动执行提醒，通知发送至消息中心。</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="lv-btn" type="button" onClick={load}><ReloadOutlined /> 刷新</button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="create" onClick={openCreate}><PlusOutlined /> 新建任务</button>
        </div>
      </div>

      {/* 列表面板 */}
      <div className="lv-panel">
        <div className="lv-panel-head">
          <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
          <span className="lv-panel-title">定时任务</span>
          <span className="lv-panel-meta">共 {data.length} 条</span>
          <div className="lv-panel-tools">
            <Tooltip title="刷新"><button className="icon-btn" data-act="refresh" onClick={load}><ReloadOutlined /></button></Tooltip>
          </div>
        </div>
        <Table rowKey="id" size="middle" loading={loading} dataSource={data} columns={columns} pagination={false} scroll={{ x: 900 }}
          locale={{ emptyText: "暂无定时任务，点击右上角新建" }} />
      </div>

      <Modal
        title={editing ? "编辑任务" : "新建定时任务"}
        open={open}
        onCancel={() => setOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" loading={saving} className="lv-submit" onClick={handleSave}>保存</Button>,
        ]}
        width={560}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" className="lv-form">
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
            <Input placeholder="如：早交班提醒" />
          </Form.Item>
          <Form.Item name="schedule_type" label="执行频率">
            <Select options={[
              { value: "daily", label: "每天" },
              { value: "weekly", label: "每周" },
              { value: "interval", label: "固定间隔" },
              { value: "once", label: "指定时间（一次）" },
            ]} />
          </Form.Item>
          {typeWatch === "interval" ? (
            <Form.Item name="interval_minutes" label="间隔分钟">
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          ) : (
            <Form.Item name="schedule_time" label="执行时间">
              <TimePicker format="HH:mm" style={{ width: "100%" }} />
            </Form.Item>
          )}
          {typeWatch === "weekly" && (
            <Form.Item name="weekdays" label="每周几">
              <Select mode="multiple" options={WEEKDAY_LABEL.slice(1).map((l, i) => ({ value: String(i + 1), label: l }))} />
            </Form.Item>
          )}
          {typeWatch === "once" && (
            <Form.Item name="run_at" label="执行时刻" rules={[{ required: true, message: "请选择执行时刻" }]}>
              <Select
                showSearch
                options={Array.from({ length: 24 * 4 }, (_, i) => {
                  const d = dayjs().startOf("day").add(i * 15, "minute");
                  return { value: d.format("YYYY-MM-DD HH:mm"), label: d.format("YYYY-MM-DD HH:mm") };
                })}
                placeholder="选择今天/近期的 15 分钟粒度时刻"
              />
            </Form.Item>
          )}
          <Form.Item name="payload" label="提醒内容">
            <Input.TextArea rows={3} placeholder="到点后将作为站内通知发送给您" />
          </Form.Item>
          <div style={{ fontSize: 11, color: "#91a5ae", lineHeight: 1.9, padding: "10px 14px", borderRadius: 8, background: "#f4f7fb" }}>
            <BellOutlined /> 任务由系统后台调度线程自动执行，到点发送站内通知；也可点击「执行」立即触发一次。
          </div>
        </Form>
      </Modal>
    </div>
  );
}
