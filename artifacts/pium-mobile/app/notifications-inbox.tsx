import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import C from '@/constants/colors';

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface NotifItem {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const ICON_MAP: Record<string, string> = {
  notice: 'bell', community: 'message-circle', schedule: 'calendar',
  todo: 'check-square', system: 'settings', academic: 'book',
};
const COLOR_MAP: Record<string, string> = {
  notice: '#3B82F6', community: '#8B5CF6', schedule: '#059669',
  todo: '#F59E0B', system: '#6B7280', academic: '#0891B2',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

export default function NotificationsInboxScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const { token } = useAuth();
  const { refreshUnread } = useNotifications();
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const authHeader = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};

  const fetchNotifs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/notifications`, { headers: authHeader });
      if (res.ok) setNotifs(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useFocusEffect(useCallback(() => {
    fetchNotifs();
  }, [fetchNotifs]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifs();
    setRefreshing(false);
  };

  const markRead = async (id: number) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, { method: 'POST', headers: authHeader });
      refreshUnread();
    } catch {}
  };

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await fetch(`${API_BASE}/notifications/read-all`, { method: 'POST', headers: authHeader });
      refreshUnread();
    } catch {}
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>모두 읽음</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} />
        ) : notifs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell-off" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>알림이 없습니다</Text>
            <Text style={styles.emptyDesc}>새로운 알림이 오면 여기에 표시됩니다</Text>
          </View>
        ) : (
          <>
            {unreadCount > 0 && (
              <View style={styles.unreadBar}>
                <View style={styles.unreadDot} />
                <Text style={styles.unreadText}>읽지 않은 알림 {unreadCount}개</Text>
              </View>
            )}
            {notifs.map(notif => (
              <TouchableOpacity
                key={notif.id}
                style={[styles.notifCard, !notif.read && styles.notifCardUnread]}
                onPress={() => markRead(notif.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.notifIcon, { backgroundColor: (COLOR_MAP[notif.type] || '#6B7280') + '18' }]}>
                  <Feather name={(ICON_MAP[notif.type] || 'bell') as any} size={18} color={COLOR_MAP[notif.type] || '#6B7280'} />
                </View>
                <View style={styles.notifInfo}>
                  <Text style={styles.notifTitle}>{notif.title}</Text>
                  <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                  <Text style={styles.notifTime}>{timeAgo(notif.createdAt)}</Text>
                </View>
                {!notif.read && <View style={styles.unreadIndicator} />}
              </TouchableOpacity>
            ))}
          </>
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
  markAllBtn: { width: 60, alignItems: 'flex-end' },
  markAllText: { fontSize: 13, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  unreadBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, marginBottom: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  unreadText: { fontSize: 13, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular', textAlign: 'center' },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  notifCardUnread: { backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: `${C.primary}20` },
  notifIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  notifInfo: { flex: 1 },
  notifTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#6B7280', marginBottom: 2 },
  notifBody: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#111827', lineHeight: 19 },
  notifTime: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 4 },
  unreadIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginTop: 4 },
});
