/**
 * 员工端 —— 患者列表（Apple Store iOS 版式）
 * 大标题 → iOS 搜索框 → 分组列表
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { colors, spacing, shadow, request, Paged } from "@medicode/shared";

const GUTTER = 20;

export default function PatientsScreen({ navigation }: any) {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (kw = keyword) => {
    setLoading(true);
    try {
      const res = await request<Paged<any>>(
        `/api/patients?page=1&page_size=50${kw ? `&keyword=${encodeURIComponent(kw)}` : ""}`
      );
      setList(res.items || []);
      setTotal(res.total || 0);
    } catch {
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load("");
  }, []);

  return (
    <View style={styles.container}>
      {/* 大标题 */}
      <View style={styles.titleBlock}>
        <Text style={styles.largeTitle}>患者</Text>
        <Text style={styles.titleSub}>共 {total} 名建档患者，点按进入档案。</Text>
      </View>

      {/* iOS 搜索框 */}
      <View style={styles.searchWrap}>
        <View style={styles.searchField}>
          <View style={styles.magnifier}>
            <View style={styles.magGlass} />
            <View style={styles.magHandle} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索姓名或手机号"
            placeholderTextColor={colors.textMuted}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => load(keyword)}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 130 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(keyword); }}
              tintColor={colors.textMuted}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate("PatientDetail", { id: item.id, name: item.name })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.name || "?")[0]}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name || "未命名"}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.gender ? `${item.gender} · ` : ""}
                  {item.phone || "无手机号"}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyGlyph}>◉</Text>
              <Text style={styles.emptyTitle}>没有找到患者</Text>
              <Text style={styles.emptyDesc}>
                {keyword ? `没有匹配「${keyword}」的患者` : "还没有建档患者"}
              </Text>
            </View>
          }
        />
      )}
    </View>
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
  titleSub: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },

  searchWrap: { paddingHorizontal: GUTTER, paddingTop: spacing.md, paddingBottom: spacing.md },
  searchField: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#EBEBEF", borderRadius: 11, paddingHorizontal: 10, height: 37,
  },
  searchGlyph: { fontSize: 16, color: colors.textMuted, marginRight: 6, marginTop: -1 },
  magnifier: { width: 14, height: 14, marginRight: 6, alignItems: "center", justifyContent: "center" },
  magGlass: {
    width: 9, height: 9, borderRadius: 5, borderWidth: 1.6,
    borderColor: colors.textMuted, marginTop: -1, marginLeft: -1,
  },
  magHandle: {
    position: "absolute", right: 0, bottom: 2,
    width: 5, height: 1.6, borderRadius: 1,
    backgroundColor: colors.textMuted, transform: [{ rotate: "45deg" }],
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },

  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.card, borderRadius: 18, padding: 14, ...shadow.card,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 18, color: colors.textMuted, marginLeft: 8 },

  emptyBox: { alignItems: "center", marginTop: 56, paddingHorizontal: 30 },
  emptyGlyph: { fontSize: 30, color: colors.textMuted, opacity: 0.45, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  emptyDesc: { fontSize: 13, color: colors.textMuted, marginTop: 5, textAlign: "center" },
});
