import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, SectionList, ScrollView, TouchableOpacity, StyleSheet,
  Platform, RefreshControl, TextInput, Modal, Animated,
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

const FILTER_CATS = ['전체', '과제', '퀴즈', '팀플', '동영상시청', '기타'];
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

interface Section { key: string; title: string; data: Todo[]; }

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function getCurrentSemester() {
  const now = getNow();
  return { year: now.getFullYear(), sem: now.getMonth() + 1 >= 8 ? '2' : '1' };
}

function formatDateHeader(key: string): string {
  if (key === 'none') return '기한 없음';
  const now = getNow();
  if (key === dateToStr(now)) return '오늘';
  if (key === dateToStr(addDays(now, 1))) return '내일';
  if (key === dateToStr(addDays(now, 2))) return '모레';
  const d = new Date(key + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS_KO[d.getDay()]})`;
}

function getDueStatus(dueDate: string | null): 'overdue' | 'urgent' | 'normal' {
  if (!dueDate) return 'normal';
  const diffMs = new Date(dueDate).getTime() - getNow().getTime();
  if (diffMs < 0) return 'overdue';
  if (diffMs < 24 * 3600 * 1000) return 'urgent';
  return 'normal';
}

function formatDueLabel(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const key = dueDate.slice(0, 10);
  const now = getNow();
  const h = d.getHours(); const m = d.getMinutes();
  const time = `${h}:${String(m).padStart(2, '0')}`;
  if (key === dateToStr(now)) return `오늘 ${time}`;
  if (key === dateToStr(addDays(now, 1))) return `내일 ${time}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

const PALETTE = ['#C4EBDC', '#FFD6C4', '#FFCFCF', '#E6D9F3', '#E8F5D8', '#D0EBFA', '#FDD6DC', '#FEE6BF'];
function buildColorMap(subjects: string[]): Record<string, string> {
  const unique = Array.from(new Set(subjects));
  const map: Record<string, string> = {};
  unique.forEach((n, i) => { map[n] = PALETTE[i % PALETTE.length]; });
  return map;
}

