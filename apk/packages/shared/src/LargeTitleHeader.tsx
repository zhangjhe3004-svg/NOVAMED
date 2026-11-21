/**
 * Apple Store 风格大标题页头（Android 上 headerLargeTitle 不生效，统一改为页内实现）
 * 左上圆形返回按钮 + 大标题（34pt/-0.9）+ 可选副标题与右侧动作
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "./theme";

export interface LargeTitleHeaderProps {
  title: string;
  subtitle?: string;
  /** 右上角动作（如「全部已读」） */
  right?: { label: string; onPress: () => void };
  /** 是否显示返回按钮（详情页 true，首页 false） */
  back?: boolean;
  /** 返回按钮与图标颜色 */
  tint?: string;
}

export function LargeTitleHeader({ title, subtitle, right, back = false, tint = colors.primary }: LargeTitleHeaderProps) {
  const navigation = useNavigation();

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {back ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="返回"
            onPress={() => navigation.goBack()}
            hitSlop={10}
            activeOpacity={0.6}
            style={styles.backBtn}
          >
            <Text style={[styles.backChevron, { color: tint }]}>‹</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        {right ? (
          <TouchableOpacity onPress={right.onPress} hitSlop={8} activeOpacity={0.6}>
            <Text style={[styles.rightText, { color: tint }]}>{right.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  topRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    minHeight: 40,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  backChevron: { fontSize: 24, fontWeight: "600", marginTop: -2 },
  rightText: { fontSize: 14, fontWeight: "600" },
  title: {
    fontSize: 34, fontWeight: "700", color: colors.text,
    letterSpacing: -0.9, lineHeight: 41, marginTop: 4,
  },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 4, lineHeight: 21 },
});
