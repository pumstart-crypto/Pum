import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator,
  Modal, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

// ── 아이디 찾기 모달 ──────────────────────────────────────────
function FindIdModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'input' | 'verify' | 'result'>('input');
  const [name, setName] = useState('');
  const [emailLocal, setEmailLocal] = useState('');
  const [code, setCode] = useState('');
  const [foundId, setFoundId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');

  const emailOk = emailLocal.trim().length > 0;
  const fullEmail = `${emailLocal.trim().toLowerCase()}@pusan.ac.kr`;

  const reset = () => {
    setStep('input'); setName(''); setEmailLocal(''); setCode('');
    setFoundId(''); setError(''); setDevCode(''); setLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const sendVerification = async () => {
    setError(''); setLoading(true);
    try {
      const r = await fetch(`${API}/auth/find-id/send-verification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: fullEmail }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.message || '오류가 발생했습니다.'); return; }
      if (data.devCode) setDevCode(data.devCode);
      setStep('verify');
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  };

  const verifyCode = async () => {
    setError(''); setLoading(true);
    try {
      const r = await fetch(`${API}/auth/find-id/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: fullEmail, code }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.message || '인증에 실패했습니다.'); return; }
      setFoundId(data.username); setStep('result');
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sheet.overlay}>
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
        <View style={[sheet.container, { paddingBottom: insets.bottom + 24 }]}>
          <View style={sheet.handle} />

          <View style={sheet.titleRow}>
            <Text style={sheet.title}>아이디 찾기</Text>
            <TouchableOpacity onPress={handleClose} style={sheet.closeBtn}>
              <Feather name="x" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {!!error && (
            <View style={sheet.errorBox}>
              <Feather name="alert-circle" size={13} color="#EF4444" />
              <Text style={sheet.errorText}>{error}</Text>
            </View>
          )}

          {step === 'input' && (
            <>
              <Text style={sheet.label}>이름</Text>
              <TextInput style={sheet.input} value={name} onChangeText={setName}
                placeholder="실명을 입력하세요" placeholderTextColor="#9CA3AF" />
              <Text style={sheet.label}>부산대 웹메일</Text>
              <View style={sheet.emailRow}>
                <TextInput style={[sheet.input, sheet.emailLocalInput]} value={emailLocal}
                  onChangeText={setEmailLocal} placeholder="웹메일 주소" placeholderTextColor="#9CA3AF"
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                <View style={sheet.emailDomain}>
                  <Text style={sheet.emailDomainText}>@pusan.ac.kr</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[sheet.btn, (!name.trim() || !emailOk || loading) && sheet.btnDisabled]}
                onPress={sendVerification}
                disabled={!name.trim() || !emailOk || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={sheet.btnText}>인증번호 받기</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'verify' && (
            <>
              <View style={sheet.infoBox}>
                <Feather name="check-circle" size={14} color="#10B981" />
                <Text style={sheet.infoText}>{fullEmail}으로 인증번호를 발송했습니다.</Text>
              </View>
              {!!devCode && (
                <View style={sheet.devBox}>
                  <Text style={sheet.devLabel}>개발모드 인증번호</Text>
                  <Text style={sheet.devCode}>{devCode}</Text>
                </View>
              )}
              <Text style={sheet.label}>인증번호 6자리</Text>
              <TextInput style={sheet.input} value={code} onChangeText={setCode}
                placeholder="000000" placeholderTextColor="#9CA3AF"
                keyboardType="number-pad" maxLength={6} />
              <TouchableOpacity
                style={[sheet.btn, (code.length !== 6 || loading) && sheet.btnDisabled]}
                onPress={verifyCode} disabled={code.length !== 6 || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={sheet.btnText}>확인</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={sheet.retryBtn} onPress={() => { setStep('input'); setDevCode(''); setCode(''); setError(''); }}>
                <Text style={sheet.retryText}>다시 입력하기</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'result' && (
            <>
              <View style={sheet.resultBox}>
                <Feather name="user" size={28} color={C.primary} />
                <Text style={sheet.resultLabel}>회원님의 아이디</Text>
                <Text style={sheet.resultValue}>{foundId}</Text>
              </View>
              <TouchableOpacity style={sheet.btn} onPress={() => { handleClose(); }}>
                <Text style={sheet.btnText}>로그인하러 가기</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── 비밀번호 찾기 모달 ────────────────────────────────────────
function FindPasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'input' | 'verify' | 'reset' | 'done'>('input');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [emailLocal, setEmailLocal] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');

  const emailOk = emailLocal.trim().length > 0;
  const fullEmail = `${emailLocal.trim().toLowerCase()}@pusan.ac.kr`;

  const reset = () => {
    setStep('input'); setName(''); setUsername(''); setEmailLocal(''); setCode('');
    setResetToken(''); setNewPw(''); setNewPwConfirm('');
    setShowPw(false); setError(''); setDevCode(''); setLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const sendVerification = async () => {
    setError(''); setLoading(true);
    try {
      const r = await fetch(`${API}/auth/find-password/send-verification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), username: username.trim(), email: fullEmail }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.message || '오류가 발생했습니다.'); return; }
      if (data.devCode) setDevCode(data.devCode);
      setStep('verify');
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  };

  const verifyCode = async () => {
    setError(''); setLoading(true);
    try {
      const r = await fetch(`${API}/auth/find-password/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), username: username.trim(), email: fullEmail, code }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.message || '인증에 실패했습니다.'); return; }
      setResetToken(data.resetToken); setStep('reset');
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  };

  const resetPassword = async () => {
    if (newPw !== newPwConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    if (newPw.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    setError(''); setLoading(true);
    try {
      const r = await fetch(`${API}/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword: newPw }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.message || '비밀번호 변경에 실패했습니다.'); return; }
      setStep('done');
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  };

  const canSendVerification = name.trim() && username.trim() && emailOk && !loading;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sheet.overlay}>
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
        <View style={[sheet.container, { paddingBottom: insets.bottom + 24 }]}>
          <View style={sheet.handle} />

          <View style={sheet.titleRow}>
            <Text style={sheet.title}>비밀번호 찾기</Text>
            <TouchableOpacity onPress={handleClose} style={sheet.closeBtn}>
              <Feather name="x" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {!!error && (
            <View style={sheet.errorBox}>
              <Feather name="alert-circle" size={13} color="#EF4444" />
              <Text style={sheet.errorText}>{error}</Text>
            </View>
          )}

          {step === 'input' && (
            <>
              <Text style={sheet.label}>이름</Text>
              <TextInput style={sheet.input} value={name} onChangeText={setName}
                placeholder="실명을 입력하세요" placeholderTextColor="#9CA3AF" />
              <Text style={sheet.label}>아이디</Text>
              <TextInput style={sheet.input} value={username} onChangeText={setUsername}
                placeholder="아이디를 입력하세요" placeholderTextColor="#9CA3AF"
                autoCapitalize="none" autoCorrect={false} />
              <Text style={sheet.label}>부산대 웹메일</Text>
              <View style={sheet.emailRow}>
                <TextInput style={[sheet.input, sheet.emailLocalInput]} value={emailLocal}
                  onChangeText={setEmailLocal} placeholder="웹메일 주소" placeholderTextColor="#9CA3AF"
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                <View style={sheet.emailDomain}>
                  <Text style={sheet.emailDomainText}>@pusan.ac.kr</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[sheet.btn, (!canSendVerification) && sheet.btnDisabled]}
                onPress={sendVerification} disabled={!canSendVerification}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={sheet.btnText}>인증번호 받기</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'verify' && (
            <>
              <View style={sheet.infoBox}>
                <Feather name="check-circle" size={14} color="#10B981" />
                <Text style={sheet.infoText}>{fullEmail}으로 인증번호를 발송했습니다.</Text>
              </View>
              {!!devCode && (
                <View style={sheet.devBox}>
                  <Text style={sheet.devLabel}>개발모드 인증번호</Text>
                  <Text style={sheet.devCode}>{devCode}</Text>
                </View>
              )}
              <Text style={sheet.label}>인증번호 6자리</Text>
              <TextInput style={sheet.input} value={code} onChangeText={setCode}
                placeholder="000000" placeholderTextColor="#9CA3AF"
                keyboardType="number-pad" maxLength={6} />
              <TouchableOpacity
                style={[sheet.btn, (code.length !== 6 || loading) && sheet.btnDisabled]}
                onPress={verifyCode} disabled={code.length !== 6 || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={sheet.btnText}>확인</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={sheet.retryBtn} onPress={() => { setStep('input'); setDevCode(''); setCode(''); setError(''); }}>
                <Text style={sheet.retryText}>정보 다시 입력하기</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'reset' && (
            <>
              <Text style={sheet.label}>새 비밀번호 (8자 이상)</Text>
              <View style={sheet.pwWrap}>
                <TextInput style={[sheet.input, { paddingRight: 52 }]} value={newPw} onChangeText={setNewPw}
                  placeholder="새 비밀번호" placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPw} />
                <TouchableOpacity style={sheet.eyeBtn} onPress={() => setShowPw(v => !v)}>
                  <Feather name={showPw ? 'eye' : 'eye-off'} size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <Text style={sheet.label}>비밀번호 확인</Text>
              <TextInput style={sheet.input} value={newPwConfirm} onChangeText={setNewPwConfirm}
                placeholder="비밀번호 확인" placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPw} />
              <TouchableOpacity
                style={[sheet.btn, (newPw.length < 8 || newPw !== newPwConfirm || loading) && sheet.btnDisabled]}
                onPress={resetPassword} disabled={newPw.length < 8 || newPw !== newPwConfirm || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={sheet.btnText}>비밀번호 변경</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'done' && (
            <>
              <View style={sheet.resultBox}>
                <Feather name="check-circle" size={32} color="#10B981" />
                <Text style={sheet.resultLabel}>비밀번호가 변경되었습니다</Text>
                <Text style={sheet.resultSub}>새 비밀번호로 로그인해주세요</Text>
              </View>
              <TouchableOpacity style={sheet.btn} onPress={handleClose}>
                <Text style={sheet.btnText}>로그인하러 가기</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── 로그인 화면 ───────────────────────────────────────────────
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFindId, setShowFindId] = useState(false);
  const [showFindPw, setShowFindPw] = useState(false);

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
          <Image
            source={require('../assets/images/pium-logo-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appSub}>피움 · 더 나은 캠퍼스 라이프의 시작</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {!!error && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#FCA5A5" />
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
              ? <ActivityIndicator color={C.primary} />
              : <Text style={styles.loginBtnText}>로그인</Text>
            }
          </TouchableOpacity>

          {/* 아이디/비밀번호 찾기 */}
          <View style={styles.findRow}>
            <TouchableOpacity onPress={() => setShowFindId(true)}>
              <Text style={styles.findLink}>아이디 찾기</Text>
            </TouchableOpacity>
            <Text style={styles.findDivider}>|</Text>
            <TouchableOpacity onPress={() => setShowFindPw(true)}>
              <Text style={styles.findLink}>비밀번호 찾기</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.registerRow}>
            <Text style={styles.registerHint}>계정이 없으신가요? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.registerLink}>회원가입</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <FindIdModal visible={showFindId} onClose={() => setShowFindId(false)} />
      <FindPasswordModal visible={showFindPw} onClose={() => setShowFindPw(false)} />
    </KeyboardAvoidingView>
  );
}

// ── 로그인 화면 스타일 ─────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primary },
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  branding: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  logo: { width: 270, height: 270, marginBottom: 16 },
  appSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter_400Regular' },
  form: { gap: 12, paddingBottom: 8 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
  },
  errorText: { fontSize: 13, color: '#FCA5A5', flex: 1, fontFamily: 'Inter_400Regular' },
  inputGroup: { gap: 10 },
  input: {
    backgroundColor: '#F3F4F6', borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  loginBtn: {
    backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 17, alignItems: 'center', marginTop: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 4,
  },
  loginBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.3)', shadowOpacity: 0 },
  loginBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.primary },
  findRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 2 },
  findLink: { fontSize: 13, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.75)' },
  findDivider: { fontSize: 13, color: 'rgba(255,255,255,0.35)' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', paddingTop: 2 },
  registerHint: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter_400Regular' },
  registerLink: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
});

// ── 모달 공통 스타일 ───────────────────────────────────────────
const sheet = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  container: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, gap: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827' },
  closeBtn: { padding: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280', marginBottom: -4 },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emailLocalInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  emailDomain: {
    paddingHorizontal: 12,
    paddingVertical: 15,
    backgroundColor: '#E5E9EF',
    borderLeftWidth: 1,
    borderLeftColor: '#D1D5DB',
    justifyContent: 'center',
  },
  emailDomainText: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'Inter_600SemiBold',
  },
  input: {
    backgroundColor: '#F3F4F6', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 15,
    fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  btn: {
    backgroundColor: C.primary, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  retryBtn: { alignItems: 'center', paddingVertical: 4 },
  retryText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#EF4444', flex: 1, fontFamily: 'Inter_400Regular' },
  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  infoText: { fontSize: 13, color: '#15803D', flex: 1, fontFamily: 'Inter_400Regular' },
  resultBox: {
    alignItems: 'center', paddingVertical: 24, gap: 8,
  },
  resultLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#6B7280', marginTop: 4 },
  resultValue: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 0.5 },
  resultSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#6B7280' },
  pwWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  devBox: {
    backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FED7AA', alignItems: 'center', gap: 4,
  },
  devLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#9A3412', letterSpacing: 0.5 },
  devCode: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#EA580C', letterSpacing: 4 },
});
