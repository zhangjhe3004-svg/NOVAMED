/**
 * 「问系统」——本地规则问答引擎（移植自 scaffold 的 composables/ask.ts）。
 *
 * 为什么不做成调 AI：这些问题（谁能进某个页面、哪个角色闲置、谁权限最高、某科室几个人）
 * 的答案本来就在手上的数据里（nav 配置 + 用户 + 数据权限规则）。
 * 本地规则算出来的答案是可复现、可跳转、零延迟、零成本的，
 * 调大模型反而会编。所以这里只做「把已有数据翻译成人话」。
 *
 * 每个意图 = 问题模板 + 命中正则 + 所需权限 + 取数函数，答案是一张张卡片：
 * 语气色条 + 结论 + 可跳转芯片。
 */
import { roleMeta, type NavGroup } from "../config/nav";

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
}

export interface AskIntent {
  id: string;
  /** 预设问题：以芯片形式展示，点了自动打字填入 */
  question: string;
  patterns: RegExp[];
  /** 需要管理员才能回答（数据面更全） */
  admin?: boolean;
  run: (question: string, ctx: AskContext) => AnswerCard[];
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
    .replace(/(能|可以|有权|有权限|能够|会)/g, "")
    .replace(/(看到|看|进入|进|打开|访问|使用|用|操作|查看|查)/g, "")
    .replace(/(吗|呢|呀|的|是|在|有|都是|分别)$/g, "")
    .trim();
}

interface MenuHit {
  group: NavGroup;
  item?: { key: string; name: string; to: string };
  score: number;
}

/** 在导航配置里找最像的那个菜单 / 分组 */
function findMenu(question: string, groups: NavGroup[]): MenuHit | null {
  const target = extractTarget(question);
  if (!target) return null;
  let best: MenuHit | null = null;
  groups.forEach((g) => {
    const gs = looseScore(target, g.short) + looseScore(target, g.label);
    if (gs > 0) {
      const cand: MenuHit = { group: g, score: gs };
      if (!best || cand.score > best.score) best = cand;
    }
    g.items.forEach((it) => {
      const s = looseScore(target, it.name);
      if (s > 0) {
        const cand: MenuHit = { group: g, item: { key: it.key, name: it.name, to: it.to }, score: s + 4 };
        if (!best || cand.score > best.score) best = cand;
      }
    });
  });
  return best;
}

/** 与后端 UserRole 枚举一致的可分配角色（pharmacist/maintainer 只是前端旧别名，不算在内） */
const ROLE_KEYS = ["admin", "doctor", "nurse", "senior", "staff"];

/** 能进入某个分组的角色 */
function rolesFor(group: NavGroup): string[] {
  return ROLE_KEYS.filter((r) => roleMeta(r).groups.includes(group.short));
}

const traceTo = (q: string) => `/role-trace${q}`;

/* ============================================================
   意图注册表
   ============================================================ */

