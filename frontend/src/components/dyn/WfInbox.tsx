/**
 * 业务工作流收件箱区块 —— 列出待办/相关审批，支持 同意/驳回
 * 用于：/lcp/staff-leave 页的 wf_inbox 区块、低代码工作台「工作流」页
 */
import { useEffect, useMemo, useState } from "react";
import { Card, List, Button, Tag, Typography, Space, message, Popconfirm, Segmented, Empty } from "antd";
import { CheckOutlined, CloseOutlined, ReloadOutlined } from "@ant-design/icons";
import { actInstance, listInstances } from "../../api/wf";
import type { WfInstance } from "../../api/wf";
import { useAuth } from "../../stores/auth";

const { Text } = Typography;

const stateTag: Record<string, { text: string; color: string }> = {
  pending: { text: "审批中", color: "orange" },
  done: { text: "已批准", color: "green" },
  rejected: { text: "已驳回", color: "red" },
  cancelled: { text: "已撤销", color: "default" },
};

export default function WfInbox({ mode = "pending", title }: { mode?: "related" | "pending" | "all"; title?: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WfInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [m, setM] = useState<"related" | "pending" | "all">(mode);

  const load = async (mm = m) => {
    setLoading(true);
    try {
      const r = await listInstances(mm);
      setItems(r.items);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载工作流失败");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const act = async (id: number, action: "approve" | "reject") => {
    try {
      await actInstance(id, action);
      message.success(action === "approve" ? "已同意" : "已驳回");
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "操作失败");
    }
  };

  const canActOn = useMemo(
    () => (inst: WfInstance) =>
      inst.state === "pending" && (inst.assignee_ids.includes(user?.id || 0) || user?.role === "admin"),
    [user]
  );

  return (
    <Card
      title={title || "审批工作台"}
      extra={
        <Space>
          <Segmented
            options={[
              { label: "待我审批", value: "pending" },
              { label: "与我相关", value: "related" },
              { label: "全部", value: "all" },
            ]}
            value={m}
            onChange={(v) => { setM(v as any); load(v as any); }}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={() => load()} />
        </Space>
      }
      loading={loading}
    >
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无流程" style={{ padding: 16 }} />
      ) : (
        <List
          size="small"
          dataSource={items}
          renderItem={(inst) => {
            const tag = stateTag[inst.state] || { text: inst.state, color: "default" };
            return (
              <List.Item
                actions={
                  inst.state === "pending" && canActOn(inst)
                    ? [
                        <Popconfirm key="ok" title="确认同意？" onConfirm={() => act(inst.id, "approve")}>
                          <Button size="small" type="primary" icon={<CheckOutlined />}>同意</Button>
                        </Popconfirm>,
                        <Popconfirm key="no" title="确认驳回？" onConfirm={() => act(inst.id, "reject")}>
                          <Button size="small" danger icon={<CloseOutlined />}>驳回</Button>
                        </Popconfirm>,
                      ]
                    : []
                }
              >
                <List.Item.Meta
                  title={
                    <Space size={6} wrap>
                      <Text strong>{inst.title || `#${inst.id}`}</Text>
                      <Tag color={tag.color}>{tag.text}</Tag>
                      {inst.node_name && <Tag>{inst.node_name}</Tag>}
                    </Space>
                  }
                  description={
                    <Space size={12} wrap>
                      <Text type="secondary">发起人：{inst.created_by_name || "-"}</Text>
                      <Text type="secondary">提交：{inst.created_at ? new Date(inst.created_at).toLocaleString("zh-CN") : "-"}</Text>
                      {inst.history && inst.history.length > 0 && (
                        <Text type="secondary" ellipsis style={{ maxWidth: 320 }}>
                          最近：{inst.history[inst.history.length - 1]?.by} · {inst.history[inst.history.length - 1]?.note || inst.history[inst.history.length - 1]?.action}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}
