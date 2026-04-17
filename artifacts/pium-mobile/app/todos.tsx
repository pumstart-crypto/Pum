import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, RefreshControl, TextInput, Modal,
  ActivityIndicator, KeyboardAvoidingView, Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetSchedules } from '@workspace/api-client-react';
import C from '@/constants/colors';
import { getNow } from '@/utils/debugTime';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const isWeb = Platform.OS === 'web';

const TODO_CATEGORIES = ['과제', '퀴즈', '팀플', '동영상시청', '기타'];
const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

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

interface WeekDay { dateStr: string; dayName: string; dateNum: number; isToday: boolean; month: number; }
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
      month: d.getMonth() + 1,
    });
  }
  return days;
}

function getCurrentSemester() {
  const now = getNow();
  return { year: now.getFullYear(), sem: now.getMonth() + 1 >= 8 ? '2' : '1' };
}

const PALETTE = ['#C4EBDC', '#FFD6C4', '#FFCFCF', '#E6D9F3', '#E8F5D8', '#D0EBFA', '#FDD6DC', '#FEE6BF'];
function buildColorMap(subjects: string[]): Record<string, string> {
  const unique = Array.from(new Set(subjects));
  const map: Record<string, string> = {};
  unique.forEach((name, i) => { map[name] = PALETTE[i % PALETTE.length]; });
  return map;
}

const DAY_W = 54;
const DAY_GAP = 8;

