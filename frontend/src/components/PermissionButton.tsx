/**
 * 按钮级权限包装组件 —— 对齐 scaffold 的 PermissionButton / v-permission 指令。
 *
 * 用法：
 *   <PermissionButton code="medicode:users:add">
 *     <Button type="primary">新增用户</Button>
 *   </PermissionButton>
 *
 *   <PermissionButton codes={["medicode:records:edit", "medicode:records:remove"]} mode="all" fallback={<span>无权限</span>}>
 *     ...需要同时具备多个权限码才渲染...
 *   </PermissionButton>
 *
 * 说明：
 * - 无权限时不渲染子元素（默认隐藏；可通过 fallback 提供替代内容）；
 * - code / codes 均缺省视为不受控，直接渲染；
 * - mode="any"（默认）任一命中即放行，mode="all" 需全部命中；
 * - 内置角色（admin/super_admin）由 usePermissions 的 full=true 全量放行。
 */
import { type ReactNode } from "react";
import { usePermissions } from "../utils/perm";

export interface PermissionButtonProps {
  /** 单一权限码 */
  code?: string;
  /** 多个权限码（配合 mode） */
  codes?: string[];
  /** 多权限码判定：any=任一命中（默认），all=全部命中 */
  mode?: "any" | "all";
  /** 无权限时的替代渲染（缺省为 null，即隐藏） */
  fallback?: ReactNode;
  children?: ReactNode;
}

export default function PermissionButton({
  code,
  codes,
  mode = "any",
  fallback = null,
  children,
}: PermissionButtonProps) {
  const { hasPermission, full, loaded } = usePermissions();

  // 未受控：没有指定任何权限码，直接渲染
  const list = code ? [code] : codes ?? [];
  if (list.length === 0) return <>{children}</>;

  // 解析完成前不渲染受控内容（避免非管理员闪现无权限按钮）；内置角色已乐观放行
  if (!loaded && !full) return <>{fallback}</>;

  const ok =
    mode === "all" ? list.every((c) => hasPermission(c)) : list.some((c) => hasPermission(c));

  return <>{ok ? children : fallback}</>;
}
