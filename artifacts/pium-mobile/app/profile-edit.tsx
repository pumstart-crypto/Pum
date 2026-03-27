import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { loadProfileAsync, saveProfileAsync, type UserProfile, DEFAULT_PROFILE } from '@/hooks/useProfile';
import C from '@/constants/colors';

const AVATAR_COLORS = [
  '#00427D', '#4F46E5', '#0891B2', '#059669', '#D97706',
  '#DC2626', '#7C3AED', '#DB2777', '#0F766E', '#EA580C',
];

const GRADE_OPTIONS = [
  { label: '1학년', value: '1' },
  { label: '2학년', value: '2' },
  { label: '3학년', value: '3' },
  { label: '4학년', value: '4' },
  { label: '5학년 이상', value: '5' },
  { label: '대학원생', value: 'grad' },
];

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useTheme();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const isAdmin = user?.studentId === 'ADMIN' || user?.username === 'admin27548';
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Auth-verified data (read-only)
  const authMajor = user?.major || '';
  const authCollege = user?.college || '';

  useEffect(() => {
    loadProfileAsync().then(p => {
      const filled = {
        ...p,
        name: p.name || user?.name || '',
        major: authMajor || p.major,
        department: authCollege || p.department,
        studentId: p.studentId || user?.studentId || '',
      };
      setProfile(filled);
      setLoading(false);
    });
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfileAsync(profile);
      Alert.alert('저장됨', '프로필이 저장되었습니다.', [{ text: '확인', onPress: () => router.back() }]);
    } catch {
      Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const initial = profile.name?.[0] || user?.name?.[0] || '학';

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>프로필 편집</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator color={C.primary} size="small" /> : <Text style={styles.saveBtnText}>저장</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Avatar */}
            <View style={styles.avatarSection}>
              <View style={[styles.avatar, { backgroundColor: profile.avatarColor }]}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <Text style={[styles.avatarLabel, { color: colors.textSecondary }]}>아바타 색상</Text>
              <View style={styles.colorRow}>
                {AVATAR_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorChip, { backgroundColor: color }, profile.avatarColor === color && styles.colorChipSelected]}
                    onPress={() => update('avatarColor', color)}
                  >
                    {profile.avatarColor === color && <Feather name="check" size={14} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {isAdmin && (
              <View style={styles.adminBanner}>
                <Feather name="shield" size={14} color={C.primary} />
                <Text style={styles.adminText}>관리자용 계정으로 로그인 중입니다.</Text>
              </View>
            )}

            {/* 인증 정보 (Read-only) */}
            {(authCollege || authMajor) && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>인증된 소속 정보</Text>
                  <View style={styles.verifiedBadge}>
                    <Feather name="shield" size={10} color={C.primary} />
                    <Text style={styles.verifiedBadgeText}>학생증 인증</Text>
                  </View>
                </View>
                <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                  {authCollege ? (
                    <>
                      <View style={styles.fieldRow}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>단과대학</Text>
                        <View style={styles.readonlyRow}>
                          <Text style={[styles.readonlyValue, { color: colors.text }]}>{authCollege}</Text>
                          <Feather name="lock" size={13} color={colors.textTertiary} />
                        </View>
                      </View>
                      {authMajor ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                    </>
                  ) : null}
                  {authMajor ? (
                    <View style={styles.fieldRow}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>전공</Text>
                      <View style={styles.readonlyRow}>
                        <Text style={[styles.readonlyValue, { color: colors.text }]}>{authMajor}</Text>
                        <Feather name="lock" size={13} color={colors.textTertiary} />
                      </View>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.readonlyHint, { color: colors.textTertiary }]}>학생증 인증 정보는 수정할 수 없습니다</Text>
              </View>
            )}

            {/* 기본 정보 (Editable) */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>기본 정보</Text>
              <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>이름</Text>
                  <TextInput
                    style={[styles.fieldInput, { color: colors.text }]}
                    value={profile.name}
                    onChangeText={v => update('name', v)}
                    placeholder="이름 입력"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>학번</Text>
                  <TextInput
                    style={[styles.fieldInput, { color: colors.text }]}
                    value={profile.studentId}
                    onChangeText={v => update('studentId', v)}
                    placeholder="학번 입력"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                  />
                </View>
                {/* Show college/major fields only if NOT from auth */}
                {!authCollege && (
                  <>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <View style={styles.fieldRow}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>단과대학</Text>
                      <TextInput
                        style={[styles.fieldInput, { color: colors.text }]}
                        value={profile.department}
                        onChangeText={v => update('department', v)}
                        placeholder="단과대학 입력"
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>
                  </>
                )}
                {!authMajor && (
                  <>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <View style={styles.fieldRow}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>전공</Text>
                      <TextInput
                        style={[styles.fieldInput, { color: colors.text }]}
                        value={profile.major}
                        onChangeText={v => update('major', v)}
                        placeholder="전공 입력"
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>
                  </>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>학년</Text>
              <View style={styles.gradeGrid}>
                {GRADE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.gradeChip, { backgroundColor: colors.card, borderColor: colors.border }, profile.grade === opt.value && styles.gradeChipActive]}
                    onPress={() => update('grade', opt.value)}
                  >
                    <Text style={[styles.gradeChipText, { color: colors.textSecondary }, profile.grade === opt.value && styles.gradeChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>추가 전공</Text>
              <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>복수전공</Text>
                  <TextInput style={[styles.fieldInput, { color: colors.text }]} value={profile.doubleMajor} onChangeText={v => update('doubleMajor', v)} placeholder="없음" placeholderTextColor={colors.textTertiary} />
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>부전공</Text>
                  <TextInput style={[styles.fieldInput, { color: colors.text }]} value={profile.minor} onChangeText={v => update('minor', v)} placeholder="없음" placeholderTextColor={colors.textTertiary} />
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.saveFullBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveFullBtnText}>저장하기</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  saveBtn: { width: 40, alignItems: 'flex-end', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, color: C.primary, fontFamily: 'Inter_700Bold' },
  content: { paddingHorizontal: 16, paddingTop: 20 },
  avatarSection: { alignItems: 'center', gap: 12, marginBottom: 24 },
  avatar: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  avatarText: { fontSize: 36, fontFamily: 'Inter_700Bold', color: '#fff' },
  avatarLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  colorChip: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  colorChipSelected: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  adminBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF4FF', borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: `${C.primary}30` },
  adminText: { fontSize: 12, color: C.primary, fontFamily: 'Inter_400Regular', flex: 1 },
  section: { marginBottom: 20 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginHorizontal: 4 },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF4FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedBadgeText: { fontSize: 10, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  sectionCard: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  fieldLabel: { width: 80, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  fieldInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  readonlyRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  readonlyValue: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'right' },
  readonlyHint: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 6, marginHorizontal: 4 },
  divider: { height: 1, marginHorizontal: 16 },
  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gradeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5 },
  gradeChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  gradeChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  gradeChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
  saveFullBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  saveFullBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
