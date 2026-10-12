/**
 * PermissionMatrix —— 角色 × 菜单授权矩阵（移植 scaffold PermissionMatrix.vue，可编辑版）。
 *
 * 行 = 菜单树（目录可折叠），列 = 角色。
 * - 悬停十字高亮整行整列；点格子切换授权（目录/菜单行整枝开关，勾选子项连带勾上祖先）；
 * - 内置角色列只读；有改动时底部升起「未保存 N 项」浮条，一次提交。
 *
 * 数据：roles/grants 来自 /api/roles（sys_roles + sys_role_menus）；
 *       菜单树来自 config/nav.ts（目录=分组，菜单=导航项）。
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "antd";
import { CheckOutlined, DownOutlined, RightOutlined } from "@ant-design/icons";
import type { NavGroup } from "../config/nav";

export interface MatrixRole {
  id: number;
  name: string;
  code: string;
  builtin: boolean;
  status: number;
}

interface MatrixRow {
  key: string;
  name: string;
  type: "dir" | "menu";
  depth: number;
  parents: string[];
  descendants: string[];
}

const TYPE_LABEL: Record<string, string> = { dir: "目录", menu: "菜单" };

function flattenGroups(groups: NavGroup[]): MatrixRow[] {
  const rows: MatrixRow[] = [];
  groups.forEach((g) => {
    const dirKey = `g:${g.short}`;
    const itemKeys = g.items.map((i) => i.key);
    rows.push({ key: dirKey, name: g.label, type: "dir", depth: 0, parents: [], descendants: itemKeys });
    g.items.forEach((i) => {
      rows.push({ key: i.key, name: i.name, type: "menu", depth: 1, parents: [dirKey], descendants: [] });
    });
  });
  return rows;
}

export interface MatrixChange { roleId: number; menuIds: string[] }

export default function PermissionMatrix({
  menus,
  roles,
  grants,
  editable,
  saving,
  onSave,
}: {
  menus: NavGroup[];
  roles: MatrixRole[];
  grants: Record<number, string[]>;
  editable: boolean;
  saving?: boolean;
  onSave?: (changes: MatrixChange[]) => void;
}) {
  const [draft, setDraft] = useState<Record<number, Set<string>>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<number, Set<string>> = {};
    roles.forEach((r) => { next[r.id] = new Set(grants[r.id] ?? []); });
    setDraft(next);
  }, [roles, grants]);

  const rows = useMemo(() => flattenGroups(menus), [menus]);
  const visibleRows = useMemo(
    () => rows.filter((r) => !r.parents.some((id) => collapsed.has(id))),
    [rows, collapsed]
  );

  const state = (roleId: number, row: MatrixRow): "on" | "off" | "partial" => {
    const set = draft[roleId];
    if (!set) return "off";
    if (!row.descendants.length) return set.has(row.key) ? "on" : "off";
    const onCount = row.descendants.filter((id) => set.has(id)).length;
    if (set.has(row.key) && onCount === row.descendants.length) return "on";
    return set.has(row.key) || onCount ? "partial" : "off";
  };

  const toggle = (role: MatrixRole, row: MatrixRow) => {
    if (!editable || role.builtin) return;
    const set = new Set(draft[role.id] ?? []);
    const current = state(role.id, row);
    const ids = [row.key, ...row.descendants];
    if (current === "on") ids.forEach((id) => set.delete(id));
    else {
      ids.forEach((id) => set.add(id));
      row.parents.forEach((id) => set.add(id));
    }
    setDraft({ ...draft, [role.id]: set });
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* 改动：按角色与原始授权做差集 */
  const changes = useMemo(
    () =>
      roles
        .filter((r) => !r.builtin)
        .map((r) => {
          const before = new Set(grants[r.id] ?? []);
          const after = draft[r.id] ?? new Set<string>();
          let diff = 0;
          after.forEach((id) => { if (!before.has(id)) diff += 1; });
          before.forEach((id) => { if (!after.has(id)) diff += 1; });
          return { role: r, diff, menuIds: [...after] };
        })
        .filter((c) => c.diff > 0),
    [roles, grants, draft]
  );
  const changeCount = changes.reduce((a, c) => a + c.diff, 0);

  const reset = () => {
    const next: Record<number, Set<string>> = {};
    roles.forEach((r) => { next[r.id] = new Set(grants[r.id] ?? []); });
    setDraft(next);
  };
  const save = () => onSave?.(changes.map((c) => ({ roleId: c.role.id, menuIds: c.menuIds })));

  const grantCount = (roleId: number) => draft[roleId]?.size ?? 0;

  return (
    <div className="mx" style={{ "--mx-cols": roles.length } as React.CSSProperties}>
      <div className="mx-scroll">
        <div className="mx-grid" role="grid">
          <div className="mx-head" role="row">
            <div className="mx-corner" role="columnheader">
              <span className="mx-eyebrow">菜单 × 角色</span>
            </div>
            {roles.map((r) => (
              <div
                key={r.id}
                role="columnheader"
                className={`mx-role${hoverCol === `r${r.id}` ? " is-hover" : ""}${r.builtin ? " is-locked" : ""}${r.status === 0 ? " is-off" : ""}`}
              >
                <span className="mx-role-name">{r.name}</span>
                <span className="mx-role-meta tnum">{r.builtin ? "内置 · 只读" : `${grantCount(r.id)} 项`}</span>
              </div>
            ))}
          </div>
          <div className="mx-body">
            {visibleRows.map((row) => {
              const isDir = row.descendants.length > 0;
              const isOpen = !collapsed.has(row.key);
              return (
                <div
                  key={row.key}
                  role="row"
                  className={`mx-row is-${row.type}${hoverRow === row.key ? " is-hover" : ""}`}
                >
                  <div className="mx-label" role="rowheader" style={{ paddingLeft: 14 + row.depth * 18 }}>
                    {isDir ? (
                      <button
                        type="button"
                        className={`tree-toggle${isOpen ? " is-open" : ""}`}
                        aria-label={isOpen ? "收起" : "展开"}
                        onClick={() => toggleCollapse(row.key)}
                      >
                        {isOpen ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                      </button>
                    ) : (
                      <span className="tree-toggle is-leaf" />
                    )}
                    <span className="mx-name ellipsis">{row.name}</span>
                    <span className="mx-type">{TYPE_LABEL[row.type]}</span>
                  </div>
                  {roles.map((r) => {
                    const st = state(r.id, row);
                    const locked = !editable || r.builtin;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="gridcell"
                        className={`mx-cell is-${st}${hoverCol === `r${r.id}` ? " is-col-hover" : ""}${locked ? " is-locked" : ""}`}
                        aria-pressed={st === "on" ? "true" : st === "partial" ? "mixed" : "false"}
                        aria-label={`${r.name} · ${row.name}`}
                        disabled={locked}
                        onPointerEnter={() => { setHoverRow(row.key); setHoverCol(`r${r.id}`); }}
                        onFocus={() => { setHoverRow(row.key); setHoverCol(`r${r.id}`); }}
                        onClick={() => toggle(r, row)}
                      >
                        <span className="mx-mark" aria-hidden="true">
                          {st === "on" ? <CheckOutlined style={{ fontSize: 12 }} /> : st === "partial" ? <span className="mx-partial" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {changeCount > 0 && (
        <div className="mx-floatbar" role="region" aria-label="未保存的权限变更">
          <span className="mx-floatbar-count">未保存 <b className="tnum">{changeCount}</b> 项 · {changes.length} 个角色</span>
          <span className="mx-floatbar-sep" aria-hidden="true" />
          <Button type="text" size="small" disabled={saving} onClick={reset}>撤销</Button>
          <Button type="primary" size="small" className="lv-submit" loading={saving} onClick={save}>保存变更</Button>
        </div>
      )}
    </div>
  );
}
