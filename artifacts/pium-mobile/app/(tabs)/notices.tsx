import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Linking, ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { loadProfileAsync } from '@/hooks/useProfile';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface Notice {
  id: number;
  title: string;
  url: string;
  date: string;
  views: number;
  isPinned: boolean;
  isNew: boolean;
  category: string;
}

interface DeptNotice {
  title: string;
  url: string;
  date: string;
  department: string;
}

type Tab = 'school' | 'dept';

function relTime(dateStr: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return '오늘';
  if (days < 7) return `${days}일 전`;
  return dateStr;
}

function isRecent(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < 7 * 24 * 60 * 60 * 1000;
}

export default function NoticesScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [tab, setTab] = useState<Tab>('school');
  const [search, setSearch] = useState('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [deptNotices, setDeptNotices] = useState<DeptNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [userDept, setUserDept] = useState('');
  const PER_PAGE = 15;

  useEffect(() => {
    loadProfileAsync().then(p => setUserDept(p.department || ''));
  }, []);

  const fetchNotices = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      const r = await fetch(`${API}/notices?${params}`);
      if (r.ok) {
        const data = await r.json();
        setNotices(Array.isArray(data) ? data : (data.notices ?? []));
      }
    } catch {}
  }, [search]);

  const fetchDeptNotices = useCallback(async () => {
    const profile = await loadProfileAsync();
    const dept = profile.department;
    if (!dept) return;
    try {
      const params = new URLSearchParams({ dept });
      const r = await fetch(`${API}/dept-notices?${params}`);
      if (r.ok) {
        const data = await r.json();
        setDeptNotices(Array.isArray(data) ? data : (data.notices ?? []));
      }
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchNotices(), fetchDeptNotices()]).finally(() => setLoading(false));
  }, [fetchNotices, fetchDeptNotices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchNotices(), fetchDeptNotices()]);
    setRefreshing(false);
  }, [fetchNotices, fetchDeptNotices]);

  useEffect(() => { setPage(1); }, [search, tab]);

  const filtered = tab === 'school'
    ? notices.filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()))
    : deptNotices.filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.department.toLowerCase().includes(search.toLowerCase()));

  const paged = filtered.slice(0, page * PER_PAGE);
  const hasMore = paged.length < filtered.length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={styles.pageTitle}>공지사항</Text>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="공지 검색"
            placeholderTextColor="#9CA3AF"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.tabRow}>
          {(['school', 'dept'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                {t === 'school' ? '학교 공지' : '학과 공지'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : tab === 'dept' && !userDept ? (
          <View style={styles.emptyState}>
            <Feather name="info" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>학과를 설정하면{'\n'}학과 공지를 볼 수 있어요</Text>
            <TouchableOpacity style={styles.setDeptBtn} onPress={() => router.push('/profile-edit' as any)}>
              <Text style={styles.setDeptBtnText}>프로필에서 학과 설정하기</Text>
              <Feather name="arrow-right" size={14} color={C.primary} />
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>공지가 없습니다</Text>
          </View>
        ) : (
          <>
            {paged.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.noticeCard}
                onPress={() => Linking.openURL((item as any).url)}
                activeOpacity={0.7}
              >
                <View style={styles.noticeTop}>
                  <View style={styles.noticeBadges}>
                    {'isPinned' in item && item.isPinned && (
                      <View style={styles.badgePrimary}>
                        <Text style={styles.badgeText}>공지</Text>
                      </View>
                    )}
                    {('isNew' in item && (item.isNew || isRecent(item.date))) && (
                      <View style={styles.badgeNew}>
                        <Text style={styles.badgeText}>NEW</Text>
                      </View>
                    )}
                    {'department' in item && (
                      <View style={styles.badgeDept}>
                        <Text style={[styles.badgeText, { color: C.primary }]}>{(item as DeptNotice).department}</Text>
                      </View>
                    )}
                  </View>
                  <Feather name="external-link" size={14} color="#D1D5DB" />
                </View>
                <Text style={styles.noticeTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.noticeMeta}>
                  <Text style={styles.noticeDate}>{relTime(item.date)}</Text>
                  {'views' in item && (
                    <>
                      <Text style={styles.metaDot}>·</Text>
                      <Text style={styles.noticeDate}>조회 {(item as Notice).views.toLocaleString()}</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            {hasMore && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setPage(p => p + 1)}>
                <Text style={styles.moreBtnText}>더 보기</Text>
                <Feather name="chevron-down" size={16} color={C.primary} />
              </TouchableOpacity>
            )}
          </>
        )}
        <View style={{ height: isWeb ? 34 : 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  headerArea: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pageTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#111827', paddingTop: 16, paddingBottom: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', fontFamily: 'Inter_400Regular' },
  tabRow: { flexDirection: 'row', gap: 0, marginBottom: -1 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: C.primary },
  tabBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  tabBtnTextActive: { color: C.primary },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  setDeptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#EEF4FF', borderRadius: 12 },
  setDeptBtnText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  noticeCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  noticeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  noticeBadges: { flexDirection: 'row', gap: 6 },
  badgePrimary: { backgroundColor: C.primary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeNew: { backgroundColor: '#3B82F6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeDept: { backgroundColor: '#EEF4FF', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },
  noticeTitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#111827', lineHeight: 20 },
  noticeMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  noticeDate: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  metaDot: { color: '#D1D5DB', fontSize: 12 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  moreBtnText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },
});
