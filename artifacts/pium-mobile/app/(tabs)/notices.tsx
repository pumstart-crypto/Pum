import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Linking, ActivityIndicator, Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
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
  views?: number;
  isNew?: boolean;
}

type Tab = 'school' | 'dept';

function isRecent(dateStr: string) {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 7 * 24 * 60 * 60 * 1000;
}

/* ── Notice Card ── */
function NoticeCard({ item, type }: { item: Notice | DeptNotice; type: 'school' | 'dept' }) {
  const n = item as Notice;
  const d = item as DeptNotice;
  const isPinned = 'isPinned' in n && n.isPinned;
  const showNew = 'isNew' in n
    ? (n.isNew || (isRecent(n.date) && !isPinned))
    : (d.isNew || isRecent(d.date));

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => Linking.openURL(item.url)}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <View style={styles.badges}>
          {isPinned && (
            <View style={styles.badgePrimary}>
              <Text style={styles.badgeText}>공지</Text>
            </View>
          )}
          {showNew && (
            <View style={styles.badgeNew}>
              <Text style={styles.badgeText}>NEW</Text>
            </View>
          )}
          {type === 'dept' && d.department && (
            <View style={styles.badgeDept}>
              <Text style={[styles.badgeText, { color: C.primary }]}>{d.department}</Text>
            </View>
          )}
        </View>
        <Feather name="external-link" size={13} color="#D1D5DB" />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardDate}>{item.date}</Text>
        {'views' in item && item.views != null && (
          <>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.cardDate}>조회 {(item.views as number).toLocaleString()}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

/* ── Section Label ── */
function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.sectionLabel}>
      <Ionicons name={icon as any} size={14} color={C.primary} />
      <Text style={styles.sectionLabelText}>{label}</Text>
    </View>
  );
}