export default function TodosScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const { colors } = useTheme();
  const { data: schedules = [] } = useGetSchedules();

  const today = getNow();
  const todayStr = dateToStr(today);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('과제');
  const [newCourseName, setNewCourseName] = useState<string | null>(null);
  const [newQuickDate, setNewQuickDate] = useState<number | null>(null);
  const [newDueTime, setNewDueTime] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('과제');
  const [editCourseName, setEditCourseName] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;
  const weekScrollRef = useRef<ScrollView>(null);

  const { year: curYear, sem: curSem } = getCurrentSemester();
  const semSchedules = (schedules as any[]).filter(s => s.year === curYear && s.semester === curSem);
  const colorMap = buildColorMap(semSchedules.map((s: any) => s.subjectName));
  const uniqueSubjects = Array.from(new Set(semSchedules.map((s: any) => s.subjectName))) as string[];
  const weekDays = getWeekDays(today);

  const todosForDate = todos.filter(t =>
    t.dueDate ? t.dueDate.slice(0, 10) === selectedDate : selectedDate === todayStr
  );
  const sortedTodos = [
    ...todosForDate.filter(t => !t.completed).sort((a, b) =>
      a.dueDate && b.dueDate ? a.dueDate.localeCompare(b.dueDate) : 0
    ),
    ...todosForDate.filter(t => t.completed),
  ];

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch(`${API}/todos`, { headers: { ...authHeader } });
      if (r.ok) setTodos(await r.json());
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetch_();
    setRefreshing(false);
  };

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

  const resetAdd = () => {
    setNewTitle(''); setNewCategory('과제');
    setNewCourseName(null); setNewQuickDate(null); setNewDueTime(null);
  };

  const addTodo = async () => {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      let dueDateStr: string | undefined;
      if (newQuickDate !== null) {
        const d = new Date(today);
        d.setDate(d.getDate() + newQuickDate);
        d.setHours(newDueTime?.getHours() ?? 23, newDueTime?.getMinutes() ?? 59, 0, 0);
        dueDateStr = d.toISOString();
      }
      const r = await fetch(`${API}/todos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ title: newTitle.trim(), category: newCategory, courseName: newCourseName, dueDate: dueDateStr }),
      });
      if (r.ok) {
        const todo = await r.json();
        setTodos(prev => [todo, ...prev]);
        resetAdd(); setShowAdd(false);
      }
    } finally { setSubmitting(false); }
  };

  const openEdit = (todo: Todo) => {
    setEditTodo(todo);
    setEditTitle(todo.title);
    setEditCategory(todo.category);
    setEditCourseName(todo.courseName);
  };

  const saveEdit = async () => {
    if (!editTodo || !editTitle.trim()) return;
    setEditSubmitting(true);
    try {
      const r = await fetch(`${API}/todos/${editTodo.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ title: editTitle.trim(), category: editCategory, courseName: editCourseName }),
      });
      if (r.ok) {
        const updated = await r.json();
        setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
        setEditTodo(null);
      }
    } finally { setEditSubmitting(false); }
  };

  const deleteAndClose = async () => {
    if (!editTodo) return;
    await deleteTodo(editTodo.id);
    setEditTodo(null);
  };

  const formatDueTime = (dueDate: string): string | null => {
    const d = new Date(dueDate);
    const h = d.getHours(); const m = d.getMinutes();
    if (h === 23 && m === 59) return null;
    const p = h < 12 ? '오전' : '오후';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${p} ${h12}:${String(m).padStart(2, '0')}`;
  };

  const completedCount = todosForDate.filter(t => t.completed).length;
  const totalCount = todosForDate.length;
  const pct = totalCount > 0 ? completedCount / totalCount : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.uniLabel}>부산대학교</Text>
        <Text style={[styles.pageTitle, { color: colors.text }]}>할 일</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress bar for selected date */}
        {totalCount > 0 && (
          <View style={[styles.progressWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                {selectedDate === todayStr ? '오늘' : `${selectedDate.slice(5, 7)}/${selectedDate.slice(8, 10)}`} 진행 현황
              </Text>
              <Text style={[styles.progressCount, { color: C.primary }]}>
                {completedCount}/{totalCount}
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} />
            </View>
          </View>
        )}

        {/* Weekly strip */}
        <ScrollView
          ref={weekScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.weekStrip}
          contentContainerStyle={styles.weekStripContent}
          onLayout={() => { weekScrollRef.current?.scrollTo({ x: 6 * (DAY_W + DAY_GAP), animated: false }); }}
        >
          {weekDays.map((day, idx) => {
            const isSelected = selectedDate === day.dateStr;
            const hasDot = todos.some(t => t.dueDate?.slice(0, 10) === day.dateStr);
            const showMonth = idx === 0 || day.dateNum === 1;
            return (
              <View key={day.dateStr}>
                {showMonth && (
                  <Text style={[styles.monthLabel, { color: colors.textTertiary }]}>{day.month}월</Text>
                )}
                <TouchableOpacity
                  style={[
                    styles.dayChip,
                    isSelected ? styles.dayChipActive : { backgroundColor: colors.card },
                  ]}
                  onPress={() => setSelectedDate(day.dateStr)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayChipName, { color: isSelected ? '#fff' : day.isToday ? C.primary : colors.textSecondary }]}>
                    {day.dayName}
                  </Text>
                  <Text style={[
                    styles.dayChipNum,
                    { color: isSelected ? '#fff' : day.isToday ? C.primary : colors.text },
                    day.isToday && !isSelected && styles.dayChipNumToday,
                  ]}>
                    {day.dateNum}
                  </Text>
                  {hasDot && <View style={[styles.dayDot, { backgroundColor: isSelected ? '#ffffffcc' : C.primary }]} />}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        {/* Todo list */}
        <View style={styles.listWrap}>
          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
          ) : sortedTodos.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIllus}>
                <Feather name="check-circle" size={44} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {selectedDate === todayStr ? '오늘 할 일이 없어요' : '이 날의 할 일이 없어요'}
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                아래 + 버튼으로 추가해보세요
              </Text>
            </View>
          ) : (
            sortedTodos.map(todo => {
              const dueTime = todo.dueDate ? formatDueTime(todo.dueDate) : null;
              return (
                <TouchableOpacity
                  key={todo.id}
                  style={[
                    styles.todoCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    todo.completed && styles.todoCardDone,
                  ]}
                  onPress={() => openEdit(todo)}
                  activeOpacity={0.75}
                >
                  <TouchableOpacity
                    onPress={() => toggleTodo(todo.id, !todo.completed)}
                    style={styles.todoCheck}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather
                      name={todo.completed ? 'check-circle' : 'circle'}
                      size={22}
                      color={todo.completed ? '#10B981' : colors.textTertiary}
                    />
                  </TouchableOpacity>
                  <View style={styles.todoBody}>
                    <Text
                      style={[
                        styles.todoTitle,
                        { color: colors.text },
                        todo.completed && styles.todoTitleDone,
                      ]}
                      numberOfLines={2}
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
                        <Text style={[styles.dueTimeText, { color: colors.textSecondary }]}>{dueTime}</Text>
                      )}
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <View style={{ height: 120 + bottomPad }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 30 + bottomPad }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      {/* ── 추가 모달 ── */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => { setShowAdd(false); resetAdd(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kavOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => { setShowAdd(false); resetAdd(); }} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>할 일 추가</Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
              value={newTitle} onChangeText={setNewTitle}
              placeholder="할 일을 입력하세요" placeholderTextColor={colors.textTertiary}
              autoFocus returnKeyType="done"
            />

            {uniqueSubjects.length > 0 && (
              <>
                <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>과목 연동</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                  {uniqueSubjects.map(s => {
                    const active = newCourseName === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.courseChip, { backgroundColor: active ? colorMap[s] ?? '#E5E7EB' : colors.inputBg }, active && styles.courseChipActive]}
                        onPress={() => setNewCourseName(active ? null : s)}
                      >
                        <Text style={[styles.courseChipText, { color: active ? '#1F2937' : colors.textSecondary }]}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>마감일</Text>
            <View style={styles.quickDateRow}>
              {(['오늘', '내일', '모레'] as const).map((label, i) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.quickDateBtn, { backgroundColor: colors.inputBg }, newQuickDate === i && styles.quickDateBtnActive]}
                  onPress={() => setNewQuickDate(newQuickDate === i ? null : i)}
                >
                  <Text style={[styles.quickDateText, { color: colors.textSecondary }, newQuickDate === i && styles.quickDateTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {newQuickDate !== null && (
              <DateTimePicker
                value={newDueTime ?? (() => { const d = new Date(); d.setHours(23, 59, 0, 0); return d; })()}
                mode="time" display="spinner" locale="ko-KR"
                onChange={(_, date) => { if (date) setNewDueTime(date); }}
                style={{ width: '100%', height: 130 }}
              />
            )}

            <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>카테고리</Text>
            <View style={styles.catRow}>
              {TODO_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, { backgroundColor: colors.inputBg }, newCategory === cat && styles.catChipActive]}
                  onPress={() => setNewCategory(cat)}
                >
                  <Text style={[styles.catChipText, { color: colors.textSecondary }, newCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, !newTitle.trim() && styles.saveBtnDisabled]}
              onPress={addTodo} disabled={!newTitle.trim() || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>추가하기</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 편집 모달 ── */}
      <Modal visible={!!editTodo} transparent animationType="slide" onRequestClose={() => setEditTodo(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kavOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setEditTodo(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.card }]}>
            <View style={styles.editHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: 0 }]}>할 일 수정</Text>
              <TouchableOpacity onPress={deleteAndClose} style={styles.deleteBtn}>
                <Feather name="trash-2" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
              value={editTitle} onChangeText={setEditTitle}
              placeholder="할 일 제목" placeholderTextColor={colors.textTertiary}
              autoFocus returnKeyType="done"
            />

            {uniqueSubjects.length > 0 && (
              <>
                <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>과목 연동</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                  {uniqueSubjects.map(s => {
                    const active = editCourseName === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.courseChip, { backgroundColor: active ? colorMap[s] ?? '#E5E7EB' : colors.inputBg }, active && styles.courseChipActive]}
                        onPress={() => setEditCourseName(active ? null : s)}
                      >
                        <Text style={[styles.courseChipText, { color: active ? '#1F2937' : colors.textSecondary }]}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>카테고리</Text>
            <View style={styles.catRow}>
              {TODO_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, { backgroundColor: colors.inputBg }, editCategory === cat && styles.catChipActive]}
                  onPress={() => setEditCategory(cat)}
                >
                  <Text style={[styles.catChipText, { color: colors.textSecondary }, editCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, !editTitle.trim() && styles.saveBtnDisabled]}
              onPress={saveEdit} disabled={!editTitle.trim() || editSubmitting}
            >
              {editSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>저장하기</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { marginBottom: 8, width: 36, height: 36, justifyContent: 'center' },
  uniLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 1, marginBottom: 4 },
  pageTitle: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },

  scrollContent: { paddingTop: 16 },

  // Progress
  progressWrap: {
    marginHorizontal: 20, marginBottom: 16, padding: 16,
    borderRadius: 16, borderWidth: 1,
  },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  progressCount: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 4 },

  // Weekly strip
  weekStrip: { marginBottom: 16 },
  weekStripContent: { paddingHorizontal: 20, gap: DAY_GAP, alignItems: 'flex-end' },
  monthLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginBottom: 4 },
  dayChip: {
    width: DAY_W, height: 72, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dayChipActive: { backgroundColor: C.primary },
  dayChipName: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  dayChipNum: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  dayChipNumToday: { fontFamily: 'Inter_700Bold' },
  dayDot: { width: 5, height: 5, borderRadius: 3 },

  // Todo cards
  listWrap: { paddingHorizontal: 20, gap: 10 },
  todoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  todoCardDone: { opacity: 0.5 },
  todoCheck: { padding: 2 },
  todoBody: { flex: 1 },
  todoTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  todoTitleDone: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  todoMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  courseTag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, maxWidth: 130 },
  courseTagText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  dueTimeText: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIllus: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular' },

  // FAB
  fab: {
    position: 'absolute', right: 20,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },

  // Sheet
  kavOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 12 },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  deleteBtn: { padding: 8 },
  input: {
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: 'Inter_400Regular',
  },
  sheetLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  chipScroll: { marginBottom: 4 },
  courseChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent' },
  courseChipActive: { borderColor: 'rgba(0,0,0,0.15)' },
  courseChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  quickDateRow: { flexDirection: 'row', gap: 8 },
  quickDateBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  quickDateBtnActive: { backgroundColor: C.primary },
  quickDateText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  quickDateTextActive: { color: '#fff' },

  catRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent' },
  catChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  catChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  catChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },

  saveBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#D1D5DB' },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
