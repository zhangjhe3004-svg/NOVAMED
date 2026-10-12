/**
 * 员工端 —— 就诊记录
 */
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { colors, spacing, radius, fontSize, request, Paged } from "@medicode/shared";

export default function RecordsScreen() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await request<Paged<any>>("/api/records?page=1&page_size=50");
        setList(res.items || []);
      } catch {
        setList([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />;
  }

  return (
    <FlatList
      style={styles.container}
      data={list}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: spacing.md }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.patientName}>{item.patient_name || item.patient?.name || "患者"}</Text>
            <Text style={styles.time}>{item.created_at || ""}</Text>
          </View>
          <Text style={styles.diag}>{item.diagnosis || "待诊断"}</Text>
          <Text style={styles.symptoms} numberOfLines={2}>
            {item.symptoms || "—"}
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>暂无就诊记录</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  patientName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  time: { fontSize: fontSize.xs, color: colors.textMuted },
  diag: { fontSize: fontSize.md, color: colors.teal, fontWeight: "600" },
  symptoms: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 60, fontSize: fontSize.md },
});
