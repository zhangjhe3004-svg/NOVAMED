/**
 * 患者端首页 —— Apple Store iOS 版式
 * 品牌行 + 大标题 → 青绿 hero 瓷砖 → 快捷入口（横向卡带）
 * → 我的预约（产品瓷砖） → 就诊提醒（分组列表）
 */
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { colors, spacing, shadow, request } from "@medicode/shared";
import { usePatientAuth } from "../auth";
import BrandMark from "../BrandMark";
import { CalIcon, DocIcon, ClockIcon, PersonIcon, CardIcon, FolderIcon } from "../icons";

export default function HomeScreen({ navigation }: any) {
  const { user } = usePatientAuth();
  const [appt, setAppt] = useState<any | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    (async () => {
      // 未读消息数（顶部铃铛角标）
      try {
        const res = await request<any>("/api/patient-auth/overview");
        setUnread(res?.unread ?? 0);
      } catch {
        setUnread(0);
      }
      try {
        const res = await request<{ items: any[] }>("/api/patient-auth/appointments");
        const first = (res.items || [])[0];
        if (first) setAppt(first);
      } catch {
        /* 保持空态：没有真实数据就不展示 */
      }
    })();
  }, []);

  const quick = [
    { title: "预约挂号", Icon: CalIcon, bg: colors.tealLight, fg: colors.brandTeal, screen: "预约" },
    { title: "就诊记录", Icon: DocIcon, bg: colors.primaryLight, fg: colors.primary, screen: "记录" },
    { title: "就诊报到", Icon: ClockIcon, bg: "#FFF4E5", fg: "#FF9500", screen: "预约" },
    { title: "我的档案", Icon: PersonIcon, bg: colors.tealLight, fg: colors.brandTeal, screen: "我的" },
  ];

  const name = user?.name || "林女士";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 130 }}>
      {/* ── 品牌行 ── */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <BrandMark size={30} on="light" />
          <Text style={styles.brandWord}>NOVAMED 健康</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("消息")}
            activeOpacity={0.7}
            accessibilityLabel="消息中心"
          >
            <View>
              {/* 铃铛：纯 View 绘制 */}
              <View style={{ width: 22, height: 24, alignItems: "center", justifyContent: "flex-end", paddingBottom: 2 }}>
                <View style={{ width: 14, height: 12, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: colors.text }} />
                <View style={{ position: "absolute", bottom: 1, width: 4, height: 2, borderRadius: 1, backgroundColor: colors.text }} />
              </View>
              {unread > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unread > 99 ? "99+" : String(unread)}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate("我的")} activeOpacity={0.7}>
            <Text style={styles.avatarText}>{name[0]}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 大标题 ── */}
      <View style={styles.titleBlock}>
        <Text style={styles.largeTitle}>您好，{name}</Text>
        <Text style={styles.titleSub}>今天也照顾好自己 · 您的健康信息都在这里</Text>
      </View>

      {/* ── hero 瓷砖 ── */}
      <View style={styles.heroTile}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.heroHeadline}>让就医更简单，{"\n"}让关怀更贴近。</Text>
          <Text style={styles.heroBody}>预约、报到与检查报告，随时清晰可见。</Text>
        </View>
        <View style={styles.heroMarkWrap}>
          <BrandMark size={52} on="light" />
        </View>
      </View>

      {/* ── 快捷入口：2×2 行内图标瓦片 ── */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>快捷服务</Text>
      </View>
      <View style={styles.quickGrid}>
        {quick.map((q) => (
          <TouchableOpacity key={q.title} style={styles.quickCard} onPress={() => navigation.navigate(q.screen)} activeOpacity={0.7}>
            <View style={[styles.quickGlyph, { backgroundColor: q.bg }]}>
              <q.Icon color={q.fg} />
            </View>
            <Text style={styles.quickTitle}>{q.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── 我的预约：产品瓷砖 ── */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>我的预约</Text>
        <TouchableOpacity onPress={() => navigation.navigate("预约")} activeOpacity={0.6}>
          <Text style={styles.sectionAction}>全部</Text>
        </TouchableOpacity>
      </View>
      {appt ? (
      <View style={styles.apptTile}>
        <View style={styles.apptTop}>
          <View style={styles.docAvatar}>
            <Text style={styles.docAvatarText}>{(appt.doctor_name || "医")[0]}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
            <Text style={styles.docName} numberOfLines={1}>{appt.doctor_name || "医生"}</Text>
            <Text style={styles.docDept} numberOfLines={1}>{appt.department || "门诊"}</Text>
          </View>
          <View style={styles.waitPill}>
            <Text style={styles.waitPillText}>{appt.status || "待就诊"}</Text>
          </View>
        </View>

        {/* 时间 / 地点 / 就诊人 三行（Apple 分组行） */}
        <View style={styles.apptMeta}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>时间</Text>
            <Text style={styles.metaValue}>
              {(appt.date || "—") + "  " + (appt.time_slot || "")}
            </Text>
          </View>
          <View style={[styles.metaRow, styles.metaDivider]}>
            <Text style={styles.metaLabel}>地点</Text>
            <Text style={styles.metaValue} numberOfLines={1}>{appt.hospital || appt.department || "—"}</Text>
          </View>
          <View style={[styles.metaRow, styles.metaDivider]}>
            <Text style={styles.metaLabel}>就诊人</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {appt.patient_name || name}
            </Text>
          </View>
        </View>

        <View style={styles.apptBtns}>
          <TouchableOpacity style={styles.btnGhost} onPress={() => navigation.navigate("预约")} activeOpacity={0.7}>
            <Text style={styles.btnGhostText}>改期</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate("记录")} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>查看报到指引</Text>
          </TouchableOpacity>
        </View>
      </View>
      ) : (
      <View style={styles.apptTileEmpty}>
        <View style={styles.emptyIconWrap}>
          <CalIcon color={colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>暂无预约</Text>
        <Text style={styles.emptyDesc}>您还没有预约记录，可从快捷服务发起预约挂号</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate("预约")} activeOpacity={0.85}>
          <Text style={styles.emptyBtnText}>去预约</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* ── 就诊提醒：分组列表 ── */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>就诊前的小提醒</Text>
      </View>
      <View style={styles.groupCard}>
        {[
          { Icon: CardIcon, c: colors.brandTeal, t: "请携带有效证件", d: "身份证或医保卡原件" },
          { Icon: FolderIcon, c: colors.primary, t: "请带好既往检查资料", d: "影像报告、化验单等" },
          { Icon: ClockIcon, c: "#FF9500", t: "请提前 15 分钟到达", d: "留出取号与候诊时间" },
        ].map((r, i, arr) => (
          <View key={r.t} style={[styles.tipRow, i < arr.length - 1 && styles.rowDivider]}>
            <View style={styles.tipGlyph}>
              <r.Icon color={r.c} />
            </View>
            <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
              <Text style={styles.tipTitle}>{r.t}</Text>
              <Text style={styles.tipDesc}>{r.d}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  brandRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: GUTTER, paddingTop: spacing.md,
  },
  brandLeft: { flexDirection: "row", alignItems: "center" },
  brandWord: {
    marginLeft: 7, fontSize: 12, fontWeight: "700", letterSpacing: 1.2,
    color: colors.brandTeal,
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tealLight,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: colors.brandTeal, fontSize: 14, fontWeight: "700" },
  demoPill: { backgroundColor: "#FFF4E5", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  demoPillText: { color: "#FF9500", fontSize: 10, fontWeight: "600" },

  apptTileEmpty: {
    marginHorizontal: GUTTER, marginTop: spacing.sm,
    backgroundColor: colors.card, borderRadius: 22, padding: 28,
    alignItems: "center", ...shadow.card,
  },
  emptyIconWrap: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  emptyDesc: { fontSize: 13, color: colors.textMuted, marginTop: 5, textAlign: "center", lineHeight: 19 },
  emptyBtn: {
    marginTop: 14, backgroundColor: colors.brandTeal, borderRadius: 999,
    paddingHorizontal: 22, paddingVertical: 9,
  },
  emptyBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  bellBadge: {
    position: "absolute", top: -3, right: -5,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.danger, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4, borderWidth: 2, borderColor: "#fff",
  },
  bellBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },

  titleBlock: { paddingHorizontal: GUTTER, paddingTop: spacing.md },
  largeTitle: {
    fontSize: 32, fontWeight: "700", color: colors.text,
    letterSpacing: -0.9, lineHeight: 39,
  },
  titleSub: { fontSize: 15, color: colors.textSecondary, marginTop: 6, lineHeight: 21 },

  /* hero 瓷砖 */
  heroTile: {
    marginHorizontal: GUTTER, marginTop: spacing.lg,
    backgroundColor: colors.tealLight, borderRadius: 22, padding: 20,
    flexDirection: "row", alignItems: "center", ...shadow.card,
  },
  heroHeadline: {
    fontSize: 21, fontWeight: "700", color: colors.brandTeal,
    lineHeight: 29, letterSpacing: -0.4,
  },
  heroBody: {
    fontSize: 13, color: colors.brandTeal, opacity: 0.72,
    marginTop: 8, lineHeight: 19,
  },
  heroMarkWrap: {
    width: 74, height: 74, borderRadius: 18, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },

  /* 区块头 */
  sectionHead: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
    paddingHorizontal: GUTTER, marginTop: 28, marginBottom: 12,
  },
  sectionTitle: { fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.4 },
  sectionAction: { fontSize: 13, color: colors.brandTeal, fontWeight: "500" },

  /* 快捷入口：2×2 行内图标瓦片 */
  quickGrid: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between",
    paddingHorizontal: GUTTER, gap: 10,
  },
  quickCard: {
    width: "48.6%", backgroundColor: colors.card, borderRadius: 18,
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 14, ...shadow.card,
  },
  quickGlyph: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  quickTitle: {
    fontSize: 14, color: colors.text, fontWeight: "600", marginLeft: 11, flex: 1,
  },

  /* 我的预约 */
  apptTile: {
    marginHorizontal: GUTTER, backgroundColor: colors.card,
    borderRadius: 18, padding: 16, ...shadow.card,
  },
  apptTop: { flexDirection: "row", alignItems: "center" },
  docAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tealLight,
    alignItems: "center", justifyContent: "center",
  },
  docAvatarText: { color: colors.brandTeal, fontSize: 17, fontWeight: "700" },
  docName: { fontSize: 16, fontWeight: "600", color: colors.text },
  docDept: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  waitPill: { backgroundColor: "#FFF4E5", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  waitPillText: { color: "#FF9500", fontSize: 11, fontWeight: "600" },

  apptMeta: { marginTop: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
  metaDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  metaLabel: { width: 56, fontSize: 13, color: colors.textMuted },
  metaValue: { flex: 1, fontSize: 13, color: colors.text, fontWeight: "500" },

  apptBtns: { flexDirection: "row", gap: 10, marginTop: 14 },
  btnGhost: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingVertical: 12, alignItems: "center",
  },
  btnGhostText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  btnPrimary: {
    flex: 1.5, backgroundColor: colors.brandTeal, borderRadius: 999,
    paddingVertical: 12, alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  /* 提醒 */
  groupCard: {
    marginHorizontal: GUTTER, backgroundColor: colors.card,
    borderRadius: 18, overflow: "hidden", ...shadow.card,
  },
  tipRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  tipGlyph: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center",
  },
  tipTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  tipDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
