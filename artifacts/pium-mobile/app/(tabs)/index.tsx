import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Linking, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetSchedules } from '@workspace/api-client-react';
import C from '@/constants/colors';
import { getNow } from '@/utils/debugTime';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function openPlatoLink() {
  const webUrl = 'https://plato.pusan.ac.kr';
  try {
    if (Platform.OS === 'android') {
      const intentUrl = 'intent://plato.pusan.ac.kr#Intent;scheme=https;package=kr.ac.pusan.smartcampus;end';
      const can = await Linking.canOpenURL(intentUrl);
      if (can) { await Linking.openURL(intentUrl); return; }
    } else if (Platform.OS === 'ios') {
      const schemes = ['pnusc://', 'smartcampus://', 'pnu://'];
      for (const scheme of schemes) {
        try { const can = await Linking.canOpenURL(scheme); if (can) { await Linking.openURL(scheme); return; } } catch {}
      }
    }
  } catch {}
  await Linking.openURL(webUrl);
}

const QUICK_LINKS = [
  { label: '홈페이지', icon: 'globe', set: 'feather', href: 'https://www.pusan.ac.kr/kor/Main.do' },
  { label: '학생지원', icon: 'help-circle', set: 'feather', href: 'https://onestop.pusan.ac.kr/login' },
  { label: 'PLATO', icon: 'book-open', set: 'feather', href: 'https://plato.pusan.ac.kr' },
  { label: '도서관', icon: 'book', set: 'feather', screen: '/reading-rooms' },
  { label: '학사일정', icon: 'calendar', set: 'feather', screen: '/academic-calendar' },
  { label: '식단', icon: 'restaurant-outline', set: 'ionicons', screen: '/meals' },
  { label: '순환버스', icon: 'bus-outline', set: 'ionicons', screen: '/bus' },
  { label: '캠퍼스맵', icon: 'map', set: 'feather', screen: '/campus-map' },
] as const;

const DAYS_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

interface Todo {
  id: number;
  title: string;
  category: string;
  courseName: string | null;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
}

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCurrentSemester() {
  const now = getNow();
  return { year: now.getFullYear(), sem: now.getMonth() + 1 >= 8 ? '2' : '1' };
}

function getTodaySchedules(schedules: any[]) {
  const dayIdx = (getNow().getDay() + 6) % 7;
  const { year, sem } = getCurrentSemester();
  return schedules
    .filter(s => s.dayOfWeek === dayIdx && s.year === year && s.semester === sem)
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
}

function isCurrentClass(startTime: string, endTime: string): boolean {
  const now = getNow();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
}

const PALETTE = ['#C4EBDC', '#FFD6C4', '#FFCFCF', '#E6D9F3', '#E8F5D8', '#D0EBFA', '#FDD6DC', '#FEE6BF'];
function buildColorMap(subjects: string[]): Record<string, string> {
  const unique = Array.from(new Set(subjects));
  const map: Record<string, string> = {};
  unique.forEach((name, i) => { map[name] = PALETTE[i % PALETTE.length]; });
  return map;
}

