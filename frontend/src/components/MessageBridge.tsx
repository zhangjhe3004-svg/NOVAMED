/**
 * antd 静态 message 桥接 —— v6 + React 19.3 下 message 静态调用
 * 与 App 上下文实例均静默失效（rc-notification 不渲染 DOM，见 utils/toast.ts 说明）。
 * 本组件把自研 toast 回填到静态 message 对象上，
 * 全站 40+ 处 message.xxx(...) 调用无需改动即可恢复可见。
 */
import { useEffect } from "react";
import { message as staticMessage } from "antd";
import { toast } from "../utils/toast";

const METHODS = ["success", "error", "info", "warning", "loading"] as const;

export default function MessageBridge() {
  useEffect(() => {
    const target = staticMessage as unknown as Record<string, (...args: unknown[]) => unknown>;
    const impl = toast as unknown as Record<string, (...args: unknown[]) => unknown>;
    METHODS.forEach((k) => {
      target[k] = (...args: unknown[]) => {
        const first = args[0];
        const duration = typeof args[1] === "number" ? args[1] * 1000 : undefined;
        impl[k](typeof first === "string" ? first : String(first ?? ""), duration);
      };
    });
    (window as unknown as Record<string, unknown>).__msgBridge = true;
  }, []);

  return null;
}
