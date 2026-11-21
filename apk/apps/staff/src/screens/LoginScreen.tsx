/**
 * 员工登录页 —— 参考 Web 客户端登录页改造：
 * 深海军蓝 #142d53 品牌区（新星核 logo + NOVAMED 字标 + 标语）
 * + 白色表单区（blue-600 主按钮），Corporate Clean 蓝白体系
 */
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius, fontSize, request, TokenResponse } from "@medicode/shared";
import { useStaffAuth } from "../auth";
import BrandMark from "../BrandMark";

const NAVY = "#142d53";

export default function LoginScreen() {
  const { signIn } = useStaffAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [focus, setFocus] = useState<"user" | "pwd" | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("提示", "请输入账号和密码");
      return;
    }
    setLoading(true);
    try {
      const res = await request<TokenResponse>("/api/auth/login", {
        method: "POST",
        body: { username: username.trim(), password },
        auth: false,
      });
      await signIn(res.access_token, res.user);
    } catch (e: any) {
      Alert.alert("登录失败", e.detail || e.message || "请检查账号密码");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* 深海军蓝品牌区（对齐客户端登录页） */}
          <View style={styles.brandArea}>
            <View style={styles.logoRow}>
              <BrandMark size={40} on="dark" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.title}>NOVAMED</Text>
                <Text style={styles.brandSub}>SMART MEDICAL SYSTEM</Text>
              </View>
            </View>
            <Text style={styles.slogan}>让信息有序，</Text>
            <Text style={styles.slogan}>让诊疗更专注。</Text>
            <Text style={styles.sloganSub}>连接患者、诊疗与医学知识。</Text>
            <Text style={styles.sloganSub}>以清晰的工作空间，陪伴每一次专业判断。</Text>
          </View>

          {/* 白色表单区 */}
          <View style={styles.formArea}>
            <Text style={styles.welcome}>欢迎回到工作空间</Text>
            <Text style={styles.welcomeSub}>登录 NOVAMED，开启今天的诊疗工作。</Text>

            <Text style={styles.label}>员工账号</Text>
            <TextInput
              style={[styles.input, focus === "user" && styles.inputFocus]}
              placeholder="请输入员工账号"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              onFocus={() => setFocus("user")}
              onBlur={() => setFocus((f) => (f === "user" ? null : f))}
            />
            <Text style={styles.label}>登录密码</Text>
            <View style={[styles.pwdWrap, focus === "pwd" && styles.inputFocus]}>
              <TextInput
                style={[styles.input, styles.pwdInput]}
                placeholder="请输入密码"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                onFocus={() => setFocus("pwd")}
                onBlur={() => setFocus((f) => (f === "pwd" ? null : f))}
              />
              <TouchableOpacity style={styles.pwdToggle} onPress={() => setShowPwd((v) => !v)}>
                <Text style={styles.showBtn}>{showPwd ? "隐藏" : "显示"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>登录工作空间</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.foot}>NOVAMED 全域智慧医疗系统</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1 },
  brandArea: {
    backgroundColor: NAVY,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + 6,
    paddingBottom: spacing.xl + 8,
  },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  title: { fontSize: fontSize.xxl, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  brandSub: { fontSize: 9, letterSpacing: 1.5, color: "rgba(255,255,255,0.55)", marginTop: 2 },
  slogan: { fontSize: 26, fontWeight: "700", color: "#fff", lineHeight: 36 },
  sloganSub: { fontSize: fontSize.sm, color: "rgba(255,255,255,0.6)", marginTop: 6, lineHeight: 19 },
  formArea: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 24,
    marginTop: -20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + 4,
  },
  welcome: { fontSize: 21, fontWeight: "700", color: colors.text },
  welcomeSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: "#F2F2F7",
  },
  inputFocus: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  pwdWrap: {
    flexDirection: "row", alignItems: "center",
    borderRadius: radius.md, backgroundColor: "#F2F2F7",
  },
  pwdInput: { flex: 1, borderWidth: 0 },
  pwdToggle: { paddingHorizontal: spacing.md, paddingVertical: 13 },
  showBtn: { color: colors.primary, fontSize: fontSize.sm, fontWeight: "600" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "600" },
  foot: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.md, marginBottom: spacing.lg },
});
