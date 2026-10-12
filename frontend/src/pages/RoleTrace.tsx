/**
 * 角色溯源 —— 「谁能进哪里」的三层下钻图谱。
 *
 * 三层（对齐 scaffold 的溯源舞台）：
 *   ① 全景 —— 中央珍珠球 + 三枚玻璃刻度表盘（用户 / 角色 / 菜单）。
 *      各类条目以刻度弧的形式绕在表盘周围；悬停某枚表盘，只留这一类并显出名称与跨类授权线。
 *   ② 模块 —— 珍珠球缩到左上，三枚表盘在左侧竖排成导轨；被点开的那一类条目
 *      以带标签的胶囊触须向右侧生长（放 Discharge + delay 级联）。
 *   ③ 实体 —— 起点 → 中段 → 菜单 的链路，右侧信息卡列出该实体的角色、菜单与数据权限规则。
 *
 * 面包屑与 Esc 逐层返回；同一份配置（config/nav.ts）驱动侧边栏与溯源，
 * 保证溯源出来的菜单就是用户实际看到的菜单。
 *
 * 数据：/users（管理员，全量）或 /nearby/peers（其余账号，责任链内）；
 *       /acl 数据权限规则（仅管理员，非管理员退化为纯菜单级授权展示）。
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Empty, Spin, Segmented, Table, Modal, Form, Input, InputNumber, Switch, Popconfirm, Drawer, Tree, Select, message } from "antd";
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../stores/auth";
import { listUsers, type UserItem } from "../api/users";
import { listPeers, type PeerItem } from "../api/nearby";
import { listRules } from "../api/acl";
import { buildNavGroups, roleMeta, type NavGroup } from "../config/nav";
import StageGraph, { type GraphLink, type GraphNode } from "../components/StageGraph";
import PermissionMatrix, { type MatrixChange } from "../components/PermissionMatrix";
import { listRoles, createRole, updateRole, removeRole, saveRoleMenus, type RoleItem } from "../api/roles";
import InsightPanel, { type InsightSection } from "../components/InsightPanel";
import { ask, type AnswerCard } from "../utils/ask";
import type { NetLink, NetNode } from "../utils/stage";

type Layer = 1 | 2 | 3;
type ModuleKey = "users" | "roles" | "menus";

interface Staff {
  id: number;
  real_name: string;
  role: string;
  department: string;
  title: string;
  auth_level: number;
  work_status: string;
}

interface RoleRow {
  role: string;
  meta: ReturnType<typeof roleMeta>;
  members: Staff[];
}

interface AclRule {
  id: number;
  role: string;
  collection: string;
  action: string;
  row_scope: string;
  enabled: boolean;
}

interface EntryRow {
  id: string;
  name: string;
  sub: string;
  cat: number;
  badge?: string | number;
  meta?: string;
  tone?: "off";
}

interface ChainLink {
  label: string;
  sub: string;
  cat: number;
  count?: number;
  ratio?: number;
  hub: boolean;
  meta?: string;
}

interface Entity {
  type: "user" | "role" | "group";
  key: string;
  title: string;
  sub: string;
  cat: number;
  role: string;
  person?: Staff;
  roleRow?: RoleRow;
  group?: NavGroup;
}

const CATS: Array<{ key: ModuleKey; name: string; cat: number }> = [
  { key: "users", name: "用户", cat: 1 },
  { key: "roles", name: "角色", cat: 2 },
  { key: "menus", name: "菜单", cat: 3 },
];

const ACTION_TEXT: Record<string, string> = {
  read: "读取",
  create: "新建",
  update: "修改",
  delete: "删除",
  write: "读写",
};

const SCOPE_TEXT: Record<string, string> = {
  all: "全院",
  dept: "本科室",
  self: "仅本人",
  chain: "责任链内",
  none: "不可见",
};

export default function RoleTrace() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [aclRules, setAclRules] = useState<AclRule[]>([]);
  const [scope, setScope] = useState<"all" | "chain">("all");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"trace" | "matrix" | "list">("trace");

  const [layer, setLayer] = useState<Layer>(1);
  const [module, setModule] = useState<ModuleKey | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 900, h: 620 });
  const [burstKey, setBurstKey] = useState(0);

  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  /* ---------- 角色管理：列表 CRUD + 矩阵授权（/api/roles，sys_roles + sys_role_menus） ---------- */
  const [roleRows, setRoleRows] = useState<RoleItem[]>([]);
  const [roleTotal, setRoleTotal] = useState(0);
  const [rolePage, setRolePage] = useState(1);
  const [roleLoading, setRoleLoading] = useState(false);
  const [kwInput, setKwInput] = useState("");
  const [roleKw, setRoleKw] = useState("");
  const [statusF, setStatusF] = useState<string>("");

  const loadRoles = useCallback(async () => {
    setRoleLoading(true);
    try {
      const r = await listRoles({ page: rolePage, page_size: 10, keyword: roleKw || undefined, status: statusF || undefined });
      setRoleRows(r.items || []);
      setRoleTotal(r.total || 0);
    } catch {
      message.error("加载角色列表失败");
    } finally {
      setRoleLoading(false);
    }
  }, [rolePage, roleKw, statusF]);
  useEffect(() => { if (view !== "trace") loadRoles(); }, [view, loadRoles]);

  // 新增 / 编辑角色
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [roleForm] = Form.useForm();

  const openCreate = () => {
    setEditing(null);
    roleForm.resetFields();
    roleForm.setFieldsValue({ name: "", code: "", data_scope: "SELF", sort: 10, status: 1, remark: "" });
    setFormOpen(true);
  };
  const openEdit = (r: RoleItem) => {
    setEditing(r);
    roleForm.setFieldsValue({ name: r.name, code: r.code, data_scope: r.data_scope, sort: r.sort, status: r.status, remark: r.remark });
    setFormOpen(true);
  };
  const submitForm = async () => {
    const v = await roleForm.validateFields();
    setFormSaving(true);
    try {
      if (editing) {
        await updateRole(editing.id, v);
        message.success("角色已更新");
      } else {
        await createRole(v);
        message.success("角色已新增");
      }
      setFormOpen(false);
      loadRoles();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "角色保存失败");
    } finally {
      setFormSaving(false);
    }
  };
  const handleRemove = async (r: RoleItem) => {
    try {
      await removeRole(r.id);
      message.success("角色已删除");
      loadRoles();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "角色删除失败");
    }
  };

  // 分配权限抽屉（菜单树 + 数据范围）
  const [permOpen, setPermOpen] = useState(false);
  const [permRole, setPermRole] = useState<RoleItem | null>(null);
  const [permTab, setPermTab] = useState<"menu" | "data">("menu");
  const [permChecked, setPermChecked] = useState<string[]>([]);
  const [permScope, setPermScope] = useState("SELF");
  const [permSaving, setPermSaving] = useState(false);

  const menuTreeData = useMemo(
    () => buildNavGroups().map((g) => ({
      key: `g:${g.short}`,
      title: `${g.label}（${g.items.length}）`,
      children: g.items.map((i) => ({ key: i.key, title: i.name })),
    })),
    []
  );
  const openPerm = (r: RoleItem) => {
    setPermRole(r);
    setPermTab("menu");
    setPermScope(r.data_scope || "SELF");
    setPermChecked(r.menu_ids || []);
    setPermOpen(true);
  };
  const savePerm = async () => {
    if (!permRole) return;
    setPermSaving(true);
    try {
      await updateRole(permRole.id, { data_scope: permScope });
      await saveRoleMenus(permRole.id, permChecked.filter((k) => !k.startsWith("g:")));
      message.success("权限已保存，相关用户重新登录后生效");
      setPermOpen(false);
      loadRoles();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "权限保存失败");
    } finally {
      setPermSaving(false);
    }
  };
  const permPageCount = permChecked.filter((k) => !k.startsWith("g:")).length;

  // 权限矩阵数据（全量角色 + 授权）
  const [matrixRoles, setMatrixRoles] = useState<RoleItem[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState(false);
  const loadMatrix = useCallback(async () => {
    setMatrixLoading(true);
    try {
      const r = await listRoles({ page: 1, page_size: 100 });
      setMatrixRoles(r.items || []);
    } catch {
      message.error("权限矩阵加载失败");
    } finally {
      setMatrixLoading(false);
    }
  }, []);
  useEffect(() => { if (view === "matrix") loadMatrix(); }, [view, loadMatrix]);

  const matrixGrants = useMemo(() => {
    const g: Record<number, string[]> = {};
    matrixRoles.forEach((x) => { g[x.id] = x.menu_ids || []; });
    return g;
  }, [matrixRoles]);

  const saveMatrix = async (changes: MatrixChange[]) => {
    setMatrixSaving(true);
    try {
      for (const c of changes) await saveRoleMenus(c.roleId, c.menuIds);
      message.success(`已更新 ${changes.length} 个角色的权限，相关用户重新登录后生效`);
      await loadMatrix();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "权限保存失败");
    } finally {
      setMatrixSaving(false);
    }
  };

  const SCOPE_LABELS: Record<string, string> = {
    ALL: "全部数据权限", DEPT_AND_CHILD: "本部门及以下数据权限", DEPT: "本部门数据权限",
    SELF: "仅本人数据权限", CUSTOM: "自定义数据权限",
  };

  // 「问问权限」问答条（全景层底部）：本地规则引擎，与命令面板「问系统」同源
  const [askQ, setAskQ] = useState("");
  const [askCards, setAskCards] = useState<AnswerCard[]>([]);

  /* ---------- 深链：/role-trace?trace=user:12 ----------
     从用户管理页的「权限溯源」图标跳进来时，省掉「全景 → 用户」两层下钻，
     等数据加载完直接落到该实体的链路。

     顺序很关键：**先落位、再抹参数**。反过来写成「先抹参数、loading 就 return」的话，
     等 loading 变 false 时 effect 重跑，参数已经没了，就永远停在第一层。
     参数只在真正消费掉之后才用 replace 抹掉，否则用户按 Esc 退回上一层会被弹回第 3 层。 */
  useEffect(() => {
    const raw = searchParams.get("trace");
    if (!raw) return;
    const [kind, id] = raw.split(":");
    if (!id || (kind !== "user" && kind !== "role")) {
      setSearchParams({}, { replace: true }); // 认不出来的参数直接丢掉
      return;
    }
    if (loading) return; // staff 还没到，留着参数等下一轮
    setModule(kind === "role" ? "roles" : "users");
    setEntityId(`e-${kind}-${id}`);
    setLayer(3);
    setBurstKey((k) => k + 1);
    setSearchParams({}, { replace: true });
  }, [loading, searchParams, setSearchParams]);

  /* ---------- 数据 ---------- */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const [u, rules] = await Promise.all([
          listUsers({ page_size: 100 }),
          listRules().catch(() => ({ items: [] as AclRule[] })),
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
        setAclRules((rules.items || []) as AclRule[]);
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
        setAclRules([]);
        setScope("chain");
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "加载溯源数据失败");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- 配置与聚合 ---------- */
  const navGroups = useMemo(() => buildNavGroups(), []);
  const menuTotal = useMemo(() => navGroups.reduce((n, g) => n + g.items.length, 0), [navGroups]);
  const globalMenus = useMemo(
    () => navGroups.filter((g) => !(g as any).adminOnly).reduce((n, g) => n + g.items.length, 0),
    [navGroups]
  );

  const runAsk = (q?: string) => {
    const question = (q ?? askQ).trim();
    if (!question) return;
    setAskCards(
      ask(question, {
        navGroups,
        people: staff as any,
        aclRules: aclRules as any,
        scope,
        isAdmin,
      })
    );
  };

  const roles = useMemo<RoleRow[]>(() => {
    const tally = new Map<string, Staff[]>();
    staff.forEach((s) => {
      if (!tally.has(s.role)) tally.set(s.role, []);
      tally.get(s.role)!.push(s);
    });
    return [...tally.entries()]
      .map(([role, members]) => ({ role, meta: roleMeta(role), members }))
      .sort((a, b) => b.members.length - a.members.length);
  }, [staff]);

  const onDuty = staff.filter((s) => s.work_status === "在职").length;

  /** 表盘读数：分子 / 分母都是真实数据，ratio 只是把同一个比例画成刻度弧 */
  const ruleRoles = useMemo(() => new Set(aclRules.map((r) => r.role)), [aclRules]);
  const idleRoles = useMemo(
    () => roles.filter((r) => !staff.some((s) => (s as any).role === (r as any).role)).length,
    [roles, staff]
  );
  const rolesWithRules = roles.filter(
    (r) => ruleRoles.has(r.role) || ruleRoles.has(r.meta.text)
  ).length;
  const catCount: Record<ModuleKey, number> = {
    users: staff.length,
    roles: roles.length,
    menus: navGroups.reduce((n, g) => n + g.items.length, 0),
  };
  const commonMenus = navGroups
    .filter((g) => !g.adminOnly)
    .reduce((n, g) => n + g.items.length, 0);
  const catRatio: Record<ModuleKey, number> = {
    users: staff.length ? onDuty / staff.length : 0,
    roles: roles.length ? rolesWithRules / roles.length : 0,
    menus: catCount.menus ? commonMenus / catCount.menus : 0,
  };
  const catSub: Record<ModuleKey, string> = {
    users: `在职 ${onDuty}/${staff.length}`,
    roles: `有规则 ${rolesWithRules}/${roles.length}`,
    menus: `通用 ${commonMenus}/${catCount.menus}`,
  };

  /* ---------- 舞台几何 ---------- */
  const corePos = useMemo(() => {
    if (layer === 1) return { x: size.w * 0.5, y: size.h * 0.44, s: 108 };
    return { x: 92, y: 58, s: 58 };
  }, [layer, size]);

  const dialPos = useCallback(
    (key: ModuleKey): { x: number; y: number; s: number } => {
      const i = CATS.findIndex((c) => c.key === key);
      if (layer === 1) {
        const cx = size.w * 0.5;
        const cy = size.h * 0.44;
        const dx = Math.min(238, size.w * 0.28);
        const spots: Record<ModuleKey, { x: number; y: number }> = {
          users: { x: cx, y: cy - 158 },
          roles: { x: cx - dx, y: cy + 124 },
          menus: { x: cx + dx, y: cy + 124 },
        };
        return { ...spots[key], s: 104 };
      }
      const railY = [size.h * 0.3, size.h * 0.52, size.h * 0.74];
      return { x: 92, y: railY[i], s: 68 };
    },
    [layer, size]
  );

  /* ---------- 菜单查询：全部走同一个 navGroups ---------- */
  const menusOf = useCallback(
    (role: string): NavGroup[] => {
      const meta = roleMeta(role);
      return navGroups.filter((g) => meta.groups.includes(g.short));
    },
    [navGroups]
  );

  const menuCountOf = useCallback(
    (role: string) => menusOf(role).reduce((n, g) => n + g.items.length, 0),
    [menusOf]
  );

  /* ---------- 某类的条目清单（②③ 两层的胶囊来源） ---------- */
  const moduleEntries = useCallback(
    (key: ModuleKey): EntryRow[] => {
      if (key === "users") {
        return staff.slice(0, 60).map((s) => ({
          id: `e-user-${s.id}`,
          name: s.real_name,
          sub: `${roleMeta(s.role).text} · ${s.title || s.department || "未分配"}`,
          cat: roleMeta(s.role).cat,
          badge: `L${s.auth_level}`,
          meta: `${s.real_name} · L${s.auth_level} · ${s.work_status}`,
          tone: s.work_status === "在职" ? undefined : "off",
        }));
      }
      if (key === "roles") {
        return roles.map((r) => ({
          id: `e-role-${r.role}`,
          name: r.meta.text,
          sub: `${r.members.length} 人 · ${menuCountOf(r.role)} 个菜单`,
          cat: r.meta.cat,
          badge: r.members.length,
          meta: `角色 ${r.meta.text}`,
        }));
      }
      return navGroups.map((g) => ({
        id: `e-group-${g.short}`,
        name: g.short,
        sub: `${g.items.length} 个菜单${g.adminOnly ? " · 管理员专属" : ""}`,
        cat: g.cat,
        badge: g.items.length,
        meta: g.label,
        tone: g.adminOnly ? "off" : undefined,
      }));
    },
    [staff, roles, navGroups, menuCountOf]
  );

  /* ---------- 实体解析（③） ---------- */
  const entity = useMemo<Entity | null>(() => {
    if (!entityId) return null;
    if (entityId.startsWith("e-user-")) {
      const id = Number(entityId.replace("e-user-", ""));
      const person = staff.find((s) => s.id === id);
      if (!person) return null;
      const meta = roleMeta(person.role);
      return {
        type: "user",
        key: entityId,
        title: person.real_name,
        sub: `${meta.text} · L${person.auth_level}`,
        cat: meta.cat,
        role: person.role,
        person,
      };
    }
    if (entityId.startsWith("e-role-")) {
      const role = entityId.replace("e-role-", "");
      const row = roles.find((r) => r.role === role);
      if (!row) return null;
      return {
        type: "role",
        key: entityId,
        title: row.meta.text,
        sub: `${row.members.length} 名成员`,
        cat: row.meta.cat,
        role,
        roleRow: row,
      };
    }
    if (entityId.startsWith("e-group-")) {
      const short = entityId.replace("e-group-", "");
      const group = navGroups.find((g) => g.short === short);
      if (!group) return null;
      return {
        type: "group",
        key: entityId,
        title: group.short,
        sub: `${group.items.length} 个菜单`,
        cat: group.cat,
        role: "",
        group,
      };
    }
    return null;
  }, [entityId, staff, roles, navGroups]);

  /* ---------- 实体链路（③ 的三个节点） ---------- */
  const chain = useMemo<ChainLink[] | null>(() => {
    if (!entity) return null;
    if (entity.type === "user" && entity.person) {
      const person = entity.person;
      const meta = roleMeta(person.role);
      const menus = menusOf(person.role);
      const total = menus.reduce((n, g) => n + g.items.length, 0);
      const peers = roles.find((r) => r.role === person.role)?.members.length ?? 1;
      return [
        {
          label: person.real_name,
          sub: `${person.title || person.department || "—"} · L${person.auth_level}`,
          cat: meta.cat,
          hub: false,
          meta: `${person.real_name} · ${person.work_status}`,
        },
        {
          label: meta.text,
          sub: `${peers} 名同角色`,
          cat: meta.cat,
          hub: false,
          meta: `角色 ${meta.text}`,
        },
        {
          label: "可用菜单",
          sub: `${total} 个`,
          cat: 3,
          count: total,
          ratio: catCount.menus ? total / catCount.menus : 0,
          hub: true,
          meta: menus.map((g) => g.short).join(" / "),
        },
      ];
    }
    if (entity.type === "role" && entity.roleRow) {
      const row = entity.roleRow;
      const menus = menusOf(row.role);
      const total = menus.reduce((n, g) => n + g.items.length, 0);
      return [
        {
          label: row.meta.text,
          sub: `角色 · ${row.members.length} 人`,
          cat: row.meta.cat,
          hub: false,
          meta: `角色 ${row.meta.text}`,
        },
        {
          label: "成员",
          sub: `${row.members.length} 人`,
          cat: row.meta.cat,
          count: row.members.length,
          ratio: staff.length ? row.members.length / staff.length : 0,
          hub: true,
          meta: row.members
            .slice(0, 6)
            .map((m) => m.real_name)
            .join(" / "),
        },
        {
          label: "可用菜单",
          sub: `${total} 个`,
          cat: 3,
          count: total,
          ratio: catCount.menus ? total / catCount.menus : 0,
          hub: true,
          meta: menus.map((g) => g.short).join(" / "),
        },
      ];
    }
    if (entity.type === "group" && entity.group) {
      const group = entity.group;
      const holders = roles.filter((r) => r.meta.groups.includes(group.short));
      return [
        {
          label: group.short,
          sub: `${group.items.length} 个菜单`,
          cat: group.cat,
          hub: false,
          meta: group.label,
        },
        {
          label: "可进入角色",
          sub: `${holders.length} 个`,
          cat: 2,
          count: holders.length,
          ratio: roles.length ? holders.length / roles.length : 0,
          hub: true,
          meta: holders.map((h) => h.meta.text).join(" / "),
        },
        {
          label: "菜单项",
          sub: `${group.items.length} 个`,
          cat: 3,
          count: group.items.length,
          ratio: undefined,
          hub: true,
          meta: group.items.map((i) => i.name).join(" / "),
        },
      ];
    }
    return null;
  }, [entity, catCount, menusOf, roles, staff]);

  /* ---------- 节点 ---------- */
  const nodes = useMemo<GraphNode[]>(() => {
    const out: GraphNode[] = [
      {
        id: "h-core",
        x: corePos.x,
        y: corePos.y,
        label: layer === 1 ? "权限全景" : "",
        sub: layer === 1 ? (scope === "all" ? "全院授权" : "责任链授权") : undefined,
        kind: "core",
        size: corePos.s,
        interactive: false,
      },
    ];

    CATS.forEach((c) => {
      const p = dialPos(c.key);
      const dim = layer >= 2 && module !== c.key;
      out.push({
        id: `d-${c.key}`,
        x: p.x,
        y: p.y,
        label: c.name,
        sub: catSub[c.key],
        kind: "hub",
        cat: c.cat,
        size: p.s,
        ratio: catRatio[c.key],
        count: catCount[c.key],
        float: layer === 1,
        from: "h-core",
        tone: dim ? "off" : undefined,
      });
    });

    // ② 模块：被点开的那一类条目以胶囊触须向右生长
    // （只在模块层出现；进入实体层后它们缩回表盘，由链路节点接管）
    if (layer === 2 && module) {
      const entries = moduleEntries(module);
      const shown = entries.slice(0, 12);
      const gap = Math.min(52, (size.h - 150) / Math.max(1, shown.length));
      const baseX = size.w * 0.34;
      shown.forEach((e, j) => {
        out.push({
          id: e.id,
          x: baseX + Math.sin(j * 0.62) * 20,
          y: 78 + j * gap,
          label: e.name,
          sub: e.sub,
          kind: "item",
          cat: e.cat,
          align: "left",
          from: `d-${module}`,
          delay: 0.05 + j * 0.06,
          count: e.badge,
          tone: e.tone,
          title: e.meta,
        });
      });
      if (entries.length > 12) {
        out.push({
          id: `e-more-${module}`,
          x: baseX,
          y: 78 + shown.length * gap,
          label: `另有 ${entries.length - 12} 项`,
          sub: "请用用户管理查看完整清单",
          kind: "item",
          align: "left",
          from: `d-${module}`,
          delay: 0.05 + 12 * 0.06,
          interactive: false,
        });
      }
    }

    // ③ 实体：起点 → 中段 → 菜单
    if (layer === 3 && chain && module) {
      const xs = [size.w * 0.3, size.w * 0.5, size.w * 0.7];
      const y = size.h * 0.5;
      chain.forEach((link, i) => {
        out.push({
          id: `c-${i + 1}`,
          x: xs[i],
          y,
          label: link.label,
          sub: link.sub,
          kind: link.hub ? "hub" : "item",
          cat: link.cat,
          size: link.hub ? 76 : undefined,
          ratio: link.ratio,
          count: link.count,
          align: "center",
          from: i === 0 ? `d-${module}` : `c-${i}`,
          delay: i * 0.1,
          title: link.meta,
        });
      });
    }

    return out;
  }, [corePos, dialPos, layer, module, chain, size, catCount, catRatio, catSub, scope, moduleEntries]);

  /* ---------- 连线 ---------- */
  const links = useMemo<GraphLink[]>(() => {
    const out: GraphLink[] = [];
    CATS.forEach((c) => {
      const primary = layer === 1 || c.key === module;
      out.push({
        a: "h-core",
        b: `d-${c.key}`,
        flow: primary ? "forward" : "none",
        cat: c.cat,
        shape: "arc",
        dashed: !primary,
      });
    });
    if (layer === 2 && module) {
      moduleEntries(module)
        .slice(0, 12)
        .forEach((e) =>
          out.push({ a: `d-${module}`, b: e.id, flow: "none", cat: e.cat, shape: "h" })
        );
      if (moduleEntries(module).length > 12) {
        out.push({ a: `d-${module}`, b: `e-more-${module}`, flow: "none", cat: 0, shape: "h", dashed: true });
      }
    }
    if (layer === 3) {
      out.push({ a: "c-1", b: "c-2", flow: "forward", cat: 2, shape: "h" });
      out.push({ a: "c-2", b: "c-3", flow: "forward", cat: 3, shape: "h" });
    }
    return out;
  }, [layer, module, moduleEntries]);

  /* ---------- 背景网络 ---------- */
  const network = useMemo(() => {
    const netNodes: NetNode[] = [];
    const netLinks: NetLink[] = [];

    if (layer === 1) {
      // 三枚表盘各自的条目绕成刻度弧
      CATS.forEach((c) => {
        const p = dialPos(c.key);
        const entries = moduleEntries(c.key).slice(0, 16);
        const total = Math.max(1, entries.length);
        entries.forEach((e, i) => {
          const ang = Math.PI * 0.6 + (i / total) * Math.PI * 1.8;
          const r = 86 + (i % 2) * 26;
          const x = p.x + Math.cos(ang) * r;
          const y = p.y + Math.sin(ang) * r;
          netNodes.push({
            id: e.id,
            x,
            y,
            cat: e.cat,
            r: 2.4,
            depth: 1,
            label: e.name,
            angle: Math.atan2(y - p.y, x - p.x),
            tone: e.tone,
          });
          netLinks.push({ a: `d-${c.key}`, b: e.id, cat: e.cat });
        });
      });
      // 跨类授权线：用户 → 角色、角色 → 分组（仅在聚焦某类时显现）
      staff.slice(0, 24).forEach((s) => {
        netLinks.push({ a: `e-user-${s.id}`, b: `e-role-${s.role}`, cross: true });
      });
      navGroups.forEach((g) => {
        roles.forEach((r) => {
          if (r.meta.groups.includes(g.short)) {
            netLinks.push({ a: `e-role-${r.role}`, b: `e-group-${g.short}`, cross: true });
          }
        });
      });
    }

    if (layer === 3 && chain) {
      const xs = [size.w * 0.3, size.w * 0.5, size.w * 0.7];
      const y = size.h * 0.5;
      const menus =
        entity?.type === "group" && entity.group
          ? entity.group.items.map((i) => ({ name: i.name, cat: entity.group!.cat }))
          : entity
          ? menusOf(entity.role).flatMap((g) => g.items.map((i) => ({ name: i.name, cat: g.cat })))
          : [];
      const shown = menus.slice(0, 18);
      const total = Math.max(1, shown.length);
      shown.forEach((m, i) => {
        const ang = Math.PI * 0.62 + (i / total) * Math.PI * 1.76;
        const r = 76 + (i % 2) * 22;
        const x = xs[2] + Math.cos(ang) * r;
        const yy = y + Math.sin(ang) * r;
        netNodes.push({
          id: `mn-${i}`,
          x,
          y: yy,
          cat: m.cat,
          r: 2.4,
          depth: 1,
          label: m.name,
          angle: Math.atan2(yy - y, x - xs[2]),
        });
        netLinks.push({ a: "c-3", b: `mn-${i}`, cat: m.cat });
      });
    }

    return { nodes: netNodes, links: netLinks };
  }, [layer, chain, entity, dialPos, staff, roles, navGroups, size, moduleEntries, menusOf]);

  /* ---------- 交互 ---------- */
  const goLayer = (next: Layer) => {
    setLayer(next);
    setBurstKey((k) => k + 1);
    if (next === 1) {
      setModule(null);
      setEntityId(null);
    }
    if (next === 2) setEntityId(null);
  };

  const openModule = (key: ModuleKey) => {
    setModule(key);
    goLayer(2);
  };

  const openEntity = (id: string) => {
    setEntityId(id);
    goLayer(3);
  };

  /** 悬停表盘 → 只留这一类（labels + 跨类线只在聚焦时出现） */
  const focusCat = useMemo(() => {
    if (layer !== 1 || !hover) return null;
    if (!hover.startsWith("d-")) return null;
    return CATS.find((c) => c.key === hover.replace("d-", ""))?.cat ?? null;
  }, [layer, hover]);

  const selectedNodeId = layer === 3 ? "c-3" : layer === 2 && module ? `d-${module}` : null;

  /* ---------- 面包屑 ---------- */
  const breadcrumb = (
    <nav className="trace-crumbs" aria-label="溯源层级">
      <button type="button" className={layer === 1 ? "is-current" : ""} onClick={() => goLayer(1)}>
        <PartitionOutlined /> 全景
      </button>
      {layer >= 2 && module && (
        <>
          <span className="trace-sep">/</span>
          <button type="button" className={layer === 2 ? "is-current" : ""} onClick={() => goLayer(2)}>
            {CATS.find((c) => c.key === module)?.name}
          </button>
        </>
      )}
      {layer === 3 && entity && (
        <>
          <span className="trace-sep">/</span>
          <button type="button" className="is-current" onClick={() => goLayer(3)}>
            {entity.title}
          </button>
        </>
      )}
      {layer > 1 && (
        <Button
          size="small"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => goLayer((layer - 1) as Layer)}
        >
          返回
        </Button>
      )}
    </nav>
  );

  /* ---------- 信息卡内容 ---------- */
  const insight = useMemo(() => {
    if (layer !== 3 || !entity) return null;
    const stats: Array<{ label: string; value: ReactNode }> = [];
    const sections: InsightSection[] = [];

    const aclRows = (role: string) =>
      aclRules
        .filter((r) => r.role === role || r.role === roleMeta(role).text)
        .map((r) => ({
          key: r.id,
          name: r.collection,
          meta: `${ACTION_TEXT[r.action] || r.action} · ${SCOPE_TEXT[r.row_scope] || r.row_scope}`,
          badge: r.enabled ? undefined : "停用",
          tone: r.enabled ? ("ok" as const) : ("off" as const),
        }));

    const groupChips = (role: string) =>
      menusOf(role).map((g) => ({
        key: g.short,
        name: g.short,
        meta: g.label,
        cat: g.cat,
        badge: String(g.items.length),
      }));

    if (entity.type === "user" && entity.person) {
      const p = entity.person;
      stats.push({ label: "级别", value: `L${p.auth_level}` }, { label: "状态", value: p.work_status });
      sections.push(
        {
          title: "身份",
          rows: [
            { key: "dept", name: "科室", meta: p.department || "未分配" },
            { key: "title", name: "职称", meta: p.title || "—" },
            { key: "role", name: "角色", meta: roleMeta(p.role).text, cat: roleMeta(p.role).cat },
          ],
        },
        {
          title: "可进入的分组",
          chips: true,
          rows: groupChips(p.role),
          empty: "该角色未匹配到分组",
        },
        {
          title: "数据权限规则",
          rows: aclRows(p.role),
          empty: isAdmin ? "该角色暂无 DB 级规则（仅菜单级授权）" : "需管理员账号查看",
        }
      );
    } else if (entity.type === "role" && entity.roleRow) {
      const row = entity.roleRow;
      stats.push(
        { label: "成员", value: row.members.length },
        { label: "菜单", value: menuCountOf(row.role) }
      );
      sections.push(
        {
          title: "成员",
          rows: row.members.slice(0, 12).map((m) => ({
            key: m.id,
            name: m.real_name,
            meta: `${m.title || m.department || "—"} · L${m.auth_level}`,
            cat: row.meta.cat,
          })),
          empty: "暂无成员",
        },
        { title: "可进入的分组", chips: true, rows: groupChips(row.role) },
        {
          title: "数据权限规则",
          rows: aclRows(row.role),
          empty: isAdmin ? "该角色暂无 DB 级规则（仅菜单级授权）" : "需管理员账号查看",
        }
      );
    } else if (entity.type === "group" && entity.group) {
      const g = entity.group;
      const holders = roles.filter((r) => r.meta.groups.includes(g.short));
      stats.push({ label: "菜单", value: g.items.length }, { label: "角色", value: holders.length });
      sections.push(
        {
          title: "菜单项",
          rows: g.items.map((i) => ({ key: i.key, name: i.name, meta: i.to, cat: g.cat })),
        },
        {
          title: "可进入角色",
          chips: true,
          rows: holders.map((h) => ({
            key: h.role,
            name: h.meta.text,
            meta: `${h.members.length} 人`,
            cat: h.meta.cat,
            badge: String(h.members.length),
          })),
          empty: "暂无角色可进入",
        }
      );
    }

    return { stats, sections };
  }, [layer, entity, aclRules, roles, isAdmin, menuCountOf, menusOf]);

  /* 「问问权限」问答条：全景层底部；空数据（无责任链成员）时也保留入口 */
  const askBar =
    layer === 1 ? (
      <div style={{ width: "min(600px, 94%)", margin: "0 auto" }}>
        {askCards.length > 0 && (
          <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {askCards.map((c, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--lv-line)", boxShadow: "var(--lv-e2)", padding: "12px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 650, color: "var(--lv-ink)" }}>{c.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--lv-muted)", marginTop: 4, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.text}</div>
                {c.chips && c.chips.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {c.chips.map((ch) => (
                      <button key={ch.key} type="button" onClick={() => { if (ch.to) navigate(ch.to); }}
                        style={{ border: "1px solid var(--lv-line)", background: "#fff", borderRadius: 999, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "var(--lv-blue)" }}>
                        {ch.label}{ch.sub ? ` · ${ch.sub}` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 999, padding: "6px 6px 6px 16px", boxShadow: "var(--lv-e2)", border: "1px solid var(--lv-line)" }}>
          <span style={{ color: "var(--lv-faint)", fontSize: 13, flex: "none" }}>问</span>
          <input
            value={askQ}
            onChange={(e) => setAskQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runAsk(); }}
            placeholder="问问权限，例如「谁能进入药房」"
            style={{ flex: 1, border: 0, outline: "none", fontSize: 13, background: "transparent", color: "var(--lv-ink)", minWidth: 0 }}
          />
          <button type="button" aria-label="发送" onClick={() => runAsk()}
            style={{ width: 32, height: 32, borderRadius: 999, border: 0, background: "var(--lv-blue)", color: "#fff", cursor: "pointer", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <SendOutlined style={{ fontSize: 13 }} />
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 10 }}>
          {["哪些角色没人用？", "哪些分组没人能进？", "权限最高的是谁？"].map((q) => (
            <button key={q} type="button" onClick={() => { setAskQ(q); runAsk(q); }}
              style={{ border: "1px solid var(--lv-line)", background: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 12, cursor: "pointer", color: "var(--lv-muted)", transition: "color .15s ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--lv-blue)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--lv-muted)"; }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 740, letterSpacing: "-0.03em", color: "var(--lv-ink)" }}>角色管理</div>
          <div style={{ color: "var(--lv-muted)", fontSize: 13, marginTop: 6 }}>
            角色决定用户可见的菜单、可用的按钮以及可查看的数据范围。
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={view}
            onChange={(v) => setView(v as "trace" | "matrix" | "list")}
            options={[
              { label: "列表", value: "list" },
              { label: "矩阵", value: "matrix" },
              { label: "溯源", value: "trace" },
            ]}
          />
          <span className="lv-tag lv-tag--neutral">
            <DatabaseOutlined />
            {scope === "all"
              ? `全院 ${staff.length} 人 · ${aclRules.length} 条规则`
              : `责任链内 ${staff.length} 人`}
          </span>
          <button className="lv-btn" type="button" onClick={load}><ReloadOutlined /> 刷新</button>
        </div>
      </div>

      {view === "trace" && scope === "chain" && (
        <p className="note" style={{ background: "#fdf7ea", color: "#8a6a22", marginBottom: 14 }}>
          当前账号不是管理员，溯源范围收窄为你的责任链；数据权限规则需要管理员账号才能读取。
        </p>
      )}

      {view === "matrix" && (
        <section className="panel md-no-lift" style={{ overflow: "hidden" }}>
          <div className="panel-head">
            <div>
              <h2>
                <PartitionOutlined style={{ marginRight: 6 }} />
                权限矩阵
              </h2>
              <small>点格子切换授权 · 勾选子项连带勾上祖先 · 底部一次提交{isAdmin ? "" : "（需管理员账号）"}</small>
            </div>
          </div>
          {matrixLoading ? (
            <div style={{ textAlign: "center", padding: 60 }}><Spin /></div>
          ) : (
            <PermissionMatrix
              menus={buildNavGroups()}
              roles={matrixRoles.map((r) => ({ id: r.id, name: r.name, code: r.code, builtin: r.builtin, status: r.status }))}
              grants={matrixGrants}
              editable={isAdmin}
              saving={matrixSaving}
              onSave={saveMatrix}
            />
          )}
        </section>
      )}

      {view === "list" && (
        <>
          {/* 查询面板：关键词/状态 + 新增角色 */}
          <div className="lv-query">
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: "var(--lv-faint)" }} />}
              placeholder="角色名称 / 编码"
              style={{ width: 240 }}
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onPressEnter={() => { setRoleKw(kwInput.trim()); setRolePage(1); }}
            />
            <Select
              allowClear
              placeholder="全部状态"
              style={{ width: 130 }}
              value={statusF || undefined}
              onChange={(v) => { setStatusF(v || ""); setRolePage(1); }}
              options={[{ value: "1", label: "正常" }, { value: "0", label: "停用" }]}
            />
            <div className="lv-query-actions">
              <button className="lv-btn" type="button" onClick={() => { setRoleKw(kwInput.trim()); setRolePage(1); }}>查询</button>
              <button className="lv-btn" type="button" onClick={() => { setKwInput(""); setRoleKw(""); setStatusF(""); setRolePage(1); }}>重置</button>
              {isAdmin && (
                <button className="lv-btn lv-btn--primary" type="button" onClick={openCreate}><PlusOutlined /> 新增角色</button>
              )}
            </div>
          </div>

          {/* 角色列表面板 */}
          <section className="lv-panel">
            <div className="lv-panel-head">
              <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
              <span className="lv-panel-title">角色列表</span>
              <span className="lv-panel-meta">共 {roleTotal} 条</span>
              <div className="lv-panel-tools">
                <button className="icon-btn" title="刷新" onClick={loadRoles}><ReloadOutlined /></button>
              </div>
            </div>
            <Table
              rowKey="id"
              size="middle"
              loading={roleLoading}
              dataSource={roleRows}
              pagination={false}
              scroll={{ x: 980 }}
              locale={{ emptyText: "暂无角色" }}
              columns={[
                {
                  title: "角色", dataIndex: "name", width: 190, fixed: "left" as const,
                  render: (v: string, r: RoleItem) => (
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 650, color: "var(--lv-ink)", display: "flex", alignItems: "center", gap: 6 }}>
                        {v}
                        {r.builtin && <span className="lv-tag lv-tag--neutral">内置</span>}
                        {r.status === 0 && <span className="lv-tag lv-tag--red"><span className="lv-tag-dot" />停用</span>}
                      </div>
                      <div className="tnum" style={{ fontSize: 11.5, color: "var(--lv-soft)" }}>{r.code}</div>
                    </div>
                  ),
                },
                { title: "数据权限", dataIndex: "data_scope", width: 160, render: (v: string) => <span style={{ color: "var(--lv-muted)" }}>{SCOPE_LABELS[v] || v}</span> },
                { title: "用户数", dataIndex: "user_count", width: 80, align: "right" as const, render: (v: number) => <span className="tnum">{v}</span> },
                { title: "排序", dataIndex: "sort", width: 70, align: "right" as const, render: (v: number) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{v}</span> },
                {
                  title: "状态", dataIndex: "status", width: 90,
                  render: (v: number) => (
                    <span className={`lv-tag ${v === 1 ? "lv-tag--leaf" : "lv-tag--gray"}`}><span className="lv-tag-dot" />{v === 1 ? "正常" : "停用"}</span>
                  ),
                },
                { title: "创建时间", dataIndex: "created_at", width: 150, render: (v: string) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "—"}</span> },
                {
                  title: "操作", width: 130, fixed: "right" as const, className: "col-actions",
                  render: (_: any, r: RoleItem) =>
                    r.builtin ? (
                      <span style={{ fontSize: 12, color: "var(--lv-faint)" }} title="内置角色拥有全部权限，不可修改">全部权限</span>
                    ) : (
                      <div className="row-actions">
                        <button className="icon-btn" title="编辑" data-act="edit" onClick={() => openEdit(r)}><EditOutlined /></button>
                        <button className="icon-btn" title="分配权限" data-act="perm" onClick={() => openPerm(r)}><SafetyOutlined /></button>
                        <Popconfirm title={`确认删除角色「${r.name}」吗？已分配该角色的用户将失去对应权限。`} okText="删除" okButtonProps={{ danger: true }} onConfirm={() => handleRemove(r)}>
                          <button className="icon-btn is-danger" title="删除" data-act="remove"><DeleteOutlined /></button>
                        </Popconfirm>
                      </div>
                    ),
                },
              ]}
            />
            <div className="lv-pager">
              <span className="lv-pager-meta">共 {roleTotal} 条，当前 {roleTotal === 0 ? 0 : (rolePage - 1) * 10 + 1}–{Math.min(rolePage * 10, roleTotal)}</span>
              <div className="lv-pager-btns">
                <button className="icon-btn" disabled={rolePage <= 1} onClick={() => setRolePage(rolePage - 1)}>‹</button>
                <span className="tnum lv-pager-cur">{rolePage} / {Math.max(1, Math.ceil(roleTotal / 10))}</span>
                <button className="icon-btn" disabled={rolePage >= Math.ceil(roleTotal / 10)} onClick={() => setRolePage(rolePage + 1)}>›</button>
              </div>
            </div>
          </section>
        </>
      )}

      {view === "trace" && (
      <>
      <section className="panel md-no-lift" style={{ overflow: "hidden" }}>
        {layer > 1 && (
          <div className="panel-head">
            <div>
              <h2>
                <NodeIndexOutlined style={{ marginRight: 6 }} />
                溯源下钻
              </h2>
              <small>方向键在节点之间移动，Esc 逐层返回</small>
            </div>
            {breadcrumb}
          </div>
        )}
        <div className="panel-body" style={{ padding: layer === 1 ? 0 : undefined, paddingTop: 0 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <Spin />
            </div>
          ) : staff.length === 0 ? (
            <div>
              <Empty description="没有可溯源的数据" />
              <div style={{ marginTop: 20, paddingBottom: 12 }}>{askBar}</div>
            </div>
          ) : (
            <div className="trace-wrap">
              <div className="stage-scroll">
                <StageGraph
                  className="trace-stage"
                  style={{ height: 620 }}
                  variant="stage"
                  label="角色溯源图谱"
                  nodes={nodes}
                  links={links}
                  size={size}
                  onSize={setSize}
                  activeId={selectedNodeId}
                  highlight={layer === 3 ? ["c-1", "c-2", "c-3"] : null}
                  network={network}
                  networkFocus={focusCat}
                  networkAlpha={layer === 1 ? (focusCat ? 0.95 : 0.5) : 0.42}
                  orbits={layer === 1 ? [{ rx: 250, ry: 186 }, { rx: 330, ry: 246 }] : undefined}
                  burstKey={burstKey}
                  onSelect={(n) => {
                    if (n.id.startsWith("d-")) {
                      openModule(n.id.replace("d-", "") as ModuleKey);
                      return;
                    }
                    if (n.id.startsWith("e-") && !n.id.startsWith("e-more-")) openEntity(n.id);
                  }}
                  onHover={setHover}
                  onBack={() => {
                    if (layer === 3) goLayer(2);
                    else if (layer === 2) goLayer(1);
                  }}
                  tl={
                    layer === 1 ? (
                      <div
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          background: "#fff", borderRadius: 999, padding: "8px 16px",
                          boxShadow: "var(--lv-e1)", border: "1px solid var(--lv-line)",
                          fontSize: 13, fontWeight: 650, color: "var(--lv-ink)",
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--lv-blue)" }} />
                        权限全景
                      </div>
                    ) : (
                      <div className="rg-hint">
                        <AppstoreOutlined />
                        <span>{layer === 2 ? "点开条目落到实体" : "实体链路：起点 → 中段 → 菜单"}</span>
                      </div>
                    )
                  }
                  tr={
                    layer === 1 ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: "2px 20px", background: "#fff", borderRadius: 14, border: "1px solid var(--lv-line)", boxShadow: "var(--lv-e1)", padding: "12px 18px" }}>
                        {[["用户", staff.length], ["角色", roles.length], ["菜单", menuTotal]].map(([label, n]) => (
                          <div key={label as string} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--lv-faint)" }}>{label as string}</div>
                            <div className="tnum" style={{ fontSize: 20, fontWeight: 700, color: "var(--lv-ink)" }}>{n as number}</div>
                          </div>
                        ))}
                        <div className="tnum" style={{ fontSize: 11, color: "#b9770a", textAlign: "center" }}>独立角色 {idleRoles}</div>
                        <div className="tnum" style={{ fontSize: 11, color: "#b9770a", textAlign: "center" }}>全局菜单 {globalMenus}</div>
                        <div className="tnum" style={{ fontSize: 11, color: "#b9770a", textAlign: "center" }}>无角色用户 0</div>
                      </div>
                    ) : null
                  }
                  bl={
                    layer === 1 ? (
                      askBar
                    ) : (
                      <div className="rg-legend">
                        {CATS.map((c) => (
                          <span key={c.key} className={`rg-legend-item cat-${c.cat}`}>
                            <i aria-hidden="true" />
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )
                  }
                />
              </div>

              {insight && entity ? (
                <InsightPanel
                  title={entity.title}
                  sub={entity.sub}
                  cat={entity.cat}
                  stats={insight.stats}
                  sections={insight.sections}
                  note="链路来自真实配置：角色决定可进入的分组，分组决定可见菜单；DB 级规则取自数据权限表。"
                  actions={
                    <>
                      <Button size="small" icon={<TeamOutlined />} onClick={() => goLayer(2)}>
                        返回模块
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<SafetyCertificateOutlined />}
                        onClick={() => goLayer(1)}
                      >
                        回到全景
                      </Button>
                    </>
                  }
                  onClose={() => goLayer(2)}
                />
              ) : (
                <div className="trace-side-hint">
                  <UserOutlined />
                  <span>
                    {layer === 1
                      ? "全景：三枚表盘分别是用户、角色、菜单。悬停表盘可看名称与跨类授权线。"
                      : "点开任一胶囊条目，这里会给出该实体的角色、菜单与数据权限规则。"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <p className="note" style={{ background: "#f6f8fc", color: "#7d8ba0", marginTop: 14 }}>
        溯源用的菜单就是侧边栏真实渲染的那一份（config/nav.ts），
        因此「角色 → 分组 → 菜单」的结果与界面完全一致，不会出现溯源里能进、界面上看不到的情况。
      </p>
      </>
      )}

      {/* 新增 / 编辑角色弹窗 */}
      <Modal
        title={editing ? "编辑角色" : "新增角色"}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={submitForm}
        confirmLoading={formSaving}
        okText={editing ? "保存" : "新增"}
        width={620}
        destroyOnHidden
      >
        <Form form={roleForm} layout="vertical">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="name" label="角色名称" rules={[{ required: true, message: "请输入角色名称" }]}>
              <Input placeholder="如：系统管理员" />
            </Form.Item>
            <Form.Item
              name="code"
              label="角色编码"
              rules={[
                { required: true, message: "请输入角色编码" },
                { pattern: /^[a-z][a-z0-9_]*$/, message: "小写字母开头，仅含小写字母、数字、下划线" },
              ]}
              extra="用于后端判断角色，创建后不建议修改"
            >
              <Input placeholder="如：sys_admin" />
            </Form.Item>
            <Form.Item name="data_scope" label="数据权限">
              <Select
                options={[
                  { value: "ALL", label: "全部数据权限" },
                  { value: "DEPT_AND_CHILD", label: "本部门及以下数据权限" },
                  { value: "DEPT", label: "本部门数据权限" },
                  { value: "SELF", label: "仅本人数据权限" },
                  { value: "CUSTOM", label: "自定义数据权限" },
                ]}
              />
            </Form.Item>
            <Form.Item name="sort" label="显示排序">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="角色用途说明" maxLength={200} />
          </Form.Item>
          <Form.Item name="status" label="角色状态" valuePropName="checked">
            <Switch checkedChildren="正常" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 分配权限抽屉（菜单树 + 数据范围） */}
      <Drawer
        title={`分配权限 · ${permRole?.name ?? ""}`}
        size={560}
        open={permOpen}
        onClose={() => setPermOpen(false)}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button onClick={() => setPermOpen(false)}>取消</Button>
            <Button type="primary" className="lv-submit" loading={permSaving} onClick={savePerm}>保存权限</Button>
          </div>
        }
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <Segmented
            value={permTab}
            onChange={(v) => setPermTab(v as "menu" | "data")}
            options={[{ label: "菜单与页面", value: "menu" }, { label: "数据范围", value: "data" }]}
          />
          {permTab === "menu" && <span style={{ fontSize: 12, color: "var(--lv-soft)" }}>已选 {permPageCount} 个页面</span>}
        </div>

        {permTab === "menu" ? (
          <Tree
            checkable
            defaultExpandAll
            selectable={false}
            treeData={menuTreeData}
            checkedKeys={permChecked}
            onCheck={(checked, info) => setPermChecked([...(checked as string[]), ...((info.halfCheckedKeys || []) as string[])])}
          />
        ) : (
          <div role="radiogroup" aria-label="数据范围" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { code: "ALL", name: "全部数据权限", desc: "可查看系统内所有部门的数据" },
              { code: "DEPT_AND_CHILD", name: "本部门及以下数据权限", desc: "可查看本部门及全部下级部门的数据" },
              { code: "DEPT", name: "本部门数据权限", desc: "仅可查看本部门的数据" },
              { code: "SELF", name: "仅本人数据权限", desc: "仅可查看本人创建的数据" },
              { code: "CUSTOM", name: "自定义数据权限", desc: "按角色关联的部门范围查看数据" },
            ].map((s) => (
              <button
                key={s.code}
                type="button"
                role="radio"
                aria-checked={permScope === s.code}
                onClick={() => setPermScope(s.code)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left", font: "inherit",
                  padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                  border: `1px solid ${permScope === s.code ? "var(--lv-blue)" : "var(--lv-line)"}`,
                  background: permScope === s.code ? "var(--lv-blue-soft)" : "#fff",
                  color: "var(--lv-ink)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 16, height: 16, borderRadius: 999, flex: "none",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    border: `1.5px solid ${permScope === s.code ? "var(--lv-blue)" : "rgba(46,58,62,.25)"}`,
                    color: "#fff", fontSize: 10, background: permScope === s.code ? "var(--lv-blue)" : "transparent",
                  }}
                >
                  {permScope === s.code ? "✓" : ""}
                </span>
                <span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 650 }}>{s.name}</span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 11.5, color: "var(--lv-muted)" }}>{s.desc}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}
