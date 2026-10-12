/**
 * 员工端 —— 患者详情
 */
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { colors, spacing, radius, fontSize, request } from "@medicode/shared";

export default function PatientDetailScreen({ route }: any) {
  const { id } = route.params;
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await request<any>(`/api/patients/${id}`);
        setDetail(res);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />;
  }
  if (!detail) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.textMuted }}>患者不存在</Text>
      </View>
    );
  }

  const rows: [string, string][] = [
    ["姓名", detail.name || "—"],
    ["性别", detail.gender || "—"],
    ["手机号", detail.phone || "—"],
    ["身份证", detail.id_card || detail.id_number || "—"],
    ["出生日期", detail.birth_date || "—"],
    ["地址", detail.address || "—"],
    ["过敏史", detail.medical_history || "—"],
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(detail.name || "?")[0]}</Text>
        </View>
        <Text style={styles.name}>{detail.name || "未命名"}</Text>
        <Text style={styles.meta}>
          {detail.gender ? `${detail.gender} · ` : ""}
          {detail.phone || ""}
        </Text>
      </View>

      <View style={styles.card}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.rowKey}>{k}</Text>
            <Text style={styles.rowVal}>{v}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: "center", paddingVertical: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: { color: colors.primary, fontSize: 28, fontWeight: "700" },
  name: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowKey: { fontSize: fontSize.sm, color: colors.textSecondary },
  rowVal: { fontSize: fontSize.md, color: colors.text, flex: 1, textAlign: "right", marginLeft: spacing.md },
});
