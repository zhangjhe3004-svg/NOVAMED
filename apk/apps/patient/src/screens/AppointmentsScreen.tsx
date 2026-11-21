/**
 * 患者端 —— 预约挂号（Apple Store iOS 版式）
 * 大标题 → 状态筛选胶囊 → 预约分组列表
 */
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, ScrollView } from "react-native";
import { colors, spacing, fontSize, shadow, request } from "@medicode/shared";
import { CalIcon } from "../icons";

const GUTTER = 20;
const FILTERS = ["全部", "待就诊", "已确认", "已完成", "已取消"] as const;

export default function AppointmentsScreen() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("全部");

  const load = async () => {
    try {
      const res = await request<{ items: any[] }>("/api/patient-auth/appointments");
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

  const data = useMemo(
    () => (filter === "全部" ? list : list.filter((x: any) => (x.status || "待确认") === filter)),
    [list, filter]
  );

  const pill = (s: string) => {
    const map: Record<string, { bg: string; fg: string }> = {
      已确认: { bg: colors.tealLight, fg: colors.brandTeal },
      待确认: { bg: "#FFF4E5", fg: "#FF9500" },
      待就诊: { bg: "#FFF4E5", fg: "#FF9500" },
      已报到: { bg: "#EAF2FF", fg: "#2F6FED" },
      已完成: { bg: "#EDF9F1", fg: "#1E9E5A" },
      已取消: { bg: "#FFECEB", fg: colors.danger },
    };
    return map[s] || { bg: colors.background, fg: colors.textSecondary };
  };

  return (
    <View style={styles.container}>
      {/* 大标题 */}
      <View style={styles.titleBlock}>
        <Text style={styles.largeTitle}>预约</Text>
        <Text style={styles.titleSub}>您的全部预约，按时间倒序排列。</Text>
      </View>

      {/* 筛选胶囊 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => {
          const on = filter === f;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandTeal} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 130 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => {
            const p = pill(item.status || "待确认");
            return (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.docAvatar}>
                    <Text style={styles.docAvatarText}>{(item.doctor_name || "医")[0]}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                    <Text style={styles.docName} numberOfLines={1}>{item.doctor_name || "医生"}</Text>
                    <Text style={styles.docDept} numberOfLines={1}>{item.department || "门诊"}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: p.bg }]}>
                    <Text style={[styles.pillText, { color: p.fg }]}>{item.status || "待确认"}</Text>
                  </View>
                </View>

                <View style={styles.metaBox}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>时间</Text>
                    <Text style={styles.metaValue}>{(item.date || "—") + "  " + (item.time_slot || "")}</Text>
                  </View>
                  <View style={[styles.metaRow, styles.metaDivider]}>
                    <Text style={styles.metaLabel}>就诊人</Text>
                    <Text style={styles.metaValue} numberOfLines={1}>{item.patient_name || "本人"}</Text>
                  </View>
                  <View style={[styles.metaRow, styles.metaDivider]}>
                    <Text style={styles.metaLabel}>编号</Text>
                    <Text style={styles.metaValue}>#{item.id}</Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <CalIcon color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>暂无预约</Text>
              <Text style={styles.emptyDesc}>
                {filter === "全部" ? "还没有预约记录，从首页发起第一次预约" : `没有「${filter}」的预约`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyIconWrap: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  container: { flex: 1, backgroundColor: colors.background },

  titleBlock: { paddingHorizontal: GUTTER, paddingTop: spacing.md },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, color: colors.textMuted, fontWeight: "700" },
  largeTitle: {
    fontSize: 34, fontWeight: "700", color: colors.text,
    letterSpacing: -0.9, lineHeight: 41, marginTop: 2,
  },
  titleSub: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },

  filterRow: { paddingHorizontal: GUTTER, paddingTop: spacing.md, paddingBottom: spacing.md, gap: 8 },
  chip: {
    height: 32, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: colors.card, justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.brandTeal, borderColor: colors.brandTeal },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: "500" },
  chipTextOn: { color: "#fff", fontWeight: "600" },

  card: {
    backgroundColor: colors.card, borderRadius: 18, padding: 16, ...shadow.card,
  },
  cardHead: { flexDirection: "row", alignItems: "center" },
  docAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tealLight,
    alignItems: "center", justifyContent: "center",
  },
  docAvatarText: { color: colors.brandTeal, fontSize: 17, fontWeight: "700" },
  docName: { fontSize: 16, fontWeight: "600", color: colors.text },
  docDept: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: "600" },

  metaBox: {
    marginTop: 14, paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator,
  },
  metaRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
  metaDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  metaLabel: { width: 56, fontSize: 13, color: colors.textMuted },
  metaValue: { flex: 1, fontSize: 13, color: colors.text, fontWeight: "500" },

  emptyBox: { alignItems: "center", marginTop: 56, paddingHorizontal: 30 },
  emptyGlyph: { fontSize: 34, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  emptyDesc: { fontSize: 13, color: colors.textMuted, marginTop: 5, textAlign: "center", lineHeight: 19 },
});
