import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Linking, RefreshControl, TextInput, Modal,
  ActivityIndicator, Image, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetSchedules } from '@workspace/api-client-react';
import C from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function openPlatoLink() {
  const webUrl = 'https://plato.pusan.ac.kr';
  // 부산대학교 스마트캠퍼스 앱 (App Store id454665714)
  try {
    if (Platform.OS === 'android') {
      const intentUrl = 'intent://plato.pusan.ac.kr#Intent;scheme=https;package=kr.ac.pusan.smartcampus;end';
      const can = await Linking.canOpenURL(intentUrl);
      if (can) { await Linking.openURL(intentUrl); return; }
    } else if (Platform.OS === 'ios') {
      // 스마트캠퍼스 앱 URL 스킴 시도
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
  { label: '도서관', icon: 'book', set: 'feather', href: 'https://lib.pusan.ac.kr' },
  { label: '학사일정', icon: 'calendar', set: 'feather', screen: '/academic-calendar' },
  { label: '식단', icon: 'restaurant-outline', set: 'ionicons', screen: '/meals' },
  { label: '순환버스', icon: 'bus-outline', set: 'ionicons', screen: '/bus' },
  { label: '캠퍼스맵', icon: 'map', set: 'feather', screen: '/campus-map' },
] as const;

const TODO_CATEGORIES = ['과제', '팀플', '동영상시청', '기타'];
const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  '과제': { bg: '#FEE2E2', text: '#DC2626' },
  '팀플': { bg: '#DBEAFE', text: '#2563EB' },
  '동영상시청': { bg: '#EDE9FE', text: '#7C3AED' },
  '기타': { bg: '#F3F4F6', text: '#6B7280' },
};

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const DAYS_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

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
  const { colors } = useTheme();
  const { data: schedules = [], refetch: refetchSchedules } = useGetSchedules();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('과제');
  const [newDueDate, setNewDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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

        {/* Quick Links — 2×4 grid */}
        <View style={styles.quickGrid}>
          {QUICK_LINKS.map((link) => (
            <TouchableOpacity
              key={link.label}
              style={styles.quickItem}
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
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {todaySchedules.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="calendar" size={32} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>오늘 수업이 없어요</Text>
              </View>
            ) : (
              todaySchedules.slice(0, 4).map((s: any) => (
                <View key={s.id} style={[styles.scheduleItem, { borderLeftColor: getSubjectColor(s.subjectName) }]}>
                  <View style={styles.scheduleTime}>
                    <Text style={[styles.scheduleTimeText, { color: colors.text }]}>{s.startTime}</Text>
                    <Text style={[styles.scheduleTimeEnd, { color: colors.textSecondary }]}>{s.endTime}</Text>
                  </View>
                  <View style={styles.scheduleInfo}>
                    <Text style={[styles.scheduleName, { color: colors.text }]} numberOfLines={1}>{s.subjectName}</Text>
                    {s.location && <Text style={[styles.scheduleLocation, { color: colors.textSecondary }]} numberOfLines={1}>{s.location}</Text>}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Todo */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>할일</Text>
            <TouchableOpacity onPress={() => setShowAddTodo(true)}>
              <Text style={styles.sectionLink}>+ 추가</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {todosLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 16 }} />
            ) : pendingTodos.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="check-circle" size={32} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>할 일을 추가해보세요</Text>
              </View>
            ) : (
              pendingTodos.slice(0, 5).map(todo => (
                <View key={todo.id} style={[styles.todoItem, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity onPress={() => toggleTodo(todo.id, true)} style={styles.todoCheck}>
                    <Feather name="circle" size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                  <View style={styles.todoInfo}>
                    <Text style={[styles.todoTitle, { color: colors.text }]} numberOfLines={1}>{todo.title}</Text>
                    <View style={[styles.todoCat, { backgroundColor: CAT_COLORS[todo.category]?.bg || '#F3F4F6' }]}>
                      <Text style={[styles.todoCatText, { color: CAT_COLORS[todo.category]?.text || '#6B7280' }]}>
                        {todo.category}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => deleteTodo(todo.id)} style={styles.todoDelete}>
                    <Feather name="x" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Todo Modal */}
      <Modal visible={showAddTodo} transparent animationType="slide" onRequestClose={() => setShowAddTodo(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddTodo(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>할 일 추가</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="할 일을 입력하세요"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>카테고리</Text>
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
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text }]}
              value={newDueDate}
              onChangeText={setNewDueDate}
              placeholder="마감일 (선택, YYYY-MM-DD)"
              placeholderTextColor={colors.textTertiary}
            />
            <TouchableOpacity
              style={[styles.btn, !newTitle.trim() && styles.btnDisabled]}
              onPress={addTodo} disabled={!newTitle.trim() || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>추가하기</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
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
  logoText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#111827' },
  bellBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  dateSection: { marginBottom: 24 },
  universityLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 1, marginBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'baseline' },
  dateText: { fontSize: 34, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: -0.5 },
  dayText: { fontSize: 34, fontFamily: 'Inter_400Regular', color: '#9CA3AF', letterSpacing: -0.5 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 28, marginHorizontal: -4 },
  quickItem: { alignItems: 'center', gap: 7, width: '25%', paddingVertical: 8, paddingHorizontal: 4 },
  quickIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#F5F7FB', justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 11, color: '#374151', fontFamily: 'Inter_500Medium', textAlign: 'center' },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#111827' },
  sectionLink: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },

  card: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  scheduleItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderLeftWidth: 3, paddingLeft: 12, marginBottom: 4, borderRadius: 4 },
  scheduleTime: { minWidth: 42 },
  scheduleTimeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  scheduleTimeEnd: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  scheduleInfo: { flex: 1 },
  scheduleName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  scheduleLocation: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular', marginTop: 1 },

  todoItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
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