const INTENTS: AskIntent[] = [
  {
    id: "who.can",
    question: "谁能进运营数据？",
    patterns: [
      /谁(能|可以|有权|有权限)/,
      /哪些(人|角色)(能|可以|有)/,
      /(可以|能)(看到|进入|访问|打开)/,
      /权限/,
    ],
    run: (question, ctx) => {
      const hit = findMenu(question, ctx.navGroups);
      if (!hit) {
        return [
          {
            tone: "warn",
            title: "没找到对应的页面",
            text: `可以试试：${presetQuestions().slice(0, 4).join("、")}`,
          },
        ];
      }
      const roles = rolesFor(hit.group);
      const roleSet = new Set(roles);
      const people = ctx.people.filter((p) => roleSet.has(p.role));
      const who = hit.item ? `「${hit.item.name}」` : `「${hit.group.short}」整组`;
      return [
        {
          tone: hit.group.adminOnly ? "warn" : "info",
          title: `${who}的可见范围`,
          text: hit.group.adminOnly
            ? `这是管理员专属分组。只有 ${roles.map((r) => roleMeta(r).text).join("、")} 能进入，当前数据里有 ${people.length} 人。`
            : `${roles.map((r) => roleMeta(r).text).join("、")} 可以进入，当前数据里有 ${people.length} 人。`,
          chips: [
            ...roles.map((r) => ({
              key: `r-${r}`,
              label: roleMeta(r).text,
              sub: `${ctx.people.filter((p) => p.role === r).length} 人`,
              to: traceTo(`?entity=role:${r}`),
              tone: hit.group.adminOnly && r !== "admin" ? ("off" as const) : undefined,
            })),
            ...people.slice(0, 8).map((p) => ({
              key: `u-${p.id}`,
              label: p.real_name,
              sub: p.department || "未分配科室",
              to: "/users",
            })),
          ],
        },
      ];
    },
  },

  {
    id: "role.unused",
    question: "哪些角色没人用？",
    patterns: [/(没人|无人|闲置|未使用|没有用户|没有成员).*角色/, /角色.*(没人|无人|闲置|未使用|没有成员)/],
    run: (_q, ctx) => {
      const used = new Set(ctx.people.map((p) => p.role));
      const unused = ROLE_KEYS.filter((r) => !used.has(r));
      const total = ROLE_KEYS.length;
      return [
        {
          tone: unused.length ? "warn" : "ok",
          title: "闲置角色",
          text: unused.length
            ? `${total} 个可分配角色里有 ${unused.length} 个没有任何成员：${unused
                .map((r) => roleMeta(r).text)
                .join("、")}。可考虑停用或合并。`
            : `每个角色都至少有一名成员。`,
          chips: unused.map((r) => ({
            key: `r-${r}`,
            label: roleMeta(r).text,
            sub: "0 人",
            to: traceTo(`?entity=role:${r}`),
            tone: "off" as const,
          })),
        },
      ];
    },
  },

  {
    id: "menu.orphan",
    question: "哪些菜单没人能进？",
    patterns: [/(没人|无人|没有角色|未授予|未授权|孤立).*菜单/, /菜单.*(没人|无人|没有角色|未授予|孤立)/],
    run: (_q, ctx) => {
      const covered = new Set(ROLE_KEYS.flatMap((r) => roleMeta(r).groups));
      const orphan = ctx.navGroups.filter((g) => !covered.has(g.short));
      const adminOnly = ctx.navGroups.filter((g) => g.adminOnly);
      // 没有孤立分组时改列管理员专属分组：卡片不至于只剩一句话，
      // 而且这两类都是「实际能进的人很少」的分组，读者关心的是同一件事。
      const chips = (orphan.length ? orphan : adminOnly).map((g) => ({
        key: `g-${g.short}`,
        label: g.short,
        sub: orphan.length ? `${g.items.length} 个菜单` : `${g.items.length} 个菜单 · 管理员专属`,
        to: "/role-trace",
        tone: orphan.length ? ("danger" as const) : ("off" as const),
      }));
      return [
        {
          tone: orphan.length ? "danger" : "ok",
          title: "没人能进入的分组",
          text: orphan.length
            ? `${orphan.length} 个分组不在任何角色的可进入列表里：${orphan.map((g) => g.short).join("、")}。`
            : `每个分组都至少被一个角色覆盖。管理员专属分组 ${adminOnly.length} 个（${adminOnly
                .map((g) => g.short)
                .join("、")}），其余角色进不去。`,
          chips,
        },
      ];
    },
  },

  {
    id: "user.top",
    question: "谁的权限最高？",
    patterns: [/(谁|哪个|哪些).*(权限|级别|职级).*(最高|最大|最大)/, /(最高|最大).*(权限|级别|职级)/],
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
          to: traceTo(`?entity=role:${role}`),
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
  return INTENTS.slice(0, 5).map((i) => i.question);
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

export function ask(question: string, ctx: AskContext): AnswerCard[] {
  const q = question.trim();
  if (!q) return [];
  const intent = matchIntent(q);
  if (!intent) {
    return [
      {
        tone: "warn",
        title: "没有识别这个问题",
        text: `这是本地规则问答，能答的是「人和权限」这类能从现有数据直接算出来的问题。试试：${presetQuestions().join(
          "、"
        )}`,
      },
    ];
  }
  try {
    const cards = intent.run(q, ctx);
    return cards.length
      ? cards
      : [{ tone: "warn", title: "没有找到结果", text: "换一种问法试试。" }];
  } catch (e: any) {
    return [{ tone: "danger", title: "分析出错了", text: String(e?.message || e) }];
  }
}
