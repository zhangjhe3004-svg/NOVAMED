/**
 * 员工端 —— 我的
 */
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { colors, spacing, radius, fontSize } from "@medicode/shared";
import { useStaffAuth } from "../auth";

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
    ["角色", user?.role || "—"],
    ["科室", user?.department || "—"],
    ["职称", user?.title || "—"],
    ["工号", user?.employee_no || "—"],
    ["在岗状态", user?.work_status || "—"],
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.real_name || user?.username || "?")[0]}</Text>
        </View>
        <Text style={styles.name}>{user?.real_name || user?.username}</Text>
        <Text style={styles.role}>{user?.role || ""}</Text>
      </View>

      <View style={styles.card}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.rowKey}>{k}</Text>
            <Text style={styles.rowVal}>{v}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.logout} onPress={handleLogout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: { alignItems: "center", paddingVertical: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: { color: colors.primary, fontSize: 28, fontWeight: "700" },
  name: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  role: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowKey: { fontSize: fontSize.sm, color: colors.textSecondary },
  rowVal: { fontSize: fontSize.md, color: colors.text },
  logout: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: colors.danger, fontSize: fontSize.lg, fontWeight: "600" },
});
