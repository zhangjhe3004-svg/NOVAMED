/**
 * 患者端 —— 个人中心（Apple Store iOS 版式）
 * 大标题 → 账户卡（头像+姓名） → 功能分组列表 → 个人资料分组 → 退出
 */
import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { colors, spacing, shadow } from "@medicode/shared";
import { usePatientAuth } from "../auth";
import { PersonIcon, PeopleIcon, LockIcon, CalIcon } from "../icons";

const GUTTER = 20;

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
    { title: "个人资料", desc: "身份与联系方式", Icon: PersonIcon, fg: colors.brandTeal, action: () => setShowInfo((v) => !v) },
    { title: "就诊人管理", desc: "为家人添加就诊人", Icon: PeopleIcon, fg: colors.primary, action: () => Alert.alert("提示", "本页暂未开放，敬请期待") },
    { title: "账号与密码", desc: "登录与安全设置", Icon: LockIcon, fg: "#FF9500", action: () => Alert.alert("提示", "本页暂未开放，敬请期待") },
    { title: "预约管理", desc: "查看与取消预约", Icon: CalIcon, fg: colors.primary, action: () => Alert.alert("提示", "请在「预约」页查看和管理预约") },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 130 }}>
      {/* 大标题 */}
      <View style={styles.titleBlock}>
        <Text style={styles.largeTitle}>我的</Text>
      </View>

      {/* 账户卡 */}
      <View style={styles.accountCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name[0]}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.nameSub} numberOfLines={1}>
            {user?.phone && user.phone !== name ? `${user.phone} · 已登录` : "账号已登录"}
          </Text>
        </View>
      </View>

      {/* 功能分组 */}
      <Text style={styles.groupLabel}>服务</Text>
      <View style={styles.groupCard}>
        {menus.map((m, i) => (
          <TouchableOpacity
            key={m.title}
            style={[styles.row, i < menus.length - 1 && styles.rowDivider]}
            onPress={m.action}
            activeOpacity={0.6}
          >
            <View style={styles.rowGlyph}>
              <m.Icon color={m.fg} />
            </View>
            <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{m.title}</Text>
              <Text style={styles.rowDesc} numberOfLines={1}>{m.desc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 个人资料（可展开） */}
      {showInfo && (
        <>
          <Text style={styles.groupLabel}>个人资料</Text>
          <View style={styles.groupCard}>
            {rows.map(([k, v], i) => (
              <View key={k} style={[styles.infoRow, i < rows.length - 1 && styles.rowDivider]}>
                <Text style={styles.infoKey}>{k}</Text>
                <Text style={styles.infoVal} numberOfLines={2}>{v}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* 关于 + 退出 */}
      <Text style={styles.groupLabel}>关于</Text>
      <View style={styles.groupCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>版本</Text>
          <Text style={styles.infoVal}>NOVAMED 健康 1.0.0</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logout} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>让就医更简单，让关怀更贴近。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  titleBlock: { paddingHorizontal: GUTTER, paddingTop: spacing.md },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, color: colors.textMuted, fontWeight: "700" },
  largeTitle: {
    fontSize: 34, fontWeight: "700", color: colors.text,
    letterSpacing: -0.9, lineHeight: 41, marginTop: 2,
  },

  accountCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: GUTTER, marginTop: spacing.lg,
    backgroundColor: colors.card, borderRadius: 18, padding: 16, ...shadow.card,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tealLight,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: colors.brandTeal, fontSize: 22, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  nameSub: { fontSize: 12, color: colors.textMuted, marginTop: 3 },

  groupLabel: {
    fontSize: 12, fontWeight: "600", color: colors.textMuted,
    letterSpacing: 0.4, textTransform: "uppercase",
    paddingHorizontal: GUTTER, marginTop: 26, marginBottom: 8,
  },
  groupCard: {
    marginHorizontal: GUTTER, backgroundColor: colors.card,
    borderRadius: 18, overflow: "hidden", ...shadow.card,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  rowGlyph: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: colors.tealLight,
    alignItems: "center", justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "500", color: colors.text },
  rowDesc: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  chevron: { fontSize: 18, color: colors.textMuted, marginLeft: 8 },

  infoRow: {
    flexDirection: "row", alignItems: "flex-start",
    paddingVertical: 12, paddingHorizontal: 16,
  },
  infoKey: { width: 78, fontSize: 14, color: colors.textSecondary },
  infoVal: { flex: 1, fontSize: 14, color: colors.text, textAlign: "right" },

  logout: {
    marginHorizontal: GUTTER, marginTop: 24,
    backgroundColor: colors.card, borderRadius: 18,
    paddingVertical: 14, alignItems: "center", ...shadow.card,
  },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: "600" },

  footer: {
    textAlign: "center", fontSize: 11, color: colors.textMuted,
    marginTop: 20, letterSpacing: 0.2,
  },
});
