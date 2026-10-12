/**
 * 员工端 —— 患者列表
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
} from "react-native";
import { colors, spacing, radius, fontSize, request, Paged } from "@medicode/shared";

export default function PatientsScreen({ navigation }: any) {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (kw = "") => {
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
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索姓名 / 手机号"
          placeholderTextColor={colors.textMuted}
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={() => load(keyword)}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => load(keyword)}>
          <Text style={{ color: "#fff" }}>搜索</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: spacing.md }}
          ListHeaderComponent={
            <Text style={styles.count}>共 {total} 名患者</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("PatientDetail", { id: item.id, name: item.name })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.name || "?")[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name || "未命名"}</Text>
                <Text style={styles.meta}>
                  {item.gender ? `${item.gender} · ` : ""}
                  {item.phone || "无手机号"}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>暂无患者数据</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBar: { flexDirection: "row", padding: spacing.md, gap: spacing.sm },
  searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSize.md,
    color: colors.text,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  count: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: { color: colors.primary, fontSize: fontSize.lg, fontWeight: "700" },
  name: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  meta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 60, fontSize: fontSize.md },
});