function sortByDueDate(a: Todo, b: Todo): number {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

export default function TodosScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const { colors } = useTheme();
  const { data: schedules = [] } = useGetSchedules();

  const today = getNow();
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  // Display list (initial order locked after fetch, in-place completion)
  const [displayTodos, setDisplayTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selCat, setSelCat] = useState('전체');
  const [selCourse, setSelCourse] = useState<string | null>(null);
  const [showCourseFilter, setShowCourseFilter] = useState(false);

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

  // Animated opacity per todo (for in-place completion animation)
  const animOpacities = useRef<Record<number, Animated.Value>>({});

  function getOpacity(id: number, completed: boolean): Animated.Value {
    if (!animOpacities.current[id]) {
      animOpacities.current[id] = new Animated.Value(completed ? 0.4 : 1);
    }
    return animOpacities.current[id];
  }

  const { year: curYear, sem: curSem } = getCurrentSemester();
  const semSchedules = (schedules as any[]).filter(s => s.year === curYear && s.semester === curSem);
  const colorMap = buildColorMap(semSchedules.map((s: any) => s.subjectName));
  const uniqueSubjects = Array.from(new Set(semSchedules.map((s: any) => s.subjectName))) as string[];

  const availableCourses = useMemo(
    () => Array.from(new Set(displayTodos.map(t => t.courseName).filter(Boolean))) as string[],
    [displayTodos]
  );

  const fetchTodos = useCallback(async () => {
    try {
      const r = await fetch(`${API}/todos`, { headers: { ...authHeader } });
      if (r.ok) {
        const data: Todo[] = await r.json();
        // Show only incomplete initially, sorted by dueDate
        const incomplete = data.filter(t => !t.completed).sort(sortByDueDate);
        setDisplayTodos(incomplete);
        animOpacities.current = {};  // reset animations on refresh
      }
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTodos();
    setRefreshing(false);
  };

  // In-place toggle: item stays in position, only visual change + API call
  const toggleTodo = (id: number, completed: boolean) => {
    setDisplayTodos(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
    const opacity = animOpacities.current[id] ?? (animOpacities.current[id] = new Animated.Value(completed ? 1 : 0.4));
    Animated.timing(opacity, {
      toValue: completed ? 0.4 : 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
    fetch(`${API}/todos/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ completed }),
    });
  };

  const deleteTodo = (id: number) => {
    setDisplayTodos(prev => prev.filter(t => t.id !== id));
    delete animOpacities.current[id];
    fetch(`${API}/todos/${id}`, { method: 'DELETE', headers: { ...authHeader } });
  };

  const filteredTodos = useMemo(() => displayTodos.filter(t => {
    if (selCat !== '전체' && t.category !== selCat) return false;
    if (selCourse && t.courseName !== selCourse) return false;
    return true;
  }), [displayTodos, selCat, selCourse]);

  const sections: Section[] = useMemo(() => {
    const groups: Record<string, Todo[]> = {};
    for (const todo of filteredTodos) {
      const key = todo.dueDate?.slice(0, 10) ?? 'none';
      if (!groups[key]) groups[key] = [];
      groups[key].push(todo);
    }
    return Object.keys(groups)
      .sort((a, b) => a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b))
      .map(key => ({ key, title: formatDateHeader(key), data: groups[key] }));
  }, [filteredTodos]);

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
        const todo: Todo = await r.json();
        // Insert into sorted position
        setDisplayTodos(prev => [...prev, todo].sort(sortByDueDate));
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
        const updated: Todo = await r.json();
        setDisplayTodos(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
        setEditTodo(null);
      }
    } finally { setEditSubmitting(false); }
  };

  // ── Renders ──

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item, index, section }: { item: Todo; index: number; section: Section }) => {
    const opacity = getOpacity(item.id, item.completed);
    const dueStatus = getDueStatus(item.dueDate);
    const dueLabel = formatDueLabel(item.dueDate);
    const subtitle = [item.courseName, dueLabel].filter(Boolean).join(' · ');
    const isLast = index === section.data.length - 1;

    return (
      <Animated.View style={{ opacity }}>
        <TouchableOpacity
          style={[styles.todoRow, { backgroundColor: colors.background }]}
          onPress={() => openEdit(item)}
          activeOpacity={0.6}
        >
          {/* Circular checkbox */}
          <TouchableOpacity
            onPress={() => toggleTodo(item.id, !item.completed)}
            style={styles.checkWrap}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {item.completed ? (
              <View style={[styles.checkFilled, { backgroundColor: C.primary }]}>
                <Feather name="check" size={12} color="#fff" />
              </View>
            ) : (
              <View style={[styles.checkEmpty, { borderColor: colors.border ?? '#D1D5DB' }]} />
            )}
          </TouchableOpacity>

          {/* Content */}
          <View style={styles.todoContent}>
            <Text
              style={[styles.todoTitle, { color: colors.text }, item.completed && styles.todoTitleDone]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {!!subtitle && (
              <Text
                style={[
                  styles.todoSub,
                  { color: colors.textSecondary },
                  (dueStatus === 'overdue' || dueStatus === 'urgent') && styles.todoSubUrgent,
                ]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Divider (skip after last item in section) */}
        {!isLast && (
          <View style={[styles.divider, { backgroundColor: colors.border ?? '#F0F0F0' }]} />
        )}
      </Animated.View>
    );
  };

  // ── Main render ──

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

      {/* FilterBar */}
      <View style={[styles.filterBar, { borderBottomColor: colors.border ?? '#F0F0F0' }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_CATS.map(cat => {
            const active = selCat === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelCat(cat)}
              >
                <Text style={[
                  styles.filterChipText,
                  { color: active ? C.primary : colors.textSecondary },
                  active && styles.filterChipTextActive,
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Course filter funnel */}
        <TouchableOpacity
          style={styles.funnelBtn}
          onPress={() => setShowCourseFilter(true)}
        >
          <Feather name="filter" size={17} color={selCourse ? C.primary : colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      {loading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} />
      ) : sections.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.card ?? '#F3F4F6' }]}>
            <Feather name="check-square" size={36} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {displayTodos.length === 0 ? '할 일이 없어요' : '해당하는 항목이 없어요'}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            + 버튼을 눌러 추가해보세요
          </Text>
        </View>
      ) : (
        <SectionList<Todo, Section>
          sections={sections}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          contentContainerStyle={{ paddingBottom: 120 + bottomPad }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 30 + bottomPad }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      {/* ── 과목 필터 모달 ── */}
      <Modal
        visible={showCourseFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCourseFilter(false)}
      >
        <Pressable style={styles.filterOverlay} onPress={() => setShowCourseFilter(false)}>
          <Pressable style={[styles.filterSheet, { backgroundColor: colors.card ?? '#fff' }]}>
            <Text style={[styles.filterSheetTitle, { color: colors.text }]}>과목별 필터</Text>
            {/* 전체 */}
            <TouchableOpacity
              style={[styles.filterSheetItem, !selCourse && { backgroundColor: `${C.primary}10` }]}
              onPress={() => { setSelCourse(null); setShowCourseFilter(false); }}
            >
              <Text style={[styles.filterSheetItemText, { color: !selCourse ? C.primary : colors.text }]}>
                전체 과목
              </Text>
              {!selCourse && <Feather name="check" size={15} color={C.primary} />}
            </TouchableOpacity>
            {/* Course options from display todos */}
            {availableCourses.length === 0 ? (
              <Text style={[styles.filterSheetEmpty, { color: colors.textSecondary }]}>연동된 과목이 없어요</Text>
            ) : availableCourses.map(course => (
              <TouchableOpacity
                key={course}
                style={[styles.filterSheetItem, selCourse === course && { backgroundColor: `${C.primary}10` }]}
                onPress={() => { setSelCourse(course); setShowCourseFilter(false); }}
              >
                <Text style={[styles.filterSheetItemText, { color: selCourse === course ? C.primary : colors.text }]}>
                  {course}
                </Text>
                {selCourse === course && <Feather name="check" size={15} color={C.primary} />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── 추가 모달 ── */}
      <Modal
        visible={showAdd}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowAdd(false); resetAdd(); }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kavOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => { setShowAdd(false); resetAdd(); }} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.card ?? '#fff' }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>할 일 추가</Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg ?? '#F3F4F6', color: colors.text }]}
              value={newTitle} onChangeText={setNewTitle}
              placeholder="할 일을 입력하세요" placeholderTextColor={colors.textTertiary}
              autoFocus returnKeyType="done"
            />

            {uniqueSubjects.length > 0 && (
              <>
                <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>과목 연동</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 4 }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                  {uniqueSubjects.map(s => {
                    const active = newCourseName === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.courseChip, { backgroundColor: active ? colorMap[s] ?? '#E5E7EB' : colors.inputBg ?? '#F3F4F6' }, active && styles.courseChipBorder]}
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
                  style={[styles.quickDateBtn, { backgroundColor: colors.inputBg ?? '#F3F4F6' }, newQuickDate === i && styles.quickDateBtnActive]}
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
                <TouchableOpacity key={cat}
                  style={[styles.catChip, { backgroundColor: colors.inputBg ?? '#F3F4F6' }, newCategory === cat && styles.catChipActive]}
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

      {/* ── 수정 모달 ── */}
      <Modal
        visible={!!editTodo}
        transparent
        animationType="slide"
        onRequestClose={() => setEditTodo(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kavOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setEditTodo(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.card ?? '#fff' }]}>
            <View style={styles.editHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: 0 }]}>할 일 수정</Text>
              <TouchableOpacity onPress={() => { deleteTodo(editTodo!.id); setEditTodo(null); }} style={styles.deleteBtn}>
                <Feather name="trash-2" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg ?? '#F3F4F6', color: colors.text }]}
              value={editTitle} onChangeText={setEditTitle}
              placeholder="할 일 제목" placeholderTextColor={colors.textTertiary}
              autoFocus returnKeyType="done"
            />

            {uniqueSubjects.length > 0 && (
              <>
                <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>과목 연동</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 4 }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                  {uniqueSubjects.map(s => {
                    const active = editCourseName === s;
                    return (
                      <TouchableOpacity key={s}
                        style={[styles.courseChip, { backgroundColor: active ? colorMap[s] ?? '#E5E7EB' : colors.inputBg ?? '#F3F4F6' }, active && styles.courseChipBorder]}
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
                <TouchableOpacity key={cat}
                  style={[styles.catChip, { backgroundColor: colors.inputBg ?? '#F3F4F6' }, editCategory === cat && styles.catChipActive]}
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

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { marginBottom: 8, width: 36, height: 36, justifyContent: 'center' },
  uniLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 1, marginBottom: 4 },
  pageTitle: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },

  // FilterBar
  filterBar: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterScroll: { flex: 1 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterChipActive: { backgroundColor: `${C.primary}18` },
  filterChipText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  filterChipTextActive: { fontFamily: 'Inter_700Bold' },
  funnelBtn: {
    width: 48, height: 48, justifyContent: 'center', alignItems: 'center',
    marginRight: 4,
  },

  // Section header
  sectionHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 0.1 },

  // Todo row — flat, no card
  todoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 14, gap: 14,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 54 },

  // Checkbox
  checkWrap: { paddingTop: 2 },
  checkEmpty: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  checkFilled: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },

  // Text
  todoContent: { flex: 1, gap: 4 },
  todoTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', lineHeight: 22, color: '#111827' },
  todoTitleDone: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  todoSub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  todoSubUrgent: { color: '#EF4444' },

  // Empty
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 80 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular' },

  // FAB
  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },

  // Course filter modal
  filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', paddingHorizontal: 28 },
  filterSheet: { borderRadius: 20, overflow: 'hidden' },
  filterSheetTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', padding: 20, paddingBottom: 12 },
  filterSheetItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  filterSheetItemText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  filterSheetEmpty: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 16, paddingBottom: 20 },

  // Add / Edit sheet
  kavOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 12 },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  deleteBtn: { padding: 8 },
  input: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular' },
  sheetLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  courseChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent' },
  courseChipBorder: { borderColor: 'rgba(0,0,0,0.15)' },
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
