import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

interface NotifItem {
  id: number;
  type: 'notice' | 'community' | 'schedule' | 'system';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const ICON_MAP = { notice: 'bell', community: 'message-circle', schedule: 'calendar', system: 'settings' } as const;
const COLOR_MAP: Record<string, string> = { notice: '#3B82F6', community: '#8B5CF6', schedule: '#059669', system: '#6B7280' };

const SAMPLE_NOTIFS: NotifItem[] = [
  { id: 1, type: 'notice', title: '학교 공지사항', body: '[공지] 2025학년도 1학기 수강신청 안내', time: '10분 전', read: false },
  { id: 2, type: 'community', title: '내 게시글에 댓글', body: '"컴공 스터디 모집" 글에 새 댓글이 달렸습니다', time: '1시간 전', read: false },
  { id: 3, type: 'schedule', title: '수업 시작 알림', body: '알고리즘 수업이 15분 후 시작됩니다 - IT대학 301호', time: '2시간 전', read: true },
  { id: 4, type: 'notice', title: '학과 공지사항', body: '[학과] 논문 심사 일정 변경 안내', time: '3시간 전', read: true },
  { id: 5, type: 'system', title: 'P:um 업데이트', body: 'P:um v1.0.1이 출시되었습니다. 새로운 기능을 확인해보세요!', time: '어제', read: true },
];

export default function NotificationsInboxScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [notifs, setNotifs] = useState<NotifItem[]>(SAMPLE_NOTIFS);

  const unreadCount = notifs.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: number) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllBtn}>모두 읽음</Text>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={{ width: 60 }} />}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <View style={styles.unreadDot} />
            <Text style={styles.unreadText}>읽지 않은 알림 {unreadCount}개</Text>
          </View>
        )}

        {notifs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell-off" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>알림이 없습니다</Text>
            <Text style={styles.emptyDesc}>새로운 알림이 오면 여기에 표시됩니다</Text>
          </View>
        ) : (
          notifs.map(notif => (
            <TouchableOpacity
              key={notif.id}
              style={[styles.notifCard, !notif.read && styles.notifCardUnread]}
              onPress={() => markRead(notif.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.notifIcon, { backgroundColor: COLOR_MAP[notif.type] + '18' }]}>
                <Feather name={ICON_MAP[notif.type] as any} size={18} color={COLOR_MAP[notif.type]} />
              </View>
              <View style={styles.notifInfo}>
                <Text style={styles.notifTitle}>{notif.title}</Text>
                <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                <Text style={styles.notifTime}>{notif.time}</Text>
              </View>
              {!notif.read && <View style={styles.unreadIndicator} />}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' },
  markAllBtn: { fontSize: 13, color: C.primary, fontFamily: 'Inter_600SemiBold', width: 60, textAlign: 'right' },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  unreadBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, marginBottom: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  unreadText: { fontSize: 13, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular', textAlign: 'center' },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  notifCardUnread: { backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: `${C.primary}18` },
  notifIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  notifInfo: { flex: 1 },
  notifTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#374151', marginBottom: 3 },
  notifBody: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#111827', lineHeight: 19 },
  notifTime: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 4 },
  unreadIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginTop: 4 },
});
