/**
 * 字典样本册 —— 移植自 scaffold DictSwatchbook.vue。
 * 每个字典类型一张卡，渲染真实标签样式与色调分布条；点卡片原地展开，
 * 行内切换色调 / 默认项 / 状态即时生效；新增与完整编辑走页面统一表单。
 */
import { useEffect, useMemo, useState } from "react";
import { Switch, Tooltip, message } from "antd";
import { CheckOutlined, DownOutlined, EditOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import DictTag, { toneClass } from "./DictTag";
import { listDictData, updateDictData, type DictDataItem, type DictTypeItem } from "../api/dicts";
import { errText } from "../utils/apiError";

const TONES = [
  { value: "neutral", label: "中性" },
  { value: "ok", label: "状态" },
  { value: "info", label: "信息" },
  { value: "danger", label: "警示" },
] as const;

export interface DictSwatchbookRef {
  reload: (dictType: string) => Promise<void>;
}

export default function DictSwatchbook({
  types,
  loading,
  onCreateItem,
  onEditItem,
  onEditType,
}: {
  types: DictTypeItem[];
  loading?: boolean;
  onCreateItem: (type: DictTypeItem) => void;
  onEditItem: (type: DictTypeItem, item: DictDataItem) => void;
  onEditType: (type: DictTypeItem) => void;
}) {
  const [items, setItems] = useState<Record<string, DictDataItem[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async (dictType: string) => {
    try {
      const rows = await listDictData(dictType);
      setItems((prev) => ({ ...prev, [dictType]: [...rows].sort((a, b) => a.sort - b.sort) }));
    } catch (e: any) {
      message.error(errText(e, "字典数据加载失败"));
    }
  };

  useEffect(() => {
    types.filter((t) => !items[t.dict_type]).forEach((t) => load(t.dict_type));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types]);

  const distribution = (list: DictDataItem[] = []) => {
    const total = list.length || 1;
    return TONES.map((t) => ({
      tone: t.value,
      share: list.filter((i) => toneClass(i.tone) === t.value).length / total,
    })).filter((d) => d.share > 0);
  };

  const toggle = (dictType: string) => {
    setExpanded((prev) => (prev === dictType ? null : dictType));
  };

  const patch = async (
    type: DictTypeItem,
    item: DictDataItem,
    change: Partial<Pick<DictDataItem, "tone" | "def" | "status">>,
  ) => {
    const before = { tone: item.tone, def: item.def, status: item.status };
    setItems((prev) => ({
      ...prev,
      [type.dict_type]: (prev[type.dict_type] || []).map((i) => {
        if (i.id !== item.id) return change.def ? { ...i, def: false } : i;
        return { ...i, ...change };
      }),
    }));
    try {
      await updateDictData(item.id, { dict_type: type.dict_type, ...change } as any);
      if (change.def) await load(type.dict_type);
    } catch (e: any) {
      setItems((prev) => ({
        ...prev,
        [type.dict_type]: (prev[type.dict_type] || []).map((i) =>
          i.id === item.id ? { ...i, ...before } : i,
        ),
      }));
      message.error(errText(e, "字典数据更新失败"));
    }
  };

  const sorted = useMemo(() => types, [types]);

  return (
    <div className="swatchbook" data-testid="swatchbook">
      {loading && !types.length && <p className="band-empty">正在加载字典…</p>}
      {sorted.map((t) => {
        const open = expanded === t.dict_type;
        const list = items[t.dict_type] ?? [];
        return (
          <article
            key={t.dict_type}
            data-dict={t.dict_type}
            className={`swatch${open ? " is-open" : ""}${t.status !== 1 ? " is-off" : ""}`}
          >
            <button type="button" className="swatch-head" aria-expanded={open} onClick={() => toggle(t.dict_type)}>
              <span className="swatch-title">
                <b>{t.dict_name}</b>
                <span className="code-chip">{t.dict_type}</span>
              </span>
              <span className="swatch-count">
                {list.length}
                <small>项</small>
              </span>
              {open ? (
                <DownOutlined style={{ fontSize: 15, color: "var(--lv-faint)", marginTop: 2 }} />
              ) : (
                <RightOutlined style={{ fontSize: 15, color: "var(--lv-faint)", marginTop: 2 }} />
              )}
            </button>

            <div className="swatch-tags">
              {(open ? [] : list.slice(0, 8)).map((i) => (
                <DictTag key={i.id} tone={i.tone} isOff={i.status !== 1}>
                  {i.label}
                  {i.def && <CheckOutlined style={{ fontSize: 11 }} />}
                </DictTag>
              ))}
              {!open && list.length > 8 && <span style={{ fontSize: 12, color: "var(--lv-faint)" }}>+{list.length - 8}</span>}
              {!open && list.length === 0 && <span style={{ fontSize: 12, color: "var(--lv-faint)" }}>还没有字典数据</span>}
            </div>

            <div className="swatch-bar" aria-hidden>
              {distribution(list).map((d) => (
                <i key={d.tone} className={`tone-${d.tone}`} style={{ flexGrow: d.share }} />
              ))}
            </div>

            {!open && (
              <footer className="swatch-foot">
                {t.status === 1 ? (
                  <DictTag tone="ok">正常</DictTag>
                ) : (
                  <DictTag tone="neutral">停用</DictTag>
                )}
                <span style={{ color: "var(--lv-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.remark || "未填写用途说明"}
                </span>
              </footer>
            )}

            {open && (
              <div className="swatch-editor">
                {list.map((i) => (
                  <div key={i.id} className="swatch-row">
                    <DictTag tone={i.tone} isOff={i.status !== 1}>
                      {i.label}
                    </DictTag>
                    <span className="code-chip">{i.value}</span>
                    <span className="swatch-tones" role="radiogroup" aria-label={`${i.label} 的标签色调`}>
                      {TONES.map((tone) => (
                        <Tooltip key={tone.value} title={tone.label}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={toneClass(i.tone) === tone.value}
                            aria-label={tone.label}
                            className={`swatch-tone tone-${tone.value}${toneClass(i.tone) === tone.value ? " is-on" : ""}`}
                            onClick={() => patch(t, i, { tone: tone.value })}
                          />
                        </Tooltip>
                      ))}
                    </span>
                    <button
                      type="button"
                      className={`swatch-def${i.def ? " is-on" : ""}`}
                      aria-pressed={i.def}
                      disabled={i.def}
                      title={i.def ? "默认项" : "设为默认项"}
                      onClick={() => patch(t, i, { def: true })}
                    >
                      <CheckOutlined style={{ fontSize: 12 }} />
                      {i.def ? "默认" : "设为默认"}
                    </button>
                    <Switch
                      size="small"
                      checked={i.status === 1}
                      onChange={(v) => patch(t, i, { status: v ? 1 : 0 })}
                    />
                    <Tooltip title="编辑字典数据">
                      <button className="icon-btn icon-btn-sm" type="button" onClick={() => onEditItem(t, i)}>
                        <EditOutlined />
                      </button>
                    </Tooltip>
                  </div>
                ))}
                <div className="swatch-actions">
                  <button className="lv-btn" type="button" onClick={() => onEditType(t)}>
                    <EditOutlined /> 编辑类型
                  </button>
                  <button className="lv-btn lv-btn--primary" type="button" onClick={() => onCreateItem(t)}>
                    <PlusOutlined /> 新增数据
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
