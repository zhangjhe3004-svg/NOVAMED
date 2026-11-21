/**
 * 患者端 —— 就诊记录（Apple Store iOS 版式）
 * 大标题 → 可展开的分组记录卡
 */
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { colors, spacing, shadow, request } from "@medicode/shared";

const GUTTER = 20;

/** 2026-10-11T21:54:06.081907 → 2026年10月11日 21:54 */
function fmtDate(raw?: string | null): string {
  if (!raw) return "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return raw;
  const [, y, mo, d, hh, mm] = m;
  const date = `${y}年${Number(mo)}月${Number(d)}日`;
  return hh ? `${date} ${hh}:${mm}` : date;
}

export default function RecordsScreen() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<any>(null);

  const load = async () => {
    try {
      const res = await request<{ items: any[] }>("/api/patient-auth/records");
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
      <View style={styles.titleBlock}>
        <Text style={styles.largeTitle}>就诊记录</Text>
        <Text style={styles.titleSub}>诊疗记录已归档，点按任意一条查看详情。</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandTeal} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: spacing.sm, paddingBottom: 130 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => {
            const open = expanded === item.id;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setExpanded(open ? null : item.id)}
                activeOpacity={0.85}
              >
                <View style={styles.cardHead}>
                  <View style={styles.recGlyph}>
                    <Text style={styles.recGlyphText}>▤</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                    <Text style={styles.recTitle} numberOfLines={1}>
                      {item.diagnosis || item.department || "门诊记录"}
                    </Text>
                    <Text style={styles.recMeta} numberOfLines={1}>
                      {fmtDate(item.visit_date || item.created_at)}
                      {item.doctor_name ? `  ·  ${item.doctor_name}` : ""}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, open && { transform: [{ rotate: "90deg" }] }]}>›</Text>
                </View>

                {open && (
                  <View style={styles.detailBox}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>主诉 / 症状</Text>
                      <Text style={styles.detailText}>{item.symptoms || "—"}</Text>
                    </View>
                    <View style={[styles.detailRow, styles.detailDivider]}>
                      <Text style={styles.detailLabel}>诊断</Text>
                      <Text style={styles.detailText}>{item.diagnosis || "待诊断"}</Text>
                    </View>
                    {item.prescription ? (
                      <View style={[styles.detailRow, styles.detailDivider]}>
                        <Text style={styles.detailLabel}>处方</Text>
                        <Text style={styles.detailText}>{item.prescription}</Text>
                      </View>
                    ) : null}
                    {item.notes ? (
                      <View style={[styles.detailRow, styles.detailDivider]}>
                        <Text style={styles.detailLabel}>备注</Text>
                        <Text style={styles.detailText}>{item.notes}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyGlyph}>▤</Text>
              <Text style={styles.emptyTitle}>暂无就诊记录</Text>
              <Text style={styles.emptyDesc}>就诊完成后，归档记录会显示在这里</Text>
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

  card: {
    backgroundColor: colors.card, borderRadius: 18, padding: 16, ...shadow.card,
  },
  cardHead: { flexDirection: "row", alignItems: "center" },
  recGlyph: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: colors.tealLight,
    alignItems: "center", justifyContent: "center",
  },
  recGlyphText: { color: colors.brandTeal, fontSize: 17, fontWeight: "700" },
  recTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  recMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textMuted, marginLeft: 8 },

  detailBox: {
    marginTop: 12, paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator,
  },
  detailRow: { paddingVertical: 9 },
  detailDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  detailLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600", letterSpacing: 0.2 },
  detailText: { fontSize: 14, color: colors.text, marginTop: 3, lineHeight: 20 },

  emptyBox: { alignItems: "center", marginTop: 56, paddingHorizontal: 30 },
  emptyGlyph: { fontSize: 32, color: colors.textMuted, marginBottom: 10, opacity: 0.5 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  emptyDesc: { fontSize: 13, color: colors.textMuted, marginTop: 5, textAlign: "center" },
});
