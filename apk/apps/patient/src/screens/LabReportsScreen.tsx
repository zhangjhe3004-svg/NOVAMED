/**
 * 患者端 —— 检查报告（Apple Store iOS 版式）
 * 大标题 → 可展开的报告卡（状态胶囊 / 报告号 / 科室 / 结果与参考区间）
 */
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, shadow, request, LargeTitleHeader } from "@medicode/shared";
import { FlaskIcon } from "../icons";

const GUTTER = 20;

/** 2026-10-11T21:54:06.081907 → 2026年10月11日 */
function fmtDate(raw?: string | null): string {
  if (!raw) return "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : raw || "";
}

const STATUS: Record<string, { bg: string; fg: string }> = {
  已出报告: { bg: colors.tealLight, fg: colors.brandTeal },
  检查中: { bg: "#FFF4E5", fg: "#FF9500" },
  已采样: { bg: "#FFF4E5", fg: "#FF9500" },
  待检查: { bg: colors.background, fg: colors.textSecondary },
};

export default function LabReportsScreen({ navigation }: any) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<any>(null);

  const load = async () => {
    try {
      const res = await request<{ items: any[] }>("/api/patient-auth/lab-tests");
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
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <LargeTitleHeader
        back
        title="检查报告"
        subtitle={`${list.length} 份报告 · 点按查看结果与参考区间`}
        tint={colors.brandTeal}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandTeal} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: spacing.xs, paddingBottom: 130 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.textMuted} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => {
            const open = expanded === item.id;
            const p = STATUS[item.status] || STATUS["待检查"];
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setExpanded(open ? null : item.id)}
                activeOpacity={0.85}
              >
                <View style={styles.head}>
                  <View style={[styles.glyph, { backgroundColor: p.bg }]}>
                    <FlaskIcon color={p.fg} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.item_name || "检查项目"}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {fmtDate(item.created_at)}{item.department ? `  ·  ${item.department}` : ""}
                    </Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: p.bg }]}>
                    <Text style={[styles.pillText, { color: p.fg }]}>{item.status || "待检查"}</Text>
                  </View>
                </View>

                {open && (
                  <View style={styles.detailBox}>
                    <View style={styles.row}>
                      <Text style={styles.rowKey}>报告号</Text>
                      <Text style={styles.rowVal}>{item.test_no || "—"}</Text>
                    </View>
                    <View style={[styles.row, styles.divider]}>
                      <Text style={styles.rowKey}>送诊医生</Text>
                      <Text style={styles.rowVal}>{item.doctor_name || "—"}</Text>
                    </View>
                    <View style={[styles.row, styles.divider]}>
                      <Text style={styles.rowKey}>结果</Text>
                      <Text style={styles.rowVal}>{item.result || "未出"}</Text>
                    </View>
                    <View style={[styles.row, styles.divider]}>
                      <Text style={styles.rowKey}>参考区间</Text>
                      <Text style={styles.rowVal}>{item.reference || "—"}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <FlaskIcon color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>暂无检查报告</Text>
              <Text style={styles.emptyDesc}>医生开具检查后，报告会显示在这里</Text>
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

  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, ...shadow.card },
  head: { flexDirection: "row", alignItems: "center" },
  glyph: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  glyphText: { fontSize: 17, fontWeight: "700" },
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: "600" },

  detailBox: {
    marginTop: 12, paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator,
  },
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 9 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  rowKey: { width: 64, fontSize: 12, color: colors.textMuted, paddingTop: 2 },
  rowVal: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },

  emptyBox: { alignItems: "center", marginTop: 56, paddingHorizontal: 30 },
  emptyGlyph: { fontSize: 32, color: colors.textMuted, opacity: 0.45, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  emptyDesc: { fontSize: 13, color: colors.textMuted, marginTop: 5, textAlign: "center" },
});
