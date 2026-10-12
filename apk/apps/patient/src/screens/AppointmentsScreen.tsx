/**
 * 患者端 —— 预约挂号（对照设计稿 10-患者预约）
 * 顶部：预约挂号标题；医生信息卡 + 我的预约列表
 */
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { colors, spacing, radius, fontSize, request, Paged } from "@medicode/shared";

export default function AppointmentsScreen() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await request<Paged<any>>("/api/appointments?page=1&page_size=50");
      setList(res.items || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pill = (s: string) => {
    const map: Record<string, { bg: string; fg: string }> = {
      已确认: { bg: "#e6f7f6", fg: colors.teal },
      待确认: { bg: "#fff6e8", fg: "#b07a1f" },
      待就诊: { bg: "#fff6e8", fg: "#b07a1f" },
      已取消: { bg: "#fff1f0", fg: colors.danger },
    };
    return map[s] || { bg: "#eef2f6", fg: colors.textSecondary };
  };

  return (
    <View style={styles.container}>
      {/* 标题区 */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
        <Text style={styles.eyebrow}>APPOINTMENT</Text>
        <Text style={styles.h1}>预约挂号</Text>
        <Text style={styles.hSub}>选择医生与时间，预约信息一目了然。</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.teal} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const p = pill(item.status || "待确认");
            return (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.docAvatar}>
                    <Text style={styles.docAvatarText}>{(item.doctor_name || "医")[0]}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={styles.docName}>
                      {item.doctor_name || "医生"}
                      <Text style={styles.docTitle}>  {item.department || "门诊"}</Text>
                    </Text>
                    <Text style={styles.docSub}>预约编号 #{item.id}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: p.bg }]}>
                    <Text style={[styles.pillText, { color: p.fg }]}>{item.status || "待确认"}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>▢</Text>
                  <Text style={styles.infoText}>{item.date || "—"}  {item.time_slot || ""}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>◉</Text>
                  <Text style={styles.infoText}>{item.patient_name ? `就诊人：${item.patient_name}` : "就诊人：本人"}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>▢</Text>
              <Text style={styles.emptyText}>暂无预约记录</Text>
              <Text style={styles.emptySub}>在首页选择「预约挂号」开始你的第一次预约</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f7f6" },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: colors.textMuted, fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 4 },
  hSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "center" },
  docAvatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#e6f7f6", alignItems: "center", justifyContent: "center" },
  docAvatarText: { color: colors.teal, fontSize: 19, fontWeight: "700" },
  docName: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
  docTitle: { fontSize: fontSize.xs, fontWeight: "400", color: colors.textMuted },
  docSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  pill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: fontSize.xs, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  infoIcon: { width: 22, color: colors.teal, fontSize: 13, fontWeight: "700" },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
  emptyBox: { alignItems: "center", marginTop: 60 },
  emptyIcon: { fontSize: 40, color: colors.teal, opacity: 0.4 },
  emptyText: { fontSize: fontSize.lg, color: colors.text, fontWeight: "600", marginTop: spacing.sm },
  emptySub: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4 },
});
