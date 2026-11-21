/**
 * 代码生成 —— 移植自 scaffold Generator.vue（/tool/generator）。
 *
 * 导入数据库表 → 配置字段映射 → 预览后端四层 + 前端页面 + 菜单 SQL → 生成下载 ZIP，
 * 作为新业务模块的起点。三步流水线见 components/GeneratorPipeline。
 *
 * 数据来源：/api/generator（gen_tables + gen_table_columns，employee.db）。
 */
import { useEffect, useState } from "react";
import { Checkbox, Input, Modal, Table, Tag, Tooltip, message } from "antd";
import {
  CloudDownloadOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import GeneratorPipeline from "../components/GeneratorPipeline";
import {
  downloadGenTable,
  importTables,
  listGenTables,
  listImportableTables,
  type GenTableItem,
  type ImportableTable,
} from "../api/generator";
import { errText } from "../utils/apiError";

function panelHead(title: string, total: number, extra: React.ReactNode) {
  return (
    <div className="lv-panel-head">
      <span className="lv-dot" aria-hidden="true" />
      <b>{title}</b>
      <span className="lv-count">共 {total} 条</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6, alignItems: "center" }}>{extra}</span>
    </div>
  );
}

export default function Generator() {
  const [rows, setRows] = useState<GenTableItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [kwInput, setKwInput] = useState("");
  const [kw, setKw] = useState("");

  // 导入
  const [importOpen, setImportOpen] = useState(false);
  const [importKw, setImportKw] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [candidates, setCandidates] = useState<ImportableTable[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  // 流水线
  const [pipeTable, setPipeTable] = useState<GenTableItem | null>(null);
  const [pipeStep, setPipeStep] = useState<1 | 2 | 3>(1);
  const [generating, setGenerating] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listGenTables({ keyword: kw || undefined });
      setRows(r.items);
      setTotal(r.total);
    } catch (e) {
      message.error(errText(e, "列表加载失败"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [kw]);

  const openImport = async () => {
    setImportOpen(true);
    setPicked([]);
    await loadCandidates();
  };

  const loadCandidates = async () => {
    setImportLoading(true);
    try {
      setCandidates(await listImportableTables(importKw.trim() || undefined));
    } catch (e) {
      message.error(errText(e, "数据库表加载失败"));
    } finally {
      setImportLoading(false);
    }
  };

  const togglePick = (name: string) => {
    setPicked((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const doImport = async () => {
    if (!picked.length) return;
    setImporting(true);
    try {
      await importTables(picked);
      message.success(`已导入 ${picked.length} 张表`);
      setImportOpen(false);
      setKw("");
      setKwInput("");
      await load();
    } catch (e) {
      message.error(errText(e, "导入失败"));
    } finally {
      setImporting(false);
    }
  };

  const openPipeline = (row: GenTableItem, step: 1 | 2 | 3) => {
    setPipeStep(step);
    setPipeTable(row);
  };

  const generate = async (row: GenTableItem) => {
    setGenerating(row.id);
    try {
      await downloadGenTable(row.id, `${row.className}.zip`);
      message.success(`已生成「${row.tableComment || row.tableName}」代码包`);
    } catch (e) {
      message.error(errText(e, "代码生成失败"));
    } finally {
      setGenerating(null);
    }
  };

  const columns = [
    {
      title: "数据表", dataIndex: "tableName", key: "tableName", minWidth: 220,
      render: (_: unknown, row: GenTableItem) => (
        <div className="cell-main">
          <span className="row-ico"><DatabaseOutlined /></span>
          <div style={{ minWidth: 0 }}>
            <div className="cell-title mono" style={{ fontSize: 12.5 }}>{row.tableName}</div>
            <div className="cell-sub ellipsis">{row.tableComment || "未填写表说明"}</div>
          </div>
        </div>
      ),
    },
    { title: "实体类", dataIndex: "className", key: "className", render: (v: string) => <span className="mono">{v}</span> },
    { title: "模块", dataIndex: "module", key: "module", width: 100, render: (v: string) => <span className="code-chip">{v}</span> },
    {
      title: "状态", dataIndex: "synced", key: "synced", width: 100,
      render: (v: boolean) => (v ? <Tag color="green" style={{ borderRadius: 999 }}>已确认</Tag> : <Tag style={{ borderRadius: 999 }}>待确认</Tag>),
    },
    { title: "导入时间", dataIndex: "createTime", key: "createTime", width: 150, render: (v: string | null) => <span className="tnum soft">{v || "—"}</span> },
    {
      title: "操作", key: "actions", width: 210, className: "col-actions",
      render: (_: unknown, row: GenTableItem) => (
        <div className="row-actions" style={{ justifyContent: "flex-end" }}>
          <button className="lv-link" type="button" data-act="preview" onClick={() => openPipeline(row, 3)}><EyeOutlined /> 预览</button>
          <button className="lv-link" type="button" data-act="config" onClick={() => openPipeline(row, 1)}><SettingOutlined /> 配置</button>
          <button className="lv-link" type="button" data-act="generate" disabled={generating === row.id} onClick={() => generate(row)}>
            <DownloadOutlined /> {generating === row.id ? "生成中…" : "生成"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="lv" style={{ padding: "8px 0 32px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="md-page-title" style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>代码生成</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 5 }}>
            导入数据库表，预览并下载后端四层、前端页面与菜单权限 SQL，作为新业务模块的起点。
          </div>
        </div>
        <button className="lv-btn lv-btn--primary" type="button" data-act="import" onClick={openImport}>
          <CloudDownloadOutlined /> 导入数据表
        </button>
      </div>

      {/* 查询面板 */}
      <div className="lv-query" style={{ borderRadius: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
          placeholder="表名 / 表说明"
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          onPressEnter={() => setKw(kwInput)}
          className="lv-query-input"
          data-act="keyword"
        />
        <div className="lv-query-actions">
          <button className="lv-btn" type="button" data-act="reset" onClick={() => { setKwInput(""); setKw(""); }}>重置</button>
          <button className="lv-btn lv-btn--primary" type="button" data-act="search" onClick={() => setKw(kwInput)}>
            <SearchOutlined /> 查询
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div className="lv-panel">
        {panelHead("已导入的表", total, (
          <Tooltip title="刷新">
            <button className="icon-btn" type="button" data-act="refresh" onClick={load}><ReloadOutlined /></button>
          </Tooltip>
        ))}
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={false}
          locale={{ emptyText: "还没有导入的表，点击右上角「导入数据表」开始" }}
        />
      </div>

      {/* 导入弹窗 */}
      <Modal
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        title="导入数据表"
        width={620}
        destroyOnHidden
        footer={
          <div className="lv-submit">
            <span className="soft" style={{ marginRight: "auto", fontSize: 12 }}>已选 {picked.length} 张</span>
            <button className="lv-btn" type="button" onClick={() => setImportOpen(false)}>取消</button>
            <button className="lv-btn lv-btn--primary" type="button" disabled={!picked.length} onClick={doImport} data-act="do-import">
              {importing ? "导入中…" : "导入"}
            </button>
          </div>
        }
      >
        <div className="import-search">
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
            placeholder="表名 / 表说明"
            value={importKw}
            onChange={(e) => setImportKw(e.target.value)}
            onPressEnter={loadCandidates}
            data-act="import-kw"
          />
          <button className="lv-btn" type="button" onClick={loadCandidates} disabled={importLoading}>查询</button>
        </div>
        <div className="import-list">
          {importLoading && !candidates.length ? (
            <div style={{ padding: 12 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton" style={{ width: `${50 + ((i * 11) % 40)}%`, margin: "12px 0" }} />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="select-empty" style={{ padding: 28 }}>没有可导入的表</div>
          ) : (
            candidates.map((c) => (
              <div
                key={c.tableName}
                className={`import-row${picked.includes(c.tableName) ? " is-on" : ""}${c.imported ? " is-disabled" : ""}`}
                onClick={() => !c.imported && togglePick(c.tableName)}
                data-act="candidate"
              >
                <Checkbox checked={picked.includes(c.tableName)} disabled={c.imported} onChange={() => togglePick(c.tableName)} />
                <span className="mono" style={{ fontSize: 12.5 }}>{c.tableName}</span>
                <span className="muted ellipsis" style={{ flex: 1 }}>{c.tableComment || "未填写表说明"}</span>
                {c.imported && <Tag style={{ borderRadius: 999 }}>已导入</Tag>}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* 三步流水线 */}
      <GeneratorPipeline
        table={pipeTable}
        step={pipeStep}
        onClose={() => setPipeTable(null)}
        onSaved={() => {
          load();
        }}
        onGenerate={(t) => {
          generate(t);
          setPipeTable(null);
        }}
      />
    </div>
  );
}
