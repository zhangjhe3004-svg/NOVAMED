/**
 * 岗位阶梯 —— 1–9 级「数字身份权限」(auth_level) 的图谱舞台。
 *
 * 语汇（对齐 scaffold 的岗位阶梯）：
 *   九个岗位沿对角线自左下向右上等距铺开，每一级是带分类色上沿的珍珠玻璃台面，
 *   台面下淡色光柱垂到带刻度的地平线；脊线脉冲逐级向上传递（职级越高越靠上）。
 *   选中某一级 → 该级在岗成员以带标签的胶囊触须扇形长进上方空域（放 Discharge + delay 级联）。
 *   右侧信息卡给出该级权限范围、成员与编辑入口。
 *
 * 分类色取自「该级占多数的角色」——台面上沿的颜色就是这一级实际的岗位属性色，
 * 不是随便配的装饰色。窄屏时舞台横向滚动，不压缩对角线的可读性。
 *
 * 触须方向：台面在左半场就朝右上长、在右半场就朝左上长，永远长向空域，
 * 因此最低级和最高级的成员都不会被推出舞台外。
 *
 * 数据来源：
 *   · 管理员 → /users（全量员工，含 auth_level / work_status）
 *   · 非管理员 → /nearby/peers（本人责任链内的上级与下级），舞台降级但语义一致
 *   · /nearby/levels → 1–9 级的名称与权限说明（仅管理员可读，其余走内置默认文案）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Input, Segmented, Spin, Table, Tag, Tooltip, message } from "antd";
import {
  ApartmentOutlined,
  EditOutlined,
  ReloadOutlined,
  RiseOutlined,
  SaveOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../stores/auth";
import { listUsers, type UserItem } from "../api/users";
import {
  listLevels,
  listPeers,
  updateLevel,
  type PeerItem,
  type PermissionLevel,
} from "../api/nearby";
import { LEVELS, levelDesc, levelName, roleMeta } from "../config/nav";
import StageGraph, { type GraphLink, type GraphNode } from "../components/StageGraph";
import type { NetLink, NetNode } from "../utils/stage";
import { revealCascade, settlePop } from "../utils/motion";

interface Staff {
  id: number;
  real_name: string;
  role: string;
  department: string;
  title: string;
  auth_level: number;
  work_status: string;
}

/** 触须扇形：向右上（flip）/ 向左上展开，半径交替错开避免标签压叠 */
function fanPos(cx: number, cy: number, index: number, total: number, flip: boolean) {
  const t = total <= 1 ? 0.5 : index / (total - 1);
  const from = flip ? 8 : 102;
  const to = flip ? 76 : 172;
  const ang = ((from + t * (to - from)) * Math.PI) / 180;
  const r = 164 + (index % 2) * 30 + (index % 3) * 14;
  return { x: cx + Math.cos(ang) * r, y: cy - Math.sin(ang) * r };
}

