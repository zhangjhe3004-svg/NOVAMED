import { blockRegistry } from "./registry";

export interface PageBlock { type: string; config?: Record<string, any>; }
export interface PageSchema { type?: string; title?: string; blocks?: PageBlock[]; }

/** 根据页面 Schema 渲染区块（配置驱动，对齐 NocoBase） */
export default function BlockRenderer({ schema }: { schema: PageSchema }) {
  const blocks = schema?.blocks || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {blocks.map((b, i) => {
        const Comp = blockRegistry[b.type];
        if (!Comp) return <div key={i} style={{ color: "#999" }}>未知区块：{b.type}</div>;
        return <Comp key={i} config={b.config} />;
      })}
    </div>
  );
}
