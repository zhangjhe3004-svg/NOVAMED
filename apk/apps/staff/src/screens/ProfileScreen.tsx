/**
 * 员工端 —— 我的（Apple Store iOS 版式）
 * 大标题 → 账户卡 → 身份信息分组 → 退出
 */
import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { colors, spacing, shadow } from "@medicode/shared";
import { useStaffAuth } from "../auth";
import BrandMark from "../BrandMark";

const GUTTER = 20;

/** 后端角色代码 → 中文称谓 */
const ROLE_LABEL: Record<string, string> = {
  admin: "系统管理员",
  super_admin: "超级管理员",
  senior: "高级职称",
  doctor: "医师",
  nurse: "护士",
  pharmacist: "药师",
  maintainer: "运维",
  staff: "员工",
};
const roleLabel = (r?: string | null) =>
  r ? ROLE_LABEL[String(r).toLowerCase()] || String(r) : "员工";

export default function ProfileScreen({ navigation }: any) {
  const { user, signOut } = useStaffAuth();

  const handleLogout = () => {
    Alert.alert("退出登录", "确定要退出当前账号吗？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const rows: [string, string][] = [
    ["用户名", user?.username || "—"],
    ["姓名", user?.real_name || "—"],
    ["角色", roleLabel(user?.role)],
    ["科室", user?.department || "—"],
    ["职称", user?.title || "—"],
    ["工号", user?.employee_no || "—"],
    ["在岗状态", user?.work_status || "—"],
  ];

  const displayName = user?.real_name || user?.username || "医生";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 130 }}>
      {/* 大标题 */}
      <View style={styles.titleBlock}>
        <Text style={styles.largeTitle}>我的</Text>
      </View>

      {/* 账户卡 */}
      <View style={styles.accountCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName[0]}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.role} numberOfLines={1}>
            {[user?.title, user?.department].filter(Boolean).join("  ·  ") || "NOVAMED 员工"}
          </Text>
        </View>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>{roleLabel(user?.role)}</Text>
        </View>
      </View>

      {/* 身份信息 */}
      <Text style={styles.groupLabel}>身份信息</Text>
      <View style={styles.groupCard}>
        {rows.map(([k, v], i) => (
          <View key={k} style={[styles.infoRow, i < rows.length - 1 && styles.rowDivider]}>
            <Text style={styles.infoKey}>{k}</Text>
            <Text style={styles.infoVal} numberOfLines={1}>{v}</Text>
          </View>
        ))}
      </View>

      {/* 关于 */}
      <Text style={styles.groupLabel}>关于</Text>
      <View style={styles.groupCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>版本</Text>
          <Text style={styles.infoVal}>NOVAMED 员工端 1.0.0</Text>
        </View>
        <View style={[styles.infoRow, styles.rowDivider, { alignItems: "center" }]}>
          <Text style={styles.infoKey}>品牌</Text>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
            <BrandMark size={20} on="light" />
            <Text style={[styles.infoVal, { flex: 0, marginLeft: 6 }]}>NOVAMED</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logout} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>NOVA MEDICAL SYSTEM</Text>
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
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontSize: 22, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  role: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  rolePill: {
    backgroundColor: colors.primaryLight, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8,
  },
  rolePillText: { fontSize: 11, fontWeight: "600", color: colors.primary },

  groupLabel: {
    fontSize: 12, fontWeight: "600", color: colors.textMuted,
    letterSpacing: 0.4, textTransform: "uppercase",
    paddingHorizontal: GUTTER, marginTop: 26, marginBottom: 8,
  },
  groupCard: {
    marginHorizontal: GUTTER, backgroundColor: colors.card,
    borderRadius: 18, overflow: "hidden", ...shadow.card,
  },
  infoRow: {
    flexDirection: "row", alignItems: "flex-start",
    paddingVertical: 12, paddingHorizontal: 16,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  infoKey: { width: 78, fontSize: 14, color: colors.textSecondary },
  infoVal: { flex: 1, fontSize: 14, color: colors.text, textAlign: "right" },

  logout: {
    marginHorizontal: GUTTER, marginTop: 24,
    backgroundColor: colors.card, borderRadius: 18,
    paddingVertical: 14, alignItems: "center", ...shadow.card,
  },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: "600" },

  footer: {
    textAlign: "center", fontSize: 10, color: colors.textMuted,
    marginTop: 20, letterSpacing: 1.4, fontWeight: "600",
  },
});
