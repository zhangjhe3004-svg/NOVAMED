/**
 * 员工端登录页（对照设计稿 07-员工登录）
 * 深蓝品牌区（logo + 标语）+ 白色表单区
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius, fontSize, request, StaffUser, TokenResponse } from "@medicode/shared";
import { useStaffAuth } from "../auth";

export default function LoginScreen() {
  const { signIn } = useStaffAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* 深蓝品牌区 */}
          <View style={styles.brandArea}>
            <View style={styles.logoRow}>
              <View style={styles.logo}>
                <Text style={styles.logoCross}>+</Text>
              </View>
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={styles.title}>MediCode</Text>
                <Text style={styles.brandSub}>SMART MEDICAL SYSTEM</Text>
              </View>
            </View>
            <Text style={styles.eyebrow}>FOCUS ON CARE · CONNECT WITH CLARITY</Text>
            <Text style={styles.slogan}>让信息有序，</Text>
            <Text style={styles.slogan}>让诊疗更专注。</Text>
            <Text style={styles.sloganSub}>连接患者、诊疗与医学知识。</Text>
            <Text style={styles.sloganSub}>以清晰的工作空间，陪伴每一次专业判断。</Text>
          </View>

          {/* 白色表单区 */}
          <View style={styles.formArea}>
            <Text style={styles.welcome}>欢迎回到工作空间</Text>
            <Text style={styles.welcomeSub}>登录 MediCode，开启今天的诊疗工作。</Text>

            <Text style={styles.label}>员工账号</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入员工账号"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <Text style={styles.label}>登录密码</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入密码"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>登录工作空间 →</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.foot}>MediCode 全域智慧医疗系统</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1 },
  brandArea: {
    backgroundColor: "#0f2d52",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl + 8,
  },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  logo: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#2f6bff", alignItems: "center", justifyContent: "center" },
  logoCross: { color: "#fff", fontSize: 28, fontWeight: "700", lineHeight: 32 },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: "#fff" },
  brandSub: { fontSize: 9, letterSpacing: 1.5, color: "rgba(255,255,255,0.55)", marginTop: 2 },
  eyebrow: { fontSize: 9, letterSpacing: 2, color: "rgba(255,255,255,0.45)", marginBottom: spacing.sm },
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#2f6bff",
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "600" },
  foot: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.md, marginBottom: spacing.lg },
});
