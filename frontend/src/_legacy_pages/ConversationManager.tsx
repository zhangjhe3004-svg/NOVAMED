/**
 * 会话管理 — 参考「暴喵AI管家」截图。
 * 数据来自后端 /api/conversations；删除为永久删除。
 */
import { useState, useEffect } from "react";
import { Card, Input, Space, Tag, Typography, Button, List, message, Empty } from "antd";
import { SearchOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { listConversations, getConversation, deleteConversation } from "../api/conversation";
import type { ConversationItem, ConversationDetail } from "../api/conversation";

const { Title, Text } = Typography;

export default function ConversationManager() {
  const [convs, setConvs] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadList = async (selectId?: number) => {
    setLoading(true);
    try {
      const res = await listConversations();
      setConvs(res.items || []);
      const targetId = selectId ?? res.items?.[0]?.id ?? null;
      if (targetId) {
        setActiveId(targetId);
        const d = await getConversation(targetId);
        setDetail(d);
      } else {
        setActiveId(null);
        setDetail(null);
      }
    } catch {
      message.error("加载会话失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const select = async (id: number) => {
    setActiveId(id);
    try {
      const d = await getConversation(id);
      setDetail(d);
    } catch {
      message.error("加载会话详情失败");
    }
  };

  const deleteActive = async () => {
    if (!activeId) return;
    setDeleteLoading(true);
    try {
      await deleteConversation(activeId);
      message.success("会话已永久删除");
      await loadList();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "删除失败");
    } finally {
      setDeleteLoading(false);
    }
  };

  const list = convs.filter((c) => c.title.toLowerCase().includes(keyword.toLowerCase()));

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>会话管理</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>所有 Agent 会话，搜索与管理历史会话；删除为永久删除</Text>
      </div>

      <div style={{ display: "flex", gap: 16, height: 560 }}>
        {/* 左侧：会话列表 */}
        <Card size="small" style={{ width: 300, flexShrink: 0 }} bodyStyle={{ padding: 0 }} loading={loading}>
          <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Text strong>会话列表</Text>
            <Space>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => loadList()} />
              <Input size="small" prefix={<SearchOutlined />} placeholder="搜索" allowClear style={{ width: 140 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </Space>
          </div>
          {list.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无会话" style={{ padding: 24 }} />
          ) : (
            <List
              dataSource={list}
              renderItem={(c) => (
                <div
                  key={c.id}
                  onClick={() => select(c.id)}
                  style={{
                    padding: "10px 14px", cursor: "pointer", borderTop: "1px solid #f0f0f0",
                    background: activeId === c.id ? "#e6f4ff" : "#fff",
                  }}
                >
                  <Tag style={{ borderRadius: 6, fontSize: 11 }}>{c.tag}</Tag>
                  <Text style={{ fontSize: 12, display: "block", marginTop: 4 }} ellipsis={{ tooltip: c.title }}>{c.title}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{c.time ? new Date(c.time).toLocaleString("zh-CN") : ""}</Text>
                </div>
              )}
            />
          )}
        </Card>

        {/* 右侧：对话详情 */}
        {detail ? (
          <Card
            size="small"
            style={{ flex: 1 }}
            title={<Space><Text>{detail.title}</Text><Tag style={{ borderRadius: 6 }}>{detail.tag}</Tag></Space>}
            extra={<Button type="primary" danger icon={<DeleteOutlined />} loading={deleteLoading} onClick={deleteActive}>删除会话</Button>}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {detail.messages.map((m, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Space size={8}>
                      <Tag color={m.role === "用户" ? "blue" : m.role === "AI" ? "green" : "default"} style={{ borderRadius: 6 }}>
                        {m.role}
                      </Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 11 }}>{m.time}</Text>
                  </div>
                  <pre style={{ margin: "6px 0 0", padding: "8px 12px", background: "#fafafa", borderRadius: 8, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {m.content}
                  </pre>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card size="small" style={{ flex: 1 }}>
            <Empty description="请选择一个会话" />
          </Card>
        )}
      </div>
    </div>
  );
}
