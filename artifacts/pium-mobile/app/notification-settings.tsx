import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const NOTIFICATION_SETTINGS = [
  {
    section: '학교 공지',
    items: [
      { key: 'school_notice', label: '학교 공지사항', desc: '새 공지 등록 시 알림' },
      { key: 'dept_notice', label: '학과 공지사항', desc: '학과 공지 알림' },
    ],
  },
  {
    section: '할 일',
    items: [
      { key: 'todo_deadline', label: '할 일 마감 알림', desc: '마감 하루 전 알림' },
      { key: 'todo_daily', label: '오늘 할 일 요약', desc: '매일 오전 8시 알림' },
    ],
  },
  {
    section: '시간표',
    items: [
      { key: 'class_before', label: '수업 시작 전 알림', desc: '수업 15분 전 알림' },
    ],
  },
  {
    section: '커뮤니티',
    items: [
      { key: 'community_comment', label: '댓글 알림', desc: '내 게시글에 댓글 시 알림' },
    ],
  },
  {
    section: '학사일정',
    items: [
      { key: 'academic_favorite', label: '즐겨찾기한 학사일정 알림', desc: '즐겨찾기한 일정 하루 전 알림' },
    ],
  },
];

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;

  const [settings, setSettings] = useState<Record<string, boolean>>({
    school_notice: true,
    dept_notice: true,
    todo_deadline: true,
    todo_daily: false,
    class_before: true,
    community_comment: true,
    academic_favorite: true,
  });

  const toggle = (key: string) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림 설정</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>원하는 알림을 설정하세요</Text>

        {NOTIFICATION_SETTINGS.map(section => (
          <View key={section.section} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.section}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <View key={item.key} style={[styles.settingRow, idx < section.items.length - 1 && styles.settingRowBorder]}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    <Text style={styles.settingDesc}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={settings[item.key] || false}
                    onValueChange={() => toggle(item.key)}
                    trackColor={{ false: '#D1D5DB', true: `${C.primary}60` }}
                    thumbColor={settings[item.key] ? C.primary : '#F9FAFB'}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.noteBox}>
          <Feather name="info" size={14} color="#6B7280" />
          <Text style={styles.noteText}>
            알림은 기기 설정에서도 관리할 수 있습니다. 기기 알림이 꺼져 있으면 앱 내 설정과 관계없이 알림이 오지 않습니다.
          </Text>
        </View>
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
  subtitle: { fontSize: 14, color: '#6B7280', fontFamily: 'Inter_400Regular', marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  settingDesc: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },
  noteBox: { flexDirection: 'row', gap: 10, backgroundColor: '#F3F4F6', borderRadius: 14, padding: 14, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
