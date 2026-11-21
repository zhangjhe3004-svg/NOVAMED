/**
 * 命令面板（⌘K / Ctrl+K）—— 移植自 scaffold 的 CommandPalette.vue。
 *
 * 四组结果：最近访问 / 页面 / 用户 / 动作；一块玻璃滑块在结果间移动表示键盘焦点。
 *
 * 两处刻意的本地化改造：
 *  1. 滑块用「CSS transition + offsetTop」而非补间库 —— 因为滑块永远是列表的直接子元素，
 *     几何差值法在这里是多余的；让 CSS 负责位移，React 只负责写目标值，更不容易错位。
 *  2. 「动作」组换成了 NOVAMED 真实存在的入口（岗位阶梯 / 角色溯源 / 权限链路 / 患者端），
 *     并把原来的「切换深色外观」换成「问系统」，因为员工端只有浅色主题。
 *
 * 「问系统」= 以 ? 前缀进入本地规则问答（utils/ask.ts），预设问题用打字机逐字填入，
 * 答案是级联出现的卡片，卡片底部的芯片可直接跳转到对应页面。
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRightOutlined,
  FileOutlined,
  LogoutOutlined,
  PhoneOutlined,
  SearchOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useAuth } from "../stores/auth";
import { buildNavGroups, visibleNavGroups } from "../config/nav";
import { listPeers } from "../api/nearby";
import { listRules } from "../api/acl";
import { listUsers } from "../api/users";
import { afterTwoFrames, revealCascade, typeOut } from "../utils/motion";
import {
  ask,
  presetQuestions,
  type AnswerCard,
  type AnswerChip,
  type AskAclRule,
  type AskContext,
  type AskPerson,
} from "../utils/ask";

const RECENT_KEY = "medicode.recent";
const PATIENT_URL = "http://localhost:3005";

interface Entry {
  key: string;
  group: string;
  label: string;
  sub?: string;
  icon?: ReactNode;
  initials?: string;
  cat?: number;
  tone?: "danger";
  run: () => void;
}

const match = (text: string, key: string) => text.toLowerCase().includes(key);

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "admin";

  const [keyword, setKeyword] = useState("");
  const [active, setActive] = useState(0);
  const [users, setUsers] = useState<
    { id: number; username: string; real_name: string; department?: string }[]
  >([]);
  const [recentVisits, setRecentVisits] = useState<string[]>([]);
  const [askCards, setAskCards] = useState<AnswerCard[] | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askedText, setAskedText] = useState("");

  // 出场动画：open 翻假后再留 160ms 播淡出，播完才真正卸载
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const wasOpen = useRef(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const askResultsRef = useRef<HTMLDivElement | null>(null);
  const cancelTypingRef = useRef<() => void>(() => {});
  const ctxLoadedRef = useRef(false);

  /** 问答上下文：先用一份空底盘占位，取到数据后原地替换，ask() 永远不用判空 */
  const ctxRef = useRef<AskContext>({
    navGroups: buildNavGroups({}),
    people: [],
    aclRules: [],
    scope: "chain",
    isAdmin: false,
  });

  /* ---------- 问系统的派生值 ----------
     必须声明在用到它们的 effect 之前：effect 回调在 render 期间立即执行，
     写成 `const` 之后会命中暂时性死区（TDZ）。 */

  const askMode = keyword.startsWith("?") || keyword.startsWith("？");
  const askQuestion = keyword.replace(/^[?？]/, "").trim();
  const askPresets = useMemo(() => presetQuestions(), []);

  /* ---------- 跳转与关闭 ---------- */

  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  /** 站内跳转统一出口；external 的菜单项走新标签页 */
  const go = useCallback(
    (to: string, external?: string) => {
      requestClose();
      if (external) {
        window.open(external, "_blank");
        return;
      }
      navigate(to);
    },
    [navigate, requestClose]
  );

  const doLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  /* ---------- 打开 / 关闭生命周期 ---------- */

  useEffect(() => {
    if (open === wasOpen.current) return;
    wasOpen.current = open;
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    setClosing(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [open]);

  /* ---------- 最近访问：本机记录最近 5 个站内页面 ---------- */

  useEffect(() => {
    const path = location.pathname;
    if (!path || path === "/login" || path === "/") return;
    try {
      const next = [path, ...readRecent().filter((p) => p !== path)].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      setRecentVisits(next);
    } catch {
      // 隐私模式下 localStorage 不可写，忽略即可
    }
  }, [location.pathname]);

  /* ---------- 问答数据（首次打开时懒加载一次） ---------- */

  const ensureContext = useCallback(async () => {
    ctxRef.current = {
      ...ctxRef.current,
      scope: isAdmin ? "all" : "chain",
      isAdmin,
    };
    if (ctxLoadedRef.current) return;
    ctxLoadedRef.current = true;
    try {
      let people: AskPerson[] = [];
      if (isAdmin) {
        // /users 上限 page_size=100 且仅管理员可读
        const res = await listUsers({ page_size: 100 });
        people = (res.items || []).map((u) => ({
          id: u.id,
          real_name: u.real_name,
          role: u.role,
          department: u.department || "",
          title: u.title || "",
          auth_level: u.auth_level ?? 0,
          work_status: u.work_status || "",
        }));
      } else {
        // 非管理员看不到全院名册，退化为责任链内的同事
        const res = await listPeers();
        people = (res.items || []).map((p) => ({
          id: p.id,
          real_name: p.real_name,
          role: p.role,
          department: p.department || "",
          title: p.title || "",
          auth_level: p.auth_level,
          work_status: "在职",
        }));
      }

      let rules: AskAclRule[] = [];
      if (isAdmin) {
        try {
          const res = await listRules();
          rules = (res.items || []) as AskAclRule[];
        } catch {
          // 数据权限表读不到不影响其它意图
        }
      }

      ctxRef.current = {
        ...ctxRef.current,
        people,
        aclRules: rules,
        scope: isAdmin ? "all" : "chain",
        isAdmin,
      };
    } catch {
      // 取数失败就保持空底盘，让 ask() 给出「没找到」而不是崩掉
      ctxLoadedRef.current = false;
    }
  }, [isAdmin]);

  /* ---------- 打开时重置 ---------- */

  useEffect(() => {
    if (!open) return;
    setKeyword("");
    setActive(0);
    setUsers([]);
    setAskCards(null);
    setAskedText("");
    setAskLoading(false);
    cancelTypingRef.current();
    setRecentVisits(readRecent());
    ensureContext();
    afterTwoFrames(() => inputRef.current?.focus());
  }, [open, ensureContext]);

  // 打开期间锁住页面滚动，避免背景跟着命令面板一起滚
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* ---------- 结果集 ---------- */

  const pages = useMemo(
    () =>
      visibleNavGroups(buildNavGroups({}), user?.role).flatMap((g) =>
        g.items.map((it) => ({
          key: it.key,
          label: it.name,
          group: g.short,
          cat: g.cat,
          icon: it.icon,
          to: it.to,
          external: it.external,
        }))
      ),
    [user?.role]
  );

  /**
   * 「动作」= 真正的动作，不放导航别名。
   * 岗位阶梯 / 角色溯源 / 权限链路都在「页面」组里，写成动作会得到两条同名结果。
   * 「个人设置」单独保留：它是 adminOnly 分组下的菜单，非管理员在「页面」组里看不到。
   */
  const actions = useMemo<Entry[]>(
    () => [
      {
        key: "a-settings",
        group: "动作",
        label: "个人设置 · 账号安全",
        sub: "密码、在岗状态、通知偏好",
        icon: <SettingOutlined />,
        run: () => go("/settings"),
      },
      {
        key: "a-ask",
        group: "动作",
        label: "问系统",
        sub: "以 ? 开头，问权限、参数、异常登录",
        icon: <ThunderboltOutlined />,
        run: () => {
          setKeyword("?");
          inputRef.current?.focus();
        },
      },
      {
        key: "a-patient",
        group: "动作",
        label: "打开客户端",
        sub: "独立 SPA · 新标签页",
        icon: <PhoneOutlined />,
        run: () => {
          requestClose();
          window.open(PATIENT_URL, "_blank");
        },
      },
      {
        key: "a-logout",
        group: "动作",
        label: "退出登录",
        sub: "归档本次会话",
        icon: <LogoutOutlined />,
        tone: "danger",
        run: () => {
          requestClose();
          doLogout();
        },
      },
    ],
    [go, doLogout, requestClose]
  );

  const entries = useMemo<Entry[]>(() => {
    const key = keyword.trim().toLowerCase();
    const out: Entry[] = [];

    if (!key) {
      recentVisits
        .map((path) => pages.find((p) => p.to === path))
        .filter((p): p is (typeof pages)[number] => Boolean(p) && p!.to !== location.pathname)
        .slice(0, 4)
        .forEach((p) =>
          out.push({
            key: `r-${p.key}`,
            group: "最近访问",
            label: p.label,
            sub: p.group,
            icon: p.icon,
            cat: p.cat,
            run: () => go(p.to, p.external),
          })
        );
    }

    pages
      .filter((p) => !key || match(p.label, key) || match(p.group, key) || p.to.includes(key))
      .forEach((p) =>
        out.push({
          key: `p-${p.key}`,
          group: "页面",
          label: p.label,
          sub: p.group,
          icon: p.icon,
          cat: p.cat,
          run: () => go(p.to, p.external),
        })
      );

    if (key) {
      users.forEach((u) =>
        out.push({
          key: `u-${u.id}`,
          group: "用户",
          label: u.real_name,
          sub: `@${u.username} · ${u.department || "未分配科室"}`,
          initials: u.real_name?.[0],
          run: () => go("/users"),
        })
      );
    }

    // 动作只按标题匹配：副标题是说明性文案（「在岗状态」等），按它搜会冒出无关结果
    actions.filter((a) => !key || match(a.label, key)).forEach((a) => out.push(a));

    return out;
  }, [keyword, users, recentVisits, location.pathname, pages, actions, go]);

  const grouped = useMemo(() => {
    const groups: { name: string; items: (Entry & { index: number })[] }[] = [];
    entries.forEach((entry, index) => {
      let g = groups.find((x) => x.name === entry.group);
      if (!g) {
        g = { name: entry.group, items: [] };
        groups.push(g);
      }
      g.items.push({ ...entry, index });
    });
    return groups;
  }, [entries]);

  /* ---------- 用户搜索（防抖 220ms） ---------- */

  useEffect(() => {
    const key = keyword.trim();
    // 用户搜索走 /users（管理员专属），非管理员直接跳过，避免每次输入都吃一个 403
    if (!isAdmin || !key || key.startsWith("?") || key.startsWith("？")) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await listUsers({ keyword: key, page_size: 5 });
        if (!cancelled) {
          setUsers(
            (res.items || []).map((u) => ({
              id: u.id,
              username: u.username,
              real_name: u.real_name,
              department: u.department,
            }))
          );
        }
      } catch {
        if (!cancelled) setUsers([]);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [keyword, isAdmin]);

  // 关键词变了，高亮回到第一条
  useEffect(() => {
    setActive(0);
  }, [keyword]);

  // 问题被改写后旧答案就不再对应，清掉重新问（否则改完问题还挂着上一题的卡片）
  useEffect(() => {
    if (askCards && askQuestion !== askedText) setAskCards(null);
  }, [askCards, askQuestion, askedText]);

  /* ---------- 玻璃滑块 ---------- */

  // 打开瞬间先禁用过渡，落位后再恢复，避免滑块从左上角滑进来
  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    if (!thumb || !open) return;
    thumb.classList.add("is-instant");
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => thumb.classList.remove("is-instant"));
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, [open]);

  // 只写目标值，位移交给 CSS transition
  useLayoutEffect(() => {
    const list = listRef.current;
    const thumb = thumbRef.current;
    if (!list || !thumb) return;
    const el = list.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!el) {
      thumb.style.opacity = "0";
      return;
    }
    thumb.style.opacity = "1";
    thumb.style.height = `${el.offsetHeight}px`;
    thumb.style.transform = `translateY(${el.offsetTop}px)`;
    el.scrollIntoView({ block: "nearest" });
  }, [active, entries, open]);

  /* ---------- 问系统 ---------- */

  const runAsk = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q) return;
    cancelTypingRef.current();
    setAskedText(q);
    setAskLoading(true);
    // 让「正在分析…」先落一帧，再算 —— 规则答案是本地推演 + 少量取数，给一帧防闪烁
    await new Promise((r) => window.setTimeout(r, 120));
    let cards: AnswerCard[];
    try {
      cards = await ask(q, ctxRef.current);
    } catch {
      cards = [];
    }
    setAskCards(cards);
    setAskLoading(false);
    requestAnimationFrame(() =>
      revealCascade(askResultsRef.current, ".ask-card", 90)
    );
  }, []);

  const typeAsk = useCallback(
    (question: string) => {
      cancelTypingRef.current();
      cancelTypingRef.current = typeOut(`?${question}`, setKeyword, () => runAsk(question));
    },
    [runAsk]
  );

  useEffect(() => {
    if (!askCards) return;
    afterTwoFrames(() => revealCascade(askResultsRef.current, ".ask-card", 90));
  }, [askCards]);

  // 组件卸载时别让打字机继续往已卸载的 state 里写
  useEffect(() => () => cancelTypingRef.current(), []);

  const openAnswerChip = useCallback(
    (chip: AnswerChip) => {
      if (!chip.to) return;
      requestClose();
      navigate(chip.to);
    },
    [navigate, requestClose]
  );

  /* ---------- 键盘 ---------- */

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const nodes = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button, input, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (askMode) {
        if (event.key === "Enter") {
          event.preventDefault();
          runAsk(askQuestion);
        }
        return;
      }
      const total = entries.length;
      if (!total) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((v) => (v + 1) % total);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((v) => (v - 1 + total) % total);
      } else if (event.key === "Enter") {
        event.preventDefault();
        entries[active]?.run();
      }
    },
    [askMode, askQuestion, entries, active, requestClose, runAsk]
  );

  if (!mounted) return null;

  return (
    <div
      className={`cmd-overlay${closing ? " is-closing" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        className="cmd-panel"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        onKeyDown={onKeyDown}
      >
        <div className="cmd-input">
          <SearchOutlined className="cmd-input-ico" />
          <input
            ref={inputRef}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={askMode ? "输入问题后回车，例如「谁能进运营数据」" : "搜索页面、用户或动作；输入 ? 问系统"}
            role="combobox"
            aria-expanded
            aria-controls="cmd-results"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="kbd">Esc</span>
        </div>

        <div
          id="cmd-results"
          ref={listRef}
          className="cmd-results"
          role={askMode ? "region" : "listbox"}
        >
          {askMode ? (
            <div className="cmd-ask">
              {!askCards && (
                <>
                  <div className="ask-presets">
                    {askPresets.map((p) => (
                      <button key={p} type="button" onClick={() => typeAsk(p)}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <p className="cmd-ask-hint">
                    小智能体：能直接用数据算的走本地规则；算不出的交给已接入的大模型回答。
                  </p>
                </>
              )}
              {askCards && (
                <div ref={askResultsRef} className="cmd-ask-results" aria-live="polite">
                  <div className="ask-results-head">
                    <span>
                      <ThunderboltOutlined />
                      {askedText}
                    </span>
                    <small>{askCards.some((c) => c.source === "agent") ? "AI 智能体" : "本地规则分析"}</small>
                  </div>
                  {askCards.map((card) => (
                    <article key={card.title} className={`ask-card tone-${card.tone}`}>
                      <h4>{card.title}</h4>
                      <p>{card.text}</p>
                      {card.chips && card.chips.length > 0 && (
                        <div className="insight-chips">
                          {card.chips.map((chip) => (
                            <button
                              key={chip.key}
                              type="button"
                              className={`insight-chip${chip.to ? " is-clickable" : ""}${
                                chip.tone ? ` tone-${chip.tone}` : ""
                              }`}
                              disabled={!chip.to}
                              onClick={() => openAnswerChip(chip)}
                            >
                              {chip.label}
                              {chip.sub && <em>{chip.sub}</em>}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {askLoading && <p className="cmd-ask-hint is-loading">正在分析…</p>}
            </div>
          ) : (
            <>
              {entries.length > 0 && <span ref={thumbRef} className="cmd-thumb" aria-hidden="true" />}
              {grouped.map((g) => (
                <div key={g.name}>
                  <div className="cmd-group" role="presentation">
                    {g.name}
                  </div>
                  {g.items.map((item) => (
                    <button
                      key={item.key}
                      id={`cmd-${item.index}`}
                      data-index={item.index}
                      type="button"
                      role="option"
                      aria-selected={item.index === active}
                      className={`cmd-item${item.index === active ? " is-active" : ""}${
                        item.tone === "danger" ? " is-danger" : ""
                      }`}
                      tabIndex={-1}
                      onPointerEnter={() => setActive(item.index)}
                      onClick={() => item.run()}
                    >
                      {item.initials ? (
                        <span className={`cmd-avatar cat-${item.cat ?? 1}`}>{item.initials}</span>
                      ) : (
                        <span className={`cmd-ico cat-${item.cat ?? 1}`}>
                          {item.icon ?? <FileOutlined />}
                        </span>
                      )}
                      <span className="cmd-label">{item.label}</span>
                      {item.sub && <span className="cmd-sub">{item.sub}</span>}
                      <ArrowRightOutlined className="cmd-go" />
                    </button>
                  ))}
                </div>
              ))}
              {entries.length === 0 && (
                <div className="cmd-empty">
                  <SearchOutlined />
                  <p>没有找到匹配的结果</p>
                  <small>试试输入 <b>?</b> 进入「问系统」</small>
                </div>
              )}
            </>
          )}
        </div>

        <div className="cmd-foot">
          {askMode ? (
            <>
              <span>
                <span className="kbd">↵</span> 提问
              </span>
              <span className="cmd-foot-faint">删去 ? 返回搜索</span>
            </>
          ) : (
            <>
              <span>
                <span className="kbd">↑</span>
                <span className="kbd">↓</span> 选择
              </span>
              <span>
                <span className="kbd">↵</span> 打开
              </span>
              <span>
                <span className="kbd">?</span> 问系统
              </span>
            </>
          )}
          <span className="cmd-foot-spacer" />
          <span className="cmd-foot-tag">{askMode ? "智能体" : "命令"}</span>
        </div>
      </div>
    </div>
  );
}
