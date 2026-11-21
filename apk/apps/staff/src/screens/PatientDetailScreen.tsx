/**
 * 员工端 —— 患者详情（Apple Store iOS 版式）
 * 头像卡 → 分组身份信息
 */
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { colors, spacing, shadow, request, LargeTitleHeader } from "@medicode/shared";

const GUTTER = 20;

export default function PatientDetailScreen({ route, navigation }: any) {
  const { id, name } = route.params;
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LargeTitleHeader back title="患者详情" tint={colors.primary} />
        <View style={{ alignItems: "center", paddingTop: 60 }}>
          <Text style={{ fontSize: 32, color: colors.textMuted, opacity: 0.4, marginBottom: 10 }}>◉</Text>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>患者不存在</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>该档案可能已被删除</Text>
        </View>
      </View>
    );
  }

  const basic: [string, string][] = [
    ["姓名", detail.name || "—"],
    ["性别", detail.gender || "—"],
    ["出生日期", detail.birth_date || "—"],
  ];
  const contact: [string, string][] = [
    ["手机号", detail.phone || "—"],
    ["身份证", detail.id_card || detail.id_number || "—"],
    ["地址", detail.address || "—"],
  ];
  const clinical: [string, string][] = [["过敏史", detail.medical_history || "—"]];

  const Group = ({ label, rows }: { label: string; rows: [string, string][] }) => (
    <>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.groupCard}>
        {rows.map(([k, v], i) => (
          <View key={k} style={[styles.infoRow, i < rows.length - 1 && styles.rowDivider]}>
            <Text style={styles.infoKey}>{k}</Text>
            <Text style={styles.infoVal}>{v}</Text>
          </View>
        ))}
      </View>
    </>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl + 40 }}>
      <LargeTitleHeader back title={name || "患者详情"} subtitle="档案详情" tint={colors.primary} />

      {/* 头像卡 */}
      <View style={styles.heroCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(detail.name || "?")[0]}</Text>
        </View>
        <Text style={styles.name}>{detail.name || "未命名"}</Text>
        <Text style={styles.meta}>
          {detail.gender ? `${detail.gender}` : ""}
          {detail.gender && detail.phone ? "  ·  " : ""}
          {detail.phone || ""}
        </Text>
      </View>

      <Group label="基本信息" rows={basic} />
      <Group label="联系方式" rows={contact} />
      <Group label="临床信息" rows={clinical} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  heroCard: {
    alignItems: "center", paddingVertical: 26,
    marginHorizontal: GUTTER, marginTop: spacing.md,
    backgroundColor: colors.card, borderRadius: 18, ...shadow.card,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  avatarText: { color: colors.primary, fontSize: 28, fontWeight: "700" },
  name: { fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.4 },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },

  groupLabel: {
    fontSize: 12, fontWeight: "600", color: colors.textMuted,
    letterSpacing: 0.4, textTransform: "uppercase",
    paddingHorizontal: GUTTER, marginTop: 26, marginBottom: 8,
  },
  groupCard: {
    marginHorizontal: GUTTER, backgroundColor: colors.card,
    borderRadius: 18, overflow: "hidden", ...shadow.card,
  },
  infoRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 12, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  infoKey: { width: 72, fontSize: 14, color: colors.textSecondary },
  infoVal: { flex: 1, fontSize: 14, color: colors.text, textAlign: "right" },
});
