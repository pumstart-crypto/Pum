import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

const getBaseUrl = () => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
};

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleNext = async () => {
    setError("");
    if (step === 1) {
      if (!username.trim() || !password || !confirmPw) {
        setError("모든 항목을 입력해주세요.");
        return;
      }
      if (!/^[a-zA-Z0-9]{4,20}$/.test(username)) {
        setError("아이디는 영문+숫자 4-20자리여야 합니다.");
        return;
      }
      if (password.length < 8) {
        setError("비밀번호는 8자 이상이어야 합니다.");
        return;
      }
      if (password !== confirmPw) {
        setError("비밀번호가 일치하지 않습니다.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `${getBaseUrl()}/api/auth/check-username?username=${username}`
        );
        const data = await res.json();
        if (!data.available) {
          setError("이미 사용 중인 아이디입니다.");
          return;
        }
        setStep(2);
      } catch {
        setError("서버 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    } else if (step === 2) {
      if (!name.trim() || !studentId.trim() || !department.trim()) {
        setError("모든 항목을 입력해주세요.");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!otpVerified) {
        setError("휴대폰 인증을 완료해주세요.");
        return;
      }
      await handleRegister();
    }
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      setError("휴대폰 번호를 입력해주세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "인증번호 발송에 실패했습니다.");
        return;
      }
      setOtpSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "인증번호가 올바르지 않습니다.");
        return;
      }
      setOtpVerified(true);
      setError("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("인증에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          name,
          studentId,
          department,
          phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "회원가입에 실패했습니다.");
        return;
      }
      await login(username, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = ["계정 정보", "학생 정보", "본인 인증"];
  const stepDescs = [
    "로그인에 사용할 정보를 입력해주세요",
    "학생 정보를 입력해주세요",
    "휴대폰 번호로 인증해주세요",
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => (step === 1 ? router.back() : setStep(step - 1))} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#111827" />
          </Pressable>
        </View>

        <View style={styles.stepInfo}>
          <View style={styles.stepDots}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[
                  styles.stepDot,
                  s === step
                    ? { backgroundColor: C.primary, width: 24 }
                    : s < step
                    ? { backgroundColor: C.primary, opacity: 0.4 }
                    : { backgroundColor: C.border },
                ]}
              />
            ))}
          </View>
          <Text style={styles.stepLabel}>
            {step}/3단계 · {stepTitles[step - 1]}
          </Text>
          <Text style={styles.stepTitle}>{stepDescs[step - 1]}</Text>
        </View>

        {step === 1 && (
          <View style={styles.form}>
            <InputField
              label="아이디"
              icon="user"
              placeholder="영문+숫자 4-20자"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={18} color={C.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="8자 이상"
                  placeholderTextColor={C.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                />
                <Pressable onPress={() => setShowPw((v) => !v)} style={{ padding: 4 }}>
                  <Feather name={showPw ? "eye-off" : "eye"} size={18} color={C.textSecondary} />
                </Pressable>
              </View>
            </View>
            <InputField
              label="비밀번호 확인"
              icon="lock"
              placeholder="비밀번호 재입력"
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
            <InputField label="이름" icon="user" placeholder="실명을 입력하세요" value={name} onChangeText={setName} />
            <InputField label="학번" icon="hash" placeholder="학번을 입력하세요" value={studentId} onChangeText={setStudentId} keyboardType="numeric" />
            <InputField label="학과" icon="book" placeholder="소속 학과를 입력하세요" value={department} onChangeText={setDepartment} />
          </View>
        )}

        {step === 3 && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>휴대폰 번호</Text>
              <View style={styles.inputWrap}>
                <Feather name="smartphone" size={18} color={C.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="010-0000-0000"
                  placeholderTextColor={C.textTertiary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!otpSent}
                />
                {!otpSent && (
                  <Pressable
                    onPress={handleSendOtp}
                    disabled={loading}
                    style={[styles.sendOtpBtn, { backgroundColor: C.primary }]}
                  >
                    <Text style={styles.sendOtpText}>발송</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {otpSent && !otpVerified && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>인증번호</Text>
                <View style={styles.inputWrap}>
                  <Feather name="key" size={18} color={C.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="6자리 인증번호"
                    placeholderTextColor={C.textTertiary}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <Pressable
                    onPress={handleVerifyOtp}
                    disabled={loading}
                    style={[styles.sendOtpBtn, { backgroundColor: C.accent }]}
                  >
                    <Text style={styles.sendOtpText}>확인</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {otpVerified && (
              <View style={styles.verifiedBox}>
                <Feather name="check-circle" size={16} color={C.accent} />
                <Text style={styles.verifiedText}>본인 인증이 완료되었습니다</Text>
              </View>
            )}
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color={C.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.nextBtn,
            { backgroundColor: C.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextBtnText}>
              {step === 3 ? "가입 완료" : "다음"}
            </Text>
          )}
        </Pressable>

        {step === 1 && (
          <Pressable style={styles.loginLink} onPress={() => router.back()}>
            <Text style={styles.loginLinkText}>
              이미 계정이 있으신가요?{" "}
              <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold" }}>로그인</Text>
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InputField({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: {
  label: string;
  icon: any;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  const C = Colors.light;
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Feather name={icon} size={18} color={C.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={placeholder}
          placeholderTextColor={C.textTertiary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    padding: 4,
  },
  stepInfo: {
    gap: 6,
  },
  stepDots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  stepDot: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },
  stepLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  stepTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#111827",
  },
  form: {
    gap: 14,
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
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#111827",
    height: 52,
  },
  sendOtpBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendOtpText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#fff",
  },
  verifiedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 10,
  },
  verifiedText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.light.accent,
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
  nextBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  loginLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  loginLinkText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#6B7280",
  },
});
