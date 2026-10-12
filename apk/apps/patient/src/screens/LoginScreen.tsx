/**
 * 患者端登录页（对照设计稿 14-患者手机登录）
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
import { colors, spacing, radius, fontSize, request, PatientTokenResponse } from "@medicode/shared";
import { usePatientAuth } from "../auth";

export default function LoginScreen() {
  const { signIn } = usePatientAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const doLogin = async (account: string, pwd: string) => {
    if (!account.trim() || !pwd.trim()) {
      Alert.alert("提示", "请输入账号和密码");
      return;
    }
    setLoading(true);
    try {
      const res = await request<PatientTokenResponse>("/api/patient-auth/login", {
        method: "POST",
        body: { phone: account.trim(), password: pwd },
        auth: false,
      });
      const profile = res.patient || res.profile || ({} as any);
      await signIn(res.access_token, profile);
    } catch (e: any) {
      Alert.alert("登录失败", e.detail || e.message || "请检查账号和密码");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => doLogin(phone, password);
  const handleDemo = () => doLogin("admin", "admin");

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          {/* 品牌区 */}
          <View style={styles.logoRow}>
            <View style={styles.logo}>
              <Text style={styles.logoCross}>+</Text>
            </View>
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={styles.title}>MediCode</Text>
              <Text style={styles.brandSub}>SMART MEDICAL SYSTEM</Text>
            </View>
          </View>

          <Text style={styles.slogan}>每一步就医，都更安心。</Text>
          <Text style={styles.sloganSub}>从预约到就诊，让重要信息触手可及。</Text>
          <Text style={styles.sloganSub}>简单清晰的指引，陪伴每一次健康之旅。</Text>

          {/* 表单区 */}
          <View style={styles.form}>
            <Text style={styles.h2}>欢迎来到健康空间</Text>
            <Text style={styles.h2Sub}>预约、报到、就诊记录，一处轻松管理。</Text>

            <Text style={styles.label}>患者账号 / 手机号</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入患者账号或手机号"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <Text style={styles.label}>登录密码</Text>
            <View style={styles.pwdWrap}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0, paddingVertical: 12 }]}
                placeholder="请输入密码"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
              />
              <TouchableOpacity style={{ paddingHorizontal: spacing.md }} onPress={() => setShowPwd((v) => !v)}>
                <Text style={styles.showBtn}>{showPwd ? "隐藏" : "显示"}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rememberRow}>
              <TouchableOpacity style={styles.checkbox} onPress={() => setRemember((v) => !v)}>
                <View style={[styles.checkboxBox, remember && { backgroundColor: colors.teal, borderColor: colors.teal }]}>
                  {remember ? <Text style={{ color: "#fff", fontSize: 11, lineHeight: 13 }}>✓</Text> : null}
                </View>
                <Text style={styles.rememberText}>保持登录状态</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("提示", "请联系管理员重置密码")}>
                <Text style={styles.forgot}>忘记密码?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>进入我的健康空间 →</Text>
              )}
            </TouchableOpacity>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>快速预览，无需真实账号</Text>
              <View style={styles.orLine} />
            </View>

            <TouchableOpacity style={styles.demoBtn} onPress={handleDemo} disabled={loading}>
              <Text style={styles.demoBtnText}>使用演示身份进入</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.foot}>MediCode 全域智慧医疗系统</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f2f7f6" },
  container: { flex: 1 },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  logo: { width: 52, height: 52, borderRadius: 13, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" },
  logoCross: { color: "#fff", fontSize: 30, fontWeight: "700", lineHeight: 34 },
  title: { fontSize: fontSize.title, fontWeight: "700", color: colors.text },
  brandSub: { fontSize: 10, letterSpacing: 1.5, color: colors.textMuted, marginTop: 2 },
  slogan: { fontSize: 26, fontWeight: "700", color: colors.teal, lineHeight: 36 },
  sloganSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  form: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl },
  h2: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  h2Sub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
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
    marginBottom: 4,
  },
  pwdWrap: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: "#fff",
  },
  showBtn: { color: colors.teal, fontSize: fontSize.sm, fontWeight: "600" },
  rememberRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  checkbox: { flexDirection: "row", alignItems: "center" },
  checkboxBox: {
    width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  rememberText: { fontSize: fontSize.sm, color: colors.textSecondary, marginLeft: 6 },
  forgot: { fontSize: fontSize.sm, color: colors.teal, fontWeight: "600" },
  button: {
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "600" },
  orRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  orText: { fontSize: fontSize.xs, color: colors.textMuted, marginHorizontal: spacing.sm },
  demoBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 13, alignItems: "center", marginTop: spacing.md, backgroundColor: "#fff",
  },
  demoBtnText: { color: colors.text, fontSize: fontSize.md, fontWeight: "600" },
  foot: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
});
