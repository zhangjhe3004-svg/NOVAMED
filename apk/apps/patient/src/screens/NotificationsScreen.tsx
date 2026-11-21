/**
 * 患者端 —— 消息中心（Apple Store iOS 版式）
 * 大标题 + 「全部已读」→ 未读圆点分组列表
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, shadow, request, LargeTitleHeader } from "@medicode/shared";
import { BellIcon } from "../icons";

const GUTTER = 20;

function fmt(raw?: string | null): string {
  if (!raw) return "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return raw;
  const [, y, mo, d, hh, mm] = m;
  const date = `${Number(mo)}月${Number(d)}日`;
  return hh ? `${date} ${hh}:${mm}` : date;
}

export default function NotificationsScreen() {
  const [list, setList] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await request<{ items: any[]; unread: number }>("/api/patient-auth/notifications");
      setList(res.items || []);
      setUnread(res.unread || 0);
    } catch {
      setList([]);
      setUnread(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const readAll = async () => {
    try {
      await request("/api/patient-auth/notifications/read-all", { method: "POST" });
    } catch {
      /* 忽略 */
    }
    load();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <LargeTitleHeader
        back
        title="消息中心"
        subtitle={unread > 0 ? `${unread} 条未读消息` : "没有未读消息"}
        right={unread > 0 ? { label: "全部已读", onPress: readAll } : undefined}
        tint={colors.brandTeal}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandTeal} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 130 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.textMuted} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.is_read && styles.cardUnread]}>
              <View style={styles.head}>
                {!item.is_read && <View style={styles.dot} />}
                <Text style={[styles.title, !item.is_read && { color: colors.text }]} numberOfLines={1}>
                  {item.title || "通知"}
                </Text>
                <Text style={styles.time}>{fmt(item.created_at)}</Text>
              </View>
              {item.content ? <Text style={styles.content} numberOfLines={3}>{item.content}</Text> : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <BellIcon color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>暂无消息</Text>
              <Text style={styles.emptyDesc}>预约提醒、报告通知会出现在这里</Text>
            </View>
          }
        />
      )}
        </SafeAreaView>
</View>
  );
}

const styles = StyleSheet.create({
  emptyIconWrap: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  container: { flex: 1, backgroundColor: colors.background },

  card: {
    backgroundColor: colors.card, borderRadius: 18, padding: 16, ...shadow.card,
  },
  cardUnread: { backgroundColor: "#F0FAF7" },
  head: { flexDirection: "row", alignItems: "center" },
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandTeal, marginRight: 8,
  },
  title: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.textSecondary, minWidth: 0 },
  time: { fontSize: 11, color: colors.textMuted, marginLeft: 8 },
  content: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 6 },

  emptyBox: { alignItems: "center", marginTop: 56, paddingHorizontal: 30 },
  emptyGlyph: { fontSize: 32, marginBottom: 10, opacity: 0.7 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  emptyDesc: { fontSize: 13, color: colors.textMuted, marginTop: 5, textAlign: "center" },
});
