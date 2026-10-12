/**
 * 患者端 —— 首页（对照设计稿 11/06-患者手机首页）
 * 品牌顶栏 → 问候区 → 浅绿渐变卡 → 4 快捷入口 → 我的预约卡 → 就诊前小提醒
 */
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { colors, spacing, radius, fontSize, request, Paged } from "@medicode/shared";
import { usePatientAuth } from "../auth";

export default function HomeScreen({ navigation }: any) {
  const { user } = usePatientAuth();
  const [appt, setAppt] = useState<any | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await request<Paged<any>>("/api/appointments?page=1&page_size=1");
        const first = (res.items || [])[0];
        if (first) setAppt(first);
        else throw new Error("empty");
      } catch {
        setAppt({
          doctor_name: "陈医生",
          department: "全科医学科 · 普通门诊",
          date: "09月11日",
          time_slot: "09:15",
          status: "待就诊",
          place: "门诊楼 2 层 · 全科诊区",
          patient_name: user?.name || "林女士",
        });
        setIsDemo(true);
      }
    })();
  }, []);

  const quick = [
    { title: "预约挂号", icon: "📅", bg: "#e6f7f6", screen: "预约" },
    { title: "就诊记录", icon: "📄", bg: "#eaf1ff", screen: "记录" },
    { title: "就诊报到", icon: "🕐", bg: "#fff3e0", screen: "预约" },
    { title: "我的档案", icon: "👤", bg: "#e6f7f6", screen: "我的" },
  ];

  const name = user?.name || "林女士";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      {/* 品牌顶栏 */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={styles.logo}>
            <Text style={styles.logoCross}>+</Text>
          </View>
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={styles.brand}>MediCode 健康</Text>
            <Text style={styles.brandSub}>您的贴身健康助手</Text>
          </View>
        </View>
        {isDemo ? (
          <View style={styles.demoPill}>
            <Text style={styles.demoPillText}>患者预览版 · 演示数据</Text>
          </View>
        ) : (
          <View style={styles.avatarSm}>
            <Text style={styles.avatarSmText}>{name[0]}</Text>
          </View>
        )}
      </View>

      {/* 问候区 */}
      <View style={styles.greetRow}>
        <View>
          <Text style={styles.eyebrow}>YOUR HEALTH SPACE</Text>
          <Text style={styles.greeting}>您好，{name}</Text>
        </View>
        <Text style={styles.greetTip}>今天也照顾好自己</Text>
      </View>

      {/* 浅绿渐变卡 */}
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>让就医更简单，</Text>
          <Text style={styles.heroTitle}>让关怀更贴近。</Text>
          <Text style={styles.heroSub}>您的预约与就诊信息，随时清晰可见。</Text>
        </View>
        <View style={styles.heroIconCard}>
          <Text style={styles.heroCross}>+</Text>
        </View>
      </View>

      {/* 快捷入口 */}
      <View style={styles.quickRow}>
        {quick.map((q) => (
          <TouchableOpacity key={q.title} style={styles.quickItem} onPress={() => navigation.navigate(q.screen)}>
            <View style={[styles.quickIcon, { backgroundColor: q.bg }]}>
              <Text style={{ fontSize: 20 }}>{q.icon}</Text>
            </View>
            <Text style={styles.quickTitle}>{q.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 我的预约 */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>我的预约</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{appt?.status || "待就诊"}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.sm }}>
          <View style={styles.docAvatar}>
            <Text style={styles.docAvatarText}>{(appt?.doctor_name || "陈")[0]}</Text>
          </View>
          <View style={{ marginLeft: spacing.sm, flex: 1 }}>
            <Text style={styles.docName}>
              {appt?.doctor_name || "陈医生"}
              <Text style={styles.docTitle}>  主治医师</Text>
            </Text>
            <Text style={styles.docDept}>{appt?.department || "全科医学科 · 普通门诊"}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📅</Text>
          <Text style={styles.infoText}>{appt?.date || "—"}  {appt?.time_slot || ""}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>🏠</Text>
          <Text style={styles.infoText}>{appt?.place || "门诊楼 2 层 · 全科诊区"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>👤</Text>
          <Text style={styles.infoText}>就诊人：{appt?.patient_name || name}{isDemo ? " · 虚构档案" : ""}</Text>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btnGhost} onPress={() => navigation.navigate("预约")}>
            <Text style={styles.btnGhostText}>重新选择时段</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate("记录")}>
            <Text style={styles.btnPrimaryText}>查看报到指引 →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 就诊前的小提醒 */}
      <View style={styles.remindCard}>
        <Text style={styles.remindTitle}>就诊前的小提醒</Text>
        <Text style={styles.remindText}>请携带有效证件与既往检查资料。</Text>
        <Text style={styles.remindText}>请提前 15 分钟到达诊区。</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f7f6" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  logo: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" },
  logoCross: { color: "#fff", fontSize: 24, fontWeight: "700", lineHeight: 28 },
  brand: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  brandSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  avatarSm: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#e6f7f6", alignItems: "center", justifyContent: "center" },
  avatarSmText: { color: colors.teal, fontSize: 15, fontWeight: "700" },
  demoPill: { backgroundColor: "#fdf3dd", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  demoPillText: { color: "#b07a1f", fontSize: 10, fontWeight: "600" },
  greetRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: spacing.md, marginTop: spacing.sm },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: colors.textMuted, fontWeight: "600" },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.text, marginTop: 4 },
  greetTip: { fontSize: fontSize.sm, color: colors.textMuted },
  hero: {
    margin: spacing.md, borderRadius: radius.lg, padding: spacing.lg,
    backgroundColor: "#d9efec", flexDirection: "row", alignItems: "center",
  },
  heroTitle: { fontSize: 20, fontWeight: "700", color: colors.teal, lineHeight: 30 },
  heroSub: { fontSize: fontSize.sm, color: "#4e7e77", marginTop: spacing.sm },
  heroIconCard: {
    width: 76, height: 76, borderRadius: 16, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  heroCross: { color: colors.teal, fontSize: 46, fontWeight: "700", lineHeight: 52 },
  quickRow: { flexDirection: "row", paddingHorizontal: spacing.sm, marginTop: spacing.xs },
  quickItem: { flex: 1, alignItems: "center" },
  quickIcon: {
    width: 52, height: 52, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  quickTitle: { fontSize: fontSize.xs, color: colors.text },
  card: {
    marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.card,
    borderRadius: radius.lg, padding: spacing.md,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  pill: { backgroundColor: "#fdf3dd", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { color: "#b07a1f", fontSize: fontSize.xs, fontWeight: "600" },
  docAvatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#e6f7f6", alignItems: "center", justifyContent: "center" },
  docAvatarText: { color: colors.teal, fontSize: 19, fontWeight: "700" },
  docName: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
  docTitle: { fontSize: fontSize.xs, fontWeight: "400", color: colors.textMuted },
  docDept: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  divider: {
    height: 0, borderStyle: "dashed", borderWidth: 0.6, borderColor: "#d7e3e1",
    marginVertical: spacing.sm,
  },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  infoIcon: { width: 24, fontSize: 13 },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
  btnRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  btnGhost: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 12, alignItems: "center", backgroundColor: "#fff",
  },
  btnGhostText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600" },
  btnPrimary: { flex: 1, backgroundColor: colors.teal, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  btnPrimaryText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600" },
  remindCard: {
    marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.card,
    borderRadius: radius.lg, padding: spacing.md,
  },
  remindTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text, marginBottom: 6 },
  remindText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 21 },
});
