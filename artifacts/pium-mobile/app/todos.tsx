import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, RefreshControl, TextInput, Modal, Alert,
  ActivityIndicator, KeyboardAvoidingView, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import C from '@/constants/colors';
import { getNow } from '@/utils/debugTime';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const isWeb = Platform.OS === 'web';
const CAT_STORAGE_KEY = 'pium_todo_categories_v2';
const DEFAULT_CATS = ['과제', '퀴즈', '시험'];
const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

interface Todo {
  id: number;
  title: string;
  category: string;
  courseName: string | null;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TodosScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { colors } = useTheme();
  const authH = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const now = getNow();
  const TODAY = toDateKey(now);

  // ── Core state ─────────────────────────────────────────────
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Categories ──────────────────────────────────────────────
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATS);

  useEffect(() => {
    AsyncStorage.getItem(CAT_STORAGE_KEY).then(raw => {
      if (!raw) return;
      try { setCategories(JSON.parse(raw)); } catch {}
    });
  }, []);

  const saveCategories = useCallback(async (cats: string[]) => {
    setCategories(cats);
    await AsyncStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(cats));
  }, []);

  // ── Calendar state ──────────────────────────────────────────
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ── Modal state ─────────────────────────────────────────────
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addCat, setAddCat] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────
  const fetchTodos = useCallback(async () => {
    try {
      const r = await fetch(`${API}/todos`, { headers: authH });
      if (r.ok) setTodos(await r.json());
    } catch {} finally { setLoading(false); }
  }, [authH]);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTodos();
    setRefreshing(false);
  }, [fetchTodos]);

  // ── CRUD ────────────────────────────────────────────────────
  const toggleTodo = useCallback((id: number, completed: boolean) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
    fetch(`${API}/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authH },
      body: JSON.stringify({ completed }),
    });
  }, [authH]);

  const deleteTodo = useCallback((id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    fetch(`${API}/todos/${id}`, { method: 'DELETE', headers: authH });
  }, [authH]);

  const openAdd = useCallback((cat: string) => {
    setAddCat(cat); setNewTitle(''); setShowAdd(true);
  }, []);

  const addTodo = useCallback(async () => {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      let dueDateStr: string | undefined;
      if (selectedDate) {
        const d = new Date(`${selectedDate}T23:59:00`);
        dueDateStr = d.toISOString();
      }
      const r = await fetch(`${API}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authH },
        body: JSON.stringify({ title: newTitle.trim(), category: addCat, dueDate: dueDateStr }),
      });
      if (r.ok) {
        const todo: Todo = await r.json();
        setTodos(prev => [todo, ...prev]);
        setShowAdd(false);
      }
    } finally { setSubmitting(false); }
  }, [newTitle, addCat, selectedDate, authH]);

  const openEdit = useCallback((todo: Todo) => {
    setEditTodo(todo); setEditTitle(todo.title);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editTodo || !editTitle.trim()) return;
    setEditSubmitting(true);
    try {
      const r = await fetch(`${API}/todos/${editTodo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authH },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      if (r.ok) {
        setTodos(prev => prev.map(t => t.id === editTodo.id ? { ...t, title: editTitle.trim() } : t));
        setEditTodo(null);
      }
    } finally { setEditSubmitting(false); }
  }, [editTodo, editTitle, authH]);

  // ── Calendar helpers ────────────────────────────────────────
  const calCells = useMemo<(number | null)[]>(() => {
    const dim = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDow = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    const offset = (firstDow + 6) % 7; // Mon-start offset
    const cells: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= dim; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calYear, calMonth]);

  // per-day task summary
  const dayMap = useMemo(() => {
    const map: Record<string, { total: number; completed: number; incomplete: number }> = {};
    for (const t of todos) {
      if (!t.dueDate) continue;
      const k = t.dueDate.slice(0, 10);
      if (!map[k]) map[k] = { total: 0, completed: 0, incomplete: 0 };
      map[k].total++;
      if (t.completed) map[k].completed++; else map[k].incomplete++;
    }
    return map;
  }, [todos]);

  const prevMonth = useCallback(() => {
    setSelectedDate(null);
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }, [calMonth]);

  const nextMonth = useCallback(() => {
    setSelectedDate(null);
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }, [calMonth]);

  const handleDayPress = useCallback((day: number) => {
    const k = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(prev => (prev === k ? null : k));
  }, [calYear, calMonth]);

  // ── Filtered list ───────────────────────────────────────────
  const listTodos = useMemo(() =>
    selectedDate
      ? todos.filter(t => t.dueDate?.slice(0, 10) === selectedDate)
      : todos,
    [todos, selectedDate]);

  // ── Category management ─────────────────────────────────────
  const addCategory = useCallback(async () => {
    const name = newCatName.trim();
    if (!name || categories.includes(name)) return;
    await saveCategories([...categories, name]);
    setNewCatName('');
  }, [newCatName, categories, saveCategories]);

  const removeCategory = useCallback((cat: string) => {
    Alert.alert(
      '카테고리 삭제',
      `'${cat}' 카테고리를 삭제할까요?\n해당 카테고리의 할일은 유지됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => saveCategories(categories.filter(c => c !== cat)) },
      ],
    );
  }, [categories, saveCategories]);

  // ── Calendar day cell renderer ──────────────────────────────
  const renderDayCell = (day: number | null, idx: number) => {
    if (!day) return <View key={`e-${idx}`} style={styles.dayCell} />;

    const k = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = k === TODAY;
    const isSelected = k === selectedDate;
    const info = dayMap[k];
    const allDone = !!info && info.total > 0 && info.incomplete === 0;
    const incompleteCnt = info?.incomplete ?? 0;

    const col = idx % 7;
    const isSat = col === 5;
    const isSun = col === 6;
    const numColor = isSelected
      ? '#fff'
      : isToday
      ? C.primary
      : isSat
      ? '#3B82F6'
      : isSun
      ? '#EF4444'
      : colors.text;

    return (
      <TouchableOpacity
        key={k}
        style={styles.dayCell}
        onPress={() => handleDayPress(day)}
        activeOpacity={0.65}
      >
        {/* Circle */}
        <View style={[
          styles.dayCircle,
          isSelected && { backgroundColor: C.primary },
          isToday && !isSelected && { borderWidth: 1.5, borderColor: C.primary },
        ]}>
          <Text style={[styles.dayNum, { color: numColor }]}>{day}</Text>
        </View>

        {/* Today dot — position:absolute so it never affects row height */}
        {isToday && !isSelected && (
          <View style={[styles.todayDot, { backgroundColor: C.primary }]} />
        )}

        {/* All done checkmark — position:absolute */}
        {allDone && !isSelected && (
          <View style={styles.doneMark}>
            <Feather name="check" size={7} color={C.primary} />
          </View>
        )}

        {/* Incomplete count badge */}
        {incompleteCnt > 0 && (
          <View style={[
            styles.badge,
            isSelected && { backgroundColor: 'rgba(255,255,255,0.9)' },
          ]}>
            <Text style={[styles.badgeText, isSelected && { color: C.primary }]}>
              {incompleteCnt}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Main render ─────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.universityLabel}>부산대학교</Text>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>할 일</Text>
          <TouchableOpacity onPress={() => setShowCatMgr(true)} style={styles.menuBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="menu" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
          {calYear}년 {calMonth + 1}월
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentContainerStyle={{ paddingBottom: 60 + bottomPad }}
      >
        {/* ── Calendar card ── */}
        <View style={[styles.calCard, { backgroundColor: colors.card }]}>

          {/* Month row */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="chevron-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.monthLabel, { color: colors.text }]}>
              {calYear}년 {calMonth + 1}월
            </Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="chevron-right" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Week header */}
          <View style={styles.weekRow}>
            {WEEK_LABELS.map((w, i) => (
              <Text
                key={w}
                style={[
                  styles.weekLabel,
                  { color: i === 5 ? '#3B82F6' : i === 6 ? '#EF4444' : colors.textSecondary },
                ]}
              >
                {w}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.dayGrid}>
            {calCells.map((day, idx) => renderDayCell(day, idx))}
          </View>

        </View>

        {/* ── Category sections ── */}
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.catList}>
            {categories.map(cat => {
              const catTodos = listTodos.filter(t => t.category === cat);
              return (
                <View key={cat} style={[styles.catSection, { backgroundColor: colors.card }]}>

                  {/* Category header */}
                  <View style={styles.catHeader}>
                    <View style={[styles.catIconWrap, { backgroundColor: `${C.primary}18` }]}>
                      <Feather name="tag" size={12} color={C.primary} />
                    </View>
                    <Text style={[styles.catName, { color: colors.text }]}>{cat}</Text>
                    <TouchableOpacity
                      onPress={() => openAdd(cat)}
                      style={styles.catAddBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="plus" size={18} color={C.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Todo items */}
                  {catTodos.map((todo, i) => (
                    <TouchableOpacity
                      key={todo.id}
                      style={[
                        styles.todoRow,
                        { borderTopColor: colors.border },
                        i === 0 && { borderTopWidth: StyleSheet.hairlineWidth },
                      ]}
                      onPress={() => openEdit(todo)}
                      onLongPress={() => Alert.alert('삭제', `'${todo.title}'을 삭제할까요?`, [
                        { text: '취소', style: 'cancel' },
                        { text: '삭제', style: 'destructive', onPress: () => deleteTodo(todo.id) },
                      ])}
                      activeOpacity={0.65}
                    >
                      <TouchableOpacity
                        onPress={() => toggleTodo(todo.id, !todo.completed)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        {todo.completed ? (
                          <View style={[styles.checkFilled, { backgroundColor: C.primary }]}>
                            <Feather name="check" size={11} color="#fff" />
                          </View>
                        ) : (
                          <View style={[styles.checkEmpty, { borderColor: colors.border }]} />
                        )}
                      </TouchableOpacity>

                      <Text
                        style={[
                          styles.todoTitle,
                          { color: colors.text },
                          todo.completed && styles.todoDone,
                        ]}
                        numberOfLines={2}
                      >
                        {todo.title}
                      </Text>

                      {todo.dueDate && (
                        <Text style={[styles.todoDue, { color: colors.textTertiary }]}>
                          {todo.dueDate.slice(5, 10).replace('-', '/')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Category Manager Modal ── */}
      <Modal
        visible={showCatMgr}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCatMgr(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.overlay} onPress={() => setShowCatMgr(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>카테고리 관리</Text>
            <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>
              기본: 과제·퀴즈·시험 | 길게 눌러 삭제
            </Text>

            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catMgrRow, { borderBottomColor: colors.border }]}
                  onLongPress={() => removeCategory(cat)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.catIconWrap, { backgroundColor: `${C.primary}18` }]}>
                    <Feather name="tag" size={12} color={C.primary} />
                  </View>
                  <Text style={[styles.catMgrName, { color: colors.text }]}>{cat}</Text>
                  <TouchableOpacity
                    onPress={() => removeCategory(cat)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={15} color="#EF4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.catAddRow}>
              <TextInput
                style={[styles.catInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                value={newCatName}
                onChangeText={setNewCatName}
                placeholder="새 카테고리 이름"
                placeholderTextColor={colors.textTertiary}
                returnKeyType="done"
                onSubmitEditing={addCategory}
              />
              <TouchableOpacity style={[styles.catAddBtn2, { backgroundColor: C.primary }]} onPress={addCategory}>
                <Feather name="plus" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Todo Modal ── */}
      <Modal
        visible={showAdd}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdd(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.overlay} onPress={() => setShowAdd(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{addCat} 추가</Text>
            {selectedDate && (
              <Text style={[styles.sheetSub, { color: C.primary }]}>
                마감일: {selectedDate.slice(5).replace('-', '/')} 23:59
              </Text>
            )}
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="할 일을 입력하세요"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={addTodo}
            />
            <TouchableOpacity
              style={[styles.saveBtn, (!newTitle.trim() || submitting) && styles.saveBtnOff]}
              onPress={addTodo}
              disabled={!newTitle.trim() || submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>추가하기</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Todo Modal ── */}
      <Modal
        visible={!!editTodo}
        transparent
        animationType="slide"
        onRequestClose={() => setEditTodo(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.overlay} onPress={() => setEditTodo(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.editHeaderRow}>
              <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: 0 }]}>할 일 수정</Text>
              <TouchableOpacity
                onPress={() => { deleteTodo(editTodo!.id); setEditTodo(null); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="trash-2" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, marginTop: 16 }]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="할 일 제목"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveEdit}
            />
            <TouchableOpacity
              style={[styles.saveBtn, (!editTitle.trim() || editSubmitting) && styles.saveBtnOff]}
              onPress={saveEdit}
              disabled={!editTitle.trim() || editSubmitting}
            >
              {editSubmitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>저장하기</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const CIRCLE = 32;

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header — 학사일정 스타일
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', marginBottom: 4, marginLeft: -4 },
  universityLabel: {
    fontSize: 11, fontFamily: 'Inter_700Bold',
    color: C.primary, letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 36, fontFamily: 'Inter_700Bold', letterSpacing: -1, lineHeight: 42 },
  menuBtn: { paddingBottom: 6 },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },

  // Calendar card
  calCard: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  monthLabel: { fontSize: 15, fontWeight: '700' },

  // Week labels
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', paddingVertical: 2 },

  // Day grid
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 13, fontWeight: '500' },

  // Today dot — absolute so it never adds height to the row
  todayDot: {
    position: 'absolute',
    bottom: 3,
    width: 4, height: 4, borderRadius: 2,
  },

  // All-done mark — absolute
  doneMark: {
    position: 'absolute',
    bottom: 2,
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },

  // Incomplete badge
  badge: {
    position: 'absolute',
    top: 2,
    right: '12%',
    backgroundColor: C.primary,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },


  // Category sections
  catList: { paddingHorizontal: 16, gap: 10, marginTop: 12 },
  catSection: { borderRadius: 16, overflow: 'hidden' },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  catIconWrap: {
    width: 24, height: 24, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  catName: { flex: 1, fontSize: 14, fontWeight: '700' },
  catAddBtn: { padding: 2 },

  // Todo row
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
    borderTopWidth: 0,
  },
  checkFilled: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  checkEmpty: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5,
  },
  todoTitle: { flex: 1, fontSize: 14, lineHeight: 20 },
  todoDone: { textDecorationLine: 'line-through', opacity: 0.45 },
  todoDue: { fontSize: 11, fontWeight: '500' },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  sheetSub: { fontSize: 12, marginBottom: 14 },

  // Category manager
  catMgrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  catMgrName: { flex: 1, fontSize: 15 },
  catAddRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  catInput: {
    flex: 1, height: 44, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 14,
  },
  catAddBtn2: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Add/Edit modal
  input: {
    height: 48, borderRadius: 12,
    paddingHorizontal: 14, fontSize: 15,
    marginBottom: 14,
  },
  saveBtn: {
    height: 48, borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnOff: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  editHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
