/**
 * 权限链路 —— 责任链（superior_id）可视化编排
 *
 * 链路语义（后端 nearby_service / supervision 一致）：
 *   · 向上沿 superior_id 追溯所有上级 → 决定「下级审阅」的审批方向与「附近互传」的可达范围
 *   · 向下为所有下级（可多层）
 *
 * 交互来自 scaffold 的看板语汇：
 *   拖起卡片 → 幽灵卡跟随；落位成功弹簧飞向新位置（结）；无效或被拒则弹射归位（停摆）；
 *   其余卡片 FLIP 自动让位。键盘可用卡片右上角「⋯ → 移动到…」。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Spin, Tag, Tooltip, message } from "antd";
import {
  ArrowsAltOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../stores/auth";
import {
  assignSubordinate,
  listCandidates,
  unassignSubordinate,
  type CandidateItem,
} from "../api/supervision";
import { listPeers, type PeerItem } from "../api/nearby";
import ChainBoard, { type ChainColumn, type MovePayload } from "../components/ChainBoard";
import { revealCascade, settlePop } from "../utils/motion";

const roleText: Record<string, string> = {
  admin: "管理员",
  doctor: "医生",
  pharmacist: "药剂师",
  maintainer: "运维",
};

export default function PermissionChain() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [peers, setPeers] = useState<PeerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const chainRef = useRef<HTMLDivElement | null>(null);
  const firstPaint = useRef(true);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([listCandidates(), listPeers()]);
      setCandidates(c.items || []);
      setPeers(p.items || []);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载权限链路失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- 我的上级链路：从我的 superior_id 逐级向上 ---------- */
  const chainUp = useMemo(() => {
    const byId = new Map<number, PeerItem>(
      peers
        .filter((p) => p.relation === "上级")
        .map((p) => [p.id, p] as const)
    );
    const out: PeerItem[] = [];
    const seen = new Set<number>();
    let cur: number | null | undefined = user?.superior_id ?? undefined;
    while (cur && byId.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      const node: PeerItem = byId.get(cur)!;
      out.push(node);
      cur = node.superior_id ?? undefined;
    }
    return out;
  }, [peers, user]);

  // 链路节点逐节浮现（结 Crystallize）
  useEffect(() => {
    if (loading) return;
    const node = chainRef.current;
    if (!node) return;
    if (firstPaint.current) {
      firstPaint.current = false;
      revealCascade(node, ":scope > *", 90);
    } else {
      settlePop(node);
    }
  }, [chainUp, loading]);

  /* ---------- 看板列 ---------- */
  const columns: ChainColumn<CandidateItem>[] = useMemo(() => {
    const mine = candidates.filter((c) => c.assigned_to_me);
    const pool = candidates.filter((c) => !c.superior_id);
    const others = candidates.filter((c) => c.superior_id && !c.assigned_to_me);
    return [
      {
        key: "mine",
        title: "我的下级",
        hint: "已纳入我的责任链，可审阅其就诊记录",
        tone: 1,
        items: mine,
      },
      {
        key: "pool",
        title: "待分配池",
        hint: "拖到左侧即纳入我的责任链",
        tone: 2,
        items: pool,
      },
      {
        key: "others",
        title: "其他上级名下",
        hint: "只读 · 拖入会自动弹射归位",
        tone: 3,
        items: others,
        accepts: false,
      },
    ];
  }, [candidates]);

  /* ---------- 落位：真实调用分配 / 取消分配接口 ---------- */
  const onMove = useCallback(
    async ({ item, from, to }: MovePayload<CandidateItem>) => {
      setBusy(true);
      try {
        if (from.key === to.key) return false;
        if (to.key === "mine") {
          await assignSubordinate(item.id);
          message.success(`已将 ${item.real_name} 纳入你的责任链`);
        } else if (to.key === "pool") {
          await unassignSubordinate(item.id);
          message.success(`已将 ${item.real_name} 移出你的责任链`);
        } else {
          // 只读列：走到这里说明落点被拒，弹射归位
          message.warning(`${to.title}为只读分组，卡片已弹射归位`);
          return false;
        }
        await load();
        return true;
      } catch (e: any) {
        const detail = e?.response?.data?.detail || "操作失败，卡片已弹射归位";
        message.error(detail);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const assignedCount = candidates.filter((c) => c.assigned_to_me).length;

  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PERMISSION CHAIN</div>
          <h1>权限链路</h1>
          <div className="sub">
            拖动卡片调整归属：落位成功会弹簧飞向新位置，其余卡片自动让位；被拒或取消则弹射归位。
            链路决定「下级审阅」的审批方向与「附近互传」的可达范围。
          </div>
        </div>
        <div className="actions">
          <Tag color="navy" style={{ background: "rgba(59, 130, 246, 0.18)", color: "#93c5fd", border: "none" }}>
            <TeamOutlined style={{ marginRight: 4 }} />
            我的下级 {assignedCount} 名 · 可分配 {columns[1].items.length} 名
          </Tag>
          <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
            刷新
          </Button>
        </div>
      </div>

      {/* 上溯链路 */}
      <section className="panel md-no-lift" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <div>
            <h2>我的上溯链路</h2>
            <small>沿上级关系逐级向上，决定审批与互传的可达范围</small>
          </div>
          <Tooltip title="上级关系由管理员在用户管理中分配，此处为只读展示">
            <Tag style={{ border: "none", background: "rgba(59, 130, 246, 0.12)", color: "#9a9ab0" }}>
              <NodeIndexOutlined style={{ marginRight: 4 }} />只读
            </Tag>
          </Tooltip>
        </div>
        <div className="panel-body">
          {loading ? (
            <div style={{ textAlign: "center", padding: 18 }}>
              <Spin />
            </div>
          ) : (
            <div className="chain-rail" ref={chainRef}>
              <div className="chain-node is-me">
                <span className="avatar navy chain-avatar">{user?.real_name?.[0] || "我"}</span>
                <span className="chain-meta">
                  <b>
                    {user?.real_name}
                    <em>我</em>
                  </b>
                  <small>
                    {roleText[user?.role || ""] || user?.role}
                    {user?.department ? ` · ${user.department}` : ""}
                    {user?.auth_level ? ` · L${user.auth_level}` : ""}
                  </small>
                </span>
              </div>

              {chainUp.length === 0 ? (
                <div className="chain-empty">
                  <UserOutlined /> 当前未设置上级，你位于链路顶端
                </div>
              ) : (
                chainUp.map((p) => (
                  <div className="chain-step" key={p.id}>
                    <span className="chain-arrow" aria-hidden="true">
                      <ArrowsAltOutlined />
                    </span>
                    <div className="chain-node">
                      <span className="avatar chain-avatar">{p.real_name?.[0]}</span>
                      <span className="chain-meta">
                        <b>{p.real_name}</b>
                        <small>
                          {p.title || roleText[p.role] || p.role}
                          {p.department ? ` · ${p.department}` : ""}
                          {p.auth_level ? ` · L${p.auth_level}` : ""}
                        </small>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* 拖拽看板 */}
      <section className="panel md-no-lift">
        <div className="panel-head">
          <div>
            <h2>归属编排</h2>
            <small>
              抓取卡片拖到目标分组；键盘可用卡片右上角「⋯」
            </small>
          </div>
          {busy && <Tag color="processing">正在提交…</Tag>}
        </div>
        <div className="panel-body" style={{ paddingTop: 4 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Spin />
            </div>
          ) : candidates.length === 0 ? (
            <Empty description="没有可分配的在职员工" />
          ) : (
            <ChainBoard<CandidateItem>
              columns={columns}
              keyOf={(c) => String(c.id)}
              draggable
              busy={busy}
              onMove={onMove}
              emptyText="拖到这里"
              renderCard={(c, col) => (
                <>
                  <span className={`avatar chain-avatar${col.key === "mine" ? " teal" : ""}`}>
                    {c.real_name?.[0]}
                  </span>
                  <span className="chain-meta">
                    <b>
                      {c.real_name}
                      <em>{c.role === "doctor" ? "医" : roleText[c.role]?.[0] || "员"}</em>
                    </b>
                    <small>
                      {c.title || roleText[c.role] || c.role} · {c.department || "未分配科室"}
                    </small>
                  </span>
                  {col.key === "mine" && c.pending_count > 0 ? (
                    <span className="cb-badge hot">待审 {c.pending_count}</span>
                  ) : c.superior_name && col.key === "others" ? (
                    <span className="cb-badge">{c.superior_name}</span>
                  ) : null}
                </>
              )}
            />
          )}
        </div>
      </section>

      <p className="note" style={{ background: "rgba(59, 130, 246, 0.08)", color: "#9a9ab0", marginTop: 14 }}>
        提示：分配下级后，对方的就诊记录才会出现在「下级审阅」中；取消分配即退出链路。
        卡片落位成功走弹簧落定（k=72），取消或被拒走较软的弹射归位（k=50）。
      </p>
    </div>
  );
}
