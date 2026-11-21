/**
 * 代码生成流水线（移植 scaffold GeneratorPipeline.vue）：
 * ① 表信息 → ② 字段映射 → ③ 代码预览，一个弹窗走完。
 *
 * - 字段映射用图谱舞台把「数据库字段 → 模型字段 → 页面呈现」三列连起来，脉冲沿生成方向流动；
 * - 代码预览按行级联显现；表说明与确认状态可保存（沿用后端 update 接口）。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Modal, Spin, Switch, Tooltip, message } from "antd";
import {
  ArrowRightOutlined,
  ArrowLeftOutlined,
  CopyOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  CodeOutlined,
  DownloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import StageGraph, { type GraphLink, type GraphNode } from "./StageGraph";
import {
  getGenColumns,
  previewGenTable,
  updateGenTable,
  type GenColumn,
  type GenFile,
  type GenTableItem,
} from "../api/generator";
import { errText } from "../utils/apiError";

const STEPS = [
  { n: 1, label: "表信息", icon: <DatabaseOutlined /> },
  { n: 2, label: "字段映射", icon: <AppstoreOutlined /> },
  { n: 3, label: "代码预览", icon: <CodeOutlined /> },
] as const;

const FORM_LABEL: Record<string, string> = {
  input: "输入框", textarea: "多行文本", select: "下拉选择", radio: "单选",
  checkbox: "多选", datetime: "日期时间", date: "日期", number: "数字", upload: "上传", editor: "富文本",
  文本框: "文本框", 文本域: "多行文本", 数字框: "数字框", 日期框: "日期框", 开关: "开关",
};

function folderOf(path: string) {
  return path.split("/").slice(0, -1).join("/");
}

export default function GeneratorPipeline({
  table,
  step = 1,
  onClose,
  onSaved,
  onGenerate,
}: {
  table: GenTableItem | null;
  step?: 1 | 2 | 3;
  onClose: () => void;
  onSaved: () => void;
  onGenerate: (t: GenTableItem) => void;
}) {
  const [cur, setCur] = useState<1 | 2 | 3>(1);
  const [columns, setColumns] = useState<GenColumn[]>([]);
  const [files, setFiles] = useState<GenFile[]>([]);
  const [activePath, setActivePath] = useState("");
  const [comment, setComment] = useState("");
  const [synced, setSynced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const codeRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (!table) return;
    setCur(step);
    setComment(table.tableComment || "");
    setSynced(table.synced);
    setColumns([]);
    setFiles([]);
    setLoading(true);
    Promise.all([getGenColumns(table.id), previewGenTable(table.id)])
      .then(([cols, prev]) => {
        setColumns(cols);
        setFiles(prev.files);
        setActivePath(prev.files.find((f) => f.path === prev.activeFile)?.path ?? prev.files[0]?.path ?? "");
      })
      .catch((e) => message.error(errText(e, "生成配置加载失败")))
      .finally(() => setLoading(false));
  }, [table, step]);

  /* ── ② 字段映射图：数据库字段 → 模型字段 → 页面呈现 ── */
  const { nodes, links } = useMemo(() => {
    const { w, h } = size;
    if (!w || !h || !columns.length) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const gap = Math.min(40, (h - 48) / Math.max(1, columns.length - 1));
    const y0 = h / 2 - (gap * (columns.length - 1)) / 2;
    const xDb = w * 0.24, xField = w * 0.5, xOut = w * 0.78;
    columns.forEach((c, i) => {
      const y = y0 + i * gap;
      nodes.push({
        id: `db:${c.id}`, x: xDb, y, label: c.col,
        sub: c.dbType + (c.required ? " · 必填" : ""),
        kind: "item", align: "right", cat: 2, delay: i * 0.04, title: c.comment || c.col,
      });
      nodes.push({
        id: `f:${c.id}`, x: xField, y, label: c.field, sub: c.type,
        kind: "item", cat: 3, from: `db:${c.id}`, delay: 0.3 + i * 0.04,
      });
      links.push({ a: `db:${c.id}`, b: `f:${c.id}`, flow: "forward", shape: "h", cat: 2 });
    });
    const targets = new Map<string, { label: string; sub: string; cat: number; members: number[] }>();
    const add = (key: string, label: string, sub: string, cat: number, id: number) => {
      if (!targets.has(key)) targets.set(key, { label, sub, cat, members: [] });
      targets.get(key)!.members.push(id);
    };
    columns.forEach((c) => {
      const fl = FORM_LABEL[c.formType] ?? c.formType;
      if (c.insert || c.edit) add(`form:${c.formType}`, `表单 · ${fl}`, c.formType, 5, c.id);
      if (c.list) add("list", "列表列", "Table", 1, c.id);
      if (c.query) add(`query:${c.queryType}`, `查询条件 · ${c.queryType}`, "SearchForm", 4, c.id);
    });
    const tlist = [...targets.entries()];
    const tgap = Math.min(64, (h - 64) / Math.max(1, tlist.length - 1));
    const ty0 = h / 2 - (tgap * (tlist.length - 1)) / 2;
    tlist.forEach(([key, t], i) => {
      nodes.push({
        id: `out:${key}`, x: xOut, y: ty0 + i * tgap, label: t.label, sub: t.sub,
        count: t.members.length, kind: "item", align: "left", cat: t.cat, delay: 0.8 + i * 0.08,
      });
      t.members.forEach((id) => links.push({ a: `f:${id}`, b: `out:${key}`, flow: "forward", shape: "h", cat: t.cat }));
    });
    return { nodes, links };
  }, [size, columns]);

  const stats = useMemo(() => ({
    fields: columns.length,
    form: columns.filter((c) => c.insert || c.edit).length,
    list: columns.filter((c) => c.list).length,
    query: columns.filter((c) => c.query).length,
    required: columns.filter((c) => c.required).length,
  }), [columns]);

  /* ── ③ 代码预览 ── */
  const activeFile = files.find((f) => f.path === activePath);
  const lines = (activeFile?.code ?? "").split("\n");
  const tree = useMemo(() => {
    const groups = new Map<string, GenFile[]>();
    files.forEach((f) => groups.set(folderOf(f.path), [...(groups.get(folderOf(f.path)) ?? []), f]));
    return [...groups.entries()];
  }, [files]);

  useEffect(() => {
    if (cur === 3 && codeRef.current) {
      const rows = Array.from(codeRef.current.querySelectorAll(".code-line")).slice(0, 48);
      rows.forEach((el, i) => {
        (el as HTMLElement).style.opacity = "0";
        (el as HTMLElement).style.transform = "translateX(-8px)";
        requestAnimationFrame(() => {
          (el as HTMLElement).style.transition = "opacity .32s ease, transform .32s ease";
          (el as HTMLElement).style.transitionDelay = `${i * 0.012}s`;
          (el as HTMLElement).style.opacity = "1";
          (el as HTMLElement).style.transform = "none";
        });
      });
    }
  }, [cur, activePath]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeFile?.code ?? "");
      message.success("已复制当前文件");
    } catch {
      message.error("当前浏览器不支持写入剪贴板");
    }
  };

  const save = async () => {
    if (!table) return;
    setSaving(true);
    try {
      await updateGenTable(table.id, { tableComment: comment, synced });
      message.success("生成配置已保存");
      onSaved();
    } catch (e) {
      message.error(errText(e, "配置保存失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(table)}
      onCancel={onClose}
      footer={null}
      width={1120}
      destroyOnHidden
      title={<span>代码生成流水线{table ? <span className="pipe-sub mono"> · {table.tableName}</span> : null}</span>}
    >
      {/* 步骤条 */}
      <div className="pipe-steps" role="tablist" aria-label="生成步骤">
        <span
          className="pipe-thumb"
          style={{ transform: `translateX(calc(${cur - 1} * 100% + ${(cur - 1) * 4}px))` }}
          aria-hidden="true"
        />
        {STEPS.map((s) => (
          <button
            key={s.n}
            type="button"
            role="tab"
            aria-selected={cur === s.n}
            className={`pipe-step${cur === s.n ? " is-on" : ""}${cur > s.n ? " is-done" : ""}`}
            onClick={() => setCur(s.n)}
          >
            <span className="pipe-step-n">{s.n}</span>
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      <div className="pipe-stage">
        {loading && (
          <div className="pipe-loading"><Spin /> 正在读取字段与生成预览…</div>
        )}

        {/* ① 表信息 */}
        {!loading && cur === 1 && (
          <div className="pipe-info">
            <div className="pipe-form-grid">
              <label className="pipe-field">
                <span className="pipe-label">表说明</span>
                <Input
                  placeholder="如：请假审批"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  data-act="comment"
                />
                <span className="pipe-hint">用于生成页面标题与菜单名称</span>
              </label>
              <label className="pipe-field">
                <span className="pipe-label">实体类</span>
                <Input value={table?.className} readOnly />
              </label>
              <label className="pipe-field">
                <span className="pipe-label">模块 / 业务名</span>
                <Input value={`${table?.module} / ${table?.businessName}`} readOnly />
              </label>
              <label className="pipe-field">
                <span className="pipe-label">配置状态</span>
                <span className="pipe-switch">
                  <Switch checked={synced} onChange={setSynced} data-act="synced" />
                  <span>{synced ? "已确认" : "待确认"}</span>
                </span>
                <span className="pipe-hint">确认字段无误后标记为已确认</span>
              </label>
            </div>
            <dl className="pipe-readouts">
              <div><dt>字段</dt><dd className="tnum">{stats.fields}</dd></div>
              <div><dt>表单项</dt><dd className="tnum">{stats.form}</dd></div>
              <div><dt>列表列</dt><dd className="tnum">{stats.list}</dd></div>
              <div><dt>查询条件</dt><dd className="tnum">{stats.query}</dd></div>
              <div><dt>必填</dt><dd className="tnum">{stats.required}</dd></div>
              <div><dt>生成文件</dt><dd className="tnum">{files.length}</dd></div>
            </dl>
          </div>
        )}

        {/* ② 字段映射 */}
        {!loading && cur === 2 && (
          <div className="pipe-map">
            <div className="pipe-map-head" aria-hidden="true">
              <span style={{ left: "24%" }}>数据库字段</span>
              <span style={{ left: "50%" }}>模型字段</span>
              <span style={{ left: "78%" }}>页面呈现</span>
            </div>
            <div className="pipe-graph">
              <StageGraph
                variant="stage"
                label="字段映射图"
                nodes={nodes}
                links={links}
                size={size}
                onSize={setSize}
              />
            </div>
            <p className="pipe-note">字段的表单类型、查询方式按数据库类型自动推断；悬停任一节点查看它的去向。</p>
          </div>
        )}

        {/* ③ 代码预览 */}
        {!loading && cur === 3 && (
          <div className="pipe-preview">
            <nav className="pipe-files" aria-label="生成文件">
              {tree.map(([dir, list]) => (
                <div key={dir} className="pipe-dir-group">
                  <span className="pipe-dir mono">{dir}</span>
                  {list.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      className={`pipe-file${f.path === activePath ? " is-active" : ""}`}
                      onClick={() => setActivePath(f.path)}
                      aria-current={f.path === activePath ? "true" : undefined}
                    >
                      <span className="pipe-name">{f.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </nav>
            <div className="pipe-code">
              <div className="pipe-code-head">
                <span className="mono soft ellipsis">{activeFile?.path}</span>
                <span className="faint tnum pipe-linecount">{lines.length} 行</span>
                <Tooltip title="复制">
                  <button className="icon-btn" type="button" onClick={copyCode} data-act="copy"><CopyOutlined /></button>
                </Tooltip>
              </div>
              <pre ref={codeRef} className="pipe-code-block">
                {lines.map((line, i) => (
                  <span key={`${activePath}-${i}`} className="code-line">
                    <i className="tnum">{i + 1}</i>
                    {line || " "}
                  </span>
                ))}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* 页脚 */}
      <div className="pipe-footer">
        {cur > 1 && (
          <Button icon={<ArrowLeftOutlined />} onClick={() => setCur((cur - 1) as 1 | 2)}>上一步</Button>
        )}
        <span style={{ flex: 1 }} />
        <Button icon={<SaveOutlined />} loading={saving} onClick={save} data-act="save">保存配置</Button>
        {cur < 3 ? (
          <Button type="primary" onClick={() => setCur((cur + 1) as 2 | 3)} data-act="next">
            下一步 <ArrowRightOutlined />
          </Button>
        ) : (
          <Button type="primary" icon={<DownloadOutlined />} onClick={() => table && onGenerate(table)} data-act="download">
            生成并下载
          </Button>
        )}
      </div>
    </Modal>
  );
}
