import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { loadProfileAsync, type UserProfile, DEFAULT_PROFILE } from '@/hooks/useProfile';
import C from '@/constants/colors';

const GRADE_LABEL: Record<string, string> = {
  '1': '1학년', '2': '2학년', '3': '3학년', '4': '4학년',
  '5': '5학년 이상', 'grad': '대학원생',
};

const SECTIONS = [
  {
    title: '계정',
    items: [
      { icon: 'bell', label: '알림 설정', desc: '푸시 알림 및 리마인더', color: '#2563EB', route: '/notification-settings' },
      { icon: 'shield', label: '개인정보 보호', desc: '데이터 및 보안 설정', color: '#7C3AED', route: '/privacy-settings' },
    ],
  },
  {
    title: '앱 설정',
    items: [
      { icon: 'globe', label: '언어', desc: '한국어', color: '#059669', route: null },
      { icon: 'smartphone', label: '앱 버전', desc: 'v1.0.0 (최신)', color: '#D97706', route: null },
    ],
  },
  {
    title: '지원',
    items: [
      { icon: 'help-circle', label: '도움말 & FAQ', desc: '자주 묻는 질문', color: '#06B6D4', route: null },
      { icon: 'info', label: '앱 정보', desc: 'P:um 피움', color: '#8B5CF6', route: null },
    ],
  },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : 0;

  const isAdmin = user?.studentId === 'ADMIN' || user?.username === 'admin27548';
  const displayName = isAdmin ? (user?.name || '관리자') : (profile.name || user?.name || '부산대학교 학생');
  const displaySub = isAdmin
    ? (user?.major || '시스템 관리')
    : [profile.department, GRADE_LABEL[profile.grade]].filter(Boolean).join(' · ');
  const initial = displayName[0] || '학';

  useEffect(() => {
    loadProfileAsync().then(setProfile);
  }, []);

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerArea}>
          <Text style={styles.envLabel}>환경설정</Text>
          <Text style={styles.pageTitle}>마이페이지 <Text style={styles.titlePrimary}>설정</Text></Text>
        </View>

        {/* Profile Card */}
        <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/profile-edit')} activeOpacity={0.85}>
          <View style={[styles.avatar, { backgroundColor: profile.avatarColor }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            {!!displaySub && <Text style={styles.profileSub}>{displaySub}</Text>}
            <View style={styles.editRow}>
              <Feather name="edit-3" size={12} color={C.primary} />
              <Text style={styles.editText}>프로필 편집</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color="#D1D5DB" />
        </TouchableOpacity>

        {/* Sections */}
        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.settingRow, idx < section.items.length - 1 && styles.settingRowBorder]}
                  onPress={() => item.route && router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.settingIcon, { backgroundColor: item.color + '18' }]}>
                    <Feather name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    <Text style={styles.settingDesc}>{item.desc}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Login status */}
        {user && (
          <View style={styles.loginStatus}>
            <Text style={styles.loginStatusText}>
              {isAdmin ? '관리자용 계정으로 로그인 중' : '부산대학교 인증 학생으로 로그인 중'}
            </Text>
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Feather name="log-out" size={18} color="#EF4444" />
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>

        {user && (
          <Text style={styles.userInfo}>{user.username} · {user.studentId}</Text>
        )}

        <View style={{ height: isWeb ? 34 : 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  scroll: { paddingHorizontal: 16 },
  headerArea: { paddingTop: 8, marginBottom: 16 },
  envLabel: { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_500Medium' },
  pageTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#111827', marginTop: 2 },
  titlePrimary: { color: C.primary },
  profileCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20,
    borderWidth: 1, borderColor: `${C.primary}20`,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#111827' },
  profileSub: { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_400Regular', marginTop: 2 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  editText: { fontSize: 12, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  settingIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  settingDesc: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 1 },
  loginStatus: { backgroundColor: `${C.primary}0D`, borderWidth: 1, borderColor: `${C.primary}20`, borderRadius: 16, padding: 14, alignItems: 'center', marginBottom: 12 },
  loginStatusText: { fontSize: 13, color: C.primary, fontFamily: 'Inter_500Medium' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 16, marginBottom: 12 },
  logoutText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#EF4444' },
  userInfo: { textAlign: 'center', fontSize: 12, color: '#D1D5DB', fontFamily: 'Inter_400Regular', marginBottom: 8 },
});
