/**
 * 知识库管理页面
 */
import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Tag,
  Typography,
  message,
  Modal,
  Form,
  Select,
  Drawer,
  Popconfirm,
  Upload,
  Descriptions,
  Divider,
  Dropdown,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BookOutlined,
  UploadOutlined,
  DownOutlined,
} from "@ant-design/icons";
import {
  listKnowledgeDocs,
  getKnowledgeDoc,
  createKnowledgeDoc,
  updateKnowledgeDoc,
  deleteKnowledgeDoc,
  getCategories,
  searchKnowledge,
} from "../api/knowledge";
import { useAuth } from "../stores/auth";
import api from "../api/client";
import type { KnowledgeDoc } from "../api/knowledge";

const { Title, Text, Paragraph } = Typography;

const categoryColors: Record<string, string> = {
  "诊疗指南": "blue",
  "药品说明": "green",
  "病例研究": "purple",
  "学术文献": "orange",
  "其他": "default",
};

export default function KnowledgeBase() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canWrite = user?.role === "admin" || user?.role === "doctor";

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<KnowledgeDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string>();
  const [keyword, setKeyword] = useState<string>();
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);

  // 创建/编辑弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  const [form] = Form.useForm();

  // 详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<KnowledgeDoc | null>(null);

  // 审批
  const [pendingDocs, setPendingDocs] = useState<any[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const fetchPending = async () => {
    setPendingLoading(true);
    try {
      const res = await api.get("/knowledge/pending");
      setPendingDocs(res.data.items || []);
      const lv = await api.get("/knowledge/approval-levels");
      setLevels(lv.data.levels || []);
    } catch {
      // 忽略
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id: number, action: string) => {
    try {
      const res = await api.post(`/knowledge/${id}/approve`, { action });
      message.success(action === "approve" ? "已通过当前级别" : "已驳回");
      fetchPending();
      fetchData();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "审批失败");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await listKnowledgeDocs({
        page,
        page_size: 20,
        category,
        keyword,
      });
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, category, keyword]);

  useEffect(() => {
    getCategories().then((res) => setCategories(res.categories || []));
  }, []);

  const handleCreate = async (values: any) => {
    try {
      // tags 为多选标签数组 → 存成 JSON 字符串
      if (Array.isArray(values.tags)) values.tags = JSON.stringify(values.tags);
      if (editingDoc) {
        await updateKnowledgeDoc(editingDoc.id, values);
        message.success("已更新");
      } else {
        await createKnowledgeDoc(values);
        message.success("已创建");
      }
      setModalOpen(false);
      form.resetFields();
      setEditingDoc(null);
      fetchData();
    } catch {
      message.error("操作失败");
    }
  };

  const parseTags = (s?: string): string[] => {
    try {
      const a = JSON.parse(s || "[]");
      return Array.isArray(a) ? a : [];
    } catch {
      return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
    }
  };

  const handleEdit = (doc: KnowledgeDoc) => {
    setEditingDoc(doc);
    form.setFieldsValue({ ...doc, tags: parseTags(doc.tags) });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    await deleteKnowledgeDoc(id);
    message.success("已删除");
    fetchData();
  };

  const handleView = async (id: number) => {
    try {
      const doc = await getKnowledgeDoc(id);
      setDetail(doc);
      setDrawerOpen(true);
    } catch {
      message.error("加载失败");
    }
  };

  // 导入文件：读取文本并自动填充 标题(首行) + 正文
  const handleImportFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".docx") || name.endsWith(".doc")) {
      message.info("Word 文档暂不支持自动解析，请另存为 .txt/.md 后导入，或直接粘贴正文");
      return false;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const title = (lines[0] || "").trim().slice(0, 200) || file.name.replace(/\.[^.]+$/, "");
      form.setFieldsValue({ title, content: text });
      message.success("已导入，标题与正文已自动填充");
    };
    reader.readAsText(file, "utf-8");
    return false;
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    {
      title: "标题",
      dataIndex: "title",
      ellipsis: true,
      render: (v: string) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => handleView}>
          {v}
        </Button>
      ),
    },
    {
      title: "分类",
      dataIndex: "category",
      width: 100,
      render: (v: string) => (
        <Tag color={categoryColors[v] || "default"}>{v}</Tag>
      ),
    },
    {
      title: "作者",
      dataIndex: "author_name",
      width: 80,
      render: (v: string) => v || "-",
    },
    {
      title: "浏览",
      dataIndex: "view_count",
      width: 60,
    },
    {
      title: "更新日期",
      dataIndex: "updated_at",
      width: 120,
      render: (d: string) =>
        d ? new Date(d).toLocaleDateString("zh-CN") : "-",
    },
    ...(canWrite
      ? [
          {
            title: "操作" as const,
            width: 120 as const,
            render: (_: any, r: KnowledgeDoc) => (
              <Space size="small">
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(r)}
                >
                  编辑
                </Button>
                {isAdmin && (
                  <Popconfirm
                    title="确认删除？"
                    onConfirm={() => handleDelete(r.id)}
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          <BookOutlined /> 知识库
        </Title>
        {canWrite && (
          <Dropdown
            menu={{ items: [{ key: "doc", label: "新增文档", onClick: () => { setEditingDoc(null); form.resetFields(); setModalOpen(true); } }] }}
          >
            <Button type="primary" icon={<PlusOutlined />}>新增文档 <DownOutlined /></Button>
          </Dropdown>
        )}
      </div>

      {/* 知识库审批（按职称逐级） */}
      <Card
        title={<Space><BookOutlined style={{ color: "#722ed1" }} /> 知识库审批（新文档需逐级职称审批后入库）</Space>}
        size="small"
        style={{ marginBottom: 16 }}
        loading={pendingLoading}
      >
        {pendingDocs.length === 0 ? (
          <Text type="secondary">暂无待审批文档</Text>
        ) : (
          <Table
            rowKey="id"
            size="small"
            dataSource={pendingDocs}
            pagination={false}
            columns={[
              { title: "标题", dataIndex: "title", ellipsis: true },
              { title: "分类", dataIndex: "category", width: 90 },
              { title: "状态", dataIndex: "status", width: 90, render: (v: string) => <Tag color={v === "已入库" ? "green" : v === "已驳回" ? "red" : "orange"}>{v}</Tag> },
              { title: "当前级别", width: 190, render: (_: any, r: any) => `${levels[(r.approval_level || 1) - 1] || "待分配"}（第 ${r.approval_level} 级）` },
              { title: "作者", dataIndex: "author_name", width: 90, render: (v: string) => v || "-" },
              { title: "审批", width: 180, render: (_: any, r: any) => (
                <Space>
                  <Button size="small" type="primary" onClick={() => handleApprove(r.id, "approve")}>通过</Button>
                  <Button size="small" danger onClick={() => handleApprove(r.id, "reject")}>驳回</Button>
                </Space>
              ) },
            ]}
          />
        )}
      </Card>

      {/* 搜索栏 */}
      <Space style={{ marginBottom: 16 }} size="middle">
        <Input.Search
          placeholder="搜索标题、内容..."
          allowClear
          style={{ width: 300 }}
          onSearch={(val) => {
            setPage(1);
            setKeyword(val || undefined);
          }}
        />
        <Select
          mode="multiple"
          style={{ width: 220 }}
          allowClear
          placeholder="分类筛选（多选）"
          value={category ? category.split(",") : undefined}
          options={categories.map((c) => ({
            value: c.name,
            label: `${c.name} (${c.count})`,
          }))}
          onChange={(vals) => {
            setPage(1);
            setCategory(vals && vals.length ? vals.join(",") : undefined);
          }}
        />
      </Space>

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
        onRow={(record) => ({
          onDoubleClick: () => handleView(record.id),
          style: { cursor: "pointer" },
        })}
      />

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingDoc ? "编辑知识文档" : "新建知识文档"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingDoc(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="导入文件（可选，自动提取标题）">
            <Upload beforeUpload={handleImportFile} showUploadList={false} accept=".txt,.md,.csv,.docx,.doc">
              <Button icon={<UploadOutlined />}>选择 .txt / .md / .csv / Word 文档</Button>
            </Upload>
          </Form.Item>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input placeholder="文档标题（导入时自动提取首行）" />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: "请选择分类" }]}
          >
            <Select
              options={categories.map((c) => ({
                value: c.name,
                label: c.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="content"
            label="正文"
            rules={[{ required: true, message: "请输入正文" }]}
          >
            <Input.TextArea rows={8} placeholder="文档内容..." />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              placeholder="输入或选择标签（回车分隔）"
              tokenSeparators={[","]}
              options={["高血压", "用药指南", "诊疗指南", "病例研究", "学术文献"].map((t) => ({ value: t, label: t }))}
            />
          </Form.Item>
          <Form.Item name="source" label="来源">
            <Input placeholder="参考文献URL或出处" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title={detail?.title}
        width={640}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {detail && (
          <>
            <Space style={{ marginBottom: 16 }}>
              <Tag color={categoryColors[detail.category] || "default"}>
                {detail.category}
              </Tag>
              {detail.tags &&
                JSON.parse(detail.tags || "[]").map((t: string) => (
                  <Tag key={t}>{t}</Tag>
                ))}
            </Space>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="作者">
                {detail.author_name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="来源">
                {detail.source || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="浏览次数">
                {detail.view_count}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {detail.created_at
                  ? new Date(detail.created_at).toLocaleString("zh-CN")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {detail.updated_at
                  ? new Date(detail.updated_at).toLocaleString("zh-CN")
                  : "-"}
              </Descriptions.Item>
            </Descriptions>
            <Divider />
            <Paragraph style={{ whiteSpace: "pre-wrap" }}>
              {detail.content}
            </Paragraph>
          </>
        )}
      </Drawer>
    </div>
  );
}
