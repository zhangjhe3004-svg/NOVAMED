/**
 * Apple Store 风格悬浮 Dock 底栏
 *
 * 参考 Apple Store iOS：白色胶囊 Dock 承载 4 个页签，
 * 当前项带浅色高亮块（图标 + 文字），右侧另有独立的圆形按钮（如搜索）。
 * 整个 Dock 悬浮在内容之上，内容从其下方穿过。
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors } from "./theme";

export interface DockExtraButton {
  /** 无障碍标签 */
  label: string;
  /** 圆形按钮里的字形 */
  glyph: React.ReactNode;
  onPress: () => void;
  /** 右上角数字角标 */
  badge?: number;
}

export interface DockTabBarProps extends BottomTabBarProps {
  /** 当前项高亮色（各端品牌色） */
  accent: string;
  /** 当前项高亮块背景（品牌色 10% 左右） */
  activeBg: string;
  /** 右侧圆形按钮 */
  extra: DockExtraButton;
}

export function DockTabBar({ state, descriptors, navigation, accent, activeBg, extra }: DockTabBarProps) {
  const insets = useSafeAreaInsets();
  const iconSize = 24;
  const labelStyle = { fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.1 };

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.row, { paddingBottom: insets.bottom + 10 }]}>
        {/* —— 胶囊 Dock —— */}
        <View style={styles.dock}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label =
              typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : typeof options.title === "string"
                  ? options.title
                  : route.name;

            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };
            const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                style={[styles.item, focused && { backgroundColor: activeBg }]}
              >
                <View style={{ height: iconSize, alignItems: "center", justifyContent: "center" }}>
                  {options.tabBarIcon?.({ focused, color: focused ? accent : colors.textSecondary, size: iconSize })}
                </View>
                <Text style={[labelStyle, { color: focused ? accent : colors.textSecondary }]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* —— 右侧独立圆形按钮 —— */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={extra.label}
          onPress={extra.onPress}
          activeOpacity={0.82}
          style={styles.circle}
        >
          {extra.glyph}
          {extra.badge != null && extra.badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{extra.badge > 99 ? "99+" : String(extra.badge)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  dock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 0,
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  badge: {
    position: "absolute",
    top: -1,
    right: -1,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
