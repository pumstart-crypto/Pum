import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Linking, RefreshControl, TextInput, Modal,
  ActivityIndicator, KeyboardAvoidingView, Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
        try {
          const can = await Linking.canOpenURL(scheme);
          if (can) { await Linking.openURL(scheme); return; }
        } catch {}
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

const TODO_CATEGORIES = ['과제', '퀴즈', '팀플', '동영상시청', '기타'];

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
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

interface WeekDay {
  dateStr: string;
  dayName: string;
  dateNum: number;
  isToday: boolean;
}

function getWeekDays(today: Date, back = 6, forward = 7): WeekDay[] {
  const todayStr = dateToStr(today);
  const days: WeekDay[] = [];
  const start = new Date(today);
  start.setDate(today.getDate() - back);
  for (let i = 0; i < back + forward + 1; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({
      dateStr: dateToStr(d),
      dayName: DAYS_KO[d.getDay()],
      dateNum: d.getDate(),
      isToday: dateToStr(d) === todayStr,
    });
  }
  return days;
}

function getCurrentSemester(): { year: number; sem: string } {
  const now = getNow();
  const month = now.getMonth() + 1;
  return { year: now.getFullYear(), sem: month >= 8 ? '2' : '1' };
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
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  return nowMins >= startMins && nowMins < endMins;
}

const PALETTE = ['#C4EBDC', '#FFD6C4', '#FFCFCF', '#E6D9F3', '#E8F5D8', '#D0EBFA', '#FDD6DC', '#FEE6BF'];
function buildColorMap(subjects: string[]): Record<string, string> {
  const unique = Array.from(new Set(subjects));
  const map: Record<string, string> = {};
  unique.forEach((name, i) => { map[name] = PALETTE[i % PALETTE.length]; });
  return map;
}

