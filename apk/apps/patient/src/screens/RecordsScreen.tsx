/**
 * 患者端 —— 就诊记录（对照设计稿 12-患者就诊记录）
 */
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { colors, spacing, radius, fontSize, request, Paged } from "@medicode/shared";

export default function RecordsScreen() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await request<Paged<any>>("/api/records?page=1&page_size=50");
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

  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
        <Text style={styles.eyebrow}>MEDICAL RECORDS</Text>
        <Text style={styles.h1}>我的就诊记录</Text>
        <Text style={styles.hSub}>诊疗记录已归档，点击卡片查看详情。</Text>
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
            const open = expanded === item.id;
            return (
              <TouchableOpacity style={styles.card} onPress={() => setExpanded(open ? null : item.id)} activeOpacity={0.8}>
                <View style={styles.cardHead}>
                  <View style={styles.docIcon}>
                    <Text style={styles.docIconText}>▤</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={styles.recTitle}>{item.diagnosis || item.department || "门诊记录"}</Text>
                    <Text style={styles.recMeta}>
                      {item.created_at || ""}{item.doctor_name ? `  ·  ${item.doctor_name}` : ""}
                    </Text>
                  </View>
                  <View style={styles.viewBtn}>
                    <Text style={styles.viewBtnText}>{open ? "收起" : "查看详情"}</Text>
                  </View>
                </View>
                {open && (
                  <View style={{ marginTop: spacing.sm }}>
                    <View style={styles.divider} />
                    <Text style={styles.detailLabel}>主诉 / 症状</Text>
                    <Text style={styles.detailText}>{item.symptoms || "—"}</Text>
                    <Text style={styles.detailLabel}>诊断</Text>
                    <Text style={styles.detailText}>{item.diagnosis || "待诊断"}</Text>
                    {item.prescription ? (
                      <>
                        <Text style={styles.detailLabel}>处方</Text>
                        <Text style={styles.detailText}>{item.prescription}</Text>
                      </>
                    ) : null}
                    {item.note ? (
                      <>
                        <Text style={styles.detailLabel}>备注</Text>
                        <Text style={styles.detailText}>{item.note}</Text>
                      </>
                    ) : null}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>▤</Text>
              <Text style={styles.emptyText}>暂无就诊记录</Text>
              <Text style={styles.emptySub}>就诊完成后，归档记录会显示在这里</Text>
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
  docIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: "#e6f7f6", alignItems: "center", justifyContent: "center" },
  docIconText: { color: colors.teal, fontSize: 17, fontWeight: "700" },
  recTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
  recMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  viewBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff",
  },
  viewBtnText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: spacing.sm },
  detailLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 6, fontWeight: "600" },
  detailText: { fontSize: fontSize.sm, color: colors.text, marginTop: 2, lineHeight: 19 },
  emptyBox: { alignItems: "center", marginTop: 60 },
  emptyIcon: { fontSize: 40, color: colors.teal, opacity: 0.4 },
  emptyText: { fontSize: fontSize.lg, color: colors.text, fontWeight: "600", marginTop: spacing.sm },
  emptySub: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4 },
});
