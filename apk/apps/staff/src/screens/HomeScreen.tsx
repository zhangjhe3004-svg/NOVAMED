/**
 * 员工端工作台（对照设计稿 05-窄屏适配 / 总览控制台）
 * 深蓝 hero 卡 → 2×2 统计格 → 需要我关注 → 今日接诊
 */
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { colors, spacing, radius, fontSize, request, Paged } from "@medicode/shared";
import { useStaffAuth } from "../auth";

export default function HomeScreen({ navigation }: any) {
  const { user } = useStaffAuth();
  const [stats, setStats] = useState<any>(null);
  const [todayList, setTodayList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await request<any>("/api/analytics/summary");
      setStats(res);
    } catch {
      /* 忽略 */
    }
    try {
      const res = await request<Paged<any>>("/api/appointments?page=1&page_size=5");
      setTodayList(res.items || []);
    } catch {
      setTodayList([]);
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

  const docName = user?.real_name || user?.username || "医生";

  const statCards = [
    { label: "患者总数", value: stats?.total_patients, icon: "◉", color: colors.primary, sub: "建档患者统计" },
    { label: "本月就诊", value: stats?.total_records, icon: "📄", color: colors.teal, sub: "全部就诊记录" },
    { label: "AI 辅助已阅", value: stats?.today_appointments, icon: "✦", color: colors.purple, sub: "AI 预览已确认" },
    { label: "待处理事项", value: null, icon: "◔", color: colors.warning, sub: "签到的患者" },
  ];

  const attention = [
    { title: "AI 医嘱待确认", desc: "智能医嘱已生成待确认", count: "03", color: colors.primary, bg: "#eaf1ff" },
    { title: "待接诊患者", desc: "排队等待接诊", count: "08", color: colors.warning, bg: "#fff6e8" },
    { title: "待复查病历待降", desc: "补充的病历待预评", count: "02", color: colors.teal, bg: "#e6f7f6" },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 深蓝 hero 卡 */}
      <View style={styles.hero}>
        <Text style={styles.heroHello}>上午好，{docName}。</Text>
        <Text style={styles.heroSub}>
          今天有 {stats?.today_appointments ?? "—"} 位患者预约待诊。
        </Text>
        <Text style={styles.heroSub}>让信息更有序，让每一次诊疗更从容。</Text>
        <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.navigate("患者")}>
          <Text style={styles.heroBtnText}>进入医生工作台 →</Text>
        </TouchableOpacity>
      </View>

      {/* 2×2 统计格 */}
      <View style={styles.statGrid}>
        {statCards.map((c) => (
          <View key={c.label} style={styles.statCard}>
            <View style={styles.statHead}>
              <Text style={styles.statLabel}>{c.label}</Text>
              <View style={[styles.statIcon, { backgroundColor: `${c.color}18` }]}>
                <Text style={{ fontSize: 13 }}>{c.icon}</Text>
              </View>
            </View>
            <Text style={[styles.statValue, { color: c.color }]}>{c.value ?? "—"}</Text>
            <Text style={styles.statSub}>{c.sub}</Text>
          </View>
        ))}
      </View>

      {/* 需要我关注 */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>需要我关注</Text>
        <Text style={styles.sectionLink}>全部事项</Text>
      </View>
      <View style={styles.card}>
        {attention.map((a, i) => (
          <View key={a.title} style={[styles.attRow, i < attention.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <View style={[styles.attIcon, { backgroundColor: a.bg }]}>
              <Text style={{ fontSize: 14 }}>{a.title.startsWith("AI") ? "✦" : a.title.startsWith("待接") ? "◉" : "📄"}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.attTitle}>{a.title}</Text>
              <Text style={styles.attDesc}>{a.desc}</Text>
            </View>
            <Text style={[styles.attCount, { color: a.color }]}>{a.count}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        ))}
      </View>

      {/* 今日接诊 */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>今日接诊</Text>
        <Text style={styles.sectionLink}>查看全部 →</Text>
      </View>
      <View style={styles.card}>
        {todayList.length === 0 ? (
          <Text style={styles.empty}>暂无接诊安排</Text>
        ) : (
          todayList.map((item, i) => (
            <View key={String(item.id)} style={[styles.attRow, i < todayList.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <View style={styles.ptAvatar}>
                <Text style={styles.ptAvatarText}>{(item.patient_name || "患")[0]}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.attTitle}>{item.patient_name || "患者"}</Text>
                <Text style={styles.attDesc}>{item.date || ""} {item.time_slot || ""} · {item.department || "门诊"}</Text>
              </View>
              <Text style={[styles.attStatus, { color: item.status === "已确认" ? colors.success : colors.warning }]}>
                {item.status || "待确认"}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f7fb" },
  hero: {
    backgroundColor: "#0f2d52",
    margin: spacing.md, borderRadius: radius.lg, padding: spacing.lg,
  },
  heroHello: { color: "#fff", fontSize: 22, fontWeight: "700" },
  heroSub: { color: "rgba(255,255,255,0.65)", fontSize: fontSize.sm, marginTop: 4, lineHeight: 19 },
  heroBtn: {
    alignSelf: "flex-start", backgroundColor: "#2f6bff", borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10, marginTop: spacing.md,
  },
  heroBtnText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.md },
  statCard: {
    width: "48.5%", backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md,
  },
  statHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  statIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 26, fontWeight: "700", marginTop: spacing.sm },
  statSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  sectionHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  sectionLink: { fontSize: fontSize.xs, color: colors.textMuted },
  card: {
    marginHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
  },
  attRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  attIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  attTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  attDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  attCount: { fontSize: fontSize.xl, fontWeight: "700", marginLeft: spacing.sm },
  chevron: { fontSize: 18, color: colors.textMuted, marginLeft: 6 },
  ptAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#eaf1ff", alignItems: "center", justifyContent: "center" },
  ptAvatarText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  attStatus: { fontSize: fontSize.xs, fontWeight: "600" },
  empty: { textAlign: "center", color: colors.textMuted, paddingVertical: spacing.lg, fontSize: fontSize.sm },
});
