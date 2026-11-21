/**
 * 员工端工作台 —— Apple Store iOS 版式
 * 大标题 → 产品级 hero 瓷砖 → 数据概览（2×2 瓷片）
 * → 需要我关注（横向卡带） → 今日接诊（分组列表）
 */
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { colors, spacing, shadow, request, Paged } from "@medicode/shared";
import { useStaffAuth } from "../auth";
import BrandMark from "../BrandMark";

export default function HomeScreen({ navigation }: any) {
  const { user } = useStaffAuth();
  const [stats, setStats] = useState<any>(null);
  const [todayList, setTodayList] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await request<any>("/api/analytics/overview");
      setStats(res);
    } catch {
      /* 忽略 */
    }
    try {
      const res = await request<{ items: any[] }>("/api/doctors/appointments");
      setTodayList((res.items || []).slice(0, 5));
    } catch {
      setTodayList([]);
    }
    try {
      const res = await request<Paged<any>>("/api/records?page=1&page_size=50");
      setRecords(res.items || []);
    } catch {
      setRecords([]);
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
    { label: "患者总数", value: stats?.patient_total, color: colors.primary, sub: "建档患者" },
    { label: "就诊记录", value: stats?.record_total, color: colors.teal, sub: "累计病历" },
    { label: "预约总数", value: stats?.appointment_total, color: colors.purple, sub: "全部预约" },
    { label: "已出报告", value: stats?.labtest_done, color: colors.warning, sub: `共 ${stats?.labtest_total ?? "—"} 份检查` },
  ];

  // 关注事项数量全部由真实数据推导，不使用演示常量
  const attention = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const aiPending = records.filter((r) => !r.ai_reviewed).length;
    const waiting = todayList.filter((a) =>
      ["待就诊", "待确认", "已报到"].includes(a.status || "")
    ).length;
    const reviewPending = records.filter(
      (r) => r.review_status && r.review_status !== "已审核"
    ).length;
    return [
      { title: "AI 医嘱待确认", desc: "智能医嘱已生成，等待您的确认", count: pad(aiPending), color: colors.primary, bg: colors.primaryLight, go: "记录" },
      { title: "待接诊患者", desc: "已在候诊区排队等待叫号", count: pad(waiting), color: colors.warning, bg: "#FFF4E5", go: "患者" },
      { title: "病历待预评", desc: "补充的病历可进行质量预评", count: pad(reviewPending), color: colors.brandTeal, bg: colors.tealLight, go: "记录" },
    ];
  }, [records, todayList]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 130 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
    >
      {/* ── 品牌行 + 大标题（Apple Store Large Title） ── */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <BrandMark size={30} on="light" />
          <Text style={styles.brandWord}>NOVAMED</Text>
        </View>
        <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate("我的")} activeOpacity={0.7}>
          <Text style={styles.avatarText}>{docName[0]}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.largeTitle}>工作台</Text>
        <Text style={styles.titleSub}>上午好，{docName}。今天有 {todayList.length} 位患者预约待诊。</Text>
      </View>

      {/* ── 产品级 hero 瓷砖 ── */}
      <View style={styles.heroTile}>
        <Text style={styles.heroHeadline}>让信息更有序，{"\n"}让每一次诊疗更从容。</Text>
        <Text style={styles.heroBody}>患者档案、就诊记录与 AI 辅助建议，都在这一个工作台里。</Text>
        <TouchableOpacity style={styles.heroCta} onPress={() => navigation.navigate("患者")} activeOpacity={0.85}>
          <Text style={styles.heroCtaText}>进入患者列表</Text>
        </TouchableOpacity>
      </View>

      {/* ── 数据概览 ── */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>数据概览</Text>
        <Text style={styles.sectionLink}>本月</Text>
      </View>
      <View style={styles.statGrid}>
        {statCards.map((c) => (
          <View key={c.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: c.color }]}>{c.value ?? "—"}</Text>
            <Text style={styles.statLabel}>{c.label}</Text>
            <Text style={styles.statSub}>{c.sub}</Text>
          </View>
        ))}
      </View>

      {/* ── 需要我关注：横向卡带 ── */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>需要我关注</Text>
        <Text style={styles.sectionLink}>全部事项</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        snapToInterval={228}
        decelerationRate="fast"
      >
        {attention.map((a) => (
          <TouchableOpacity
            key={a.title}
            style={[styles.carCard, { borderLeftWidth: 3, borderLeftColor: a.bg }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate(a.go)}
          >
            <Text style={[styles.carCount, { color: a.color }]}>{a.count}</Text>
            <Text style={styles.carTitle}>{a.title}</Text>
            <Text style={styles.carDesc} numberOfLines={2}>{a.desc}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── 今日接诊：分组列表 ── */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>今日接诊</Text>
        <TouchableOpacity onPress={() => navigation.navigate("患者")} activeOpacity={0.6}>
          <Text style={styles.sectionAction}>查看全部</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.groupCard}>
        {todayList.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyGlyph}>◔</Text>
            <Text style={styles.emptyTitle}>暂无接诊安排</Text>
            <Text style={styles.emptyDesc}>今天没有预约到诊的患者</Text>
          </View>
        ) : (
          todayList.map((item, i) => (
            <TouchableOpacity
              key={String(item.id)}
              style={[styles.row, i < todayList.length - 1 && styles.rowDivider]}
              activeOpacity={0.6}
              onPress={() => navigation.navigate("患者")}
            >
              <View style={styles.rowAvatar}>
                <Text style={styles.rowAvatarText}>{(item.patient_name || "患")[0]}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.patient_name || "患者"}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {item.date || ""} {item.time_slot || ""} · {item.department || "门诊"}
                </Text>
              </View>
              <View style={[styles.statusPill, item.status === "已确认" ? styles.statusOk : styles.statusWait]}>
                <Text style={[styles.statusText, item.status === "已确认" ? { color: colors.success } : { color: colors.warning }]}>
                  {item.status || "待确认"}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  /* 品牌行 */
  brandRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: GUTTER, paddingTop: spacing.md,
  },
  brandLeft: { flexDirection: "row", alignItems: "center" },
  brandWord: {
    marginLeft: 7, fontSize: 12, fontWeight: "700", letterSpacing: 1.6,
    color: colors.textSecondary,
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontSize: 14, fontWeight: "700" },

  /* 大标题 */
  titleBlock: { paddingHorizontal: GUTTER, paddingTop: spacing.md },
  largeTitle: {
    fontSize: 34, fontWeight: "700", color: colors.text,
    letterSpacing: -0.9, lineHeight: 41,
  },
  titleSub: {
    fontSize: 15, color: colors.textSecondary, marginTop: 6, lineHeight: 21,
  },

  /* hero 瓷砖 */
  heroTile: {
    marginHorizontal: GUTTER, marginTop: spacing.lg,
    backgroundColor: colors.primary, borderRadius: 22, padding: 22,
    ...shadow.card,
  },
  heroHeadline: {
    color: "#fff", fontSize: 24, fontWeight: "700",
    lineHeight: 32, letterSpacing: -0.4,
  },
  heroBody: {
    color: "rgba(255,255,255,0.78)", fontSize: 14, lineHeight: 20, marginTop: 10,
  },
  heroCta: {
    alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 11, marginTop: 18,
  },
  heroCtaText: { color: colors.primary, fontSize: 14, fontWeight: "600" },

  /* 区块头 */
  sectionHead: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
    paddingHorizontal: GUTTER, marginTop: 30, marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.4,
  },
  sectionLink: { fontSize: 13, color: colors.textMuted },
  sectionAction: { fontSize: 13, color: colors.primary, fontWeight: "500" },

  /* 数据概览 */
  statGrid: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between",
    paddingHorizontal: GUTTER, gap: 12,
  },
  statCard: {
    width: "47.8%", backgroundColor: colors.card, borderRadius: 18,
    padding: 16, ...shadow.card,
  },
  statValue: {
    fontSize: 30, fontWeight: "700", color: colors.text,
    letterSpacing: -1,
  },
  statLabel: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 2 },
  statSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  /* 横向卡带 */
  carousel: { paddingLeft: GUTTER, paddingRight: GUTTER - 12, gap: 12 },
  carCard: {
    width: 216, backgroundColor: colors.card, borderRadius: 18,
    padding: 16, ...shadow.card,
  },
  carCount: {
    fontSize: 32, fontWeight: "700", letterSpacing: -1.2,
  },
  carTitle: { fontSize: 15, fontWeight: "600", color: colors.text, marginTop: 2 },
  carDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 4 },

  /* 分组列表 */
  groupCard: {
    marginHorizontal: GUTTER, backgroundColor: colors.card,
    borderRadius: 18, overflow: "hidden", ...shadow.card,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 16 },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowAvatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  rowAvatarText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  rowBody: { flex: 1, marginLeft: 12, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusPill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statusOk: { backgroundColor: "#E8F7EC" },
  statusWait: { backgroundColor: "#FFF4E5" },
  statusText: { fontSize: 11, fontWeight: "600" },
  chevron: { fontSize: 17, color: colors.textMuted, marginLeft: 6, marginTop: -1 },

  /* 空态 */
  emptyWrap: { alignItems: "center", paddingVertical: 34 },
  emptyGlyph: { fontSize: 26, color: colors.textMuted, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  emptyDesc: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
});
