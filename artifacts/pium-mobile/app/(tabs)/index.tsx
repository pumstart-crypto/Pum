import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Linking, RefreshControl, TextInput, Modal,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetSchedules } from '@workspace/api-client-react';
import C from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const QUICK_LINKS = [
  { label: '홈페이지', icon: 'globe', href: 'https://www.pusan.ac.kr/kor/Main.do', external: true },
  { label: '학생지원', icon: 'help-circle', href: 'https://onestop.pusan.ac.kr/login', external: true },
  { label: 'PLATO', icon: 'book-open', href: 'https://plato.pusan.ac.kr', external: true },
  { label: '도서관', icon: 'book', href: 'https://lib.pusan.ac.kr', external: true },
  { label: '학사일정', icon: 'calendar', href: null, screen: '/academic-calendar' },
  { label: '식단', icon: 'coffee', href: null, screen: '/meals' },
  { label: '순환버스', icon: 'navigation', href: null, screen: '/bus' },
  { label: '캠퍼스맵', icon: 'map', href: null, screen: '/campus-map' },
] as const;

const TODO_CATEGORIES = ['과제', '팀플', '동영상시청', '기타'];
const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  '과제': { bg: '#FEE2E2', text: '#DC2626' },
  '팀플': { bg: '#DBEAFE', text: '#2563EB' },
  '동영상시청': { bg: '#EDE9FE', text: '#7C3AED' },
  '기타': { bg: '#F3F4F6', text: '#6B7280' },
};

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

interface Todo {
  id: number;
  title: string;
  category: string;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
}

function getTodaySchedules(schedules: any[]) {
  const dayIdx = (new Date().getDay() + 6) % 7;
  return schedules.filter(s => s.dayOfWeek === dayIdx).sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
}

