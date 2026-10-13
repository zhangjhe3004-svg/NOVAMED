/**
 * 岗位管理 —— 移植自 scaffold Posts.vue（岗位阶梯 + 表格 + CRUD + 批量删除）。
 *
 * 语汇：
 *   阶梯视图 = 岗位按 sort 沿对角线自左下向右上铺满舞台，每级是带分类色上沿的珍珠玻璃台面，
 *             选中岗位 → 在岗成员以胶囊触须扇形长到空域，右侧信息卡给出岗位读数与编辑入口。
 *   表格视图 = 岗位列表（名称/编码/在岗人数/排序/状态/备注/操作）+ 勾选批量删除。
 *
 * 数据来源：/api/posts（sys_posts 表）；在岗成员取 /users 按 title 匹配岗位名。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Empty, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Select, Spin, Switch, Table, message } from "antd";
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  RiseOutlined,
  SaveOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../stores/auth";
import { listPosts, createPost, updatePost, removePost, type PostItem, type PostPayload } from "../api/posts";
import { listUsers, type UserItem } from "../api/users";
import { roleMeta } from "../config/nav";
import StageGraph, { type GraphLink, type GraphNode } from "../components/StageGraph";

interface Staff {
  id: number;
  real_name: string;
  role: string;
  title: string;
  department: string;
}

function fanPos(cx: number, cy: number, index: number, total: number, flip: boolean) {
  const t = total <= 1 ? 0.5 : index / (total - 1);
  const from = flip ? 8 : 102;
  const to = flip ? 76 : 172;
  const ang = ((from + t * (to - from)) * Math.PI) / 180;
  const r = 164 + (index % 2) * 30 + (index % 3) * 14;
  return { x: cx + Math.cos(ang) * r, y: cy - Math.sin(ang) * r };
}

export default function PostManage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [total, setTotal] = useState(0);
  const [members, setMembers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"ladder" | "table">("ladder");
  const [selected, setSelected] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 800, h: 620 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 查询
  const [kwInput, setKwInput] = useState("");
  const [kw, setKw] = useState("");
  const [statusF, setStatusF] = useState("");

  // 表单
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PostItem | null>(null);
  const [form] = Form.useForm();
  const [formSaving, setFormSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPosts({ page_size: 200, keyword: kw || undefined, status: statusF || undefined });
      setPosts(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载岗位数据失败");
    } finally {
      setLoading(false);
    }
  }, [kw, statusF]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    listUsers({ page_size: 100 })
      .then((r) =>
        setMembers(
          (r.items || []).map((x: UserItem) => ({
            id: x.id,
            real_name: x.real_name || x.username,
            role: x.role,
            title: x.title || "",
            department: x.department || "",
          }))
        )
      )
      .catch(() => setMembers([]));
  }, [isAdmin]);

  /* ---------- 阶梯布局（对齐 scaffold PostLadder.vue） ---------- */
  const steps = useMemo(() => [...posts].sort((a, b) => a.sort - b.sort || a.id - b.id), [posts]);

  const geometry = useMemo(() => {
    const { w, h } = size;
    const n = Math.max(steps.length, 1);
    const pad = Math.max(28, w * 0.03);
    const width = Math.max(92, Math.min(150, (w - pad * 2) / n - 12));
    const x0 = pad + width / 2;
    const x1 = w - pad - width / 2;
    const y0 = h - 120;
    const y1 = Math.max(150, h * 0.28);
    const cx = (i: number) => (n > 1 ? x0 + ((x1 - x0) * i) / (n - 1) : (x0 + x1) / 2);
    const cy = (i: number) => (n > 1 ? y0 + ((y1 - y0) * i) / (n - 1) : (y0 + y1) / 2);
    return { width, cx, cy, flipOf: (i: number) => cx(i) < w / 2 };
  }, [size, steps.length]);

  const selectedPost = selected ? steps.find((p) => p.id === selected) ?? null : null;
  const selectedMembers = useMemo(
    () => (selectedPost ? members.filter((m) => m.title === selectedPost.post_name) : []),
    [selectedPost, members]
  );

  const nodes = useMemo<GraphNode[]>(() => {
    const out: GraphNode[] = steps.map((p, i) => ({
      id: `post-${p.id}`,
      x: geometry.cx(i),
      y: geometry.cy(i),
      label: p.post_name,
      sub: p.post_code,
      kind: "slab" as const,
      cat: (i % 5) + 1,
      tone: p.status !== 1 ? ("off" as const) : undefined,
      size: geometry.width,
      rank: `第 ${i + 1} 级`,
      count: p.user_count,
      delay: 0.1 + i * 0.12,
    }));

    if (selectedPost) {
      const idx = steps.indexOf(selectedPost);
      const cat = (idx % 5) + 1;
      const shown = selectedMembers.slice(0, 12);
      const flip = geometry.flipOf(idx);
      shown.forEach((s, j) => {
        const pos = fanPos(geometry.cx(idx), geometry.cy(idx), j, shown.length, flip);
        out.push({
          id: `m-${s.id}`,
          x: pos.x,
          y: pos.y,
          label: s.real_name,
          sub: s.department || s.title || "—",
          kind: "item" as const,
          cat,
          align: flip ? "left" : "right",
          from: `post-${selectedPost.id}`,
          delay: 0.12 + j * 0.08,
          title: `${s.real_name} · ${roleMeta(s.role).text}${s.department ? ` · ${s.department}` : ""}`,
        });
      });
      if (selectedMembers.length > 12) {
        const pos = fanPos(geometry.cx(idx), geometry.cy(idx), 12, 13, flip);
        out.push({
          id: `m-more`,
          x: pos.x,
          y: pos.y,
          label: `另有 ${selectedMembers.length - 12} 人`,
          sub: "去用户管理查看",
          kind: "item" as const,
          align: flip ? "left" : "right",
          from: `post-${selectedPost.id}`,
          delay: 0.12 + 12 * 0.08,
          interactive: false,
        });
      }
    }
    return out;
  }, [steps, geometry, selectedPost, selectedMembers]);

  const links = useMemo<GraphLink[]>(() => {
    const out: GraphLink[] = [];
    for (let i = 0; i < steps.length - 1; i += 1) {
      out.push({ a: `post-${steps[i].id}`, b: `post-${steps[i + 1].id}`, flow: "forward", shape: "h", cat: ((i + 1) % 5) + 1 });
    }
    if (selectedPost) {
      const idx = steps.indexOf(selectedPost);
      const cat = (idx % 5) + 1;
      const ids = selectedMembers.slice(0, 12).map((s) => `m-${s.id}`);
      if (selectedMembers.length > 12) ids.push("m-more");
      ids.forEach((id) => out.push({ a: `post-${selectedPost.id}`, b: id, shape: "arc", cat }));
    }
    return out;
  }, [steps, selectedPost, selectedMembers]);

  /* ---------- CRUD ---------- */
  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ post_name: "", post_code: "", sort: 10, status: 1, remark: "" });
    setFormOpen(true);
  };
  const openEdit = (row: PostItem) => {
    setEditing(row);
    form.setFieldsValue({ post_name: row.post_name, post_code: row.post_code, sort: row.sort, status: row.status, remark: row.remark });
    setFormOpen(true);
  };
  const submitForm = async () => {
    const values = await form.validateFields();
    setFormSaving(true);
    try {
      const payload: PostPayload = {
        post_name: values.post_name.trim(),
        post_code: values.post_code.trim(),
        sort: values.sort ?? 0,
        status: values.status ? 1 : 0,
        remark: values.remark || "",
      };
      if (editing) {
        await updatePost(editing.id, payload);
        message.success("岗位已更新");
      } else {
        await createPost(payload);
        message.success("岗位已新增");
      }
      setFormOpen(false);
      await load();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.detail || "岗位保存失败");
    } finally {
      setFormSaving(false);
    }
  };
  const handleRemove = async (row: PostItem) => {
    try {
      await removePost(row.id);
      message.success("岗位已删除");
      if (selected === row.id) setSelected(null);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "岗位删除失败");
    }
  };
  const batchRemove = async () => {
    try {
      await Promise.all(selectedRowKeys.map((id) => removePost(Number(id))));
      message.success(`已删除 ${selectedRowKeys.length} 个岗位`);
      setSelectedRowKeys([]);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "批量删除失败");
    }
  };

  const viewToggle = (
    <Segmented
      value={view}
      onChange={(v) => setView(v as "ladder" | "table")}
      options={[
        { label: "阶梯", value: "ladder" },
        { label: "表格", value: "table" },
      ]}
    />
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>岗位管理</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 6 }}>
            岗位描述员工在组织中的职务，可在用户管理中为用户指定岗位。
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {viewToggle}
          <span className="lv-tag lv-tag--neutral"><TeamOutlined /> {total} 个岗位</span>
          <button className="lv-btn" type="button" onClick={load}><ReloadOutlined /> 刷新</button>
          {isAdmin && <button className="lv-btn lv-btn--primary" type="button" onClick={openCreate}><PlusOutlined /> 新增岗位</button>}
        </div>
      </div>

      {view === "ladder" ? (
        <section className="panel md-no-lift" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <div>
              <h2><RiseOutlined style={{ marginRight: 6 }} />阶梯舞台</h2>
              <small>岗位按排序沿对角线铺开 · 点击台阶查看在岗人员 · 方向键切换 · Esc 收起</small>
            </div>
          </div>
          <div className="panel-body" style={{ paddingTop: 0 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 60 }}><Spin /></div>
            ) : !steps.length ? (
              <Empty description="还没有岗位" style={{ padding: 60 }} />
            ) : (
              <div className="trace-wrap">
                <div className="stage-scroll">
                  <StageGraph
                    className="ladder-stage"
                    style={{ height: 620 }}
                    variant="stage"
                    label="岗位能量阶梯"
                    nodes={nodes}
                    links={links}
                    size={size}
                    onSize={setSize}
                    activeId={selectedPost ? `post-${selectedPost.id}` : null}
                    highlight={selectedPost ? [`post-${selectedPost.id}`, ...selectedMembers.slice(0, 12).map((s) => `m-${s.id}`)] : null}
                    onSelect={(n) => {
                      if (n.id.startsWith("post-")) {
                        const id = Number(n.id.replace("post-", ""));
                        setSelected((cur) => (cur === id ? null : id));
                      } else if (n.id.startsWith("m-")) {
                        navigate("/users");
                      }
                    }}
                    onBack={() => setSelected(null)}
                    tl={
                      selectedPost ? (
                        <div className="ladder-card m-float" aria-live="polite">
                          <div className="ladder-card-head">
                            <span className="ladder-card-rank">第 {steps.indexOf(selectedPost) + 1} 级 · 共 {steps.length} 级</span>
                          </div>
                          <h3>{selectedPost.post_name}</h3>
                          <span className="code-chip">{selectedPost.post_code}</span>
                          <dl>
                            <div><dt>在岗</dt><dd className="tnum">{selectedPost.user_count}<small>人</small></dd></div>
                            <div><dt>排序</dt><dd className="tnum">{selectedPost.sort}</dd></div>
                          </dl>
                          <div className="ladder-card-actions">
                            {isAdmin && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(selectedPost)}>编辑岗位</Button>}
                          </div>
                        </div>
                      ) : (
                        <div className="rg-hint"><RiseOutlined /><span>点选台阶查看该岗位的在岗人员</span></div>
                      )
                    }
                    bl={
                      <div className="rg-legend">
                        {steps.slice(0, 5).map((p, i) => (
                          <span key={p.id} className={`rg-legend-item cat-${(i % 5) + 1}`}><i aria-hidden="true" />{p.post_name}</span>
                        ))}
                      </div>
                    }
                  />
                </div>

                <aside className="insight ladder-card">
                  {selectedPost ? (
                    <>
                      <div className="insight-head">
                        <span className={`insight-swatch cat-${(steps.indexOf(selectedPost) % 5) + 1}`} aria-hidden="true" />
                        <div className="insight-title">
                          <b>{selectedPost.post_name}</b>
                          <small>{selectedPost.post_code} · {selectedMembers.length} 人在岗</small>
                        </div>
                        <Button type="text" size="small" aria-label="收起" icon={<EditOutlined />} onClick={() => setSelected(null)} />
                      </div>
                      <div className="insight-section">
                        <div className="insight-section-head">
                          <span>岗位信息</span>
                          <small>{isAdmin ? "可编辑" : "只读"}</small>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", fontSize: 12.5, color: "var(--lv-muted)" }}>
                          <span>排序：<b className="tnum" style={{ color: "var(--lv-ink)" }}>{selectedPost.sort}</b></span>
                          <span>状态：<b style={{ color: selectedPost.status === 1 ? "var(--lv-leaf)" : "var(--lv-red, #c4423e)" }}>{selectedPost.status === 1 ? "正常" : "停用"}</b></span>
                          <span style={{ gridColumn: "1 / -1" }}>{selectedPost.remark || "无备注"}</span>
                        </div>
                      </div>
                      <div className="insight-section">
                        <div className="insight-section-head">
                          <span>在岗成员</span>
                          <small>共 {selectedMembers.length} 人</small>
                        </div>
                        <div className="insight-chips">
                          {selectedMembers.slice(0, 10).map((s) => (
                            <span key={s.id} className="insight-chip is-clickable" role="button" tabIndex={0} onClick={() => navigate("/users")}>
                              <UserOutlined />{s.real_name}<em>{roleMeta(s.role).text}</em>
                            </span>
                          ))}
                          {selectedMembers.length === 0 && <span className="insight-chip is-empty">该岗位暂无在岗人员</span>}
                          {selectedMembers.length > 10 && <span className="insight-chip is-empty">另有 {selectedMembers.length - 10} 人</span>}
                        </div>
                      </div>
                      <div className="insight-actions">
                        {isAdmin && (
                          <Button size="small" type="primary" icon={<SaveOutlined />} onClick={() => openEdit(selectedPost)}>编辑</Button>
                        )}
                        <Button size="small" icon={<TeamOutlined />} onClick={() => navigate("/users")}>用户管理</Button>
                        <Button size="small" type="text" onClick={() => setSelected(null)}>收起</Button>
                      </div>
                    </>
                  ) : (
                    <div className="insight-empty-body">
                      <EditOutlined />
                      <span>点选任意台阶，查看该岗位的职责与在岗成员</span>
                    </div>
                  )}
                </aside>
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className="lv-query" style={{ marginTop: 16 }}>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
              placeholder="岗位名称 / 编码"
              style={{ width: 240 }}
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onPressEnter={() => setKw(kwInput.trim())}
            />
            <Select
              allowClear
              placeholder="全部状态"
              style={{ width: 130 }}
              value={statusF || undefined}
              onChange={(v) => setStatusF(v || "")}
              options={[{ value: "1", label: "正常" }, { value: "0", label: "停用" }]}
            />
            <div className="lv-query-actions">
              <button className="lv-btn" type="button" onClick={() => setKw(kwInput.trim())}>查询</button>
              <button className="lv-btn" type="button" onClick={() => { setKwInput(""); setKw(""); setStatusF(""); }}>重置</button>
              {selectedRowKeys.length > 0 && (
                <Popconfirm title={`确认删除选中的 ${selectedRowKeys.length} 个岗位吗？`} okText="删除" okButtonProps={{ danger: true }} onConfirm={batchRemove}>
                  <button className="lv-btn" type="button" style={{ color: "var(--lv-red, #c4423e)" }}>删除</button>
                </Popconfirm>
              )}
            </div>
          </div>

          <section className="lv-panel">
            <div className="lv-panel-head">
              <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
              <span className="lv-panel-title">岗位列表</span>
              <span className="lv-panel-meta">共 {total} 个岗位</span>
              <div className="lv-panel-tools">
                <button className="icon-btn" title="刷新" onClick={load}><ReloadOutlined /></button>
              </div>
            </div>
            <Table
              rowKey="id"
              size="middle"
              loading={loading}
              dataSource={posts}
              pagination={false}
              scroll={{ x: 980 }}
              locale={{ emptyText: "暂无岗位" }}
              rowSelection={isAdmin ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
              columns={[
                { title: "岗位名称", dataIndex: "post_name", width: 170, fixed: "left" as const, render: (v: string) => <span className="cell-title">{v}</span> },
                { title: "岗位编码", dataIndex: "post_code", width: 130, render: (v: string) => <span className="code-chip">{v}</span> },
                { title: "在岗人数", dataIndex: "user_count", width: 100, align: "right" as const, render: (v: number) => <span className="tnum">{v}</span> },
                { title: "排序", dataIndex: "sort", width: 70, align: "right" as const, render: (v: number) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{v}</span> },
                {
                  title: "状态", dataIndex: "status", width: 90,
                  render: (v: number) => <span className={`lv-tag ${v === 1 ? "lv-tag--leaf" : "lv-tag--gray"}`}><span className="lv-tag-dot" />{v === 1 ? "正常" : "停用"}</span>,
                },
                { title: "备注", dataIndex: "remark", render: (v: string) => <span style={{ color: "var(--lv-muted)" }}>{v || "—"}</span> },
                {
                  title: "操作", width: 100, fixed: "right" as const, className: "col-actions",
                  render: (_: any, r: PostItem) => (
                    <div className="row-actions">
                      {isAdmin && <button className="icon-btn" title="编辑" data-act="edit" onClick={() => openEdit(r)}><EditOutlined /></button>}
                      {isAdmin && (
                        <Popconfirm title={`确认删除岗位「${r.post_name}」吗？`} okText="删除" okButtonProps={{ danger: true }} onConfirm={() => handleRemove(r)}>
                          <button className="icon-btn is-danger" title="删除" data-act="remove"><TeamOutlined /></button>
                        </Popconfirm>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </section>
        </>
      )}

      {/* 新增 / 编辑岗位弹窗 */}
      <Modal
        title={editing ? "编辑岗位" : "新增岗位"}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={submitForm}
        confirmLoading={formSaving}
        okText={editing ? "保存" : "新增"}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="post_name" label="岗位名称" rules={[{ required: true, message: "请输入岗位名称" }]}>
              <Input placeholder="如：研发工程师" />
            </Form.Item>
            <Form.Item
              name="post_code"
              label="岗位编码"
              rules={[
                { required: true, message: "请输入岗位编码" },
                { pattern: /^[A-Za-z][\w-]*$/, message: "字母开头，仅含字母、数字、下划线、短横线" },
              ]}
            >
              <Input placeholder="如：dev" />
            </Form.Item>
            <Form.Item name="sort" label="显示排序">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="status" label="岗位状态" valuePropName="checked">
              <Switch checkedChildren="正常" unCheckedChildren="停用" />
            </Form.Item>
          </div>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="岗位职责说明" maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
