import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import C from '@/constants/colors';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = username.trim().length > 0 && password.length > 0 && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Branding */}
        <View style={styles.branding}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.appName}>P:um</Text>
          <Text style={styles.appSub}>피움 · 부산대학교 학생 생활 앱</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {!!error && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="아이디"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPw}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eyeBtn}>
                <Feather name={showPw ? 'eye' : 'eye-off'} size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, !canSubmit && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.loginBtnText}>로그인</Text>
            }
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerHint}>계정이 없으신가요? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.registerLink}>회원가입</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  branding: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  logoWrapper: {
    width: 96, height: 96, borderRadius: 28, overflow: 'hidden',
    marginBottom: 20, backgroundColor: '#eef0f3',
    shadowColor: '#04346E', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 8,
  },
  logo: { width: '100%', height: '100%' },
  appName: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: -0.5 },
  appSub: { fontSize: 13, color: '#6B7280', marginTop: 4, fontFamily: 'Inter_400Regular' },
  form: { gap: 12, paddingBottom: 8 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#EF4444', flex: 1, fontFamily: 'Inter_400Regular' },
  inputGroup: { gap: 10 },
  input: {
    backgroundColor: '#F3F4F6', borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular',
  },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  loginBtn: {
    backgroundColor: C.primary, borderRadius: 16,
    paddingVertical: 17, alignItems: 'center', marginTop: 4,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  loginBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  loginBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', paddingTop: 4 },
  registerHint: { fontSize: 14, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  registerLink: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primary },
});
