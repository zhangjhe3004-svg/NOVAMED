/**
 * 参数配置 —— 移植自 scaffold Configs.vue（面板 + 表格双视图）。
 *
 * 语汇：
 *   面板视图 = 左分组导航 + 右设置分组，行内直接改值，改动累积到底部深色玻璃浮条一次提交
 *   表格视图 = 参数列表（名称 / 键名 / 值 / 类型 / 备注 / 操作）
 *
 * 数据来源：/api/configs（sys_configs）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Switch,
  Table,
  Tooltip,
  message,
} from "antd";
import {
  AppstoreOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { downloadBlob } from "../utils/download";
import { errText } from "../utils/apiError";
import { inferConfigKind, splitConfigName, type ConfigKind } from "../utils/configValue";
import {
  listConfigs,
  createConfig,
  updateConfig,
  removeConfig,
  exportConfigs,
  type ConfigItem,
} from "../api/configs";

const CHOICE_LABEL: Record<string, string> = { light: "浅色", dark: "深色", auto: "跟随系统", true: "开启", false: "关闭" };

interface SettingItem {
  row: ConfigItem;
  title: string;
  kind: ConfigKind;
  locked: boolean;
}

export default function Configs() {
  const [view, setView] = useState<"panel" | "table">("panel");

  // 表格视图
  const [rows, setRows] = useState<ConfigItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kwInput, setKwInput] = useState("");
  const [kw, setKw] = useState("");

  // 面板视图
  const [all, setAll] = useState<ConfigItem[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [showDiff, setShowDiff] = useState(false);
  const [committing, setCommitting] = useState(false);

  // 表单
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<ConfigItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listConfigs({ page: 1, page_size: 100, keyword: kw || undefined });
      setRows(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      message.error(errText(e, "参数加载失败"));
    } finally {
      setLoading(false);
    }
  }, [kw]);

  const loadPanel = useCallback(async () => {
    setPanelLoading(true);
    try {
      // 后端 page_size ≤ 100：先取第一页，总数超出时循环取完（参数通常一页足够）
      const first = await listConfigs({ page: 1, page_size: 100 });
      let items = first.items || [];
      const totalN = first.total || items.length;
      for (let p = 2; items.length < totalN && p <= 10; p++) {
        const next = await listConfigs({ page: p, page_size: 100 });
        items = items.concat(next.items || []);
      }
      setAll(items);
    } catch (e: any) {
      message.error(errText(e, "参数加载失败"));
    } finally {
      setPanelLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    if (view === "panel") loadPanel();
  }, [view, loadPanel]);

  /* ── 分组 ── */
  const groups = useMemo(() => {
    const key = filter.trim().toLowerCase();
    const map = new Map<string, SettingItem[]>();
    for (const row of all) {
      if (key && !`${row.name} ${row.key} ${row.remark ?? ""}`.toLowerCase().includes(key)) continue;
      const { group, title } = splitConfigName(row.name, row.key);
      const item: SettingItem = { row, title, kind: inferConfigKind(row.key, row.value, row.remark), locked: row.builtin };
      map.set(group, [...(map.get(group) ?? []), item]);
    }
    return [...map.entries()].map(([name, items], i) => ({ name, items, index: String(i + 1).padStart(2, "0") }));
  }, [all, filter]);

  const valueOf = (row: ConfigItem) => (row.id in drafts ? drafts[row.id] : row.value);
  const setValue = (row: ConfigItem, value: string | number | boolean | null) => {
    const next = value === null ? "" : String(value);
    setDrafts((prev) => {
      const n = { ...prev };
      if (next === row.value) delete n[row.id];
      else n[row.id] = next;
      return n;
    });
    setFailed((prev) => {
      const n = new Set(prev);
      n.delete(row.id);
      return n;
    });
  };

  const changes = useMemo(
    () => all.filter((r) => r.id in drafts).map((r) => ({ row: r, from: r.value, to: drafts[r.id] })),
    [all, drafts],
  );
  const invalid = useMemo(() => changes.filter((c) => !c.to.trim()).map((c) => c.row.id), [changes]);

  const discard = () => {
    setDrafts({});
    setFailed(new Set());
    setShowDiff(false);
  };

  const commit = async () => {
    if (invalid.length) {
      message.warning("参数值不能为空");
      return;
    }
    setCommitting(true);
    const done: number[] = [];
    const bad = new Set<number>();
    for (const c of changes) {
      try {
        await updateConfig(c.row.id, { value: c.to });
        c.row.value = c.to;
        setDrafts((prev) => {
          const n = { ...prev };
          delete n[c.row.id];
          return n;
        });
        done.push(c.row.id);
      } catch {
        bad.add(c.row.id);
      }
    }
    setFailed(bad);
    setCommitting(false);
    if (done.length) {
      message.success(`已保存 ${done.length} 项参数`);
      loadTable();
    }
    if (bad.size) message.error(`${bad.size} 项保存失败，已保留在待提交列表`);
    else setShowDiff(false);
  };

  const displayValue = (item: SettingItem, v: string) =>
    item.kind.kind === "secret" && !revealed.has(item.row.id) ? "••••••" : v;

  const toggleReveal = (id: number) => {
    setRevealed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const jump = (name: string) => {
    document.getElementById(`settings-${name}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ── 表单 CRUD ── */
  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ builtin: false });
    setDialog(true);
  };
  const openEdit = (row: ConfigItem) => {
    setEditing(row);
    form.setFieldsValue({ name: row.name, key: row.key, value: row.value, builtin: row.builtin, remark: row.remark });
    setDialog(true);
  };
  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const payload = { name: v.name.trim(), key: v.key.trim(), value: v.value, builtin: !!v.builtin, remark: v.remark || "" };
      if (editing) {
        await updateConfig(editing.id, payload);
        message.success("参数已更新");
      } else {
        await createConfig(payload);
        message.success("参数已新增");
      }
      setDialog(false);
      await loadTable();
      if (view === "panel") loadPanel();
    } catch (e: any) {
      message.error(errText(e, "参数保存失败"));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (row: ConfigItem) => {
    try {
      await removeConfig(row.id);
      message.success("参数已删除");
      await loadTable();
      if (view === "panel") loadPanel();
    } catch (e: any) {
      message.error(errText(e, "参数删除失败"));
    }
  };

  const doExport = async () => {
    try {
      const blob = await exportConfigs({ keyword: kw || undefined });
      downloadBlob(blob, `参数配置-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e: any) {
      message.error(errText(e, "导出失败"));
    }
  };

  const panelHead = (title: string, totalN: number, tools?: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderBottom: "1px solid var(--lv-line)" }}>
      <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0, borderRadius: 999 }}>
        <span className="lv-tag-dot" />
      </span>
      <span style={{ fontSize: 14, fontWeight: 650, color: "var(--lv-ink)" }}>{title}</span>
      <span style={{ fontSize: 12, color: "var(--lv-faint)", fontVariantNumeric: "tabular-nums" }}>共 {totalN} 条</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>{tools}</div>
    </div>
  );

  const columns = [
    { title: "参数名称", dataIndex: "name", key: "name", minWidth: 180, render: (v: string) => <span className="cell-title">{v}</span> },
    { title: "参数键名", dataIndex: "key", key: "key", render: (v: string) => <span className="code-chip">{v}</span> },
    {
      title: "参数值", dataIndex: "value", key: "value",
      render: (v: string) => <span className="mono" style={{ display: "inline-block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>,
    },
    {
      title: "类型", dataIndex: "builtin", key: "builtin", width: 90,
      render: (v: boolean) => (v ? <span className="lv-tag lv-tag--info"><span className="lv-tag-dot" />系统内置</span> : <span className="lv-tag"><span className="lv-tag-dot" />自定义</span>),
    },
    { title: "备注", dataIndex: "remark", key: "remark", render: (v: string) => <span className="muted">{v || "—"}</span> },
    {
      title: "操作", key: "actions", width: 96, className: "col-actions",
      render: (_: unknown, row: ConfigItem) => (
        <div className="row-actions" style={{ justifyContent: "flex-end" }}>
          <Tooltip title="编辑">
            <button className="icon-btn" type="button" onClick={() => openEdit(row)}><EditOutlined /></button>
          </Tooltip>
          {!row.builtin && (
            <Popconfirm title={`确认删除参数「${row.name}」吗？`} onConfirm={() => remove(row)} okText="删除" cancelText="取消">
              <Tooltip title="删除">
                <button className="icon-btn is-danger" type="button"><DeleteOutlined /></button>
              </Tooltip>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="lv" style={{ padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>参数配置</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>
            以键值对维护系统运行参数，如账号初始密码、验证码开关等。
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={view}
            onChange={(v) => setView(v as "panel" | "table")}
            options={[
              { label: <span><AppstoreOutlined /> 面板</span>, value: "panel" },
              { label: <span><UnorderedListOutlined /> 表格</span>, value: "table" },
            ]}
          />
          <button className="lv-btn lv-btn--primary" type="button" data-act="create" onClick={openCreate}>
            <PlusOutlined /> 新增参数
          </button>
        </div>
      </div>

      {/* 查询面板 */}
      <div className="lv-query" style={{ borderRadius: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
          placeholder="参数名称 / 键名"
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          onPressEnter={() => setKw(kwInput)}
          className="lv-query-input"
          data-act="keyword"
        />
        <div className="lv-query-actions">
          <button className="lv-btn" type="button" data-act="reset" onClick={() => { setKwInput(""); setKw(""); }}>
            重置
          </button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="search" onClick={() => setKw(kwInput)}>
            <SearchOutlined /> 查询
          </button>
        </div>
      </div>

      {/* 视图主体 */}
      {view === "panel" ? (
        <div className="settings">
          <aside className="settings-nav">
            <Input
              allowClear
              size="small"
              prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
              placeholder="搜索参数"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <nav aria-label="参数分组">
              {groups.map((g) => (
                <button key={g.name} type="button" className="settings-nav-item" onClick={() => jump(g.name)}>
                  <span style={{ fontSize: 11, color: "var(--lv-faint)", fontVariantNumeric: "tabular-nums" }}>{g.index}</span>
                  {g.name}
                  <b>{g.items.length}</b>
                </button>
              ))}
            </nav>
            <p className="settings-nav-note">
              <LockOutlined style={{ fontSize: 12 }} />
              内置参数只读，可在表格视图查看
            </p>
          </aside>

          <div className="settings-body">
            {panelLoading && !all.length && <p className="band-empty">正在加载参数…</p>}
            {!panelLoading && !groups.length && <p className="band-empty">没有匹配的参数</p>}
            {groups.map((g) => (
              <section key={g.name} id={`settings-${g.name}`} className="settings-group">
                <div style={{ fontSize: 13, fontWeight: 650, color: "var(--lv-muted)", letterSpacing: ".04em", marginBottom: 4 }}>{g.name}</div>
                {g.items.map((item) => {
                  const row = item.row;
                  const kind = item.kind;
                  const isDirty = row.id in drafts;
                  const isFailed = failed.has(row.id);
                  return (
                    <div
                      key={row.id}
                      data-config={row.id}
                      className={`settings-row${isDirty ? " is-dirty" : ""}${isFailed ? " is-failed" : ""}${item.locked ? " is-locked" : ""}`}
                    >
                      <div className="settings-label">
                        <span className="settings-title">
                          {item.title}
                          {row.builtin && <LockOutlined style={{ fontSize: 12, color: "var(--lv-faint)" }} />}
                        </span>
                        <span className="code-chip">{row.key}</span>
                        {row.remark && <span className="settings-remark">{row.remark}</span>}
                      </div>
                      <div className="settings-control">
                        {item.locked && kind.kind === "boolean" && (
                          <Switch checked={row.value === "true"} disabled />
                        )}
                        {item.locked && kind.kind !== "boolean" && (
                          <>
                            <span className="settings-readonly">{displayValue(item, row.value)}</span>
                            {kind.kind === "secret" && (
                              <button className="icon-btn icon-btn-sm" type="button" onClick={() => toggleReveal(row.id)}>
                                {revealed.has(row.id) ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                              </button>
                            )}
                          </>
                        )}
                        {!item.locked && kind.kind === "boolean" && (
                          <Switch
                            checked={valueOf(row) === "true"}
                            onChange={(v) => setValue(row, v)}
                            checkedChildren="开启"
                            unCheckedChildren="关闭"
                          />
                        )}
                        {!item.locked && kind.kind === "choice" && (
                          <Segmented
                            value={valueOf(row)}
                            onChange={(v) => setValue(row, v as string)}
                            options={kind.options.map((o) => ({ label: CHOICE_LABEL[o] ?? o, value: o }))}
                          />
                        )}
                        {!item.locked && kind.kind === "number" && (
                          <InputNumber
                            className="settings-number"
                            value={valueOf(row) === "" ? null : Number(valueOf(row))}
                            onChange={(v) => setValue(row, v ?? "")}
                          />
                        )}
                        {!item.locked && kind.kind !== "boolean" && kind.kind !== "choice" && kind.kind !== "number" && (
                          <>
                            <Input
                              type={kind.kind === "secret" && !revealed.has(row.id) ? "password" : "text"}
                              value={valueOf(row)}
                              status={invalid.includes(row.id) ? "error" : undefined}
                              onChange={(e) => setValue(row, e.target.value)}
                              autoComplete="off"
                            />
                            {kind.kind === "secret" && (
                              <button className="icon-btn icon-btn-sm" type="button" onClick={() => toggleReveal(row.id)}>
                                {revealed.has(row.id) ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {isDirty && (
                        <div className="settings-was">
                          <span>
                            原值 <s style={{ fontFamily: "monospace" }}>{displayValue(item, row.value)}</s>
                          </span>
                          <button type="button" className="settings-undo" onClick={() => setValue(row, row.value)}>撤销</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
      ) : (
        <div className="lv-panel">
          {panelHead("参数列表", total, (
            <>
              <Tooltip title="刷新">
                <button className="icon-btn" type="button" data-act="refresh" onClick={loadTable}><ReloadOutlined /></button>
              </Tooltip>
              <Tooltip title="导出当前查询结果">
                <button className="icon-btn" type="button" data-act="export" onClick={doExport}><DownloadOutlined /></button>
              </Tooltip>
            </>
          ))}
          <Table
            rowKey="id"
            loading={loading}
            dataSource={rows}
            columns={columns}
            pagination={false}
            locale={{ emptyText: "还没有参数" }}
          />
        </div>
      )}

      {/* 底部深色玻璃浮条 */}
      {view === "panel" && changes.length > 0 && (
        <div className={`settings-float${showDiff ? "" : ""}`} role="region" aria-label="未保存的参数改动">
          {showDiff && (
            <div className="settings-diff">
              {changes.map((c) => (
                <div key={c.row.id} className={`settings-diff-row${failed.has(c.row.id) ? " is-failed" : ""}`}>
                  <span className="settings-diff-name">{c.row.name}</span>
                  <span style={{ fontFamily: "monospace", textDecoration: "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inferConfigKind(c.row.key, c.from).kind === "secret" ? "••••••" : c.from}
                  </span>
                  <span style={{ color: "#8494a8" }}>→</span>
                  <span style={{ fontFamily: "monospace", color: "#b9f27a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inferConfigKind(c.row.key, c.from).kind === "secret" ? "••••••" : c.to || "（空）"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <span className="settings-float-count">
            <b>{changes.length}</b> 项未保存{failed.size ? ` · ${failed.size} 项失败` : ""}
          </span>
          <span className="settings-float-sep" aria-hidden />
          <button type="button" className="float-btn" onClick={() => setShowDiff(!showDiff)}>
            {showDiff ? "收起差异" : "查看差异"}
          </button>
          <button type="button" className="float-btn float-btn--danger" onClick={discard}>放弃</button>
          <button type="button" className="float-btn float-btn--primary" onClick={commit} disabled={committing}>
            {committing ? "保存中…" : "保存改动"}
          </button>
        </div>
      )}

      {/* 参数表单 */}
      <Modal
        title={editing ? "编辑参数" : "新增参数"}
        open={dialog}
        onCancel={() => setDialog(false)}
        onOk={submit}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" className="lv-form">
          <div className="lv-form-grid">
            <Form.Item name="name" label="参数名称" rules={[{ required: true, message: "请输入参数名称" }]}>
              <Input placeholder="如：账号初始密码" />
            </Form.Item>
            <Form.Item
              name="key"
              label="参数键名"
              rules={[
                { required: true, message: "请输入参数键名" },
                { pattern: /^[A-Za-z][\w.\-]*$/, message: "字母开头，仅含字母、数字、点、下划线、连字符" },
              ]}
            >
              <Input placeholder="如：sys.user.initPassword" disabled={!!editing?.builtin} />
            </Form.Item>
          </div>
          <Form.Item name="value" label="参数值" rules={[{ required: true, message: "请输入参数值" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="参数用途说明" maxLength={200} />
          </Form.Item>
          <Form.Item name="builtin" label="系统内置" valuePropName="checked" tooltip="内置参数不可删除，键名不可修改">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