const DAY_CHIP_W = 52;
const DAY_CHIP_GAP = 8;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};
  const { colors } = useTheme();
  const { data: schedules = [], refetch: refetchSchedules } = useGetSchedules();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const today = getNow();
  const todayStr = dateToStr(today);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Modal state
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('과제');
  const [newCourseName, setNewCourseName] = useState<string | null>(null);
  const [newQuickDateIdx, setNewQuickDateIdx] = useState<number | null>(null);
  const [newDueTime, setNewDueTime] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : 0;

  const weekScrollRef = useRef<ScrollView>(null);

  const todaySchedules = getTodaySchedules(schedules);
  const { year: curYear, sem: curSem } = getCurrentSemester();
  const semSchedules = (schedules as any[]).filter(s => s.year === curYear && s.semester === curSem);
  const colorMap = buildColorMap(semSchedules.map((s: any) => s.subjectName));
  const uniqueSubjects = Array.from(new Set(semSchedules.map((s: any) => s.subjectName))) as string[];

  const weekDays = getWeekDays(today);

  // Filter & sort todos for selected date
  const todosForDate = todos.filter(todo => {
    if (!todo.dueDate) return selectedDate === todayStr;
    return todo.dueDate.slice(0, 10) === selectedDate;
  });
  const sortedTodosForDate = [
    ...todosForDate.filter(t => !t.completed).sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0;
      return a.dueDate.localeCompare(b.dueDate);
    }),
    ...todosForDate.filter(t => t.completed),
  ];

  const fetchTodos = useCallback(async () => {
    try {
      const r = await fetch(`${API}/todos`, { headers: { ...authHeader } });
      if (r.ok) setTodos(await r.json());
    } catch {}
    finally { setTodosLoading(false); }
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

  const deleteTodo = async (id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    await fetch(`${API}/todos/${id}`, { method: 'DELETE', headers: { ...authHeader } });
  };

  const resetModal = () => {
    setNewTitle('');
    setNewCategory('과제');
    setNewCourseName(null);
    setNewQuickDateIdx(null);
    setNewDueTime(null);
  };

  const addTodo = async () => {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      let dueDateStr: string | undefined;
      if (newQuickDateIdx !== null) {
        const d = new Date(today);
        d.setDate(d.getDate() + newQuickDateIdx);
        if (newDueTime) {
          d.setHours(newDueTime.getHours(), newDueTime.getMinutes(), 0, 0);
        } else {
          d.setHours(23, 59, 0, 0);
        }
        dueDateStr = d.toISOString();
      }
      const r = await fetch(`${API}/todos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory,
          courseName: newCourseName,
          dueDate: dueDateStr,
        }),
      });
      if (r.ok) {
        const todo = await r.json();
        setTodos(prev => [todo, ...prev]);
        resetModal();
        setShowAddTodo(false);
      }
    } finally { setSubmitting(false); }
  };

  const formatDueTime = (dueDate: string): string | null => {
    const d = new Date(dueDate);
    const h = d.getHours();
    const m = d.getMinutes();
    if (h === 23 && m === 59) return null;
    const period = h < 12 ? '오전' : '오후';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${period} ${h12}:${String(m).padStart(2, '0')}`;
  };

  const renderTodoItem = (todo: Todo) => {
    const dueTime = todo.dueDate ? formatDueTime(todo.dueDate) : null;
    return (
      <View
        key={todo.id}
        style={[
          styles.todoItem,
          { borderBottomColor: colors.border },
          todo.completed && styles.todoItemDone,
        ]}
      >
        <TouchableOpacity onPress={() => toggleTodo(todo.id, !todo.completed)} style={styles.todoCheck}>
          <Feather
            name={todo.completed ? 'check-circle' : 'circle'}
            size={20}
            color={todo.completed ? '#10B981' : colors.textTertiary}
          />
        </TouchableOpacity>
        <View style={styles.todoInfo}>
          <Text
            style={[styles.todoTitle, { color: colors.text }, todo.completed && styles.todoTitleDone]}
            numberOfLines={2}
          >
            {todo.title}
          </Text>
          <View style={styles.todoMeta}>
            {todo.courseName && (
              <View style={[styles.todoCourseChip, { backgroundColor: colorMap[todo.courseName] ?? '#E5E7EB' }]}>
                <Text style={styles.todoCourseText} numberOfLines={1}>{todo.courseName}</Text>
              </View>
            )}
            {dueTime && (
              <Text style={[styles.todoDueTime, { color: colors.textSecondary }]}>{dueTime}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => deleteTodo(todo.id)} style={styles.todoDelete}>
          <Feather name="x" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    );
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
                  : <Feather name={link.icon as any} size={22} color={C.primary} />
                }
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

        {/* ── 할 일 섹션 ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>할 일</Text>
          </View>

          {/* Weekly Calendar Strip */}
          <ScrollView
            ref={weekScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.weekStrip}
            contentContainerStyle={styles.weekStripContent}
            onLayout={() => {
              weekScrollRef.current?.scrollTo({ x: 6 * (DAY_CHIP_W + DAY_CHIP_GAP), animated: false });
            }}
          >
            {weekDays.map(day => {
              const isSelected = selectedDate === day.dateStr;
              const hasDot = todos.some(t => t.dueDate?.slice(0, 10) === day.dateStr);
              const isToday = day.isToday;
              return (
                <TouchableOpacity
                  key={day.dateStr}
                  style={[
                    styles.dayChip,
                    isSelected ? styles.dayChipActive : { backgroundColor: colors.card },
                  ]}
                  onPress={() => setSelectedDate(day.dateStr)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dayChipName,
                    { color: isSelected ? '#fff' : isToday ? C.primary : colors.textSecondary },
                  ]}>
                    {day.dayName}
                  </Text>
                  <Text style={[
                    styles.dayChipNum,
                    { color: isSelected ? '#fff' : isToday ? C.primary : colors.text },
                    isToday && !isSelected && styles.dayChipNumToday,
                  ]}>
                    {day.dateNum}
                  </Text>
                  {hasDot && (
                    <View style={[styles.dayDot, { backgroundColor: isSelected ? '#fff' : C.primary }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Todo list for selected date */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {todosLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 16 }} />
            ) : sortedTodosForDate.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="check-circle" size={28} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {selectedDate === todayStr ? '오늘 할 일이 없어요' : '이 날의 할 일이 없어요'}
                </Text>
              </View>
            ) : (
              sortedTodosForDate.map(renderTodoItem)
            )}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddTodo(true)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Add Todo Modal */}
      <Modal
        visible={showAddTodo}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowAddTodo(false); resetModal(); }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kavOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => { setShowAddTodo(false); resetModal(); }} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>할 일 추가</Text>

            {/* Title Input */}
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="할 일을 입력하세요"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              returnKeyType="done"
            />

            {/* Course Chips */}
            {uniqueSubjects.length > 0 && (
              <>
                <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>과목 연동</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll}
                  contentContainerStyle={styles.chipScrollContent}
                >
                  {uniqueSubjects.map(subject => {
                    const isActive = newCourseName === subject;
                    const chipBg = colorMap[subject] ?? '#E5E7EB';
                    return (
                      <TouchableOpacity
                        key={subject}
                        style={[
                          styles.courseChip,
                          { backgroundColor: isActive ? chipBg : colors.inputBg },
                          isActive && styles.courseChipActive,
                        ]}
                        onPress={() => setNewCourseName(isActive ? null : subject)}
                      >
                        <Text style={[styles.courseChipText, { color: isActive ? '#1F2937' : colors.textSecondary }]}>
                          {subject}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Quick Date */}
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>마감일</Text>
            <View style={styles.quickDateRow}>
              {(['오늘', '내일', '모레'] as const).map((label, i) => (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.quickDateBtn,
                    { backgroundColor: colors.inputBg },
                    newQuickDateIdx === i && styles.quickDateBtnActive,
                  ]}
                  onPress={() => setNewQuickDateIdx(newQuickDateIdx === i ? null : i)}
                >
                  <Text style={[
                    styles.quickDateText,
                    { color: colors.textSecondary },
                    newQuickDateIdx === i && styles.quickDateTextActive,
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time Picker (show when date is selected) */}
            {newQuickDateIdx !== null && (
              <DateTimePicker
                value={newDueTime ?? (() => { const d = new Date(); d.setHours(23, 59, 0, 0); return d; })()}
                mode="time"
                display="spinner"
                locale="ko-KR"
                onChange={(_, date) => { if (date) setNewDueTime(date); }}
                style={{ width: '100%', height: 130 }}
              />
            )}

            {/* Category */}
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>카테고리</Text>
            <View style={styles.catRow}>
              {TODO_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, { backgroundColor: colors.inputBg }, newCategory === cat && styles.catChipActive]}
                  onPress={() => setNewCategory(cat)}
                >
                  <Text style={[styles.catChipText, { color: colors.textSecondary }, newCategory === cat && styles.catChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.btn, !newTitle.trim() && styles.btnDisabled]}
              onPress={addTodo}
              disabled={!newTitle.trim() || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>추가하기</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 20 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 10,
    backgroundColor: '#fff',
  },
  headerScrolled: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  logoP: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  logoUm: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff', marginTop: 4 },
  bellBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  dateSection: { marginBottom: 24 },
  universityLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 1, marginBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'baseline' },
  dateText: { fontSize: 34, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: -0.5 },
  dayText: { fontSize: 34, fontFamily: 'Inter_400Regular', color: '#9CA3AF', letterSpacing: -0.5 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 28, marginHorizontal: -2 },
  quickItem: { alignItems: 'center', gap: 7, width: '25%', paddingVertical: 10, paddingHorizontal: 6, minHeight: 88 },
  quickIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#F5F7FB', justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 11, color: '#374151', fontFamily: 'Inter_500Medium', textAlign: 'center' },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#111827' },
  sectionLink: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },

  card: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  scheduleTime: { minWidth: 44 },
  scheduleTimeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  scheduleTimeEnd: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  scheduleInfo: { flex: 1 },
  scheduleName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  scheduleLocation: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular', marginTop: 1 },
  scheduleList: { gap: 8 },
  scheduleCard: {
    borderRadius: 14, borderWidth: 1.5, overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  scheduleCardActive: { shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  scheduleCardAccent: { width: 4, minHeight: 64 },
  scheduleCardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  nowBadge: { position: 'absolute', top: 8, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  nowBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },

  // Weekly strip
  weekStrip: { marginBottom: 12, marginHorizontal: -20 },
  weekStripContent: { paddingHorizontal: 20, gap: DAY_CHIP_GAP },
  dayChip: {
    width: DAY_CHIP_W, height: 70, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dayChipActive: { backgroundColor: C.primary },
  dayChipName: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  dayChipNum: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  dayChipNumToday: { fontFamily: 'Inter_700Bold' },
  dayDot: { width: 5, height: 5, borderRadius: 3 },

  // Todo items
  todoItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  todoItemDone: { opacity: 0.45 },
  todoCheck: { paddingTop: 1 },
  todoInfo: { flex: 1 },
  todoTitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#111827', lineHeight: 20 },
  todoTitleDone: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  todoMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  todoCourseChip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, maxWidth: 120 },
  todoCourseText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  todoDueTime: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  todoDelete: { padding: 4, marginTop: 0 },

  // Modal
  kavOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, gap: 12,
  },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 4 },
  modalInput: {
    backgroundColor: '#F3F4F6', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular',
  },
  modalLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },

  // Course chips
  chipScroll: { marginBottom: 4 },
  chipScrollContent: { gap: 8, paddingRight: 24 },
  courseChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  courseChipActive: { borderColor: 'rgba(0,0,0,0.15)' },
  courseChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  // Quick date
  quickDateRow: { flexDirection: 'row', gap: 8 },
  quickDateBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    alignItems: 'center', backgroundColor: '#F3F4F6',
  },
  quickDateBtnActive: { backgroundColor: C.primary },
  quickDateText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  quickDateTextActive: { color: '#fff' },

  // Category chips
  catRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent',
  },
  catChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  catChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  catChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },

  // Save button
  btn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
