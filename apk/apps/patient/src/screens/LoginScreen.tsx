/**
 * 患者登录页 —— 参考 Web 客户端患者主题改造：
 * 深青 #194e50 品牌区（新星核 logo + 标语）+ 白色表单区（#27857d 主按钮）
 */
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius, fontSize, shadow, request, PatientTokenResponse } from "@medicode/shared";
import { usePatientAuth } from "../auth";
import BrandMark from "../BrandMark";

const TEAL_BG = "#194e50";

export default function LoginScreen() {
  const { signIn } = usePatientAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [focus, setFocus] = useState<"user" | "pwd" | null>(null);
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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* 深青品牌区（对齐客户端患者主题） */}
          <View style={styles.brandArea}>
            <View style={styles.logoRow}>
              <BrandMark size={40} on="dark" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.title}>NOVAMED</Text>
                <Text style={styles.brandSub}>SMART MEDICAL SYSTEM</Text>
              </View>
            </View>
            <Text style={styles.slogan}>每一步就医，</Text>
            <Text style={styles.slogan}>都更安心。</Text>
            <Text style={styles.sloganSub}>从预约到就诊，让重要信息触手可及。</Text>
            <Text style={styles.sloganSub}>简单清晰的指引，陪伴每一次健康之旅。</Text>
          </View>

          {/* 白色表单区 */}
          <View style={styles.formArea}>
            <Text style={styles.welcome}>欢迎来到健康空间</Text>
            <Text style={styles.welcomeSub}>预约、报到、就诊记录，一处轻松管理。</Text>

            <Text style={styles.label}>用户名</Text>
            <TextInput
              style={[styles.input, focus === "user" && styles.inputFocus]}
              placeholder="请输入用户名"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
              autoCorrect={false}
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

            <View style={styles.rememberRow}>
              <TouchableOpacity style={styles.checkbox} onPress={() => setRemember((v) => !v)} activeOpacity={0.6}>
                <View style={[styles.checkboxBox, remember && { backgroundColor: colors.brandTeal, borderColor: colors.brandTeal }]}>
                  {remember ? <Text style={{ color: "#fff", fontSize: 12, lineHeight: 15 }}>✓</Text> : null}
                </View>
                <Text style={styles.rememberText}>保持登录状态</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("提示", "请联系管理员重置密码")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.forgot}>忘记密码?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>进入我的健康空间</Text>}
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
    backgroundColor: TEAL_BG,
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
    borderColor: colors.brandTeal,
  },
  pwdWrap: {
    flexDirection: "row", alignItems: "center",
    borderRadius: radius.md, backgroundColor: "#F2F2F7",
  },
  pwdInput: { flex: 1, borderWidth: 0 },
  pwdToggle: { paddingHorizontal: spacing.md, paddingVertical: 13 },
  showBtn: { color: colors.brandTeal, fontSize: fontSize.sm, fontWeight: "600" },
  rememberRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  checkbox: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  checkboxBox: {
    width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  rememberText: { fontSize: fontSize.sm, color: colors.textSecondary, marginLeft: 8 },
  forgot: { fontSize: fontSize.sm, color: colors.brandTeal, fontWeight: "600" },
  button: {
    backgroundColor: colors.brandTeal,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "600" },
  foot: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.md, marginBottom: spacing.lg },
});
