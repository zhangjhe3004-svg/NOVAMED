import { useEffect, useState } from "react";
import { Card, List, Tag, Empty, message } from "antd";
import api from "../api/client";

export default function Messages() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/messages").then((r) => setItems(r.data.items)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return (
    <Card title="员工消息" loading={loading}>
      {items.length === 0 ? <Empty description="暂无消息" /> : (
        <List dataSource={items} renderItem={(m: any) => (
          <List.Item>
            <List.Item.Meta title={<span>{m.title} {!m.is_read && <Tag color="red">未读</Tag>}</span>} description={m.content} />
          </List.Item>
        )} />
      )}
    </Card>
  );
}
