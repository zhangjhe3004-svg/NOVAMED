/**
 * 患者端 —— 个人中心（对照设计稿 13-患者个人中心）
 */
import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { colors, spacing, radius, fontSize } from "@medicode/shared";
import { usePatientAuth } from "../auth";

export default function ProfileScreen() {
  const { user, signOut } = usePatientAuth();
  const [showInfo, setShowInfo] = useState(false);

  const handleLogout = () => {
    Alert.alert("退出登录", "确定要退出当前账号吗？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const name = user?.name || user?.phone || "患者";
  const rows: [string, string][] = [
    ["姓名", user?.name || "—"],
    ["性别", user?.gender || "—"],
    ["手机号", user?.phone || "—"],
    ["证件号", user?.id_number || user?.id_card || "—"],
    ["出生日期", user?.birth_date || "—"],
    ["地址", user?.address || "—"],
    ["过敏史", user?.medical_history || "—"],
  ];

  const menus = [
    { title: "个人资料", action: () => setShowInfo((v) => !v) },
    { title: "就诊人管理", action: () => Alert.alert("提示", "本页暂未开放，敬请期待") },
    { title: "账号与密码", action: () => Alert.alert("提示", "本页暂未开放，敬请期待") },
    { title: "预约管理", action: () => Alert.alert("提示", "请在「预约」页查看和管理预约") },
    { title: "帮助与说明", action: () => Alert.alert("MediCode 健康", "你的贴身健康助手。\n预约、报到、就诊记录，一处轻松管理。") },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
      <Text style={styles.eyebrow}>MY ACCOUNT</Text>
      <Text style={styles.h1}>我的健康空间</Text>
      <Text style={styles.hSub}>个人信息与服务</Text>

      <View style={styles.card}>
        {/* 个人卡 */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name[0]}</Text>
          </View>
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.nameSub}>{user?.phone ? `${user.phone} · 未绑定真实身份` : "患者演示账号 · 未绑定真实身份"}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* 菜单列表 */}
        {menus.map((m, i) => (
          <TouchableOpacity key={m.title} style={styles.menuRow} onPress={m.action} activeOpacity={0.7}>
            <Text style={styles.menuText}>{m.title}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        {/* 个人资料展开区 */}
        {showInfo && (
          <View style={styles.infoBox}>
            {rows.map(([k, v]) => (
              <View key={k} style={styles.infoRow}>
                <Text style={styles.infoKey}>{k}</Text>
                <Text style={styles.infoVal}>{v}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Text style={styles.logoutText}>退出演示，返回患者登录</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f7f6" },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: colors.textMuted, fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 4 },
  hSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  card: {
    marginTop: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#e6f7f6", alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.teal, fontSize: 23, fontWeight: "700" },
  name: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  nameSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 3 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  menuRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  menuText: { fontSize: fontSize.md, color: colors.text },
  chevron: { fontSize: 18, color: colors.textMuted },
  infoBox: { backgroundColor: "#f7fbfa", borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between", paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  infoKey: { fontSize: fontSize.sm, color: colors.textSecondary },
  infoVal: { fontSize: fontSize.sm, color: colors.text, flex: 1, textAlign: "right" },
  logout: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 12, alignItems: "center", marginTop: spacing.sm, backgroundColor: "#fff",
  },
  logoutText: { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: "600" },
});