const PALETTE = ['#4F46E5', '#0891B2', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777', '#0F766E'];

function getSubjectColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: schedules = [], refetch: refetchSchedules } = useGetSchedules();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('과제');
  const [newDueDate, setNewDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : 0;

  const today = new Date();
  const todaySchedules = getTodaySchedules(schedules);
  const pendingTodos = todos.filter(t => !t.completed);

  const fetchTodos = useCallback(async () => {
    try {
      const r = await fetch(`${API}/todos`);
      if (r.ok) setTodos(await r.json());
    } catch {}
    finally { setTodosLoading(false); }
  }, []);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchTodos(), refetchSchedules()]);
    setRefreshing(false);
  }, [fetchTodos, refetchSchedules]);

  const toggleTodo = async (id: number, completed: boolean) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
    await fetch(`${API}/todos/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
  };

  const addTodo = async () => {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/todos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), category: newCategory, dueDate: newDueDate || undefined }),
      });
      if (r.ok) {
        const todo = await r.json();
        setTodos(prev => [todo, ...prev]);
        setNewTitle(''); setNewCategory('과제'); setNewDueDate('');
        setShowAddTodo(false);
      }
    } finally { setSubmitting(false); }
  };

  const deleteTodo = async (id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    await fetch(`${API}/todos/${id}`, { method: 'DELETE' });
  };

  const handleQuickLink = (link: typeof QUICK_LINKS[number]) => {
    if (link.href) { Linking.openURL(link.href); return; }
    if ('screen' in link && link.screen) router.push(link.screen as any);
  };

  const greeting = () => {
    const h = today.getHours();
    if (h < 6) return '새벽에도 열심히';
    if (h < 12) return '좋은 아침이에요';
    if (h < 18) return '좋은 오후에요';
    return '좋은 저녁이에요';
  };

  return (
    <View style={[styles.root, { paddingBottom: bottomPad }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 8 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName}>{user?.name || '학생'} 님 👋</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/notifications-inbox')} style={styles.notifBtn}>
            <Feather name="bell" size={22} color={C.primary} />
          </TouchableOpacity>
        </View>

        {/* Today schedule preview */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              오늘 수업
              <Text style={styles.cardDate}>
                {' '}({DAYS[(today.getDay() + 6) % 7]}요일)
              </Text>
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')}>
              <Text style={styles.cardMore}>전체보기</Text>
            </TouchableOpacity>
          </View>
          {todaySchedules.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="sun" size={28} color="#D1D5DB" />
              <Text style={styles.emptyText}>오늘 수업이 없어요</Text>
            </View>
          ) : (
            todaySchedules.slice(0, 4).map((s: any) => (
              <View key={s.id} style={[styles.scheduleItem, { borderLeftColor: getSubjectColor(s.subjectName) }]}>
                <View style={styles.scheduleTime}>
                  <Text style={styles.scheduleTimeText}>{s.startTime}</Text>
                  <Text style={styles.scheduleTimeEnd}>{s.endTime}</Text>
                </View>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleName} numberOfLines={1}>{s.subjectName}</Text>
                  {s.location && <Text style={styles.scheduleLocation} numberOfLines={1}>{s.location}</Text>}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Quick links */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>바로가기</Text>
          <View style={styles.quickGrid}>
            {QUICK_LINKS.map((link) => (
              <TouchableOpacity key={link.label} style={styles.quickItem} onPress={() => handleQuickLink(link)}>
                <View style={styles.quickIcon}>
                  <Feather name={link.icon as any} size={20} color={C.primary} />
                </View>
                <Text style={styles.quickLabel}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Todo */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>할 일 <Text style={styles.cardBadge}>{pendingTodos.length}</Text></Text>
            <TouchableOpacity onPress={() => setShowAddTodo(true)} style={styles.addBtn}>
              <Feather name="plus" size={16} color={C.primary} />
            </TouchableOpacity>
          </View>

          {todosLoading ? (
            <ActivityIndicator color={C.primary} style={{ marginVertical: 16 }} />
          ) : pendingTodos.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={28} color="#D1D5DB" />
              <Text style={styles.emptyText}>할 일이 없어요!</Text>
            </View>
          ) : (
            pendingTodos.slice(0, 5).map(todo => (
              <View key={todo.id} style={styles.todoItem}>
                <TouchableOpacity onPress={() => toggleTodo(todo.id, true)} style={styles.todoCheck}>
                  <Feather name="circle" size={20} color="#D1D5DB" />
                </TouchableOpacity>
                <View style={styles.todoInfo}>
                  <Text style={styles.todoTitle} numberOfLines={1}>{todo.title}</Text>
                  <View style={[styles.todoCat, { backgroundColor: CAT_COLORS[todo.category]?.bg || '#F3F4F6' }]}>
                    <Text style={[styles.todoCatText, { color: CAT_COLORS[todo.category]?.text || '#6B7280' }]}>
                      {todo.category}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => deleteTodo(todo.id)} style={styles.todoDelete}>
                  <Feather name="x" size={16} color="#D1D5DB" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Todo Modal */}
      <Modal visible={showAddTodo} transparent animationType="slide" onRequestClose={() => setShowAddTodo(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddTodo(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.modalTitle}>할 일 추가</Text>
            <TextInput
              style={styles.modalInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="할 일을 입력하세요"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <Text style={styles.modalLabel}>카테고리</Text>
            <View style={styles.catRow}>
              {TODO_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, newCategory === cat && styles.catChipActive]}
                  onPress={() => setNewCategory(cat)}
                >
                  <Text style={[styles.catChipText, newCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalInput}
              value={newDueDate}
              onChangeText={setNewDueDate}
              placeholder="마감일 (선택, YYYY-MM-DD)"
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              style={[styles.btn, !newTitle.trim() && styles.btnDisabled]}
              onPress={addTodo} disabled={!newTitle.trim() || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>추가하기</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  scroll: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 14, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  userName: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#111827', marginTop: 2 },
  notifBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827' },
  cardDate: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#6B7280' },
  cardMore: { fontSize: 13, color: C.primary, fontFamily: 'Inter_500Medium' },
  cardBadge: { fontSize: 14, color: C.primary },
  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  scheduleItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderLeftWidth: 3, paddingLeft: 12, marginBottom: 4, borderRadius: 4 },
  scheduleTime: { minWidth: 42 },
  scheduleTimeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  scheduleTimeEnd: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  scheduleInfo: { flex: 1 },
  scheduleName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  scheduleLocation: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular', marginTop: 1 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  quickItem: { width: '22%', alignItems: 'center', gap: 6 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 11, color: '#374151', fontFamily: 'Inter_500Medium', textAlign: 'center' },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  todoItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  todoCheck: { padding: 2 },
  todoInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  todoTitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#111827', flex: 1 },
  todoCat: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  todoCatText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  todoDelete: { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 4 },
  modalInput: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular' },
  modalLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  catRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  catChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  catChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  catChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
  btn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
