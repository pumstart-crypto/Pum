import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Linking, ActivityIndicator,
  Platform, Animated, Modal, FlatList, Pressable,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { loadProfileAsync } from '@/hooks/useProfile';
import C from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const PAGE_SIZE = 10;
const MAX_PAGES = 10;

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

interface DeptInfo {
  name: string;
  hasNotice: boolean;
  hasJobs: boolean;
}

type Tab = 'school' | 'dept';
type DeptTab = 'notice' | 'jobs';

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
  const hasDept = type === 'dept' && !!d.department;
  const hasBadge = isPinned || showNew || hasDept;

  return (
    <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(item.url)} activeOpacity={0.7}>
      {hasBadge && (
        <View style={styles.badgeRow}>
          {isPinned && <View style={styles.badgePrimary}><Text style={styles.badgeText}>공지</Text></View>}
          {showNew && <View style={styles.badgeNew}><Text style={styles.badgeText}>NEW</Text></View>}
          {hasDept && <View style={styles.badgeDept}><Text style={[styles.badgeText, { color: C.primary }]}>{d.department}</Text></View>}
        </View>
      )}
      <View style={styles.cardTitleRow}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Feather name="external-link" size={13} color="#D1D5DB" style={{ marginTop: 2 }} />
      </View>
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

/* ── Pagination ── */
function Pagination({
  current, total, onChange, scrollRef,
}: {
  current: number; total: number;
  onChange: (p: number) => void;
  scrollRef: React.RefObject<ScrollView | null>;
}) {
  if (total <= 1) return null;
  const WINDOW = 5;
  let start = Math.max(1, current - Math.floor(WINDOW / 2));
  let end = start + WINDOW - 1;
  if (end > total) { end = total; start = Math.max(1, end - WINDOW + 1); }
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const go = (p: number) => { onChange(p); scrollRef.current?.scrollTo({ y: 0, animated: true }); };
  const inactive = '#6B7280';
  const disabled = '#D1D5DB';
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pagination}>
      <TouchableOpacity style={[styles.pageBtn, current === 1 && styles.pageBtnDisabled]} onPress={() => go(1)} disabled={current === 1}>
        <Ionicons name="play-skip-back" size={10} color={current === 1 ? disabled : inactive} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.pageBtn, current === 1 && styles.pageBtnDisabled]} onPress={() => go(current - 1)} disabled={current === 1}>
        <Ionicons name="chevron-back" size={13} color={current === 1 ? disabled : inactive} />
      </TouchableOpacity>
      {start > 1 && <Text style={styles.ellipsis}>…</Text>}
      {pages.map(p => (
        <TouchableOpacity key={p} style={[styles.pageBtn, current === p && styles.pageBtnActive]} onPress={() => go(p)}>
          <Text style={[styles.pageBtnText, current === p && styles.pageBtnTextActive]}>{p}</Text>
        </TouchableOpacity>
      ))}
      {end < total && <Text style={styles.ellipsis}>…</Text>}
      <TouchableOpacity style={[styles.pageBtn, current === total && styles.pageBtnDisabled]} onPress={() => go(current + 1)} disabled={current === total}>
        <Ionicons name="chevron-forward" size={13} color={current === total ? disabled : inactive} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.pageBtn, current === total && styles.pageBtnDisabled]} onPress={() => go(total)} disabled={current === total}>
        <Ionicons name="play-skip-forward" size={10} color={current === total ? disabled : inactive} />
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ── School Notices ── */
function SchoolNotices({ search, scrollRef }: { search: string; scrollRef: React.RefObject<ScrollView | null> }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

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
  const pool = regular.slice(0, MAX_PAGES * PAGE_SIZE);
  const totalPages = Math.min(Math.ceil(pool.length / PAGE_SIZE), MAX_PAGES);
  const paged = kw ? pool : pool.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (pinned.length === 0 && regular.length === 0) return (
    <View style={styles.emptyBox}>
      <Feather name="bell-off" size={36} color="#D1D5DB" />
      <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
    </View>
  );

  return (
    <>
      {pinned.map((n, i) => <NoticeCard key={`p-${i}`} item={n} type="school" />)}
      {paged.map((n, i) => <NoticeCard key={`r-${i}`} item={n} type="school" />)}
      {!kw && <Pagination current={page} total={totalPages} onChange={setPage} scrollRef={scrollRef} />}
    </>
  );
}