/* ── School Notices ── */
function SchoolNotices({ search }: { search: string }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const fetch_ = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/notices`);
      if (!r.ok) throw new Error();
      const data = await r.json();
      setNotices(Array.isArray(data) ? data : (data.notices ?? []));
    } catch { setError('공지사항을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);
  useEffect(() => { setPage(1); }, [search]);

  if (loading) return <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />;
  if (error) return (
    <View style={styles.emptyBox}>
      <Feather name="alert-circle" size={36} color="#D1D5DB" />
      <Text style={styles.emptyText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={fetch_}>
        <Text style={styles.retryText}>다시 시도</Text>
      </TouchableOpacity>
    </View>
  );

  const kw = search.trim().toLowerCase();
  const pinned = notices.filter(n => n.isPinned && (!kw || n.title.toLowerCase().includes(kw)));
  const regular = notices.filter(n => !n.isPinned && (!kw || n.title.toLowerCase().includes(kw)));
  const paged = regular.slice(0, page * PER_PAGE);
  const hasMore = paged.length < regular.length;

  if (pinned.length === 0 && regular.length === 0) return (
    <View style={styles.emptyBox}>
      <Feather name="bell-off" size={36} color="#D1D5DB" />
      <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
    </View>
  );

  return (
    <>
      {pinned.length > 0 && (
        <>
          <SectionLabel icon="notifications" label="고정 공지" />
          {pinned.map((n, i) => <NoticeCard key={`p-${i}`} item={n} type="school" />)}
        </>
      )}
      {paged.map((n, i) => <NoticeCard key={`r-${i}`} item={n} type="school" />)}
      {hasMore && (
        <TouchableOpacity style={styles.moreBtn} onPress={() => setPage(p => p + 1)}>
          <Text style={styles.moreBtnText}>더 보기</Text>
          <Feather name="chevron-down" size={15} color={C.primary} />
        </TouchableOpacity>
      )}
    </>
  );
}

/* ── Dept Notices ── */
function DeptNotices({ search }: { search: string }) {
  const [deptNotices, setDeptNotices] = useState<DeptNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [userDept, setUserDept] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  useEffect(() => {
    loadProfileAsync().then(p => setUserDept(p.department || ''));
  }, []);

  useEffect(() => {
    if (!userDept) return;
    setLoading(true);
    fetch(`${API}/dept-notices?dept=${encodeURIComponent(userDept)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setDeptNotices(Array.isArray(data) ? data : (data.notices ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userDept]);

  useEffect(() => { setPage(1); }, [search]);

  if (!userDept) return (
    <View style={styles.emptyBox}>
      <Feather name="info" size={36} color="#D1D5DB" />
      <Text style={styles.emptyText}>학과를 설정하면{'\n'}학과 공지를 볼 수 있어요</Text>
      <TouchableOpacity style={styles.setDeptBtn} onPress={() => router.push('/profile-edit' as any)}>
        <Text style={styles.setDeptBtnText}>프로필에서 학과 설정하기</Text>
        <Feather name="arrow-right" size={13} color={C.primary} />
      </TouchableOpacity>
    </View>
  );

  if (loading) return <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />;

  const kw = search.trim().toLowerCase();
  const filtered = deptNotices.filter(n => !kw || n.title.toLowerCase().includes(kw) || (n.department || '').toLowerCase().includes(kw));
  const paged = filtered.slice(0, page * PER_PAGE);
  const hasMore = paged.length < filtered.length;

  if (filtered.length === 0) return (
    <View style={styles.emptyBox}>
      <Feather name="bell-off" size={36} color="#D1D5DB" />
      <Text style={styles.emptyText}>공지가 없습니다</Text>
    </View>
  );

  return (
    <>
      {paged.map((n, i) => <NoticeCard key={i} item={n} type="dept" />)}
      {hasMore && (
        <TouchableOpacity style={styles.moreBtn} onPress={() => setPage(p => p + 1)}>
          <Text style={styles.moreBtnText}>더 보기</Text>
          <Feather name="chevron-down" size={15} color={C.primary} />
        </TouchableOpacity>
      )}
    </>
  );
}

/* ══════════════════════════════
   Main Screen
══════════════════════════════ */
export default function NoticesScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [tab, setTab] = useState<Tab>('school');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleTabChange = (t: Tab) => { setTab(t); setSearch(''); };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* ── Sticky Header ── */}
      <View style={styles.header}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.subTitle}>부산대학교</Text>
            <Text style={styles.pageTitle}>
              공지 <Text style={styles.pageTitleAccent}>사항</Text>
            </Text>
          </View>
        </View>

        {/* Tab selector */}
        <View style={styles.tabSegment}>
          {(['school', 'dept'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tabSegItem, tab === t && styles.tabSegItemActive]}
              onPress={() => handleTabChange(t)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabSegText, tab === t && styles.tabSegTextActive]}>
                {t === 'school' ? '학교 공지' : '학과 공지'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search bar */}
        <View style={styles.searchBox}>
          <Feather name="search" size={15} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="공지 제목 검색..."
            placeholderTextColor="#9CA3AF"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={15} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView
        key={`${tab}-${refreshKey}`}
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'school'
          ? <SchoolNotices search={search} />
          : <DeptNotices search={search} />
        }
        <View style={{ height: isWeb ? 34 : 110 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },

  /* Header */
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  subTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF', letterSpacing: 0.3, marginBottom: 2 },
  pageTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#111827' },
  pageTitleAccent: { color: C.primary, fontFamily: 'Inter_800ExtraBold' },

  /* Tab segment */
  tabSegment: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  tabSegItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabSegItemActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabSegText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  tabSegTextActive: { color: C.primary, fontFamily: 'Inter_700Bold' },

  /* Search */
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#111827', fontFamily: 'Inter_400Regular' },

  /* List */
  listContent: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },

  /* Section label */
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginTop: 4,
    marginBottom: 2,
  },
  sectionLabelText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 0.3 },

  /* Card */
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badges: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  badgePrimary: { backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeNew: { backgroundColor: '#3B82F6', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDept: { backgroundColor: '#EEF4FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#111827', lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  cardDate: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  metaDot: { color: '#D1D5DB', fontSize: 12 },

  /* More button */
  moreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 16,
  },
  moreBtnText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },

  /* Empty state */
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: C.primary, borderRadius: 20 },
  retryText: { fontSize: 13, color: '#fff', fontFamily: 'Inter_600SemiBold' },
  setDeptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#EEF4FF', borderRadius: 12,
  },
  setDeptBtnText: { fontSize: 13, color: C.primary, fontFamily: 'Inter_600SemiBold' },
});
