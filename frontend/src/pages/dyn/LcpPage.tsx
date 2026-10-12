import { useEffect, useState } from "react";
import { Card, Spin, message } from "antd";
import { useParams } from "react-router-dom";
import { listPages } from "../../api/pages";
import BlockRenderer from "../../blocks/BlockRenderer";

export default function LcpPage() {
  const { pageKey } = useParams();
  const [schema, setSchema] = useState<any>(null);
  const [pageTitle, setPageTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    listPages().then((r) => {
      const p = r.items.find((x) => x.name === pageKey);
      if (p) { setSchema(p.schema); setPageTitle(p.title || pageKey || ""); }
      else message.error("页面不存在");
    }).catch(() => message.error("加载失败")).finally(() => setLoading(false));
  }, [pageKey]);
  if (loading) return <Spin />;
  return <Card title={pageTitle || pageKey}>{schema ? <BlockRenderer schema={schema} /> : "未找到页面"}</Card>;
}
