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
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
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
import { listRoles, createRole, updateRole, removeRole, saveRoleMenus, exportRoles as exportRolesCsv, type RoleItem } from "../api/roles";
import { fetchMenuTree, type MenuItemRow } from "../api/menus";
import InsightPanel, { type InsightSection } from "../components/InsightPanel";
import { ask, type AnswerCard } from "../utils/ask";
import { downloadBlob } from "../utils/download";
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
  /** group 实体指向的 DB 页面（e-menu-<permission>） */
  menu?: MenuItemRow;
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
  const [view, setView] = useState<"trace" | "matrix" | "list">("list");

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

  /** 导出角色 CSV（对齐 scaffold：走 /api/roles/export，按关键词/状态过滤导出全量） */
  const exportRoles = async () => {
    try {
      const blob = await exportRolesCsv({ keyword: roleKw || undefined, status: statusF || undefined });
      downloadBlob(blob, "roles.csv");
    } catch {
      message.error("导出失败");
    }
  };

  /* ---------- 溯源数据：DB 菜单树页面 + 全量角色授权（sys_role_menus） ---------- */
  // 溯源的真实授权链：用户 --(role code)--> sys_roles --(menu_ids)--> 页面（menu_items.permission = 导航 key）
  const [menuPages, setMenuPages] = useState<MenuItemRow[]>([]);
  const [allRoles, setAllRoles] = useState<RoleItem[]>([]);
  useEffect(() => {
    if (view !== "trace") return;
    fetchMenuTree().then((r) => {
      const pages: MenuItemRow[] = [];
      const walk = (ns: MenuItemRow[]) => ns.forEach((n) => { if (n.type === "menu") pages.push(n); walk(n.children ?? []); });
      walk(r.items || []);
      setMenuPages(pages);
    }).catch(() => {});
    listRoles({ page: 1, page_size: 100 }).then((r) => setAllRoles(r.items || [])).catch(() => {});
  }, [view, staff.length]);

  /** 角色 → 可访问页面（DB 授权；内置 admin 拥有全部） */
  const menusOfRole = useCallback(
    (roleCode: string): MenuItemRow[] => {
      const r = allRoles.find((x) => x.code === roleCode);
      if (!r) return [];
      if (r.builtin) return menuPages;
      const ids = new Set(r.menu_ids || []);
      return menuPages.filter((m) => ids.has(m.permission));
    },
    [allRoles, menuPages]
  );
  /** 页面 → 授予它的启用普通角色 */
  const holdersOfPage = useCallback(
    (permission: string) =>
      allRoles.filter((r) => !r.builtin && r.status === 1 && (r.menu_ids || []).includes(permission)),
    [allRoles]
  );
  /** 用户持有的启用角色（单角色模型，最多 1 个） */
  const rolesOfUser = useCallback(
    (roleCode: string) => {
      const r = allRoles.find((x) => x.code === roleCode);
      return r ? [r] : [];
    },
    [allRoles]
  );

  // 新增 / 编辑角色
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [roleForm] = Form.useForm();

  // 表单值在 Modal 真正挂载后再写入（destroyOnHidden 下提前 setFieldsValue 会触发
  // 「useForm not connected」告警），这里用 effect 跟随 formOpen。
  useEffect(() => {
    if (!formOpen) return;
    if (editing) {
      roleForm.setFieldsValue({ name: editing.name, code: editing.code, data_scope: editing.data_scope, sort: editing.sort, status: editing.status, remark: editing.remark });
    } else {
      roleForm.resetFields();
      roleForm.setFieldsValue({ name: "", code: "", data_scope: "SELF", sort: 10, status: 1, remark: "" });
    }
  }, [formOpen, editing, roleForm]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (r: RoleItem) => {
    setEditing(r);
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
    setView("trace"); // 深链落点在溯源视图（默认视图是列表）
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

  /** 表盘读数（真实数据，对齐 scaffold）：
   *  users = 已分配角色的用户占比；roles = 有人持有的角色占比；menus = 被普通角色授权的页面占比 */
  const assignedUsers = useMemo(
    () => staff.filter((s) => allRoles.some((r) => r.code === s.role)).length,
    [staff, allRoles]
  );
  const heldRoles = useMemo(() => allRoles.filter((r) => (r.user_count || 0) > 0).length, [allRoles]);
  const grantedPages = useMemo(
    () => menuPages.filter((m) => holdersOfPage(m.permission).length > 0).length,
    [menuPages, holdersOfPage]
  );
  const idleRoleCount = useMemo(() => allRoles.length - heldRoles, [allRoles, heldRoles]);
  const orphanPageCount = useMemo(() => menuPages.length - grantedPages, [menuPages, grantedPages]);
  const userlessCount = useMemo(
    () => staff.filter((s) => !allRoles.some((r) => r.code === s.role)).length,
    [staff, allRoles]
  );
  const catCount: Record<ModuleKey, number> = {
    users: staff.length,
    roles: allRoles.length,
    menus: menuPages.length,
  };
  const catRatio: Record<ModuleKey, number> = {
    users: staff.length ? assignedUsers / staff.length : 0,
    roles: allRoles.length ? heldRoles / allRoles.length : 0,
    menus: menuPages.length ? grantedPages / menuPages.length : 0,
  };
  const catSub: Record<ModuleKey, string> = {
    users: "刻度：已分配角色占比",
    roles: "刻度：有人持有占比",
    menus: "刻度：已授权页面占比",
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

  /* ---------- 菜单查询：全部走 DB 授权（sys_role_menus × menu_items） ---------- */

  /** 纵列布局（对齐 scaffold column()：上留面包屑、下留问答坞，超出折成「还有 N 项」） */
  const COL_TOP = 76;
  const COL_BOTTOM = 96;
  function columnNodes<T>(
    items: T[], x: number, H: number,
    make: (item: T, y: number, i: number, n: number) => GraphNode,
    moreId: string, align: GraphNode["align"], minGap = 34
  ): GraphNode[] {
    const span = Math.max(120, H - COL_TOP - COL_BOTTOM);
    const cap = Math.max(4, Math.floor(span / minGap) + 1);
    const shown = items.slice(0, cap);
    const n = shown.length + (items.length > cap ? 1 : 0);
    const gap = n > 1 ? Math.min(46, span / (n - 1)) : 0;
    const y0 = COL_TOP + span / 2 - (gap * (n - 1)) / 2;
    const nodes = shown.map((item, i) => make(item, y0 + i * gap, i, n));
    if (items.length > cap) {
      nodes.push({ id: moreId, x, y: y0 + shown.length * gap, label: `还有 ${items.length - cap} 项`, kind: "item", align, interactive: false, delay: 0.5 });
    }
    return nodes;
  }

  const stagger = (i: number, n: number, base = 0) => base + i * Math.min(0.09, 1.8 / Math.max(n, 1));

  /* ---------- 某类的条目清单（② 模块层的胶囊来源；sub/tone 对齐 scaffold） ---------- */
  const moduleEntries = useCallback(
    (key: ModuleKey): EntryRow[] => {
      if (key === "users") {
        return [...staff]
          .sort((a, b) => rolesOfUser(b.role).length - rolesOfUser(a.role).length)
          .map((s) => {
            const rs = rolesOfUser(s.role);
            return {
              id: `e-user-${s.id}`,
              name: s.real_name,
              sub: rs.length ? `${s.department || "未分配部门"} · ${rs.length} 个角色` : "未分配角色",
              cat: roleMeta(s.role).cat,
              badge: `L${s.auth_level}`,
              meta: `${s.real_name} · L${s.auth_level} · ${s.work_status}`,
              tone: s.work_status === "在职" ? undefined : "off",
            };
          });
      }
      if (key === "roles") {
        return allRoles.map((r) => {
          const users = r.user_count || 0;
          const pageCount = menusOfRole(r.code).length;
          const idle = !users;
          return {
            id: `e-role-${r.code}`,
            name: r.name,
            sub: idle ? "闲置 · 没有持有人" : `${users} 人持有 · ${pageCount} 个页面`,
            cat: roleMeta(r.code).cat,
            badge: users || undefined,
            meta: r.builtin ? "内置角色 · 全部权限" : r.data_scope,
            tone: r.status !== 1 ? ("off" as const) : idle ? ("danger" as const) : undefined,
          } as EntryRow;
        });
      }
      return menuPages.map((m) => {
        const grants = holdersOfPage(m.permission).length;
        return {
          id: `e-menu-${m.permission}`,
          name: m.name,
          sub: grants ? `${grants} 个角色授予` : "孤立 · 仅超级管理员可见",
          cat: 3,
          badge: grants || undefined,
          meta: m.path,
          tone: m.status !== 1 ? ("off" as const) : grants ? undefined : ("danger" as const),
        } as EntryRow;
      });
    },
    [staff, allRoles, menuPages, menusOfRole, holdersOfPage, rolesOfUser]
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
      const code = entityId.replace("e-role-", "");
      const r = allRoles.find((x) => x.code === code);
      if (!r) return null;
      return {
        type: "role",
        key: entityId,
        title: r.name,
        sub: `${r.user_count || 0} 人持有 · ${menusOfRole(code).length} 个页面`,
        cat: roleMeta(code).cat,
        role: code,
        roleRow: roles.find((row) => row.role === code),
      };
    }
    if (entityId.startsWith("e-menu-")) {
      const permission = entityId.replace("e-menu-", "");
      const page = menuPages.find((m) => m.permission === permission);
      if (!page) return null;
      const holders = holdersOfPage(permission);
      return {
        type: "group",
        key: entityId,
        title: page.name,
        sub: `${holders.length} 个角色授予`,
        cat: 3,
        role: "",
        group: undefined,
        menu: page,
      } as Entity;
    }
    return null;
  }, [entityId, staff, allRoles, menuPages, menusOfRole, holdersOfPage, roles]);

  /** 实体层的双列数据（对齐 scaffold：每类实体 = 中心 + 左列 + 右列） */
  const twin = useMemo<{
    center: GraphNode;
    left: { nodes: GraphNode[]; kind: "user" | "role" | "menu" };
    right: { nodes: GraphNode[]; kind: "user" | "role" | "menu" };
    xs: [number, number, number];
  } | null>(() => {
    if (layer !== 3 || !entity) return null;
    const W = size.w;
    const H = size.h;
    const cy = H * 0.5;

    if (entity.type === "role") {
      const code = entity.role;
      const role = allRoles.find((x) => x.code === code);
      const userIds = staff.filter((s) => s.role === code);
      const grantedPages = menusOfRole(code);
      const xs: [number, number, number] = [W * 0.2, W * 0.47, W * 0.74];
      const center: GraphNode = {
        id: `e-role-${code}`, x: xs[1], y: cy, label: entity.title, sub: code,
        kind: "item", cat: entity.cat, count: `${userIds.length} 人`,
        tone: role?.status === 1 ? undefined : "off",
      };
      const left = {
        kind: "user" as const,
        nodes: columnNodes(userIds, xs[0], H, (s, y, i, n) => ({
          id: `e-user-${s.id}`, x: xs[0], y, label: s.real_name, sub: s.department || "",
          kind: "item", align: "right", cat: roleMeta(s.role).cat,
          tone: s.work_status === "在职" ? undefined : "off",
          from: `e-role-${code}`, delay: stagger(i, n, 0.1),
        }) as GraphNode, "more-user", "right"),
      };
      const right = {
        kind: "menu" as const,
        nodes: columnNodes(grantedPages, xs[2], H, (m, y, i, n) => {
          const btns = (m.children ?? []).length;
          return {
            id: `e-menu-${m.permission}`, x: xs[2], y, label: m.name,
            sub: m.path || m.permission, count: btns ? `${btns} 按钮` : undefined,
            kind: "item", align: "left", cat: 3,
            tone: m.status === 1 ? undefined : "off",
            from: `e-role-${code}`, delay: stagger(i, n, 0.25),
          } as GraphNode;
        }, "more-menu", "left"),
      };
      return { center, left, right, xs };
    }

    if (entity.type === "user" && entity.person) {
      const person = entity.person;
      const roleIds = rolesOfUser(person.role).map((r) => r.code);
      const pages = menusOfRole(person.role);
      const xs: [number, number, number] = [W * 0.14, W * 0.42, W * 0.7];
      const center: GraphNode = {
        id: `e-user-${person.id}`, x: xs[0], y: cy, label: entity.title,
        sub: person.department || person.role,
        kind: "item", cat: entity.cat, count: `${roleIds.length} 角色`,
        tone: person.work_status === "在职" ? undefined : "off",
      };
      const left = {
        kind: "role" as const,
        nodes: columnNodes(roleIds, xs[1], H, (code, y, i, n) => {
          const r = allRoles.find((x) => x.code === code);
          return {
            id: `e-role-${code}`, x: xs[1], y, label: r?.name ?? code, sub: code,
            kind: "item", cat: roleMeta(code).cat,
            tone: r?.status === 1 ? undefined : "off",
            from: `e-user-${person.id}`, delay: stagger(i, n, 0.1),
          } as GraphNode;
        }, "more-role", "center"),
      };
      const right = {
        kind: "menu" as const,
        nodes: columnNodes(pages, xs[2], H, (m, y, i, n) => ({
          id: `e-menu-${m.permission}`, x: xs[2], y, label: m.name,
          sub: m.path || m.permission, count: (m.children ?? []).length || undefined,
          kind: "item", align: "left", cat: 3,
          from: `e-user-${person.id}`, delay: stagger(i, n, 0.35),
        }) as GraphNode, "more-menu", "left"),
      };
      return { center, left, right, xs };
    }

    // menu 实体：用户 → 角色 → 页面（中心靠右，对齐 scaffold）
    if (entity.type === "group" && entity.menu) {
      const permission = entity.menu.permission;
      const holders = holdersOfPage(permission);
      const users = staff.filter((s) => holders.some((r) => r.code === s.role));
      const xs: [number, number, number] = [W * 0.2, W * 0.48, W * 0.76];
      const orphan = !holders.some((r) => !r.builtin);
      const center: GraphNode = {
        id: `e-menu-${permission}`, x: xs[2], y: cy, label: entity.title,
        sub: permission || entity.menu.path || "",
        kind: "item", cat: 3, count: `${holders.length} 角色`,
        tone: orphan ? "danger" : entity.menu.status === 1 ? undefined : "off",
      };
      const left = {
        kind: "user" as const,
        nodes: columnNodes(users, xs[0], H, (s, y, i, n) => ({
          id: `e-user-${s.id}`, x: xs[0], y, label: s.real_name, sub: s.department || "",
          kind: "item", align: "right", cat: roleMeta(s.role).cat,
          tone: s.work_status === "在职" ? undefined : "off",
          from: `e-menu-${permission}`, delay: stagger(i, n, 0.35),
        }) as GraphNode, "more-user", "right"),
      };
      const right = {
        kind: "role" as const,
        nodes: columnNodes(holders, xs[1], H, (r, y, i, n) => ({
          id: `e-role-${r.code}`, x: xs[1], y, label: r.name, sub: r.code,
          kind: "item", cat: roleMeta(r.code).cat,
          tone: r.status === 1 ? undefined : "off",
          from: `e-menu-${permission}`, delay: stagger(i, n, 0.1),
        }) as GraphNode, "more-role", "center"),
      };
      return { center, left, right, xs };
    }
    return null;
  }, [layer, entity, size, allRoles, staff, menusOfRole, holdersOfPage, rolesOfUser]);

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

    // ③ 实体：双列链路（对齐 scaffold：中心 + 左列 + 右列，脉冲贯穿）
    if (layer === 3 && twin) {
      out.push(twin.center);
      out.push(...twin.left.nodes, ...twin.right.nodes);
    }

    return out;
  }, [corePos, dialPos, layer, module, twin, size, catCount, catRatio, catSub, scope, moduleEntries]);

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
    if (layer === 3 && twin && entity) {
      const cId = twin.center.id;
      // 连线方向对齐 scaffold：用户 → 角色 → 页面 的授权流
      twin.left.nodes.forEach((n) => {
        if (n.interactive === false) return;
        // 左列 → 中心（role/menu 实体）或 中心 → 左列（user 实体：中心在左）
        if (entity.type === "user") out.push({ a: cId, b: n.id, flow: "forward", shape: "h", cat: 2 });
        else if (entity.type === "role") out.push({ a: n.id, b: cId, flow: "forward", shape: "h", cat: 1 });
        else out.push({ a: n.id, b: twin.right.nodes[0]?.id ?? cId, flow: "none", shape: "h", cat: 1, dashed: true });
      });
      twin.right.nodes.forEach((n) => {
        if (n.interactive === false) return;
        if (entity.type === "group") out.push({ a: n.id, b: cId, flow: "forward", shape: "h", cat: 3 });
        else out.push({ a: cId, b: n.id, flow: "forward", shape: "h", cat: 3 });
      });
      // user 实体：角色 → 页面 的授权线（仅该角色授权的页面）
      if (entity.type === "user" && entity.person) {
        const code = entity.person.role;
        twin.left.nodes.forEach((ln) => {
          if (ln.id !== `e-role-${code}`) return;
          twin.right.nodes.forEach((rn) => {
            if (rn.interactive === false) return;
            out.push({ a: ln.id, b: rn.id, flow: "forward", shape: "h", cat: 3 });
          });
        });
      }
    }
    return out;
  }, [layer, module, twin, entity, moduleEntries]);

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
      // 跨类授权线（真实 DB 数据）：用户 → 其角色；角色 → 其授权页面
      staff.slice(0, 24).forEach((s) => {
        if (allRoles.some((r) => r.code === s.role)) {
          netLinks.push({ a: `e-user-${s.id}`, b: `e-role-${s.role}`, cross: true });
        }
      });
      allRoles.forEach((r) => {
        if (r.builtin) return;
        (r.menu_ids || []).forEach((key) => {
          if (menuPages.some((m) => m.permission === key)) {
            netLinks.push({ a: `e-role-${r.code}`, b: `e-menu-${key}`, cross: true });
          }
        });
      });
    }

    if (layer === 3 && twin) {
      // 围绕中心节点的右列条目刻度弧（很淡的底纹）
      const anchor = twin.center;
      const kind = twin.right.kind;
      const items = twin.right.nodes.filter((n) => n.interactive !== false).slice(0, 14);
      const total = Math.max(1, items.length);
      items.forEach((n, i) => {
        const ang = Math.PI * 0.62 + (i / total) * Math.PI * 1.76;
        const r = 76 + (i % 2) * 22;
        const x = anchor.x + Math.cos(ang) * r;
        const yy = anchor.y + Math.sin(ang) * r;
        netNodes.push({
          id: `bg-${kind}-${i}`,
          x,
          y: yy,
          cat: n.cat ?? 3,
          r: 2.4,
          depth: 1,
          label: n.label,
          angle: Math.atan2(yy - anchor.y, x - anchor.x),
        });
        netLinks.push({ a: anchor.id, b: `bg-${kind}-${i}`, cat: n.cat ?? 3 });
      });
    }

    return { nodes: netNodes, links: netLinks };
  }, [layer, twin, dialPos, staff, allRoles, menuPages, size, moduleEntries]);

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

  const selectedNodeId = layer === 3 && twin ? twin.center.id : layer === 2 && module ? `d-${module}` : null;

  /* Esc 逐层返回（对齐 scaffold） */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || view !== "trace") return;
      if (layer === 3) goLayer(2);
      else if (layer === 2) goLayer(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, layer]);

  /* ---------- 信息卡内容（对齐 scaffold InsightPanel：tiles + insights + 可点击 chips） ---------- */
  const insight = useMemo(() => {
    if (layer !== 3 || !entity) return null;
    const stats: Array<{ label: string; value: ReactNode }> = [];
    const sections: InsightSection[] = [];

    const chipRow = (id: string, name: string, meta?: string, cat?: number, tone?: "off" | "warn" | "ok") => ({
      key: id, name, meta, cat, tone, onClick: () => { setEntityId(id); setBurstKey((k) => k + 1); },
    });

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

    if (entity.type === "user" && entity.person) {
      const p = entity.person;
      const rs = rolesOfUser(p.role);
      const pages = menusOfRole(p.role);
      stats.push({ label: "级别", value: `L${p.auth_level}` }, { label: "状态", value: p.work_status });
      const insights: Array<{ tone: "info" | "warn" | "danger" | "ok"; title: string; text: string }> = [];
      if (!rs.length) insights.push({ tone: "warn", title: "未分配角色", text: "该用户登录后看不到任何菜单。" });
      if (rs.some((r) => r.builtin)) insights.push({ tone: "info", title: "超级管理员", text: "拥有全部菜单与按钮权限。" });
      if (p.work_status !== "在职") insights.push({ tone: "danger", title: "账号不在岗", text: "账号已离岗，权限配置保持不变。" });
      sections.push(
        {
          title: "持有角色",
          chips: true,
          rows: rs.map((r) => chipRow(`e-role-${r.code}`, r.name, r.code, roleMeta(r.code).cat)),
          empty: "未分配角色",
        },
        {
          title: "可访问页面",
          chips: true,
          rows: pages.map((m) => chipRow(`e-menu-${m.permission}`, m.name, m.path, 3)),
          empty: "该角色未获得页面授权",
        },
        {
          title: "数据权限规则",
          rows: aclRows(p.role),
          empty: isAdmin ? "该角色暂无 DB 级规则（仅菜单级授权）" : "需管理员账号查看",
        }
      );
      return { kind: "用户", status: p.department ? `所属部门：${p.department}` : "未分配部门", tiles: [{ label: "角色", value: rs.length }, { label: "页面", value: pages.length }, { label: "状态", value: p.work_status }], insights, stats, sections };
    }

    if (entity.type === "role") {
      const code = entity.role;
      const r = allRoles.find((x) => x.code === code);
      const userIds = staff.filter((s) => s.role === code);
      const pages = menusOfRole(code);
      const insights: Array<{ tone: "info" | "warn" | "danger" | "ok"; title: string; text: string }> = [];
      if (r?.builtin) insights.push({ tone: "info", title: "超级管理员", text: "内置角色，自动拥有全部菜单与按钮，不受授权勾选影响。" });
      if (r && r.status !== 1) insights.push({ tone: "warn", title: "角色已停用", text: "持有该角色的用户不会获得其中任何权限。" });
      if (!userIds.length) insights.push({ tone: "warn", title: "闲置角色", text: "没有分配给任何用户，可考虑停用或与相近角色合并。" });
      const lonely = pages.filter((m) => holdersOfPage(m.permission).length === 1);
      if (lonely.length && !r?.builtin) {
        insights.push({ tone: "info", title: "独占授权", text: `${lonely.slice(0, 4).map((m) => m.name).join("、")}${lonely.length > 4 ? " 等" : ""} 仅由该角色授予，删除角色将导致无人可访问。` });
      }
      sections.push(
        {
          title: "持有用户",
          chips: true,
          rows: userIds.slice(0, 24).map((s) => chipRow(`e-user-${s.id}`, s.real_name, s.department || "", roleMeta(s.role).cat)),
          empty: "暂无持有人",
        },
        {
          title: "可访问页面",
          chips: true,
          rows: pages.map((m) => chipRow(`e-menu-${m.permission}`, m.name, m.path, 3)),
          empty: "未授权任何页面",
        },
        {
          title: "数据权限规则",
          rows: aclRows(code),
          empty: isAdmin ? "该角色暂无 DB 级规则（仅菜单级授权）" : "需管理员账号查看",
        }
      );
      return { kind: "角色", status: `${r ? (r.builtin ? "内置角色" : "自定义角色") : ""}`, tiles: [{ label: "页面", value: pages.length }, { label: "持有用户", value: userIds.length }, { label: "状态", value: r?.status === 1 ? "正常" : "停用" }], insights, stats, sections };
    }

    // menu 实体
    if (entity.type === "group" && entity.menu) {
      const m = entity.menu;
      const holders = holdersOfPage(m.permission);
      const users = staff.filter((s) => holders.some((r) => r.code === s.role));
      const insights: Array<{ tone: "info" | "warn" | "danger" | "ok"; title: string; text: string }> = [];
      if (!holders.some((r) => !r.builtin)) insights.push({ tone: "warn", title: "孤立菜单", text: "除超级管理员外没有任何角色授予，普通用户无法访问。" });
      if (m.visible === 0) insights.push({ tone: "info", title: "隐藏菜单", text: "不在侧栏显示，但有权限的用户仍可通过路由访问。" });
      if (m.status !== 1) insights.push({ tone: "warn", title: "已停用", text: "停用后所有角色都无法访问该项。" });
      sections.push(
        {
          title: "授予角色",
          chips: true,
          rows: holders.map((r) => chipRow(`e-role-${r.code}`, r.name, r.code, roleMeta(r.code).cat)),
          empty: "仅超级管理员可见",
        },
        {
          title: "可访问用户",
          chips: true,
          rows: users.slice(0, 24).map((s) => chipRow(`e-user-${s.id}`, s.real_name, s.department || "", roleMeta(s.role).cat)),
          empty: "暂无用户持有授权角色",
        }
      );
      return { kind: "页面", status: m.path, tiles: [{ label: "下级按钮", value: (m.children ?? []).length }, { label: "授予角色", value: holders.length }, { label: "覆盖用户", value: users.length }], insights, stats, sections };
    }

    return { kind: undefined, status: undefined, tiles: [], insights: [], stats, sections };
  }, [layer, entity, aclRules, roles, isAdmin, allRoles, staff, menusOfRole, holdersOfPage, rolesOfUser]);

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
            placeholder="问问权限…例如「谁能删除用户」"
            style={{ flex: 1, border: 0, outline: "none", fontSize: 13, background: "transparent", color: "var(--lv-ink)", minWidth: 0 }}
          />
          <button type="button" aria-label="发送" onClick={() => runAsk()}
            style={{ width: 32, height: 32, borderRadius: 999, border: 0, background: "var(--lv-blue)", color: "#fff", cursor: "pointer", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <SendOutlined style={{ fontSize: 13 }} />
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 10 }}>
          {["谁能删除用户?", "哪些角色没人用?", "哪些用户没分配角色?"].map((q) => (
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
          {isAdmin && (
            <button className="lv-btn lv-btn--primary" type="button" onClick={openCreate}><PlusOutlined /> 新增角色</button>
          )}
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
              <button className="lv-btn" type="button" onClick={() => { setKwInput(""); setRoleKw(""); setStatusF(""); setRolePage(1); }}><ReloadOutlined /> 重置</button>
              <button className="lv-btn lv-btn--primary" type="button" onClick={() => { setRoleKw(kwInput.trim()); setRolePage(1); }}><SearchOutlined /> 查询</button>
            </div>
          </div>

          {/* 角色列表面板 */}
          <section className="lv-panel">
            <div className="lv-panel-head">
              <span className="lv-tag lv-tag--leaf" style={{ width: 8, height: 8, padding: 0 }}><span className="lv-tag-dot" /></span>
              <span className="lv-panel-title">角色列表</span>
              <span className="lv-panel-meta">共 {roleTotal} 条</span>
              <div className="lv-panel-tools">
                <button className="icon-btn" title="导出 CSV" onClick={exportRoles}><DownloadOutlined /></button>
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
                { title: "数据权限", dataIndex: "data_scope", width: 160, render: (v: string, r: RoleItem) => <span style={{ color: "var(--lv-muted)" }}>{r.data_scope_text || SCOPE_LABELS[v] || v}</span> },
                { title: "用户数", dataIndex: "user_count", width: 80, align: "right" as const, render: (v: number) => <span className="tnum">{v}</span> },
                { title: "排序", dataIndex: "sort", width: 70, align: "right" as const, render: (v: number) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{v}</span> },
                {
                  title: "状态", dataIndex: "status", width: 90,
                  render: (v: number) => (
                    <span className={`lv-tag ${v === 1 ? "lv-tag--leaf" : "lv-tag--gray"}`}><span className="lv-tag-dot" />{v === 1 ? "正常" : "停用"}</span>
                  ),
                },
                { title: "创建时间", dataIndex: "created_at", width: 150, render: (v: string, r: RoleItem) => <span className="tnum" style={{ color: "var(--lv-soft)" }}>{r.create_time || (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "—")}</span> },
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
        <div className="panel-body" style={{ padding: 0 }}>
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
                  highlight={layer === 3 && twin ? [twin.center.id, ...twin.left.nodes.map((n) => n.id), ...twin.right.nodes.map((n) => n.id)] : null}
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
                    <nav className="trace-crumbs" aria-label="溯源路径">
                      {layer !== 1 && (
                        <button type="button" aria-label="返回上一层" onClick={() => goLayer((layer - 1) as Layer)}
                          style={{ border: 0, background: "none", cursor: "pointer", color: "var(--lv-soft)", padding: "0 2px", fontSize: 13 }}>‹</button>
                      )}
                      <button type="button" className={layer === 1 ? "is-current" : ""} onClick={() => goLayer(1)}>
                        <SafetyOutlined style={{ fontSize: 12 }} />权限全景
                      </button>
                      {layer >= 2 && module && (
                        <>
                          <span className="trace-sep" aria-hidden="true">/</span>
                          <button type="button" className={layer === 2 ? "is-current" : ""} onClick={() => goLayer(2)}>
                            {CATS.find((c) => c.key === module)?.name}
                          </button>
                        </>
                      )}
                      {layer === 3 && entity && (
                        <>
                          <span className="trace-sep" aria-hidden="true">/</span>
                          <b className="is-current">{entity.title}</b>
                        </>
                      )}
                    </nav>
                  }
                  tr={
                    layer === 1 ? (
                      <dl className="trace-legend">
                        <div className="cat-1"><dt><i />用户</dt><dd className="tnum">{staff.length}</dd></div>
                        <div className="cat-2"><dt><i />角色</dt><dd className="tnum">{allRoles.length}</dd></div>
                        <div className="cat-3"><dt><i />菜单</dt><dd className="tnum">{menuPages.length}</dd></div>
                        <div className="is-warn"><dt>闲置角色</dt><dd className="tnum">{idleRoleCount}</dd></div>
                        <div className="is-warn"><dt>孤立菜单</dt><dd className="tnum">{orphanPageCount}</dd></div>
                        <div className="is-warn"><dt>无角色用户</dt><dd className="tnum">{userlessCount}</dd></div>
                      </dl>
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
                  kind={insight.kind}
                  kindIcon={entity.type === "user" ? <UserOutlined /> : entity.type === "role" ? <SafetyCertificateOutlined /> : <AppstoreOutlined />}
                  cat={entity.cat}
                  status={insight.status}
                  tiles={insight.tiles}
                  insights={insight.insights}
                  stats={insight.stats}
                  sections={insight.sections}
                  note="授权链来自真实数据：用户 → 角色（sys_roles）→ 页面（menu_items 授权）；DB 级规则取自数据权限表。"
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
              ) : null}
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
        okText="保存"
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
