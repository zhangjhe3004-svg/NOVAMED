/**
 * 用户管理页面（仅管理员可见）
 */
import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  message,
  Modal,
  Form,
  Popconfirm,
  Dropdown,
} from "antd";
import {
  PlusOutlined,
  LockOutlined,
  TeamOutlined,
  DeleteOutlined,
  DownOutlined,
} from "@ant-design/icons";
import {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from "../api/users";
import type { UserItem } from "../api/users";

const { Title } = Typography;

const roleLabels: Record<string, { text: string; color: string }> = {
  admin: { text: "管理员", color: "red" },
  doctor: { text: "医生", color: "blue" },
  pharmacist: { text: "药剂师", color: "green" },
  maintainer: { text: "运维人员", color: "orange" },
};

export default function UserManagement() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>();
  const [keyword, setKeyword] = useState<string>();

  // 弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 重置密码弹窗
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdUserId, setPwdUserId] = useState<number>(0);
  const [newPassword, setNewPassword] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await listUsers({
        page,
        page_size: 20,
        role: roleFilter,
        keyword,
      });
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error("加载用户列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, roleFilter, keyword]);

  const handleCreate = async (values: any) => {
    try {
      await createUser(values);
      message.success("用户已创建");
      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "创建失败");
    }
  };

  const handleUpdate = async (id: number, values: any) => {
    try {
      await updateUser(id, values);
      message.success("已更新");
      fetchData();
    } catch {
      message.error("更新失败");
    }
  };

  const handleResetPwd = async () => {
    if (!newPassword || newPassword.length < 1) {
      message.warning("密码至少1位");
      return;
    }
    try {
      await resetUserPassword(pwdUserId, newPassword);
      message.success("密码已重置");
      setPwdModalOpen(false);
      setNewPassword("");
    } catch {
      message.error("操作失败");
    }
  };

  const handleDelete = async (id: number, username: string) => {
    try {
      await deleteUser(id);
      message.success(`用户 ${username} 已删除`);
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "删除失败");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "用户名", dataIndex: "username", width: 100 },
    { title: "姓名", dataIndex: "real_name", width: 100 },
    { title: "工号", dataIndex: "employee_no", width: 100, render: (v: string) => v || "-" },
    {
      title: "角色",
      dataIndex: "role",
      width: 100,
      render: (r: string) => {
        const label = roleLabels[r] || { text: r, color: "default" };
        return <Tag color={label.color}>{label.text}</Tag>;
      },
    },
    { title: "电话", dataIndex: "phone", width: 120, render: (v: string) => v || "-" },
    { title: "邮箱", dataIndex: "email", width: 150, render: (v: string) => v || "-" },
    {
      title: "状态",
      dataIndex: "is_active",
      width: 80,
      render: (v: number) =>
        v ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: "在岗状态",
      dataIndex: "work_status",
      width: 140,
      render: (v: string, r: any) => (
        <Select
          size="small"
          value={v || "在职"}
          style={{ width: 110 }}
          onChange={(val) => handleUpdate(r.id, { work_status: val })}
          options={[{ value: "在职", label: "在职" }, { value: "休息", label: "休息" }, { value: "离岗", label: "离岗" }]}
        />
      ),
    },
    {
      title: "职务",
      dataIndex: "title",
      width: 130,
      render: (v: string, r: any) => (
        <Select
          size="small"
          value={v || undefined}
          style={{ width: 120 }}
          placeholder="未设"
          allowClear
          onChange={(val) => handleUpdate(r.id, { title: val })}
          options={["住院医师", "主治医师", "副主任医师", "主任医师"].map((t) => ({ value: t, label: t }))}
        />
      ),
    },
    {
      title: "科室",
      dataIndex: "department",
      width: 110,
      render: (v: string, r: any) => (
        <Select
          size="small"
          value={v || undefined}
          style={{ width: 100 }}
          placeholder="未分配"
          allowClear
          onChange={(val) => handleUpdate(r.id, { department: val })}
          options={["内科", "外科", "儿科", "妇科", "骨科", "急诊科", "检验科", "影像科"].map((d) => ({ value: d, label: d }))}
        />
      ),
    },
    {
      title: "上级",
      dataIndex: "superior_name",
      width: 120,
      render: (_: any, r: any) => (
        <Select
          size="small"
          value={r.superior_id || undefined}
          style={{ width: 110 }}
          placeholder="无"
          allowClear
          onChange={(val) => handleUpdate(r.id, { superior_id: val || null })}
          options={data.filter((u) => u.id !== r.id).map((u) => ({ value: u.id, label: u.real_name }))}
        />
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      width: 120,
      render: (d: string) =>
        d ? new Date(d).toLocaleDateString("zh-CN") : "-",
    },
    {
      title: "操作",
      width: 260,
      render: (_: any, r: UserItem) => (
        <Space size="small" wrap>
          <Select
            size="small"
            value={r.role}
            style={{ width: 90 }}
            onChange={(val) => handleUpdate(r.id, { role: val })}
            options={Object.entries(roleLabels).map(([k, v]) => ({
              value: k,
              label: v.text,
            }))}
          />
          <Button
            size="small"
            type="link"
            icon={<LockOutlined />}
            onClick={() => {
              setPwdUserId(r.id);
              setPwdModalOpen(true);
            }}
          >
            密码
          </Button>
          <Popconfirm
            title={r.is_active ? "确认禁用？" : "确认启用？"}
            onConfirm={() =>
              handleUpdate(r.id, { is_active: r.is_active ? 0 : 1 })
            }
          >
            <Button size="small" type="link" danger={!!r.is_active}>
              {r.is_active ? "禁用" : "启用"}
            </Button>
          </Popconfirm>
          <Popconfirm
            title="删除用户"
            description={`确定要删除 ${r.username} (${r.real_name}) 吗？`}
            onConfirm={() => handleDelete(r.id, r.username)}
            okText="确定删除"
            cancelText="取消"
          >
            <Button
              size="small"
              type="link"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
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
          <TeamOutlined /> 用户管理
        </Title>
        <Dropdown
          menu={{ items: [{ key: "user", label: "新增用户", onClick: () => { form.resetFields(); setModalOpen(true); } }] }}
        >
          <Button type="primary" icon={<PlusOutlined />}>新增用户 <DownOutlined /></Button>
        </Dropdown>
      </div>

      <Space style={{ marginBottom: 16 }} size="middle">
        <Input.Search
          placeholder="搜索用户名/姓名/工号"
          allowClear
          style={{ width: 250 }}
          onSearch={(val) => {
            setPage(1);
            setKeyword(val || undefined);
          }}
        />
        <Select
          mode="multiple"
          style={{ width: 200 }}
          allowClear
          placeholder="角色筛选（多选）"
          value={roleFilter ? roleFilter.split(",") : undefined}
          options={Object.entries(roleLabels).map(([k, v]) => ({
            value: k,
            label: v.text,
          }))}
          onChange={(vals) => {
            setPage(1);
            setRoleFilter(vals && vals.length ? vals.join(",") : undefined);
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
          showTotal: (t) => `共 ${t} 位用户`,
          onChange: (p) => setPage(p),
        }}
      />

      {/* 新建用户弹窗 */}
      <Modal
        title="新增用户"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, min: 6 }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="real_name"
            label="真实姓名"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true }]}
            initialValue="doctor"
          >
            <Select
              options={Object.entries(roleLabels).map(([k, v]) => ({
                value: k,
                label: v.text,
              }))}
            />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="employee_no" label="工号">
            <Input placeholder="用于按工号搜索" />
          </Form.Item>
          <Form.Item name="department" label="科室">
            <Input />
          </Form.Item>
          <Form.Item name="title" label="职称">
            <Input placeholder="如：主治医师" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        title="重置密码"
        open={pwdModalOpen}
        onCancel={() => setPwdModalOpen(false)}
        onOk={handleResetPwd}
      >
        <Input.Password
          placeholder="输入新密码（至少6位）"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </Modal>
    </div>
  );
}
