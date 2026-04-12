import React, { useState, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Pressable, ScrollView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { loginWithCredentials, SchoolSession, SchoolAuthError } from '@/utils/schoolAuth';
import C from '@/constants/colors';

interface Props {
  visible: boolean;
  onSuccess: (session: SchoolSession) => void;
  onDismiss: () => void;
}

export default function SchoolLoginModal({ visible, onSuccess, onDismiss }: Props) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pwRef = useRef<TextInput>(null);

  const reset = () => { setId(''); setPw(''); setError(''); setShowPw(false); setLoading(false); };

  const handleDismiss = () => { reset(); onDismiss(); };

  const handleLogin = async () => {
    if (!id.trim() || !pw) { setError('학번과 비밀번호를 모두 입력해 주세요.'); return; }
    setError('');
    setLoading(true);
    try {
      const session = await loginWithCredentials(id.trim(), pw);
      reset();
      onSuccess(session);
    } catch (e) {
      setError(e instanceof SchoolAuthError ? e.message : '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <Pressable style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.iconBox}>
                  <Ionicons name="library-outline" size={20} color={C.primary} />
                </View>
                <View>
                  <Text style={styles.title}>도서관 로그인</Text>
                  <Text style={styles.subtitle}>학교 포털 계정으로 로그인하세요</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleDismiss} hitSlop={12}>
                <Feather name="x" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              {/* Security notice */}
              <View style={styles.noticeBox}>
                <Feather name="shield" size={13} color="#059669" style={{ marginTop: 1 }} />
                <Text style={styles.noticeText}>
                  입력하신 정보는 인증에만 사용되며 기기에 저장되지 않습니다.
                </Text>
              </View>

              {/* Inputs */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>학번</Text>
                <TextInput
                  style={styles.input}
                  value={id}
                  onChangeText={v => { setId(v); setError(''); }}
                  placeholder="학번을 입력하세요"
                  placeholderTextColor="#D1D5DB"
                  keyboardType="default"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => pwRef.current?.focus()}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호</Text>
                <View style={styles.pwRow}>
                  <TextInput
                    ref={pwRef}
                    style={[styles.input, styles.pwInput]}
                    value={pw}
                    onChangeText={v => { setPw(v); setError(''); }}
                    placeholder="비밀번호를 입력하세요"
                    placeholderTextColor="#D1D5DB"
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPw(v => !v)}
                    hitSlop={8}
                  >
                    <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Error */}
              {!!error && (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={13} color="#DC2626" style={{ marginTop: 1 }} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Login button */}
              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.loginBtnText}>로그인</Text>
                }
              </TouchableOpacity>

              <Text style={styles.hint}>
                학교 포털(portal.pusan.ac.kr)과 동일한 계정을 사용합니다.
              </Text>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  kav: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: `${C.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 1, fontFamily: 'Inter_400Regular' },

  noticeBox: {
    flexDirection: 'row', gap: 6, alignItems: 'flex-start',
    backgroundColor: '#ECFDF5', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 18,
  },
  noticeText: { flex: 1, fontSize: 12, color: '#065F46', lineHeight: 17, fontFamily: 'Inter_400Regular' },

  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, fontFamily: 'Inter_600SemiBold' },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA',
    fontFamily: 'Inter_400Regular',
  },
  pwRow: { position: 'relative' },
  pwInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute', right: 14, top: 0, bottom: 0,
    justifyContent: 'center',
  },

  errorBox: {
    flexDirection: 'row', gap: 6, alignItems: 'flex-start',
    backgroundColor: '#FEF2F2', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 14,
  },
  errorText: { flex: 1, fontSize: 12, color: '#DC2626', lineHeight: 17, fontFamily: 'Inter_400Regular' },

  loginBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  hint: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', fontFamily: 'Inter_400Regular' },
});