function formatDueTime(dueDate: string): string | null {
  const d = new Date(dueDate);
  const h = d.getHours(); const m = d.getMinutes();
  if (h === 23 && m === 59) return null;
  const p = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${p} ${h12}:${String(m).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const { colors } = useTheme();
  const { data: schedules = [], refetch: refetchSchedules } = useGetSchedules();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : 0;

  const today = getNow();
  const todayStr = dateToStr(today);

  const todaySchedules = getTodaySchedules(schedules);
  const { year: curYear, sem: curSem } = getCurrentSemester();
  const semSchedules = (schedules as any[]).filter(s => s.year === curYear && s.semester === curSem);
  const colorMap = buildColorMap(semSchedules.map((s: any) => s.subjectName));

  // 오늘 할 일: dueDate가 오늘인 것 or dueDate 없는 것
  const todayTodos = todos.filter(t =>
    t.dueDate ? t.dueDate.slice(0, 10) === todayStr : true
  ).sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  const completedCount = todayTodos.filter(t => t.completed).length;
  const totalCount = todayTodos.length;
  const pct = totalCount > 0 ? completedCount / totalCount : 0;
  const previewTodos = todayTodos.slice(0, 3);
  const hasMore = totalCount > 3;

  const fetchTodos = useCallback(async () => {
    try {
      const r = await fetch(`${API}/todos`, { headers: { ...authHeader } });
      if (r.ok) setTodos(await r.json());
    } catch {} finally { setTodosLoading(false); }
  }, [token]);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchTodos(), refetchSchedules()]);
    setRefreshing(false);
  }, [fetchTodos, refetchSchedules]);

  const toggleTodo = async (id: number, completed: boolean) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
    await fetch(`${API}/todos/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ completed }),
    });
  };

  return (
    <View style={[styles.root, { paddingBottom: bottomPad, backgroundColor: colors.background }]}>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.background }, scrolled && styles.headerScrolled]}>
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoP}>P</Text>
            <Text style={styles.logoUm}>:um</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/notifications-inbox')} style={styles.bellBtn}>
          <Feather name="bell" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
        onScroll={e => setScrolled(e.nativeEvent.contentOffset.y > 4)}
        scrollEventThrottle={16}
      >
        {/* Date */}
        <View style={styles.dateSection}>
          <Text style={styles.universityLabel}>부산대학교</Text>
          <View style={styles.dateRow}>
            <Text style={[styles.dateText, { color: colors.text }]}>
              {today.getMonth() + 1}월 {today.getDate()}일{' '}
            </Text>
            <Text style={[styles.dayText, { color: colors.textSecondary }]}>{DAYS_FULL[today.getDay()]}</Text>
          </View>
        </View>

        {/* Quick Links */}
        <View style={styles.quickGrid}>
          {QUICK_LINKS.map((link) => (
            <TouchableOpacity
              key={link.label}
              style={styles.quickItem}
              activeOpacity={0.75}
              onPress={() => {
                if (link.label === 'PLATO') { openPlatoLink(); return; }
                if ('href' in link && link.href) Linking.openURL(link.href);
                else if ('screen' in link && link.screen) router.push(link.screen as any);
              }}
            >
              <View style={[styles.quickIcon, { backgroundColor: colors.card }]}>
                {link.set === 'ionicons'
                  ? <Ionicons name={link.icon as any} size={24} color={C.primary} />
                  : <Feather name={link.icon as any} size={22} color={C.primary} />}
              </View>
              <Text style={[styles.quickLabel, { color: colors.text }]}>{link.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Today Timetable */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>오늘 시간표</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')}>
              <Text style={styles.sectionLink}>전체 보기</Text>
            </TouchableOpacity>
          </View>
          {todaySchedules.length === 0 ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.emptyState}>
                <Feather name="calendar" size={32} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>오늘 수업이 없어요</Text>
              </View>
            </View>
          ) : (
            <View style={styles.scheduleList}>
              {todaySchedules.slice(0, 4).map((s: any) => {
                const active = isCurrentClass(s.startTime, s.endTime);
                const accentColor = colorMap[s.subjectName] ?? PALETTE[0];
                return (
                  <View
                    key={s.id}
                    style={[
                      styles.scheduleCard,
                      { backgroundColor: colors.card, borderColor: active ? C.primary : colors.border },
                      active && styles.scheduleCardActive,
                    ]}
                  >
                    {active && (
                      <View style={[styles.nowBadge, { backgroundColor: accentColor }]}>
                        <Text style={[styles.nowBadgeText, { color: '#1F2937' }]}>지금 수업 중</Text>
                      </View>
                    )}
                    <View style={[styles.scheduleCardAccent, { backgroundColor: accentColor }]} />
                    <View style={styles.scheduleCardBody}>
                      <View style={styles.scheduleTime}>
                        <Text style={[styles.scheduleTimeText, { color: active ? C.primary : colors.text }]}>{s.startTime}</Text>
                        <Text style={[styles.scheduleTimeEnd, { color: colors.textSecondary }]}>{s.endTime}</Text>
                      </View>
                      <View style={styles.scheduleInfo}>
                        <Text style={[styles.scheduleName, { color: colors.text }]} numberOfLines={1}>{s.subjectName}</Text>
                        {s.location && <Text style={[styles.scheduleLocation, { color: colors.textSecondary }]} numberOfLines={1}>{s.location}</Text>}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── 오늘 할 일 요약 ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>오늘 할 일</Text>
            <TouchableOpacity onPress={() => router.push('/todos')}>
              <Text style={styles.sectionLink}>전체 보기</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.todoWidget, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {todosLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />
            ) : totalCount === 0 ? (
              /* Empty State */
              <View style={styles.emptyTodo}>
                <View style={styles.emptyTodoIcon}>
                  <Feather name="check-circle" size={36} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyTodoTitle, { color: colors.text }]}>
                  오늘의 할 일을 모두 끝냈어요!
                </Text>
                <Text style={[styles.emptyTodoDesc, { color: colors.textSecondary }]}>
                  할 일 화면에서 새 항목을 추가해보세요
                </Text>
                <TouchableOpacity
                  style={[styles.emptyTodoBtn, { borderColor: C.primary }]}
                  onPress={() => router.push('/todos')}
                >
                  <Text style={[styles.emptyTodoBtnText, { color: C.primary }]}>할 일 추가하기</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Progress Bar */}
                <View style={styles.progressSection}>
                  <View style={styles.progressLabelRow}>
                    <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                      {completedCount === totalCount
                        ? '오늘 할 일 완료!'
                        : `${totalCount - completedCount}개 남음`}
                    </Text>
                    <Text style={[styles.progressCount, { color: C.primary }]}>
                      {completedCount}/{totalCount}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: colors.inputBg ?? '#F3F4F6' }]}>
                    <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} />
                  </View>
                </View>

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Todo cards (max 3) */}
                {previewTodos.map(todo => {
                  const dueTime = todo.dueDate ? formatDueTime(todo.dueDate) : null;
                  return (
                    <TouchableOpacity
                      key={todo.id}
                      style={[styles.todoRow, todo.completed && styles.todoRowDone]}
                      onPress={() => router.push('/todos')}
                      activeOpacity={0.7}
                    >
                      {/* Checkbox */}
                      <TouchableOpacity
                        onPress={() => toggleTodo(todo.id, !todo.completed)}
                        style={styles.todoCheck}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather
                          name={todo.completed ? 'check-circle' : 'circle'}
                          size={20}
                          color={todo.completed ? '#10B981' : colors.textTertiary}
                        />
                      </TouchableOpacity>

                      {/* Content */}
                      <View style={styles.todoContent}>
                        <Text
                          style={[
                            styles.todoTitle,
                            { color: colors.text },
                            todo.completed && styles.todoTitleDone,
                          ]}
                          numberOfLines={1}
                        >
                          {todo.title}
                        </Text>
                        <View style={styles.todoMeta}>
                          {todo.courseName && (
                            <View style={[styles.courseTag, { backgroundColor: colorMap[todo.courseName] ?? '#E5E7EB' }]}>
                              <Text style={styles.courseTagText} numberOfLines={1}>{todo.courseName}</Text>
                            </View>
                          )}
                          {dueTime && (
                            <Text style={[styles.dueTime, { color: colors.textSecondary }]}>{dueTime}</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* 더보기 */}
                {hasMore && (
                  <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => router.push('/todos')}
                  >
                    <Text style={[styles.moreText, { color: C.primary }]}>
                      +{totalCount - 3}개 더보기
                    </Text>
                    <Feather name="chevron-right" size={14} color={C.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 20 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 10,
  },
  headerScrolled: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
  },
  logoP: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  logoUm: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff', marginTop: 4 },
  bellBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  dateSection: { marginBottom: 24 },
  universityLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 1, marginBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'baseline' },
  dateText: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  dayText: { fontSize: 34, fontFamily: 'Inter_400Regular', letterSpacing: -0.5 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 28, marginHorizontal: -2 },
  quickItem: { alignItems: 'center', gap: 7, width: '25%', paddingVertical: 10, paddingHorizontal: 6, minHeight: 88 },
  quickIcon: { width: 58, height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  sectionLink: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },

  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },

  scheduleList: { gap: 8 },
  scheduleCard: {
    borderRadius: 14, borderWidth: 1.5, overflow: 'hidden', flexDirection: 'row',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  scheduleCardActive: { shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  scheduleCardAccent: { width: 4, minHeight: 64 },
  scheduleCardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  nowBadge: { position: 'absolute', top: 8, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  nowBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  scheduleTime: { minWidth: 44 },
  scheduleTimeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  scheduleTimeEnd: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  scheduleInfo: { flex: 1 },
  scheduleName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  scheduleLocation: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },

  // ── 할 일 위젯 ──
  todoWidget: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },

  // Empty state
  emptyTodo: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 8 },
  emptyTodoIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  emptyTodoTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptyTodoDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  emptyTodoBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5,
  },
  emptyTodoBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // Progress bar
  progressSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  progressCount: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 3 },

  divider: { height: 1, marginHorizontal: 0 },

  // Todo rows
  todoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
  },
  todoRowDone: { opacity: 0.5 },
  todoCheck: { padding: 2 },
  todoContent: { flex: 1 },
  todoTitle: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  todoTitleDone: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  todoMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  courseTag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, maxWidth: 120 },
  courseTagText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  dueTime: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  // 더보기
  moreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 14,
  },
  moreText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