/* ── Dept Picker Modal ── */
function DeptPickerModal({
  visible, depts, selected, myMajor, onSelect, onClose,
}: {
  visible: boolean;
  depts: DeptInfo[];
  selected: string;
  myMajor: string;
  onSelect: (dept: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const allNames = React.useMemo(() => {
    const supported = depts.map(d => d.name);
    if (myMajor && !supported.includes(myMajor)) {
      return [myMajor, ...supported];
    }
    return supported;
  }, [depts, myMajor]);

  const filtered = q.trim()
    ? allNames.filter(n => n.includes(q.trim()))
    : allNames;

  const isSupported = (name: string) => depts.some(d => d.name === name);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={pickerStyles.overlay} onPress={onClose} />
      <View style={[pickerStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Handle */}
        <View style={pickerStyles.handle} />
        <Text style={pickerStyles.title}>학과 선택</Text>

        {/* Search */}
        <View style={pickerStyles.searchBox}>
          <Feather name="search" size={14} color="#9CA3AF" />
          <TextInput
            style={pickerStyles.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder="학과 검색..."
            placeholderTextColor="#9CA3AF"
            autoFocus
          />
          {!!q && <TouchableOpacity onPress={() => setQ('')}><Feather name="x" size={14} color="#9CA3AF" /></TouchableOpacity>}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item}
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 380 }}
          renderItem={({ item }) => {
            const supported = isSupported(item);
            const isSelected = item === selected;
            const isMyMajor = item === myMajor;
            return (
              <TouchableOpacity
                style={[pickerStyles.deptItem, isSelected && pickerStyles.deptItemSelected]}
                onPress={() => { onSelect(item); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[pickerStyles.deptName, isSelected && pickerStyles.deptNameSelected]}>
                    {item}
                  </Text>
                  {isMyMajor && (
                    <Text style={pickerStyles.myMajorLabel}>내 학과</Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {!supported && (
                    <View style={pickerStyles.comingSoonBadge}>
                      <Text style={pickerStyles.comingSoonText}>준비 중</Text>
                    </View>
                  )}
                  {isSelected && <Feather name="check" size={16} color={C.primary} />}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 14 }}>검색 결과가 없습니다</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

/* ── Dept Notices ── */
function DeptNotices({
  search, scrollRef, selectedDept, onChangeDept, supportedDepts, myMajor,
}: {
  search: string;
  scrollRef: React.RefObject<ScrollView | null>;
  selectedDept: string;
  onChangeDept: () => void;
  supportedDepts: DeptInfo[];
  myMajor: string;
}) {
  const [deptNotices, setDeptNotices] = useState<DeptNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [noJobsBoard, setNoJobsBoard] = useState(false);
  const [deptTab, setDeptTab] = useState<DeptTab>('notice');
  const [page, setPage] = useState(1);
  const { colors } = useTheme();

  const isSupported = supportedDepts.some(d => d.name === selectedDept);

  useEffect(() => {
    if (!selectedDept || !isSupported) return;
    setLoading(true);
    setNoJobsBoard(false);
    fetch(`${API}/dept-notices?dept=${encodeURIComponent(selectedDept)}&type=${deptTab}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.noJobsBoard) { setNoJobsBoard(true); setDeptNotices([]); }
        else setDeptNotices(Array.isArray(data) ? data : (data.notices ?? []));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedDept, deptTab, isSupported]);

  useEffect(() => { setPage(1); }, [search, deptTab, selectedDept]);

  // 미지원 학과
  if (selectedDept && !isSupported) {
    return (
      <View style={styles.emptyBox}>
        <Feather name="tool" size={40} color="#D1D5DB" />
        <Text style={[styles.emptyText, { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#374151' }]}>
          기능 준비 중
        </Text>
        <Text style={styles.emptyText}>
          {selectedDept} 공지사항 연동을{'\n'}준비하고 있어요.{'\n'}다른 학과를 선택해 볼 수 있어요.
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onChangeDept}>
          <Text style={styles.retryText}>다른 학과 선택</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 학과 미선택
  if (!selectedDept) {
    return (
      <View style={styles.emptyBox}>
        <Feather name="info" size={36} color="#D1D5DB" />
        <Text style={styles.emptyText}>학과를 선택해 주세요</Text>
      </View>
    );
  }

  const kw = search.trim().toLowerCase();
  const pool = deptNotices
    .filter(n => !kw || n.title.toLowerCase().includes(kw) || (n.department || '').toLowerCase().includes(kw))
    .slice(0, MAX_PAGES * PAGE_SIZE);
  const totalPages = Math.min(Math.ceil(pool.length / PAGE_SIZE), MAX_PAGES);
  const paged = kw ? pool : pool.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      {/* 공지사항 / 취업공지 서브 토글 */}
      <View style={[deptStyles.subSegment, { borderColor: colors.border }]}>
        {(['notice', 'jobs'] as DeptTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[deptStyles.subSegItem, deptTab === t && deptStyles.subSegItemActive]}
            onPress={() => setDeptTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[deptStyles.subSegText, deptTab === t && deptStyles.subSegTextActive]}>
              {t === 'notice' ? '공지사항' : '취업공지'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />
      ) : noJobsBoard ? (
        <View style={styles.emptyBox}>
          <Feather name="briefcase" size={36} color="#D1D5DB" />
          <Text style={styles.emptyText}>이 학과는 취업공지 게시판이{'\n'}없거나 지원되지 않습니다</Text>
        </View>
      ) : pool.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="bell-off" size={36} color="#D1D5DB" />
          <Text style={styles.emptyText}>{kw ? '검색 결과가 없습니다' : '공지가 없습니다'}</Text>
        </View>
      ) : (
        <>
          {paged.map((n, i) => <NoticeCard key={i} item={n} type="dept" />)}
          {!kw && <Pagination current={page} total={totalPages} onChange={setPage} scrollRef={scrollRef} />}
        </>
      )}
    </>
  );
}

const deptStyles = StyleSheet.create({
  subSegment: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    marginBottom: 10,
  },
  subSegItem: { flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: 'center' },
  subSegItemActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  subSegText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  subSegTextActive: { color: C.primary, fontFamily: 'Inter_700Bold' },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '80%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
  },
  deptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  deptItemSelected: {
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    paddingHorizontal: 10,
    marginHorizontal: -10,
  },
  deptName: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#111827',
  },
  deptNameSelected: {
    fontFamily: 'Inter_700Bold',
    color: C.primary,
  },
  myMajorLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#9CA3AF',
    marginTop: 2,
  },
  comingSoonBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#9CA3AF',
  },
});

/* ══════════════════════════════
   Main Screen
══════════════════════════════ */
export default function NoticesScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('school');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [supportedDepts, setSupportedDepts] = useState<DeptInfo[]>([]);
  const [allDeptNames, setAllDeptNames] = useState<string[]>([]);
  const [myMajor, setMyMajor] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinningRef = useRef<Animated.CompositeAnimation | null>(null);

  // 지원 학과 목록 불러오기
  useEffect(() => {
    fetch(`${API}/dept-list`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setSupportedDepts(data.depts ?? []))
      .catch(() => {});
  }, []);

  // 전체 학과 목록 (수강편람 기준)
  useEffect(() => {
    const now = new Date();
    const sem = (now.getMonth() + 1) >= 8 ? '2' : '1';
    const year = now.getFullYear();
    fetch(`${API}/courses/departments?catalogYear=${year}&catalogSemester=${sem}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (Array.isArray(data)) setAllDeptNames(data); })
      .catch(() => {});
  }, []);

  // 사용자 학과 설정
  useEffect(() => {
    const major = user?.major ?? '';
    if (major) {
      setMyMajor(major);
      setSelectedDept(major);
    } else {
      loadProfileAsync().then(p => {
        const dept = p.department || '';
        setMyMajor(dept);
        setSelectedDept(dept);
      });
    }
  }, [user]);

  // 지원 학과 + 수강편람 전체 학과 병합 (중복 제거, 내 학과 상단)
  const pickerDepts = React.useMemo<DeptInfo[]>(() => {
    const supportedMap = new Map(supportedDepts.map(d => [d.name, d]));
    const merged = new Map<string, DeptInfo>(supportedMap);
    for (const name of allDeptNames) {
      if (!merged.has(name)) merged.set(name, { name, hasNotice: false, hasJobs: false });
    }
    return Array.from(merged.values()).sort((a, b) => {
      if (a.name === myMajor) return -1;
      if (b.name === myMajor) return 1;
      return a.name.localeCompare(b.name, 'ko');
    });
  }, [supportedDepts, allDeptNames, myMajor]);

  const startSpin = useCallback(() => {
    spinAnim.setValue(0);
    spinningRef.current = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 700, useNativeDriver: true })
    );
    spinningRef.current.start();
  }, [spinAnim]);

  const stopSpin = useCallback(() => {
    spinningRef.current?.stop();
    spinAnim.setValue(0);
  }, [spinAnim]);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    startSpin();
    setRefreshKey(k => k + 1);
    setTimeout(() => { setRefreshing(false); stopSpin(); }, 1200);
  }, [refreshing, startSpin, stopSpin]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const handleTabChange = (t: Tab) => { setTab(t); setSearch(''); };

  return (
    <View style={[styles.root, { paddingTop: topPad, backgroundColor: colors.background }]}>
      {/* ── Sticky Header ── */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.subTitle, { color: colors.textSecondary }]}>부산대학교</Text>
            <Text style={[styles.pageTitle, { color: colors.text }]}>
              공지 <Text style={styles.pageTitleAccent}>사항</Text>
            </Text>
          </View>
          {/* 헤더 오른쪽 버튼 영역 */}
          <View style={styles.headerActions}>
            {tab === 'dept' && (
              <TouchableOpacity
                style={[styles.deptHeaderBtn, { backgroundColor: colors.inputBg, borderColor: `${C.primary}33` }]}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.75}
              >
                <Feather name="book-open" size={13} color={C.primary} />
                <Text style={styles.deptHeaderBtnText} numberOfLines={1}>
                  {selectedDept || '학과 선택'}
                </Text>
                <Feather name="chevron-down" size={13} color={C.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onRefresh}
              disabled={refreshing}
              style={[styles.refreshBtn, { backgroundColor: colors.inputBg }]}
              activeOpacity={0.7}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Feather name="refresh-cw" size={18} color={refreshing ? C.primary : colors.textSecondary} />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab segment */}
        <View style={[styles.tabSegment, { borderColor: colors.border }]}>
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

        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="공지 제목 검색..."
            placeholderTextColor={colors.textTertiary}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={15} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView
        ref={scrollRef}
        key={`${tab}-${refreshKey}`}
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'school'
          ? <SchoolNotices search={search} scrollRef={scrollRef} />
          : <DeptNotices
              search={search}
              scrollRef={scrollRef}
              selectedDept={selectedDept}
              onChangeDept={() => setShowPicker(true)}
              supportedDepts={supportedDepts}
              myMajor={myMajor}
            />
        }
        <View style={{ height: isWeb ? 34 : 110 }} />
      </ScrollView>

      {/* ── Dept Picker Modal ── */}
      <DeptPickerModal
        visible={showPicker}
        depts={pickerDepts}
        selected={selectedDept}
        myMajor={myMajor}
        onSelect={setSelectedDept}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    gap: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  deptHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    maxWidth: 140,
  },
  deptHeaderBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: C.primary,
    flexShrink: 1,
  },
  subTitle: { fontSize: 13, fontFamily: 'Inter_500Medium', letterSpacing: 0, marginBottom: 2 },
  pageTitle: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  pageTitleAccent: { color: C.primary },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },

  tabSegment: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
  },
  tabSegItem: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
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

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F3F4F6', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#111827', fontFamily: 'Inter_400Regular' },

  listContent: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  badgeRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badgePrimary: { backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeNew: { backgroundColor: '#3B82F6', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDept: { backgroundColor: '#EEF4FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: '#111827', lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  cardDate: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  metaDot: { color: '#D1D5DB', fontSize: 12 },

  pagination: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5, paddingVertical: 20, paddingHorizontal: 4,
  },
  pageBtn: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  pageBtnActive: { backgroundColor: C.primary },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#374151' },
  pageBtnTextActive: { color: '#fff' },
  ellipsis: { fontSize: 13, color: '#9CA3AF', paddingHorizontal: 1, lineHeight: 34 },

  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
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
