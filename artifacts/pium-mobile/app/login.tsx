import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

const C = Colors.light;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "로그인에 실패했습니다.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Image
              source={require("@/assets/logo.png")}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.title}>P:um</Text>
          <Text style={styles.subtitle}>피움 · 부산대학교 학생 생활 앱</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>아이디</Text>
            <View style={styles.inputWrap}>
              <Feather name="user" size={18} color={C.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="아이디를 입력하세요"
                placeholderTextColor={C.textTertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                testID="username-input"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>비밀번호</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color={C.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="비밀번호를 입력하세요"
                placeholderTextColor={C.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                testID="password-input"
              />
              <Pressable onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn}>
                <Feather name={showPw ? "eye-off" : "eye"} size={18} color={C.textSecondary} />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={C.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.loginBtn,
              { backgroundColor: C.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleLogin}
            disabled={loading}
            testID="login-button"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>로그인</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.registerLink}
            onPress={() => router.push("/register")}
          >
            <Text style={styles.registerLinkText}>
              계정이 없으신가요?{" "}
              <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold" }}>
                회원가입
              </Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 32,
  },
  logoContainer: {
    alignItems: "center",
    gap: 8,
  },
  logoBox: {
    marginBottom: 8,
  },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: 22,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: "#00427d",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#627080",
    textAlign: "center",
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#374151",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#111827",
    height: 52,
  },
  eyeBtn: {
    padding: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#EF4444",
    flex: 1,
  },
  loginBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  loginBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  registerLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  registerLinkText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#6B7280",
  },
});
