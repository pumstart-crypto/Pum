import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import C from '@/constants/colors';

export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;

  const [anonymousPost, setAnonymousPost] = useState(true);
  const [hideGrade, setHideGrade] = useState(false);
  const [analyticsOpt, setAnalyticsOpt] = useState(true);

  const handleDeleteData = () => {
    Alert.alert(
      '데이터 초기화',
      '로컬에 저장된 프로필 데이터를 모두 삭제하시겠습니까? 서버 데이터는 유지됩니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('campus_life_profile');
          Alert.alert('완료', '로컬 데이터가 초기화되었습니다.');
        }},
      ]
    );
  };

  const SECTIONS = [
    {
      title: '커뮤니티 프라이버시',
      items: [
        {
          label: '익명 게시',
          desc: '커뮤니티 게시글을 익명으로 게시합니다',
          value: anonymousPost,
          onChange: setAnonymousPost,
        },
        {
          label: '성적 정보 숨기기',
          desc: '다른 학생들에게 성적 정보를 공개하지 않습니다',
          value: hideGrade,
          onChange: setHideGrade,
        },
      ],
    },
    {
      title: '앱 사용 데이터',
      items: [
        {
          label: '앱 개선에 참여',
          desc: '익명 사용 통계를 수집하여 앱 개선에 활용합니다',
          value: analyticsOpt,
          onChange: setAnalyticsOpt,
        },
      ],
    },
  ];

  const INFO_ITEMS = [
    { icon: 'lock', label: '데이터 암호화', desc: '모든 데이터는 암호화되어 저장됩니다' },
    { icon: 'eye-off', label: '제3자 공유 없음', desc: '개인정보는 제3자와 공유되지 않습니다' },
    { icon: 'shield', label: 'HTTPS 통신', desc: '모든 통신은 보안 연결로 이루어집니다' },
  ];

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>개인정보 보호</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Toggle sections */}
        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <View key={item.label} style={[styles.settingRow, idx < section.items.length - 1 && styles.settingRowBorder]}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    <Text style={styles.settingDesc}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={item.value}
                    onValueChange={item.onChange}
                    trackColor={{ false: '#D1D5DB', true: `${C.primary}60` }}
                    thumbColor={item.value ? C.primary : '#F9FAFB'}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Info section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>보안 정책</Text>
          <View style={styles.sectionCard}>
            {INFO_ITEMS.map((item, idx) => (
              <View key={item.label} style={[styles.infoRow, idx < INFO_ITEMS.length - 1 && styles.settingRowBorder]}>
                <View style={styles.infoIcon}>
                  <Feather name={item.icon as any} size={18} color={C.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <Text style={styles.settingDesc}>{item.desc}</Text>
                </View>
                <Feather name="check" size={16} color="#059669" />
              </View>
            ))}
          </View>
        </View>

        {/* Data management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>데이터 관리</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteData}>
              <View style={[styles.infoIcon, { backgroundColor: '#FEF2F2' }]}>
                <Feather name="trash-2" size={18} color="#DC2626" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: '#DC2626' }]}>로컬 데이터 초기화</Text>
                <Text style={styles.settingDesc}>로컬에 저장된 프로필 데이터를 삭제합니다</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.privacyLink}>
          <Text style={styles.privacyLinkText}>개인정보 처리방침 보기</Text>
          <Feather name="external-link" size={14} color={C.primary} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  settingDesc: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  dangerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  privacyLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  privacyLinkText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_500Medium' },
});
