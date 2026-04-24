import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Linking, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetSchedules } from '@workspace/api-client-react';
import C from '@/constants/colors';
import { getNow } from '@/utils/debugTime';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/contexts/NotificationContext';

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

function formatDueLabel(dueDate: string, todayStr: string): string | null {
  const d = new Date(dueDate);
  const dueDateStr = dueDate.slice(0, 10);
  const h = d.getHours(); const m = d.getMinutes();
  const hasTime = !(h === 23 && m === 59);
  const timeStr = hasTime ? ` ${h < 12 ? '오전' : '오후'} ${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')}` : '';
  if (dueDateStr < todayStr) return '기한 초과';
  if (dueDateStr === todayStr) return `오늘${timeStr}`;
  const tmr = new Date(todayStr); tmr.setDate(tmr.getDate() + 1);
  if (dueDateStr === `${tmr.getFullYear()}-${String(tmr.getMonth()+1).padStart(2,'0')}-${String(tmr.getDate()).padStart(2,'0')}`) return `내일${timeStr}`;
  return `${d.getMonth()+1}/${d.getDate()}${timeStr}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const { colors } = useTheme();
  const { unreadCount, refreshUnread } = useNotifications();
  const { data: schedules = [], refetch: refetchSchedules } = useGetSchedules();

  // 탭 포커스될 때마다 시간표 최신화
  useFocusEffect(
    useCallback(() => {
      refetchSchedules();
    }, [refetchSchedules])
  );

  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [todoExpanded, setTodoExpanded] = useState(false);

  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : 0;

  const today = getNow();
  const todayStr = dateToStr(today);

  const todaySchedules = getTodaySchedules(schedules);
  const { year: curYear, sem: curSem } = getCurrentSemester();
  const semSchedules = (schedules as any[]).filter(s => s.year === curYear && s.semester === curSem);
  const colorMap = buildColorMap(semSchedules.map((s: any) => s.subjectName));

  // 마감 가까운 미완료 할 일 (dueDate 있는 것 우선, 없으면 뒤로)
  const TODO_PREVIEW = 5;
  const incompleteTodos = todos
    .filter(t => !t.completed)
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  const displayTodos = todoExpanded ? incompleteTodos : incompleteTodos.slice(0, TODO_PREVIEW);
  const hasMore = incompleteTodos.length > TODO_PREVIEW;

  const fetchTodos = useCallback(async () => {
    try {
      const r = await fetch(`${API}/todos`, { headers: { ...authHeader } });
      if (r.ok) setTodos(await r.json());
    } catch {} finally { setTodosLoading(false); }
  }, [token]);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

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
        <Text style={styles.universityLabel}>P:um 피움</Text>
        <TouchableOpacity onPress={() => { router.push('/notifications-inbox'); refreshUnread(); }} style={styles.bellBtn}>
          <Feather name="bell" size={20} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: 0 }]}
        showsVerticalScrollIndicator={false}
        onScroll={e => setScrolled(e.nativeEvent.contentOffset.y > 4)}
        scrollEventThrottle={16}
      >
        {/* Date */}
        <View style={styles.dateSection}>
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
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>오늘 수업이 없어요.</Text>
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

        {/* ── 할 일 요약 ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>할 일</Text>
            <TouchableOpacity onPress={() => router.push('/todos')}>
              <Text style={styles.sectionLink}>전체 보기</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.todoWidget, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {todosLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />
            ) : incompleteTodos.length === 0 ? (
              <View style={styles.emptyTodo}>
                <View style={styles.emptyTodoIcon}>
                  <Feather name="check-circle" size={36} color={C.primary} />
                </View>
                <Text style={[styles.emptyTodoTitle, { color: colors.textSecondary }]}>
                  모든 할 일을 완료했습니다.
                </Text>
              </View>
            ) : (
              <>
                {displayTodos.map((todo, idx) => {
                  const dueLabel = todo.dueDate ? formatDueLabel(todo.dueDate, todayStr) : null;
                  const isOverdue = dueLabel === '기한 초과';
                  const isLast = idx === displayTodos.length - 1 && !hasMore && !todoExpanded;
                  return (
                    <TouchableOpacity
                      key={todo.id}
                      style={[
                        styles.todoRow,
                        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                      ]}
                      onPress={() => router.push('/todos')}
                      activeOpacity={0.7}
                    >
                      <TouchableOpacity
                        onPress={() => toggleTodo(todo.id, !todo.completed)}
                        style={styles.todoCheck}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="circle" size={20} color={colors.textTertiary} />
                      </TouchableOpacity>

                      <View style={styles.todoContent}>
                        <Text style={[styles.todoTitle, { color: colors.text }]} numberOfLines={1}>
                          {todo.title}
                        </Text>
                        <View style={styles.todoMeta}>
                          {todo.courseName && (
                            <View style={[styles.courseTag, { backgroundColor: colorMap[todo.courseName] ?? colors.border }]}>
                              <Text style={styles.courseTagText} numberOfLines={1}>{todo.courseName}</Text>
                            </View>
                          )}
                          {dueLabel && (
                            <Text style={[styles.dueTime, { color: isOverdue ? '#EF4444' : colors.textSecondary }]}>
                              {dueLabel}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* 토글 버튼 */}
                {(hasMore || todoExpanded) && (
                  <TouchableOpacity
                    style={[styles.toggleBtn, { borderTopColor: colors.border }]}
                    onPress={() => setTodoExpanded(prev => !prev)}
                    activeOpacity={0.7}
                  >
                    <Feather name={todoExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={C.primary} />
                    <Text style={[styles.toggleText, { color: C.primary }]}>
                      {todoExpanded ? '접기' : `+${incompleteTodos.length - TODO_PREVIEW}개 더보기`}
                    </Text>
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
    paddingHorizontal: 20, paddingBottom: 0,
  },
  headerScrolled: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 36, height: 36, borderRadius: 8 },
  logoBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
  },
  logoP: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  logoUm: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff', marginTop: 4 },
  bellBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  bellBadge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  bellBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff' },

  dateSection: { marginBottom: 14 },
  universityLabel: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 0.3 },
  dateRow: { flexDirection: 'row', alignItems: 'baseline' },
  dateText: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  dayText: { fontSize: 34, fontFamily: 'Inter_400Regular', letterSpacing: -0.5 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, marginHorizontal: -2 },
  quickItem: { alignItems: 'center', gap: 7, width: '25%', paddingVertical: 10, paddingHorizontal: 6, minHeight: 88 },
  quickIcon: { width: 58, height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  section: { marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
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
  emptyTodoTitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  emptyTodoDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  emptyTodoBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5,
  },
  emptyTodoBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // Todo rows
  todoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  todoCheck: { padding: 2 },
  todoContent: { flex: 1 },
  todoTitle: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  todoMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  courseTag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, maxWidth: 120 },
  courseTagText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  dueTime: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  // 토글 버튼
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth,
  },
  toggleText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
