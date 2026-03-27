import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

type Step = 'account' | 'phone' | 'studentid' | 'done';
const STEPS: Step[] = ['account', 'phone', 'studentid', 'done'];
const STEP_LABELS = ['계정', '전화', '학생증', '완료'];

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { setAuth } = useAuth();
  const [step, setStep] = useState<Step>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Account step
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(false);

  // Phone step
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Student ID step
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [major, setMajor] = useState('');
  const [imageUri, setImageUri] = useState('');

  const idx = STEPS.indexOf(step);

  const pwOk = password.length >= 8;
  const pwMatch = password === passwordConfirm;
  const usernameOk = /^[a-zA-Z0-9_]{4,20}$/.test(username);

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    setUsernameChecked(false);
    setUsernameAvailable(false);
  };

  const handleCheckUsername = async () => {
    if (!usernameOk) return;
    setCheckingUsername(true); setError('');
    try {
      const r = await fetch(`${API}/auth/check-username?username=${encodeURIComponent(username)}`);
      const data = await r.json();
      setUsernameChecked(true);
      setUsernameAvailable(!!data.available);
      if (!data.available) setError(data.message || '이미 사용 중인 아이디입니다.');
    } catch {
      setError('중복 확인 중 오류가 발생했습니다.');
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleSendCode = async () => {
    const digits = phone.replace(/-/g, '');
    if (digits.length < 10) { setError('올바른 번호를 입력하세요.'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.devCode) {
          // 개발 환경: SMS 실패해도 코드 표시
          setCodeSent(true);
          setCode(data.devCode);
          Alert.alert('개발 모드 인증코드', `SMS 발송 실패 - 테스트 코드: ${data.devCode}\n\n오류: ${data.devError || '알 수 없음'}`);
        } else {
          throw new Error(data.message || '발송 실패');
        }
      } else {
        setCodeSent(true);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleVerifyCode = async () => {
    const digits = phone.replace(/-/g, '');
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, code }),
      });
      if (!r.ok) throw new Error((await r.json()).message || '인증 실패');
      setPhoneVerified(true);
      setStep('studentid');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleRegister = async () => {
    setLoading(true); setError('');
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      formData.append('phone', phone.replace(/-/g, ''));
      formData.append('name', name);
      formData.append('studentId', studentId);
      formData.append('major', major);
      if (imageUri) {
        const ext = imageUri.split('.').pop() || 'jpg';
        formData.append('studentIdImage', {
          uri: imageUri,
          name: `student_id.${ext}`,
          type: `image/${ext}`,
        } as any);
      }
      const r = await fetch(`${API}/auth/register`, { method: 'POST', body: formData });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || '가입 실패');
      if (data.token) {
        setAuth(data.token, data.user);
      }
      setStep('done');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => idx > 0 ? setStep(STEPS[idx - 1]) : router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>회원가입</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressWrap}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, i <= idx ? styles.stepDotActive : styles.stepDotInactive]}>
                <Text style={[styles.stepDotText, i <= idx ? styles.stepDotTextActive : styles.stepDotTextInactive]}>
                  {i < idx ? '✓' : String(i + 1)}
                </Text>
              </View>
              <Text style={[styles.stepLabel, i <= idx ? styles.stepLabelActive : styles.stepLabelInactive]}>
                {STEP_LABELS[i]}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, i < idx ? styles.stepLineActive : styles.stepLineInactive]} />
            )}
          </React.Fragment>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!!error && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Account Step */}
        {step === 'account' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>계정 정보</Text>
            <View style={styles.rowInput}>
              <TextInput style={[styles.input, { flex: 1 }]} value={username} onChangeText={handleUsernameChange}
                placeholder="아이디 (4~20자, 영문·숫자·_)" placeholderTextColor="#9CA3AF"
                autoCapitalize="none" autoCorrect={false} />
              <TouchableOpacity
                style={[styles.sendBtn, (!usernameOk || checkingUsername) && styles.btnDisabled]}
                onPress={handleCheckUsername}
                disabled={!usernameOk || checkingUsername}
              >
                {checkingUsername
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.sendBtnText}>중복확인</Text>}
              </TouchableOpacity>
            </View>
            {username.length > 0 && !usernameOk && (
              <Text style={styles.hint}>4~20자, 영문·숫자·밑줄(_)만 가능합니다</Text>
            )}
            {usernameChecked && usernameAvailable && (
              <Text style={styles.hintOk}>사용 가능한 아이디입니다 ✓</Text>
            )}
            <TextInput style={styles.input} value={password} onChangeText={setPassword}
              placeholder="비밀번호 (8자 이상)" placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPw} />
            <TextInput style={styles.input} value={passwordConfirm} onChangeText={setPasswordConfirm}
              placeholder="비밀번호 확인" placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPw} />
            {password.length > 0 && !pwOk && <Text style={styles.hint}>비밀번호는 8자 이상이어야 합니다</Text>}
            {passwordConfirm.length > 0 && !pwMatch && <Text style={styles.hint}>비밀번호가 일치하지 않습니다</Text>}
            <TouchableOpacity
              style={[styles.btn, (!usernameOk || !usernameChecked || !usernameAvailable || !pwOk || !pwMatch) && styles.btnDisabled]}
              disabled={!usernameOk || !usernameChecked || !usernameAvailable || !pwOk || !pwMatch}
              onPress={() => { setError(''); setStep('phone'); }}
            >
              <Text style={styles.btnText}>다음</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Phone Step */}
        {step === 'phone' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>전화번호 인증</Text>
            <View style={styles.rowInput}>
              <TextInput style={[styles.input, { flex: 1 }]} value={phone} onChangeText={setPhone}
                placeholder="010-1234-5678" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSendCode} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>{codeSent ? '재발송' : '발송'}</Text>}
              </TouchableOpacity>
            </View>
            {codeSent && (
              <TextInput style={styles.input} value={code} onChangeText={setCode}
                placeholder="인증번호 6자리" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
            )}
            {codeSent && (
              <TouchableOpacity style={[styles.btn, !code && styles.btnDisabled]} disabled={!code || loading} onPress={handleVerifyCode}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>인증 확인</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Student ID Step */}
        {step === 'studentid' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>학생 정보</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="이름" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.input} value={studentId} onChangeText={setStudentId}
              placeholder="학번 (예: 20231234)" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
            <TextInput style={styles.input} value={major} onChangeText={setMajor}
              placeholder="전공 (예: 컴퓨터공학과)" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
              <Feather name="camera" size={20} color={C.primary} />
              <Text style={styles.imagePickerText}>
                {imageUri ? '이미지 선택됨 ✓' : '학생증 사진 첨부 (선택)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, (!name || !studentId || !major || loading) && styles.btnDisabled]}
              disabled={!name || !studentId || !major || loading}
              onPress={handleRegister}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>가입 완료</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Done Step */}
        {step === 'done' && (
          <View style={[styles.stepContent, styles.doneContent]}>
            <View style={styles.doneIcon}>
              <Feather name="check" size={48} color="#fff" />
            </View>
            <Text style={styles.doneTitle}>가입 완료!</Text>
            <Text style={styles.doneSub}>P:um에 오신 것을 환영합니다.</Text>
            <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.btnText}>시작하기</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.loginRow}>
          <Text style={styles.loginHint}>이미 계정이 있으신가요? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.loginLink}>로그인</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: C.primary },
  stepDotInactive: { backgroundColor: '#F3F4F6' },
  stepDotText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  stepDotTextActive: { color: '#fff' },
  stepDotTextInactive: { color: '#9CA3AF' },
  stepLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  stepLabelActive: { color: C.primary },
  stepLabelInactive: { color: '#9CA3AF' },
  stepLine: { flex: 1, height: 2, marginBottom: 14, marginHorizontal: 4, borderRadius: 1 },
  stepLineActive: { backgroundColor: C.primary },
  stepLineInactive: { backgroundColor: '#F3F4F6' },
  content: { paddingHorizontal: 24, paddingTop: 16 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 12,
  },
  errorText: { fontSize: 13, color: '#EF4444', flex: 1, fontFamily: 'Inter_400Regular' },
  stepContent: { gap: 12 },
  stepTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 8 },
  input: {
    backgroundColor: '#F3F4F6', borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular',
  },
  hint: { fontSize: 12, color: '#EF4444', fontFamily: 'Inter_400Regular', marginLeft: 4 },
  hintOk: { fontSize: 12, color: '#10B981', fontFamily: 'Inter_500Medium', marginLeft: 4 },
  btn: {
    backgroundColor: C.primary, borderRadius: 16,
    paddingVertical: 17, alignItems: 'center', marginTop: 8,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  btnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  btnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  rowInput: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  sendBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  sendBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  imagePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EEF4FF', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16,
    borderWidth: 1.5, borderColor: `${C.primary}40`, borderStyle: 'dashed',
  },
  imagePickerText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_500Medium' },
  doneContent: { alignItems: 'center', paddingTop: 40, gap: 16 },
  doneIcon: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  doneTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#111827' },
  doneSub: { fontSize: 15, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', paddingTop: 24 },
  loginHint: { fontSize: 14, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  loginLink: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primary },
});
