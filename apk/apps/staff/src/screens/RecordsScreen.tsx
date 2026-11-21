/**
 * 员工端 —— 就诊记录（Apple Store iOS 版式）
 * 大标题 → 分组记录卡
 */
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { colors, spacing, shadow, request, Paged } from "@medicode/shared";

const GUTTER = 20;

export default function RecordsScreen() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await request<Paged<any>>("/api/records?page=1&page_size=50");
      setList(res.items || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.largeTitle}>记录</Text>
        <Text style={styles.titleSub}>共 {list.length} 条就诊记录，按时间倒序。</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: spacing.xs, paddingBottom: 130 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.textMuted}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.patient_name || item.patient?.name || "患")[0]}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                  <Text style={styles.patientName} numberOfLines={1}>
                    {item.patient_name || item.patient?.name || "患者"}
                  </Text>
                  <Text style={styles.time} numberOfLines={1}>
                    {item.visit_date || (item.created_at || "").slice(0, 10) || "—"}
                    {item.doctor_name ? `  ·  ${item.doctor_name}` : ""}
                  </Text>
                </View>
              </View>

              <View style={styles.body}>
                <View style={styles.diagRow}>
                  <Text style={styles.diagLabel}>诊断</Text>
                  <Text style={styles.diag}>{item.diagnosis || "待诊断"}</Text>
                </View>
                <View style={[styles.diagRow, styles.diagDivider]}>
                  <Text style={styles.diagLabel}>症状</Text>
                  <Text style={styles.symptoms} numberOfLines={2}>{item.symptoms || "—"}</Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyGlyph}>▤</Text>
              <Text style={styles.emptyTitle}>暂无就诊记录</Text>
              <Text style={styles.emptyDesc}>完成接诊后，记录会归档显示在这里</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  titleBlock: { paddingHorizontal: GUTTER, paddingTop: spacing.md, paddingBottom: spacing.md },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, color: colors.textMuted, fontWeight: "700" },
  largeTitle: {
    fontSize: 34, fontWeight: "700", color: colors.text,
    letterSpacing: -0.9, lineHeight: 41, marginTop: 2,
  },
  titleSub: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },

  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, ...shadow.card },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  patientName: { fontSize: 15, fontWeight: "600", color: colors.text },
  time: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  body: {
    marginTop: 12, paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator,
  },
  diagRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 9 },
  diagDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  diagLabel: { width: 44, fontSize: 12, color: colors.textMuted, paddingTop: 2 },
  diag: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "600" },
  symptoms: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  emptyBox: { alignItems: "center", marginTop: 56, paddingHorizontal: 30 },
  emptyGlyph: { fontSize: 30, color: colors.textMuted, opacity: 0.45, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  emptyDesc: { fontSize: 13, color: colors.textMuted, marginTop: 5, textAlign: "center" },
});
