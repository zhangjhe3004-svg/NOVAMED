/**
 * 科室人员名单弹窗
 *
 * 点击科室组织卡片中的「子科室」框后弹出，从低代码集合 dept_members
 * （物理表 dyn_dept_members，保存在 backend/db/employee.db）按
 * 科室 + 子科室过滤查询人员名单并以表格呈现。
 *
 * 系统管理员可在弹窗内直接新增 / 编辑 / 删除该科室的人员记录。
 * 科室 / 子科室为可搜索下拉（选项自动汇总自员工账号与已有人员名单，
 * 也支持输入新科室名）；在职状态为固定选项下拉。
 */
import { useEffect, useMemo, useState } from "react";
import { Modal, Table, Tag, Button, Space, Popconfirm, Form, Input, Select, AutoComplete, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { listRows, insertRow, updateRow, deleteRow } from "../../api/dyn";
import { listUsers } from "../../api/users";
import { useAuth } from "../../stores/auth";

export interface DeptMemberTarget {
  /** 大科室名称，如「预防保健科」 */
  dept: string;
  /** 子科室名称，如「预防保健科3」；为空表示查整个大科室 */
  sub?: string;
}

const STATUS_OPTIONS = ["在职", "休假", "停职", "离职", "退休"].map((v) => ({ value: v, label: v }));

export default function DeptMembersModal({ target, onClose }: {
  target: DeptMemberTarget | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const canEdit = user?.role === "admin";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any>(null); // {} = 新增
  const [form] = Form.useForm();

  // 科室目录：从员工账号 + 已有人员名单自动汇总
  const [catalog, setCatalog] = useState<{ value: string; sub: string[] }[]>([]);

  const watchedDept = Form.useWatch("department", form);

  const load = () => {
    if (!target?.dept) return;
    setLoading(true);
    const params: any = { page: 1, page_size: 100, f_department: target.dept };
    if (target.sub) params.f_sub_department = target.sub;
    listRows("dept_members", params)
      .then((r) => setRows(r.items || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  /** 汇总科室 / 子科室选项（员工账号 + 已有人员名单） */
  const loadCatalog = () => {
    const map = new Map<string, Set<string>>();
    const add = (dept?: string, sub?: string) => {
      const d = (dept || "").trim();
      if (!d) return;
      if (!map.has(d)) map.set(d, new Set());
      const s = (sub || "").trim();
      if (s) map.get(d)!.add(s);
    };
    // 来源 1：员工账号表（需管理员权限，失败则忽略）
    listUsers({ page: 1, page_size: 200 })
      .then((r) => {
        (r.items || []).forEach((u: any) => add(u.department, u.department));
      })
      .catch(() => {})
      // 来源 2：科室人员名单集合（全量取一次）
      .finally(() => {
        listRows("dept_members", { page: 1, page_size: 200 })
          .then((r) => {
            (r.items || []).forEach((x: any) => add(x.department, x.sub_department));
          })
          .catch(() => {})
          .finally(() => {
            setCatalog(Array.from(map.entries()).map(([value, subs]) => ({
              value,
              sub: Array.from(subs),
            })));
          });
      });
  };

  useEffect(() => { load(); }, [target]);
  useEffect(() => { if (canEdit) loadCatalog(); }, [canEdit]);

  const deptOptions = useMemo(
    () => catalog.map((c) => ({ value: c.value, label: c.value })),
    [catalog]
  );

  /** 子科室选项：优先当前所选大科室下的子科室 */
  const subOptions = useMemo(() => {
    const d = (watchedDept || "").trim();
    const hit = catalog.find((c) => c.value === d);
    const subs = hit ? hit.sub : Array.from(new Set(catalog.flatMap((c) => c.sub)));
    return subs.map((s) => ({ value: s, label: s }));
  }, [catalog, watchedDept]);

  const openEdit = (row?: any) => {
    setEditing(row || {});
    form.resetFields();
    form.setFieldsValue(row || {
      department: target?.dept,
      sub_department: target?.sub || target?.dept,
      status: "在职",
    });
  };

  const save = async (v: any) => {
    try {
      if (editing?.id) await updateRow("dept_members", editing.id, v);
      else await insertRow("dept_members", v);
      message.success("已保存");
      setEditing(null);
      load();
      loadCatalog();
    } catch (e: any) { message.error(e?.response?.data?.detail || "保存失败"); }
  };

  const doDelete = async (id: number) => {
    try { await deleteRow("dept_members", id); message.success("已删除"); load(); }
    catch (e: any) { message.error(e?.response?.data?.detail || "删除失败"); }
  };

  const columns = [
    { title: "姓名", dataIndex: "name", key: "name", width: 100 },
    {
      title: "职务 / 职称", dataIndex: "title", key: "title", width: 120,
      render: (v: string) => v || "—",
    },
    {
      title: "所属子科室", dataIndex: "sub_department", key: "sub_department", width: 120,
      render: (v: string) => v || "—",
    },
    {
      title: "联系方式", dataIndex: "phone", key: "phone", width: 130,
      render: (v: string) => v || "—",
    },
    {
      title: "在职状态", dataIndex: "status", key: "status", width: 90,
      render: (v: string) => <Tag color={(!v || v === "在职") ? "green" : "default"}>{v || "在职"}</Tag>,
    },
    ...(canEdit ? [{
      title: "操作", key: "op", width: 120, render: (_: any, r: any) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除该人员？" onConfirm={() => doDelete(r.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <>
      <Modal
        open={!!target}
        title={target ? `${target.sub || target.dept} · 人员名单` : ""}
        onCancel={onClose}
        footer={null}
        width={canEdit ? 780 : 700}
        destroyOnClose
      >
        {canEdit && (
          <div style={{ marginBottom: 10, textAlign: "right" }}>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openEdit()}>新增人员</Button>
          </div>
        )}
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={false}
          locale={{ emptyText: "该科室暂无人员名单记录" }}
        />
      </Modal>

      {/* 新增 / 编辑人员（二级弹窗） */}
      <Modal
        open={!!editing}
        title={editing?.id ? "编辑人员" : "新增人员"}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        destroyOnClose
        width={460}
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item
            name="department"
            label="科室"
            rules={[{ required: true, message: "请选择或输入科室" }]}
          >
            <AutoComplete
              options={deptOptions}
              placeholder="选择或输入科室，支持搜索"
              filterOption={(input, option) =>
                (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="sub_department" label="子科室">
            <AutoComplete
              options={subOptions}
              placeholder="选择或输入子科室（随科室联动）"
              filterOption={(input, option) =>
                (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="title" label="职务 / 职称">
            <Input placeholder="如：主任医师、护师、药师" />
          </Form.Item>
          <Form.Item name="phone" label="联系方式">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="status" label="在职状态">
            <Select options={STATUS_OPTIONS} placeholder="在职" allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
