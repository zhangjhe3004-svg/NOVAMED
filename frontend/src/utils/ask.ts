/**
 * 「问系统」——本地规则问答引擎（对齐 scaffold composables/ask.ts：异步意图自取数 + 权限门）。
 *
 * 为什么不做成调 AI：这些问题（谁能删用户、哪个角色闲置、验证码开没开）
 * 的答案本来就在手上的数据里（权限图 / 参数表 / 登录热力 / 名册）。
 * 本地规则算出来的答案是可复现、可跳转、零延迟、零成本的，
 * 调大模型反而会编。所以这里只做「把已有数据翻译成人话」。
 *
 * 每个意图 = 问题模板 + 命中正则 + 是否需管理员 + 异步取数，答案是一张张卡片：
 * 语气色条 + 结论 + 可跳转芯片。数据权限类意图取自 /permissions/graph（RBAC 真授权）。
 */
import api from "../api/client";
import { fetchPermissionGraph, type PermGraph, type PermGraphMenu } from "../api/permissions";
import { listConfigs } from "../api/configs";
import { listDictTypes, listDictData } from "../api/dicts";
import { roleMeta, type NavGroup } from "../config/nav";
import { inferConfigKind } from "./configValue";

export interface AskPerson {
  id: number;
  real_name: string;
  role: string;
  department: string;
  title: string;
  auth_level: number;
  work_status: string;
}

export interface AskAclRule {
  id: number;
  role: string;
  collection: string;
  action: string;
  row_scope: string;
  enabled: boolean;
}

export interface AskContext {
  navGroups: NavGroup[];
  people: AskPerson[];
  aclRules: AskAclRule[];
  /** all = 全院（管理员）/ chain = 责任链内 */
  scope: "all" | "chain";
  isAdmin: boolean;
}

export interface AnswerChip {
  key: string;
  label: string;
  sub?: string;
  /** 点了跳哪里 */
  to?: string;
  tone?: "danger" | "off";
}

export interface AnswerCard {
  tone: "info" | "warn" | "ok" | "danger";
  title: string;
  text: string;
  chips?: AnswerChip[];
  /** 来源：rule = 本地规则引擎（可复现）；agent = 大模型智能体兜底 */
  source?: "rule" | "agent";
}

export interface AskIntent {
  id: string;
  /** 预设问题：以芯片形式展示，点了自动打字填入 */
  question: string;
  patterns: RegExp[];
  /** 需要管理员才能回答（数据面更全）；非管理员给提示卡 */
  admin?: boolean;
  run: (question: string, ctx: AskContext) => AnswerCard[] | Promise<AnswerCard[]>;
}

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

/* ── 文本匹配：不做分词，用「包含 + 字符重合」就够了，中文短句识别率很高 ── */

function looseScore(text: string, key: string): number {
  if (!text || !key) return 0;
  if (text === key) return 100;
  if (text.includes(key)) return 60 + key.length * 2;
  if (key.includes(text)) return 40 + text.length * 2;
  let hit = 0;
  for (const ch of key) if (text.includes(ch)) hit += 1;
  const need = Math.min(2, key.length);
  return hit >= need ? hit * 7 : 0;
}