export default function PostLadder() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [levels, setLevels] = useState<PermissionLevel[]>([]);
  const [scope, setScope] = useState<"all" | "chain">("all");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"ladder" | "table">("ladder");
  const [selected, setSelected] = useState<number | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [size, setSize] = useState({ w: 800, h: 620 });
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const infoRef = useRef<HTMLDivElement | null>(null);
  const firstPaint = useRef(true);
  const isAdmin = user?.role === "admin";

  /* ---------- 数据 ---------- */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const [u, lv] = await Promise.all([
          listUsers({ page_size: 100 }),
          listLevels().catch(() => ({ items: [] as PermissionLevel[] })),
        ]);
        setStaff(
          (u.items || []).map((x: UserItem) => ({
            id: x.id,
            real_name: x.real_name || x.username,
            role: x.role,
            department: x.department || "",
            title: x.title || "",
            auth_level: x.auth_level || 1,
            work_status: x.work_status || "在职",
          }))
        );
        setLevels(lv.items || []);
        setScope("all");
      } else {
        const p = await listPeers();
        setStaff(
          (p.items || []).map((x: PeerItem) => ({
            id: x.id,
            real_name: x.real_name || x.username,
            role: x.role,
            department: x.department || "",
            title: x.title || "",
            auth_level: x.auth_level || 1,
            work_status: "在职",
          }))
        );
        setLevels([]);
        setScope("chain");
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载岗位数据失败");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- 按级别分组 ---------- */
  const byLevel = useMemo(() => {
    const map = new Map<number, Staff[]>();
    LEVELS.forEach((lv) => map.set(lv, []));
    staff.forEach((s) => {
      const lv = Math.min(9, Math.max(1, s.auth_level || 1));
      map.get(lv)!.push(s);
    });
    return map;
  }, [staff]);

  const maxCount = useMemo(
    () => Math.max(1, ...LEVELS.map((lv) => byLevel.get(lv)!.length)),
    [byLevel]
  );

  /** 该级占比最高的角色 → 决定台面上沿颜色 */
  const leadRoleOf = useCallback(
    (lv: number) => {
      const members = byLevel.get(lv) ?? [];
      if (!members.length) return "";
      const tally = new Map<string, number>();
      members.forEach((m) => tally.set(m.role, (tally.get(m.role) || 0) + 1));
      return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    },
    [byLevel]
  );

  const levelNameOf = useCallback(
    (lv: number) => levels.find((l) => l.level === lv)?.name || levelName(lv),
    [levels]
  );
  const levelDescOf = useCallback(
    (lv: number) => levels.find((l) => l.level === lv)?.description || levelDesc(lv),
    [levels]
  );

  /* ---------- 舞台布局 ---------- */
  const geometry = useMemo(() => {
    const { w, h } = size;
    const pad = 52;
    const slabW = Math.max(66, Math.min(126, w / 9 - 14));
    const stepX = (w - pad * 2 - slabW) / (LEVELS.length - 1);
    const baseY = h - 84;
    const topY = Math.max(150, h * 0.5);
    const stepY = (baseY - topY) / (LEVELS.length - 1);
    const cx = (lv: number) => pad + slabW / 2 + (lv - 1) * stepX;
    const cy = (lv: number) => baseY - (lv - 1) * stepY;
    return { slabW, cx, cy, flipOf: (lv: number) => cx(lv) < w / 2 };
  }, [size]);

  const nodes = useMemo<GraphNode[]>(() => {
    const out: GraphNode[] = LEVELS.map((lv) => {
      const members = byLevel.get(lv) ?? [];
      const lead = leadRoleOf(lv);
      const count = members.length;
      return {
        id: `lv-${lv}`,
        x: geometry.cx(lv),
        y: geometry.cy(lv),
        label: levelNameOf(lv),
        sub: `${count} 人在岗`,
        kind: "slab",
        cat: lead ? roleMeta(lead).cat : undefined,
        tone: count ? undefined : "off",
        size: geometry.slabW,
        rank: `第 ${lv} 级`,
        count,
        ratio: count / maxCount,
      };
    });

    // 选中级别的成员：胶囊触须扇形长向空域
    if (selected) {
      const all = byLevel.get(selected) ?? [];
      const shown = all.slice(0, 6);
      const flip = geometry.flipOf(selected);
      shown.forEach((s, j) => {
        const p = fanPos(geometry.cx(selected), geometry.cy(selected), j, shown.length, flip);
        out.push({
          id: `m-${s.id}`,
          x: p.x,
          y: p.y,
          label: s.real_name,
          sub: s.title || s.department || "—",
          kind: "item",
          cat: roleMeta(s.role).cat,
          align: flip ? "left" : "right",
          from: `lv-${selected}`,
          delay: 0.06 + j * 0.07,
          title: `${s.real_name} · ${roleMeta(s.role).text}${s.department ? ` · ${s.department}` : ""}`,
          count: s.work_status === "在职" ? undefined : s.work_status,
          tone: s.work_status === "在职" ? undefined : "off",
        });
      });
      if (all.length > shown.length) {
        const p = fanPos(
          geometry.cx(selected),
          geometry.cy(selected),
          shown.length,
          shown.length + 1,
          flip
        );
        out.push({
          id: `m-more-${selected}`,
          x: p.x,
          y: p.y,
          label: `另有 ${all.length - shown.length} 人`,
          sub: "去用户管理查看",
          kind: "item",
          align: flip ? "left" : "right",
          from: `lv-${selected}`,
          delay: 0.06 + shown.length * 0.07,
          interactive: false,
        });
      }
    }
    return out;
  }, [byLevel, geometry, levelNameOf, leadRoleOf, maxCount, selected]);

  const links = useMemo<GraphLink[]>(() => {
    const out: GraphLink[] = [];
    // 脊线：逐级向上，脉冲顺着台阶往上走
    for (let i = 0; i < LEVELS.length - 1; i += 1) {
      out.push({
        a: `lv-${LEVELS[i]}`,
        b: `lv-${LEVELS[i + 1]}`,
        shape: "h",
        flow: "forward",
        cat: 0,
      });
    }
    // 触须：台面 → 成员
    if (selected) {
      const all = byLevel.get(selected) ?? [];
      const ids = all.slice(0, 6).map((s) => `m-${s.id}`);
      if (all.length > 6) ids.push(`m-more-${selected}`);
      ids.forEach((id) => out.push({ a: `lv-${selected}`, b: id, shape: "arc", cat: 0 }));
    }
    return out;
  }, [byLevel, selected]);

  /** 背景网络：每级成员抽稀成点位，选中级别时聚焦同类 —— 给出「同岗同类」的整体密度感 */
  const network = useMemo(() => {
    const netNodes: NetNode[] = [];
    const netLinks: NetLink[] = [];
    LEVELS.forEach((lv) => {
      const members = byLevel.get(lv) ?? [];
      const shown = members.slice(0, 8);
      const flip = geometry.flipOf(lv);
      shown.forEach((s, j) => {
        const p = fanPos(geometry.cx(lv), geometry.cy(lv), j, shown.length, flip);
        netNodes.push({
          id: `m-${s.id}`,
          x: p.x,
          y: p.y,
          cat: roleMeta(s.role).cat,
          r: 2.6,
          depth: lv,
          label: s.real_name,
          angle: Math.atan2(p.y - geometry.cy(lv), p.x - geometry.cx(lv)),
        });
        netLinks.push({ a: `lv-${lv}`, b: `m-${s.id}`, cat: roleMeta(s.role).cat });
      });
    });
    return { nodes: netNodes, links: netLinks };
  }, [byLevel, geometry]);

  const leadCat = selected ? roleMeta(leadRoleOf(selected)).cat : null;

  /* ---------- 选中级别：初始化编辑草稿 ---------- */
  useEffect(() => {
    if (!selected) return;
    setDraft({ name: levelNameOf(selected), description: levelDescOf(selected) });
    setBurstKey((k) => k + 1);
  }, [selected, levelNameOf, levelDescOf]);

  /* ---------- 信息卡浮现（首次完整级联，之后只做落定确认） ---------- */
  useEffect(() => {
    if (loading) return;
    const el = infoRef.current;
    if (!el) return;
    if (firstPaint.current) {
      firstPaint.current = false;
      revealCascade(el, ":scope > *", 80);
    } else {
      settlePop(el);
    }
  }, [loading, selected]);

  const saveLevel = async () => {
    if (!selected) return;
    const row = levels.find((l) => l.level === selected);
    if (!row) {
      message.info("非管理员仅可查看；级别名称请由管理员在权限页面维护");
      return;
    }
    setSaving(true);
    try {
      const saved = await updateLevel(row.id, {
        name: draft.name,
        description: draft.description,
      });
      setLevels((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
      message.success(`第 ${selected} 级已更新`);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const selectedMembers = selected ? byLevel.get(selected) ?? [] : [];
  const selectedLead = selected ? leadRoleOf(selected) : "";

  /* ---------- 表格视图的行 ---------- */
  const rows = LEVELS.map((lv) => {
    const members = byLevel.get(lv) ?? [];
    const lead = leadRoleOf(lv);
    return {
      key: String(lv),
      lv,
      name: levelNameOf(lv),
      desc: levelDescOf(lv),
      count: members.length,
      lead: lead ? roleMeta(lead).text : "—",
      leadCat: lead ? roleMeta(lead).cat : 0,
    };
  });

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
      <div className="page-heading">
        <div>
          <div className="eyebrow">POST LADDER</div>
          <h1>岗位阶梯</h1>
          <div className="sub">
            按 1–9 级数字身份权限（auth_level）铺成对角阶梯：越靠右上，权限越大。
            台面上沿的颜色取自该级占比最高的角色；选中一级，其在岗成员会以胶囊触须扇形长出。
          </div>
        </div>
        <div className="actions">
          <Tag
            style={{
              border: "none",
              background: scope === "all" ? "#e4eaf4" : "#fdf3e0",
              color: scope === "all" ? "#2d4a74" : "#9a6a12",
            }}
          >
            <TeamOutlined style={{ marginRight: 4 }} />
            {scope === "all" ? `全院 ${staff.length} 人` : `责任链内 ${staff.length} 人`}
          </Tag>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
            刷新
          </Button>
        </div>
      </div>

      {scope === "chain" && (
        <p className="note" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", marginBottom: 14 }}>
          当前账号不是管理员，阶梯仅展示你责任链内的同事（上级 / 下级）。
          管理员登录后可看到全院岗位分布与级别名称编辑入口。
        </p>
      )}

      {view === "ladder" ? (
        <section className="panel md-no-lift">
          <div className="panel-head">
            <div>
              <h2>
                <RiseOutlined style={{ marginRight: 6 }} />
                阶梯舞台
              </h2>
              <small>方向键在台面之间移动，Esc 收起成员触须；「重播」可重放开场涟漪</small>
            </div>
            {viewToggle}
          </div>
          <div className="panel-body" style={{ paddingTop: 0 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <Spin />
              </div>
            ) : staff.length === 0 ? (
              <Empty description="没有可展示的岗位数据" />
            ) : (
              <div className="trace-wrap">
                <div className="stage-scroll">
                  <StageGraph
                    className="ladder-stage"
                    style={{ height: 620 }}
                    variant="stage"
                    label="岗位阶梯图谱"
                    nodes={nodes}
                    links={links}
                    size={size}
                    onSize={setSize}
                    activeId={selected ? `lv-${selected}` : null}
                    highlight={
                      selected
                        ? [
                            `lv-${selected}`,
                            ...(byLevel.get(selected) ?? []).slice(0, 6).map((s) => `m-${s.id}`),
                          ]
                        : null
                    }
                    network={network}
                    networkFocus={leadCat}
                    networkAlpha={selected ? 0.85 : 0.34}
                    burstKey={burstKey}
                    onSelect={(n) => {
                      if (n.kind === "slab") {
                        const lv = Number(n.id.replace("lv-", ""));
                        setSelected((cur) => (cur === lv ? null : lv));
                      } else if (n.id.startsWith("m-")) {
                        navigate("/users");
                      }
                    }}
                    onBack={() => setSelected(null)}
                    tl={
                      <div className="rg-hint">
                        <ApartmentOutlined />
                        <span>
                          {selected
                            ? `第 ${selected} 级 · ${selectedMembers.length} 人在岗`
                            : "点选台面查看该级成员"}
                        </span>
                      </div>
                    }
                    bl={
                      <div className="rg-legend">
                        {["admin", "doctor", "nurse", "senior", "staff"].map((r) => (
                          <span key={r} className={`rg-legend-item cat-${roleMeta(r).cat}`}>
                            <i aria-hidden="true" />
                            {roleMeta(r).text}
                          </span>
                        ))}
                      </div>
                    }
                  />
                </div>

                <aside className="insight ladder-card" ref={infoRef}>
                  {selected ? (
                    <>
                      <div className="insight-head">
                        <span
                          className={`insight-swatch cat-${roleMeta(selectedLead).cat}`}
                          aria-hidden="true"
                        />
                        <div className="insight-title">
                          <b>{levelNameOf(selected)}</b>
                          <small>
                            第 {selected} 级 · {selectedMembers.length} 人在岗
                            {selectedLead ? ` · 多为${roleMeta(selectedLead).text}` : ""}
                          </small>
                        </div>
                        <Button
                          type="text"
                          size="small"
                          aria-label="收起"
                          icon={<EditOutlined />}
                          onClick={() => setSelected(null)}
                        />
                      </div>

                      <div className="insight-section">
                        <div className="insight-section-head">
                          <span>岗位定义</span>
                          <small>{isAdmin ? "可编辑" : "仅管理员可编辑"}</small>
                        </div>
                        <label className="ladder-field">
                          <span>岗位名称</span>
                          <Input
                            size="small"
                            value={draft.name}
                            disabled={!isAdmin}
                            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                          />
                        </label>
                        <label className="ladder-field">
                          <span>权限范围</span>
                          <Input.TextArea
                            size="small"
                            autoSize={{ minRows: 2, maxRows: 3 }}
                            value={draft.description}
                            disabled={!isAdmin}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, description: e.target.value }))
                            }
                          />
                        </label>
                      </div>

                      <div className="insight-section">
                        <div className="insight-section-head">
                          <span>在岗成员</span>
                          <small>共 {selectedMembers.length} 人</small>
                        </div>
                        <div className="insight-chips">
                          {selectedMembers.slice(0, 8).map((s) => (
                            <span
                              key={s.id}
                              className={`insight-chip cat-${roleMeta(s.role).cat} is-clickable`}
                              role="button"
                              tabIndex={0}
                              title={`${s.real_name} · ${roleMeta(s.role).text}${s.department ? ` · ${s.department}` : ""}`}
                              onClick={() => navigate("/users")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") navigate("/users");
                              }}
                            >
                              <UserOutlined />
                              {s.real_name}
                              <em>{roleMeta(s.role).text}</em>
                            </span>
                          ))}
                          {selectedMembers.length === 0 && (
                            <span className="insight-chip is-empty">该级暂无在岗人员</span>
                          )}
                          {selectedMembers.length > 8 && (
                            <span className="insight-chip is-empty">
                              另有 {selectedMembers.length - 8} 人
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="insight-actions">
                        <Tooltip title={isAdmin ? "保存级别名称与权限说明" : "仅管理员可编辑"}>
                          <Button
                            size="small"
                            type="primary"
                            icon={<SaveOutlined />}
                            loading={saving}
                            disabled={!isAdmin}
                            onClick={saveLevel}
                          >
                            保存
                          </Button>
                        </Tooltip>
                        <Button size="small" icon={<TeamOutlined />} onClick={() => navigate("/users")}>
                          用户管理
                        </Button>
                        <Button size="small" type="text" onClick={() => setSelected(null)}>
                          收起
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="insight-empty-body">
                      <EditOutlined />
                      <span>点选任意台面，查看该岗位的权限范围与在岗成员</span>
                    </div>
                  )}
                </aside>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="panel md-no-lift">
          <div className="panel-head">
            <div>
              <h2>级别对照表</h2>
              <small>与阶梯同源；「定位」跳回舞台并选中该级</small>
            </div>
            {viewToggle}
          </div>
          <div className="panel-body" style={{ paddingTop: 4 }}>
            <Table
              size="middle"
              rowKey="key"
              loading={loading}
              dataSource={rows}
              pagination={false}
              columns={[
                {
                  title: "级别",
                  dataIndex: "lv",
                  width: 92,
                  render: (lv: number) => <span className="tnum ladder-lv">第 {lv} 级</span>,
                },
                {
                  title: "岗位名称",
                  dataIndex: "name",
                  render: (name: string, row: (typeof rows)[number]) => (
                    <span className="ladder-name">
                      <span className={`ladder-swatch cat-${row.leadCat}`} aria-hidden="true" />
                      {name}
                    </span>
                  ),
                },
                { title: "权限范围", dataIndex: "desc" },
                {
                  title: "在岗",
                  dataIndex: "count",
                  width: 92,
                  render: (count: number) => <span className="tnum">{count} 人</span>,
                },
                { title: "主要角色", dataIndex: "lead", width: 120 },
                {
                  title: "操作",
                  width: 96,
                  render: (_: unknown, row: (typeof rows)[number]) => (
                    <Button
                      size="small"
                      type="link"
                      onClick={() => {
                        setView("ladder");
                        setSelected(row.lv);
                      }}
                    >
                      定位
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        </section>
      )}
    </div>
  );
}
