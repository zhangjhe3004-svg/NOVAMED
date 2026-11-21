/**
 * 按钮级权限 —— 对应 scaffold 的 v-permission 指令 + PermissionButton 组件。
 *
 * 数据源：/api/roles/my-menus（任意登录用户可访问）返回：
 *   - permissions: null   → 内置角色（admin/super_admin），全量放行；
 *   - permissions: []     → 无角色 / 无授权，无任何按钮权限；
 *   - permissions: [..]   → 该用户多角色权限码并集（含 medicode:<key>:<action> 按钮码
 *                           与 menu 页面导航 key）。
 *
 * 结果按「用户 + 30s」两级缓存，避免每次渲染都打后端；切换账号立即失效（按 user.id 键控）。
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../stores/auth";
import { myMenus } from "../api/roles";

interface PermState {
  /** true = 内置角色，全量放行 */
  full: boolean;
  /** 已授权的权限码集合（full=true 时为空，hasPermission 直接放行） */
  codes: Set<string>;
  /** 是否已完成首次解析 */
  loaded: boolean;
}

const TTL = 30_000;
let cache: { userId: number; at: number; state: PermState } | null = null;

export interface Permissions {
  /** 判断当前用户是否拥有指定权限码；full=true 或缺省 code 一律放行 */
  hasPermission: (code: string) => boolean;
  /** 已授权权限码集合（只读快照） */
  permissions: Set<string>;
  /** 是否内置角色全量放行 */
  full: boolean;
  /** 是否已加载完成（未加载完成前建议不渲染受控按钮，避免闪动） */
  loaded: boolean;
}

export function usePermissions(): Permissions {
  const { user } = useAuth();
  // 乐观种子：内置主角色（admin/super_admin 均映射回 users.role="admin"）先按全量放行，
  // 避免管理员页面按钮在 /my-menus 返回前出现闪现隐藏；非管理员待真实权限码解析后放行。
  const [state, setState] = useState<PermState>({
    full: user?.role === "admin",
    codes: new Set(),
    loaded: false,
  });

  useEffect(() => {
    let alive = true;
    const uid = user?.id ?? 0;

    // 命中同账号缓存（30s 内）
    if (cache && cache.userId === uid && Date.now() - cache.at < TTL) {
      setState(cache.state);
      return;
    }

    (async () => {
      try {
        const res = await myMenus();
        if (!alive) return;
        const next: PermState =
          res.permissions === null
            ? { full: true, codes: new Set(), loaded: true }
            : { full: false, codes: new Set(res.permissions ?? []), loaded: true };
        cache = { userId: uid, at: Date.now(), state: next };
        setState(next);
      } catch {
        // 拉取失败：保守放行为 false、空权限集，但标记 loaded 避免卡在加载态
        if (alive) setState({ full: false, codes: new Set(), loaded: true });
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const hasPermission = useMemo(
    () => (code: string) => {
      if (state.full) return true;
      if (!code) return true;
      return state.codes.has(code);
    },
    [state.full, state.codes]
  );

  return {
    hasPermission,
    permissions: state.codes,
    full: state.full,
    loaded: state.loaded,
  };
}