/** 从问句里剥出「对象」：谁能进运营数据 → 运营数据 */
export function extractTarget(question: string): string {
  return question
    .replace(/[?？。！!，,、"'“”‘’（）()《》\s]/g, "")
    .replace(/^(请问|帮我|我想知道|我想问|我想|想知道|我要查|我要|麻烦)/, "")
    .replace(/(谁|哪些人|哪个人|什么人|哪个角色|哪些角色|哪位|哪个科室|哪些科室|哪些菜单|哪些页面)/g, "")
    .replace(/(能|可以|有权|有权限|能够|会|有权)/g, "")
    .replace(/(删除|编辑|新增|修改|导出|查看|访问|进入|打开|操作|看到|使用)/g, "")
    .replace(/(吗|呢|呀|的|是|在|有|都是|分别)$/g, "")
    .trim();
}

/* ============================================================
   权限图索引：把 /permissions/graph 推演成各类问题的答案
   （带 30s 模块级缓存，连续提问不重复拉取）
   ============================================================ */

interface GraphIndex {
  g: PermGraph;
  menuById: Map<number, PermGraphMenu>;
  menusOfUser: (userId: number) => PermGraphMenu[];
  holdersOfMenu: (menuId: number) => { roles: PermGraph["roles"]; users: PermGraph["users"] };
  menuPath: (menuId: number) => PermGraphMenu[];
  findings: () => {
    unusedRoles: PermGraph["roles"];
    usersWithoutRole: PermGraph["users"];
    orphanMenus: PermGraphMenu[];
    buttonsWithoutCode: PermGraphMenu[];
    overlapUsers: { user: PermGraph["users"][number]; roles: PermGraph["roles"] }[];
  };
}

let graphCache: { at: number; index: GraphIndex } | null = null;

async function loadGraphIndex(): Promise<GraphIndex> {
  if (graphCache && Date.now() - graphCache.at < 30_000) return graphCache.index;
  const g = await fetchPermissionGraph();
  const menuById = new Map(g.menus.map((m) => [m.id, m] as const));
  const roleById = new Map(g.roles.map((r) => [r.id, r] as const));
  const userById = new Map(g.users.map((u) => [u.id, u] as const));

  const rolesOfUser = new Map<number, number[]>();
  const usersOfRole = new Map<number, number[]>();
  g.userRoles.forEach(([uid, rid]) => {
    if (!rolesOfUser.has(uid)) rolesOfUser.set(uid, []);
    rolesOfUser.get(uid)!.push(rid);
    if (!usersOfRole.has(rid)) usersOfRole.set(rid, []);
    usersOfRole.get(rid)!.push(uid);
  });

  const index: GraphIndex = {
    g,
    menuById,
    menusOfUser(userId) {
      const ids = new Set<number>();
      (rolesOfUser.get(userId) ?? []).forEach((rid) =>
        (roleById.get(rid)?.menuIds ?? []).forEach((mid) => ids.add(mid))
      );
      return [...ids].map((id) => menuById.get(id)!).filter(Boolean);
    },
    holdersOfMenu(menuId) {
      const roles = g.roles.filter((r) => r.menuIds.includes(menuId));
      const uids = new Set<number>();
      roles.forEach((r) => (usersOfRole.get(r.id) ?? []).forEach((u) => uids.add(u)));
      const users = [...uids].map((id) => userById.get(id)!).filter(Boolean);
      return { roles, users };
    },
    menuPath(menuId) {
      const path: PermGraphMenu[] = [];
      let cur = menuById.get(menuId);
      const guard = new Set<number>();
      while (cur && !guard.has(cur.id)) {
        guard.add(cur.id);
        path.unshift(cur);
        cur = cur.parentId ? menuById.get(cur.parentId) : undefined;
      }
      return path;
    },
    findings() {
      const builtinIds = new Set(g.roles.filter((r) => r.builtin).map((r) => r.id));
      const unusedRoles = g.roles.filter((r) => !r.builtin && (usersOfRole.get(r.id)?.length ?? 0) === 0);
      const usersWithoutRole = g.users.filter((u) => (rolesOfUser.get(u.id)?.length ?? 0) === 0);
      const holders = new Map<number, { hasNormal: boolean }>();
      g.roles.forEach((r) =>
        r.menuIds.forEach((mid) => {
          const h = holders.get(mid) ?? { hasNormal: false };
          if (!builtinIds.has(r.id) && r.status === 1) h.hasNormal = true;
          holders.set(mid, h);
        })
      );
      const orphanMenus = g.menus.filter(
        (m) => m.type === "menu" && m.status === 1 && !(holders.get(m.id)?.hasNormal ?? false)
      );
      const buttonsWithoutCode = g.menus.filter((m) => m.type === "btn" && !(m.permission ?? "").trim());
      const overlapUsers = g.users
        .map((u) => ({
          user: u,
          roles: (rolesOfUser.get(u.id) ?? [])
            .map((rid) => roleById.get(rid)!)
            .filter((r) => r && r.status === 1),
        }))
        .filter((x) => x.roles.length >= 3);
      return { unusedRoles, usersWithoutRole, orphanMenus, buttonsWithoutCode, overlapUsers };
    },
  };
  graphCache = { at: Date.now(), index };
  return index;
}

/** 溯源深链：/role-trace?trace=role:<code> / user:<id> */
const traceTo = (q: string) => `/role-trace${q}`;

/** 在菜单树里找「最像问句对象」的权限点（页面 / 按钮，按钮带父页面名一起打分） */
function findPermTargets(target: string, menus: PermGraphMenu[]): PermGraphMenu[] {
  if (!target) return [];
  const byId = new Map(menus.map((m) => [m.id, m] as const));
  const parentName = (m: PermGraphMenu) => (m.parentId ? byId.get(m.parentId)?.name ?? "" : "");
  const scored = menus
    .filter((m) => m.type !== "dir")
    .map((m) => {
      let s = looseScore(target, m.name) + (m.permission ? looseScore(target, m.permission) * 0.5 : 0);
      if (m.type === "btn") s += looseScore(target, parentName(m)) * 0.8;
      return { m, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, 3).map((x) => x.m);
}

/** 显式权限码：medicode:users:remove / system:user:list */
function permissionFromQuestion(question: string): string | null {
  return question.match(/(?:medicode|system|monitor|tool)[\w-]*:[\w-]+:[\w-]+/i)?.[0] ?? null;
}

/* ============================================================
   意图注册表
   ============================================================ */

const INTENTS: AskIntent[] = [
  /* ── 权限类（/permissions/graph 真授权）────────────────── */
  {
    id: "perm.who",
    question: "谁能删除用户？",
    patterns: [
      /谁(能|可以|有权|有权限)/,
      /哪些(人|角色)(能|可以|有)/,
      /medicode:[\w-]+:[\w-]+/i,
      /(能|可以|有权)(删除|编辑|新增|修改|导出|导入|审核|审批)/,
    ],
    admin: true,
    async run(question) {
      const index = await loadGraphIndex();
      const code = permissionFromQuestion(question);
      const targets = code
        ? index.g.menus.filter((m) => (m.permission ?? "").toLowerCase() === code.toLowerCase())
        : findPermTargets(extractTarget(question) || question, index.g.menus);
      if (!targets.length) {
        return [
          {
            tone: "warn",
            title: "没有找到对应权限",
            text: code
              ? `系统里没有权限标识「${code}」。`
              : "请说明动作和对象，例如「谁能删除用户」「谁能编辑就诊记录」。",
          },
        ];
      }
      return targets.map((m) => {
        const { roles, users } = index.holdersOfMenu(m.id);
        const path = index.menuPath(m.id).map((x) => x.name).join(" / ");
        const normalRoles = roles.filter((r) => !r.builtin);
        return {
          tone: users.length > 5 ? ("warn" as const) : ("info" as const),
          title: `${m.name}${m.permission && m.type === "btn" ? ` · ${m.permission}` : ""}`,
          text: `${path}。${normalRoles.length} 个业务角色授予，覆盖 ${users.length} 名用户。`,
          chips: [
            ...roles.map((r) => ({
              key: `r${r.id}`,
              label: r.name,
              sub: r.code,
              to: traceTo(`?trace=role:${r.code}`),
              tone: r.builtin ? ("off" as const) : undefined,
            })),
            ...users.slice(0, 8).map((u) => ({
              key: `u${u.id}`,
              label: u.nickname,
              sub: u.deptName ?? "",
              to: traceTo(`?trace=user:${u.id}`),
            })),
          ],
        };
      });
    },
  },

  {
    id: "perm.unused",
    question: "哪些角色没人用？",
    patterns: [/(没人|无人|闲置|未使用|没有用户|没有成员).*角色/, /角色.*(没人|无人|闲置|未使用|没有成员)/],
    admin: true,
    async run() {
      const index = await loadGraphIndex();
      const { unusedRoles } = index.findings();
      return [
        {
          tone: unusedRoles.length ? ("warn" as const) : ("ok" as const),
          title: "闲置角色",
          text: unusedRoles.length
            ? `${unusedRoles.length} 个角色没有分配给任何用户，可考虑停用或合并。`
            : "每个业务角色都至少分配给了一名用户。",
          chips: unusedRoles.map((r) => ({
            key: `r${r.id}`,
            label: r.name,
            sub: r.status === 1 ? r.code : "已停用",
            to: traceTo(`?trace=role:${r.code}`),
            tone: r.status === 1 ? undefined : ("off" as const),
          })),
        },
      ];
    },
  },

  {
    id: "perm.noRole",
    question: "哪些用户还没分配角色？",
    patterns: [/(没有|没|未|无)(分配|任何)?角色/, /没.*角色.*用户/, /用户.*(没有|未|无).*角色/],
    admin: true,
    async run() {
      const index = await loadGraphIndex();
      const { usersWithoutRole } = index.findings();
      return [
        {
          tone: usersWithoutRole.length ? ("warn" as const) : ("ok" as const),
          title: "未分配角色的用户",
          text: usersWithoutRole.length
            ? `${usersWithoutRole.length} 名用户登录后看不到任何菜单。`
            : "所有用户都已分配角色。",
          chips: usersWithoutRole.slice(0, 16).map((u) => ({
            key: `u${u.id}`,
            label: u.nickname,
            sub: u.deptName ?? "",
            to: traceTo(`?trace=user:${u.id}`),
          })),
        },
      ];
    },
  },

  {
    id: "perm.orphan",
    question: "哪些菜单没有授予任何角色？",
    patterns: [
      /孤立/,
      /(没有|未)(授予|授权).*菜单/,
      /菜单.*(没有|未)(授予|授权)/,
      /缺.*权限码|权限码.*缺/,
    ],
    admin: true,
    async run() {
      const index = await loadGraphIndex();
      const { orphanMenus, buttonsWithoutCode } = index.findings();
      const cards: AnswerCard[] = [
        {
          tone: orphanMenus.length ? ("warn" as const) : ("ok" as const),
          title: "孤立菜单",
          text: orphanMenus.length
            ? `${orphanMenus.length} 个启用页面只有超级管理员能访问。`
            : "所有启用页面都已授予至少一个业务角色。",
          chips: orphanMenus.slice(0, 16).map((m) => ({
            key: `m${m.id}`,
            label: m.name,
            sub: m.permission ?? m.type,
            to: "/menu-star",
          })),
        },
      ];
      if (buttonsWithoutCode.length) {
        cards.push({
          tone: "danger",
          title: "缺少权限标识的按钮",
          text: `${buttonsWithoutCode.length} 个按钮没有权限标识，前后端都无法据此校验。`,
          chips: buttonsWithoutCode.slice(0, 12).map((m) => ({
            key: `b${m.id}`,
            label: m.name,
            to: "/menu-star",
            tone: "danger" as const,
          })),
        });
      }
      return cards;
    },
  },

  {
    id: "perm.overlap",
    question: "哪些用户叠加了多个角色？",
    patterns: [/叠加|冗余|多个角色|多角色/],
    admin: true,
    async run() {
      const index = await loadGraphIndex();
      const { overlapUsers } = index.findings();
      return [
        {
          tone: overlapUsers.length ? ("warn" as const) : ("ok" as const),
          title: "多角色叠加",
          text: overlapUsers.length
            ? `${overlapUsers.length} 名用户同时持有 3 个及以上启用角色，权限可能超出岗位需要。`
            : "没有用户叠加 3 个及以上角色。",
          chips: overlapUsers.map(({ user, roles }) => ({
            key: `u${user.id}`,
            label: user.nickname,
            sub: `${roles.length} 个角色`,
            to: traceTo(`?trace=user:${user.id}`),
          })),
        },
      ];
    },
  },

  {
    id: "perm.can",
    question: "医生能访问哪些菜单？",
    patterns: [/(.+?)(能|可以)(访问|看到|进|进入|做|操作)(哪些|什么)/],
    admin: true,
    async run(question) {
      const index = await loadGraphIndex();
      const name = question.match(/(.+?)(能|可以)(访问|看到|进|进入|做|操作)/)?.[1]?.trim() ?? "";
      const user =
        index.g.users.find((u) => u.nickname === name || u.username === name) ??
        index.g.users.find((u) => name && (u.nickname.includes(name) || u.username.includes(name)));
      if (!user) {
        return [
          { tone: "warn", title: "没有找到这个用户", text: `「${name}」不在可见用户范围内。` },
        ];
      }
      const menus = index.menusOfUser(user.id);
      const pages = menus.filter((m) => m.type === "menu");
      const buttons = menus.filter((m) => m.type === "btn");
      const roleNames = index.g.userRoles
        .filter(([uid]) => uid === user.id)
        .map(([, rid]) => index.g.roles.find((r) => r.id === rid)?.name ?? `#${rid}`)
        .join("、");
      return [
        {
          tone: "info",
          title: `${user.nickname} 的可用权限`,
          text: `持有角色：${roleNames || "（无）"}。可访问 ${pages.length} 个页面、${buttons.length} 个操作按钮。`,
          chips: [
            { key: `u${user.id}`, label: "查看溯源图", sub: user.username, to: traceTo(`?trace=user:${user.id}`) },
            ...pages.map((m) => ({ key: `m${m.id}`, label: m.name, sub: m.permission ?? "", to: "/menu-star" })),
          ],
        },
      ];
    },
  },

  /* ── 登录安全类 ─────────────────────────────────────────── */
  {
    id: "login.anomaly",
    question: "最近有异常登录吗？",
    patterns: [/异常登录|登录异常|暴力|撞库|失败.*登录|登录.*失败|可疑/],
    admin: true,
    async run(question) {
      const days = /月|30/.test(question) ? 30 : 7;
      const heat = await api
        .get("/login-logs/heatmap", { params: { days } })
        .then((r) => r.data as {
          days: number; threshold: number;
          cells: { total: number; failed: number }[];
          anomalies: { kind: "ip" | "user"; key: string; failed: number }[];
        });
      const failed = heat.cells.reduce((a, c) => a + (c.failed || 0), 0);
      const total = heat.cells.reduce((a, c) => a + (c.total || 0), 0);
      return [
        {
          tone: heat.anomalies.length ? ("danger" as const) : ("ok" as const),
          title: heat.anomalies.length ? `发现 ${heat.anomalies.length} 处失败聚集` : "没有异常聚集",
          text: `近 ${heat.days} 天登录 ${total} 次，失败 ${failed} 次；同一 IP 或账号失败 ≥ ${heat.threshold} 次计为异常。`,
          chips: heat.anomalies.slice(0, 10).map((a) => ({
            key: `${a.kind}-${a.key}`,
            label: a.key,
            sub: `${a.kind === "ip" ? "IP" : "账号"} · ${a.failed} 次失败`,
            to: "/login-log",
            tone: "danger" as const,
          })),
        },
      ];
    },
  },

  /* ── 参数类（/api/configs）──────────────────────────────── */
  {
    id: "config.boolean",
    question: "当前登录验证码是否开启？",
    patterns: [/是否(开启|启用|关闭|开着)|开没开|有没有开/, /(开关|布尔).*(参数|哪些)/, /验证码|初始密码|外观/],
    admin: true,
    async run(question) {
      const res = await listConfigs({ page: 1, page_size: 100 });
      const rows = res.items || [];
      const bools = rows.filter(
        (r) => inferConfigKind(r.key, r.value ?? "", r.remark ?? "").kind === "boolean"
      );
      if (/哪些|所有|全部|几个|多少/.test(question) && /开关|布尔|是否|参数/.test(question)) {
        return [
          {
            tone: bools.length ? ("info" as const) : ("warn" as const),
            title: `开关类参数 ${bools.length} 个`,
            text: bools.length
              ? `当前开启 ${bools.filter((r) => /^true$/i.test(r.value)).length} 个，关闭 ${
                  bools.length - bools.filter((r) => /^true$/i.test(r.value)).length
                } 个。`
              : "系统里没有布尔类型的参数。",
            chips: bools.slice(0, 12).map((r) => ({
              key: `c${r.id}`,
              label: r.name,
              sub: `${r.key} = ${r.value}`,
              to: "/configs",
            })),
          },
        ];
      }
      const term = String(question)
        .replace(/[?？。,，!！\s]/g, "")
        .replace(/是否|有没有|开没开|开启|启用|关闭|开着|当前|吗|呢|的|了|着|在|被|系统/g, "");
      const grams: string[] = [];
      for (let len = Math.min(4, term.length); len >= 2; len--)
        for (let i = 0; i + len <= term.length; i++) grams.push(term.slice(i, i + len));
      const matched = rows
        .map((row) => {
          const text = `${row.name} ${row.key} ${row.remark ?? ""}`.toLowerCase();
          const hits = grams.filter((g) => text.includes(g.toLowerCase()));
          return { row, hits: hits.length, longest: hits.length ? Math.max(...hits.map((h) => h.length)) : 0 };
        })
        .filter((s) => s.hits > 0)
        .sort((a, b) => b.longest - a.longest || b.hits - a.hits);
      if (!matched.length) {
        return [
          {
            tone: "warn",
            title: "没有匹配的参数",
            text: `在 ${rows.length} 个参数里没找到与「${term || question}」相关的项，可以试试参数的名称或键名片段。`,
          },
        ];
      }
      return matched.slice(0, 3).map(({ row }) => {
        const on = /^true$/i.test(row.value);
        return {
          tone: (on ? "ok" : "info") as "ok" | "info",
          title: `${row.name} · 当前${on ? "开启" : "关闭"}`,
          text: `${row.key} = ${row.value}${row.remark ? `；${row.remark}` : ""}${
            row.builtin ? "（内置参数，键名不可改）" : ""
          }`,
          chips: [{ key: `c${row.id}`, label: "去参数配置", sub: row.key, to: "/configs" }],
        };
      });
    },
  },

  {
    id: "config.sensitive",
    question: "参数配置里有哪些敏感值？",
    patterns: [/敏感|密钥|秘密|secret/i],
    admin: true,
    async run() {
      const res = await listConfigs({ page: 1, page_size: 100 });
      const rows = res.items || [];
      const secrets = rows.filter(
        (r) => inferConfigKind(r.key, r.value ?? "", r.remark ?? "").kind === "secret"
      );
      const mask = (v: string) =>
        v.length <= 2 ? "••" : `${v.slice(0, 2)}${"•".repeat(Math.min(6, v.length - 2))}${v.slice(-1)}`;
      return [
        {
          tone: secrets.length ? ("warn" as const) : ("ok" as const),
          title: `敏感参数 ${secrets.length} 个`,
          text: secrets.length
            ? secrets
                .slice(0, 8)
                .map((r) => `${r.name}（${r.key} = ${mask(r.value ?? "")}）`)
                .join("；") + "。这些值按密钥类参数渲染为密文，注意保存后不再明文展示。"
            : "系统没有密钥类参数。",
          chips: secrets.slice(0, 8).map((r) => ({
            key: `c${r.id}`,
            label: r.name,
            sub: r.key,
            to: "/configs",
          })),
        },
      ];
    },
  },

  {
    id: "config.find",
    question: "哪些参数管登录安全？",
    patterns: [/参数|配置|设置|开关/],
    admin: true,
    async run(question) {
      const res = await listConfigs({ page: 1, page_size: 100 });
      const rows = res.items || [];
      const en = String(question).match(/[a-zA-Z][\w.]*/g) ?? [];
      const zh = String(question).match(/[一-龥]{2,}/g) ?? [];
      const terms = [...en, ...zh].filter(
        (w) => !/参数|配置|设置|开关|哪些|什么|管理|系统|怎么|怎样/.test(w)
      );
      const scored = rows
        .map((row) => {
          const text = `${row.name} ${row.key} ${row.remark ?? ""}`.toLowerCase();
          return { row, hits: terms.filter((t) => text.includes(t.toLowerCase())) };
        })
        .filter((s) => s.hits.length)
        .sort((a, b) => b.hits.length - a.hits.length);
      if (!scored.length) {
        return [
          {
            tone: "info",
            title: `共 ${res.total} 个参数`,
            text: "没有找到直接匹配问题关键词的参数，试试「验证码」「密码」「阈值」等词，或去参数配置按名称检索。",
            chips: [{ key: "go", label: "去参数配置", to: "/configs" }],
          },
        ];
      }
      return scored.slice(0, 3).map(({ row }) => ({
        tone: "info" as const,
        title: row.name || row.key,
        text: `${row.key} = ${row.value}${row.remark ? `；${row.remark}` : ""}${
          row.builtin ? "（内置参数，键名不可改）" : ""
        }`,
        chips: [{ key: `c${row.id}`, label: "去参数配置", sub: row.key, to: "/configs" }],
      }));
    },
  },

  /* ── 字典类 ─────────────────────────────────────────────── */
  {
    id: "dict.find",
    question: "系统里有哪些字典？",
    patterns: [/字典/, /(下拉|选项|枚举).*(哪些|有什么|多少)/],
    admin: true,
    async run() {
      const res = await listDictTypes({ page: 1, page_size: 50 });
      const types = res.items || [];
      const withCount = await Promise.all(
        types.slice(0, 6).map(async (t) => {
          try {
            const data = await listDictData(t.dict_type);
            return { t, n: data.length };
          } catch {
            return { t, n: 0 };
          }
        })
      );
      return [
        {
          tone: types.length ? ("info" as const) : ("warn" as const),
          title: `字典类型共 ${res.total} 个`,
          text: types.length
            ? "字典统一维护各业务页面的下拉选项和状态标签，点芯片可到字典管理查看数据项。"
            : "还没有任何字典类型，可到字典管理新增。",
          chips: withCount.map(({ t, n }) => ({
            key: `d${t.id}`,
            label: t.dict_name,
            sub: `${t.dict_type} · ${n} 项`,
            to: "/dicts",
          })),
        },
      ];
    },
  },

  /* ── 人员组织类（名册来自上下文）────────────────────────── */
  {
    id: "user.top",
    question: "谁的权限最高？",
    patterns: [/(谁|哪个|哪些).*(权限|级别|职级).*(最高|最大)/, /(最高|最大).*(权限|级别|职级)/],
    run: (_q, ctx) => {
      const sorted = [...ctx.people].sort((a, b) => b.auth_level - a.auth_level);
      const top = sorted.slice(0, 5);
      const max = top[0]?.auth_level ?? 0;
      return [
        {
          tone: "info",
          title: `权限最高：${max} 级`,
          text: `${ctx.people.length} 人里最高是 ${max} 级（数字身份权限 1–9）。下面按级别列出前 ${top.length} 人。`,
          chips: top.map((p) => ({
            key: `u-${p.id}`,
            label: p.real_name,
            sub: `L${p.auth_level} · ${roleMeta(p.role).text}`,
            to: "/post-ladder",
          })),
        },
      ];
    },
  },

  {
    id: "dept.count",
    question: "各科室有多少人？",
    patterns: [/(几个|多少)(人|个人)/, /(科室|部门).*(人|人数|成员)/, /人.*(科室|部门)/],
    run: (_q, ctx) => {
      const tally = new Map<string, AskPerson[]>();
      ctx.people.forEach((p) => {
        const d = p.department || "未分配科室";
        if (!tally.has(d)) tally.set(d, []);
        tally.get(d)!.push(p);
      });
      const rows = [...tally.entries()].sort((a, b) => b[1].length - a[1].length);
      return [
        {
          tone: "info",
          title: "科室人数分布",
          text: `共 ${ctx.people.length} 人、${rows.length} 个科室。${
            rows[0] ? `最多的是${rows[0][0]}（${rows[0][1].length} 人）。` : ""
          }`,
          chips: rows.map(([dept, list]) => ({
            key: `d-${dept}`,
            label: dept,
            sub: `${list.length} 人`,
            to: "/org-canvas",
          })),
        },
      ];
    },
  },

  {
    id: "acl.collection",
    question: "leave_requests 谁能读？",
    patterns: [/[a-z_]{3,}/i, /数据权限/, /(读取|读写|新建|修改|删除).*(规则|权限)/],
    run: (question, ctx) => {
      if (!ctx.isAdmin) {
        return [
          {
            tone: "warn",
            title: "需要管理员账号",
            text: "数据权限规则只有管理员能读。当前账号看到的是菜单级授权。",
          },
        ];
      }
      const target = extractTarget(question) || question.toLowerCase();
      const rules = ctx.aclRules.filter(
        (r) => r.collection.toLowerCase().includes(target) || target.includes(r.collection.toLowerCase())
      );
      const list = rules.length ? rules : ctx.aclRules;
      if (!list.length) {
        return [{ tone: "warn", title: "没有数据权限规则", text: "数据权限表里暂时没有任何规则。" }];
      }
      const byCollection = new Map<string, AskAclRule[]>();
      list.forEach((r) => {
        if (!byCollection.has(r.collection)) byCollection.set(r.collection, []);
        byCollection.get(r.collection)!.push(r);
      });
      return [...byCollection.entries()].slice(0, 3).map(([collection, rows]) => ({
        tone: "info" as const,
        title: collection,
        text: `${rows.length} 条规则：${rows
          .map(
            (r) =>
              `${roleMeta(r.role).text} 可${ACTION_TEXT[r.action] || r.action}（${
                SCOPE_TEXT[r.row_scope] || r.row_scope
              }）${r.enabled ? "" : " · 已停用"}`
          )
          .join("；")}。`,
        chips: [...new Set(rows.map((r) => r.role))].map((role) => ({
          key: `r-${role}`,
          label: roleMeta(role).text,
          sub: `${rows.filter((r) => r.role === role).length} 条`,
          to: traceTo(`?trace=role:${role}`),
        })),
      }));
    },
  },

  {
    id: "person.find",
    question: "张伟在哪个科室？",
    patterns: [/(在哪个|属于哪个|哪个)科室/, /(谁在|查找|找一下|帮我找)/],
    run: (question, ctx) => {
      const target = extractTarget(question);
      const hits = ctx.people.filter((p) => looseScore(target, p.real_name) > 0);
      if (!hits.length) {
        return [
          {
            tone: "warn",
            title: "没找到这个人",
            text: `当前数据面（${ctx.scope === "all" ? "全院" : "责任链内"}）没有匹配「${target}」的人。`,
          },
        ];
      }
      return [
        {
          tone: "info",
          title: hits.length === 1 ? hits[0].real_name : `匹配到 ${hits.length} 人`,
          text: hits
            .slice(0, 3)
            .map(
              (p) =>
                `${p.real_name}：${p.department || "未分配科室"} · ${p.title || "无职称"} · ${
                  roleMeta(p.role).text
                } · L${p.auth_level}`
            )
            .join("\n"),
          chips: hits.slice(0, 8).map((p) => ({
            key: `u-${p.id}`,
            label: p.real_name,
            sub: `${p.department || "未分配"} · L${p.auth_level}`,
            to: "/users",
          })),
        },
      ];
    },
  },
];

/* ── 匹配与入口 ── */

export function presetQuestions(): string[] {
  const preferred = [
    "谁能删除用户？",
    "哪些角色没人用？",
    "哪些用户还没分配角色？",
    "哪些用户叠加了多个角色？",
    "最近有异常登录吗？",
    "当前登录验证码是否开启？",
  ];
  const byQuestion = new Map(INTENTS.map((i) => [i.question, i] as const));
  const out = preferred.filter((q) => byQuestion.has(q));
  for (const i of INTENTS) {
    if (out.length >= 6) break;
    if (!out.includes(i.question)) out.push(i.question);
  }
  return out;
}

/** 命中：正则命中数 × 3 + 正则总长（越长越具体），选分数最高的意图 */
export function matchIntent(question: string, intents: AskIntent[] = INTENTS): AskIntent | null {
  let best: AskIntent | null = null;
  let bestScore = 0;
  intents.forEach((intent) => {
    let score = 0;
    intent.patterns.forEach((p) => {
      if (p.test(question)) score += 3 + p.source.length * 0.4;
    });
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  });
  return best;
}

export async function ask(question: string, ctx: AskContext): Promise<AnswerCard[]> {
  const q = question.trim();
  if (!q) return [];
  const intent = matchIntent(q);
  if (!intent) {
    // 本地规则没命中 → 交给小智能体（大模型兜底），让对话坞能答更多问题
    return askAgent(q, ctx);
  }
  if (intent.admin && !ctx.isAdmin) {
    return [
      {
        tone: "warn",
        title: "需要管理员账号",
        text: `「${intent.question}」这类问题要读全院权限/配置数据，当前账号是责任链视角。`,
      },
    ];
  }
  try {
    const cards = await intent.run(q, ctx);
    return cards.length
      ? cards
      : [{ tone: "warn", title: "没有找到结果", text: "换一种问法试试。" }];
  } catch (e: any) {
    return [{ tone: "danger", title: "分析出错了", text: String(e?.response?.data?.detail || e?.message || e) }];
  }
}

/* ── 小智能体（大模型兜底）──────────────────────────────────
   把「本地规则命不中」的问题交给后端 /api/agent/ask：后端复用管理员配置的
   模型 Key，带上这里拼出的真实数据快照，让答案可落地、不瞎编。 */

/** 拼一份「真实数据快照」给大模型做上下文（只取能拿到的，绝不编造） */
async function buildAgentContext(ctx: AskContext): Promise<string> {
  const lines: string[] = [];
  lines.push(`数据视角：${ctx.scope === "all" ? "全院（管理员）" : "责任链内（非管理员）"}。`);

  const people = ctx.people || [];
  lines.push(
    `可见用户 ${people.length} 人：` +
      (people
        .slice(0, 30)
        .map((p) => `${p.real_name}（${p.department || "未分配科室"}/${p.title || "无职称"}/权限 L${p.auth_level}）`)
        .join("、") || "（无）")
  );

  try {
    const index = await loadGraphIndex();
    const roles = index.g.roles || [];
    lines.push(
      `角色 ${roles.length} 个：` +
        (roles.map((r) => `${r.name}（${r.code}）`).join("、") || "（无）")
    );
    const dirs = (index.g.menus || []).filter((m) => m.type === "dir").map((m) => m.name);
    lines.push(`菜单模块：${dirs.join("、") || "（无）"}。`);
  } catch {
    /* 权限图取不到就跳过，不影响主流程 */
  }

  if (ctx.isAdmin) {
    lines.push(
      `数据权限规则 ${(ctx.aclRules || []).length} 条（角色×集合×动作×行范围）。`
    );
  }
  return lines.join("\n");
}

/** 调后端智能体接口，返回一张来源为 agent 的答案卡 */
export async function askAgent(question: string, ctx: AskContext): Promise<AnswerCard[]> {
  try {
    const context = await buildAgentContext(ctx);
    const res = await api.post("/agent/ask", { question, context });
    const d = res.data as {
      available: boolean; answer?: string; provider?: string; model?: string;
      hint?: string; error?: string;
    };
    if (!d?.available) {
      return [
        {
          source: "agent",
          tone: "warn",
          title: "智能体还没接入模型",
          text:
            d?.hint ||
            "请在「设置 → API 密钥」配置一个模型服务商（如 DeepSeek / 千问 / OpenAI）的 Key，我就能回答更多问题。",
          chips: [{ key: "cfg", label: "去配置密钥", to: "/settings" }],
        },
      ];
    }
    if (d.error) {
      return [{ source: "agent", tone: "danger", title: "智能体调用失败", text: d.error }];
    }
    const meta = [d.provider, d.model].filter(Boolean).join(" · ");
    return [
      {
        source: "agent",
        tone: "info",
        title: question,
        text: String(d.answer || "").trim() || "（模型没有返回内容）",
        chips: meta ? [{ key: "src", label: meta, to: "/settings", tone: "off" as const }] : undefined,
      },
    ];
  } catch (e: any) {
    return [
      {
        source: "agent",
        tone: "warn",
        title: "智能体暂时不可用",
        text: String(e?.response?.data?.detail || e?.message || e),
        chips: [{ key: "cfg", label: "去配置密钥", to: "/settings" }],
      },
    ];
  }
}
