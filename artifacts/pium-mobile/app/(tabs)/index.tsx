import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApiUrl, useAuth } from "@/contexts/AuthContext";

const C = Colors.light;
const isWeb = Platform.OS === "web";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_KO = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const QUICK_LINKS = [
  { label: "홈페이지",  icon: "globe"       as const, external: true,  href: "https://www.pusan.ac.kr/kor/Main.do" },
  { label: "학생지원",  icon: "help-circle" as const, external: true,  href: "https://onestop.pusan.ac.kr/login" },
  { label: "PLATO",     icon: "book"        as const, external: true,  href: "https://plato.pusan.ac.kr" },
  { label: "도서관",    icon: "book-open"   as const, external: true,  href: "https://lib.pusan.ac.kr" },
  { label: "학사일정",  icon: "calendar"    as const, external: false, route: "/calendar" },
  { label: "식단",      icon: "coffee"      as const, external: false, route: "/(tabs)/meal" },
  { label: "순환버스",  icon: "navigation"  as const, external: false, route: "/bus" },
  { label: "캠퍼스맵",  icon: "map"         as const, external: false, route: "/map" },
] as const;

const SUBJECT_COLORS = [
  "#00427d", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316",
];

const TODO_CATEGORIES = ["과제", "팀플", "동영상시청", "기타"];
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "과제":       { bg: "#FEE2E2", text: "#DC2626" },
  "팀플":       { bg: "#DBEAFE", text: "#2563EB" },
  "동영상시청": { bg: "#F3E8FF", text: "#9333EA" },
  "기타":       { bg: "#F3F4F6", text: "#6B7280" },
};

interface Schedule {
  id: number; subjectName: string; dayOfWeek: number;
  startTime: string; endTime: string; location?: string; color?: string;
}
interface Todo {
  id: number; title: string; category: string;
  dueDate: string | null; completed: boolean; createdAt: string;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const apiUrl = useApiUrl();

  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddTodo, setShowAddTodo] = useState(false);

  const now = new Date();
  const dayOfWeek = now.getDay();
  const monthDay = `${now.getMonth() + 1}월 ${now.getDate()}일`;
  const weekday = WEEKDAY_KO[dayOfWeek];

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : 100;

  const fetchData = async () => {
    try {
      const [schRes, todoRes] = await Promise.allSettled([
        fetch(`${apiUrl}/schedule`),
        fetch(`${apiUrl}/todos`),
      ]);
      if (schRes.status === "fulfilled" && schRes.value.ok) {
        const all: Schedule[] = await schRes.value.json();
        setTodaySchedules(
          all.filter((s) => s.dayOfWeek === dayOfWeek)
             .sort((a, b) => a.startTime.localeCompare(b.startTime))
        );
      }
      if (todoRes.status === "fulfilled" && todoRes.value.ok) {
        setTodos(await todoRes.value.json());
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const toggleTodo = async (id: number, completed: boolean) => {
    try {
      const res = await fetch(`${apiUrl}/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
  };

  const deleteTodo = async (id: number) => {
    try {
      await fetch(`${apiUrl}/todos/${id}`, { method: "DELETE" });
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch {}
  };

  const addTodo = async (data: { title: string; category: string }) => {
    try {
      const res = await fetch(`${apiUrl}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = await res.json();
        setTodos((prev) => [created, ...prev]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {}
  };

  const incomplete = todos.filter((t) => !t.completed);
  const complete = todos.filter((t) => t.completed);

  if (loading) {
    return (
      <View style={[styles.loadWrap, { paddingTop: topPad }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: C.background }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top App Bar ── */}
        <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
          <View style={styles.topBrand}>
            <View style={styles.logoWrap}>
              <Image source={require("@/assets/logo.png")} style={styles.logoImg} resizeMode="cover" />
            </View>
            <Text style={styles.logoText}>P:um</Text>
          </View>
          <Pressable style={styles.bellBtn} onPress={() => router.push("/(tabs)/notices" as any)}>
            <Feather name="bell" size={22} color={C.text} />
          </Pressable>
        </View>

        <View style={styles.content}>
          {/* ── Hero Date ── */}
          <View style={styles.heroSection}>
            <Text style={styles.heroLabel}>부산대학교</Text>
            <Text style={styles.heroDate}>
              {monthDay}{" "}
              <Text style={styles.heroWeekday}>{weekday}</Text>
            </Text>
          </View>

          {/* ── Quick Links ── */}
          <View style={styles.quickSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
              {QUICK_LINKS.map((link) => (
                <Pressable
                  key={link.label}
                  style={({ pressed }) => [styles.quickItem, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => {
                    if (link.external) {
                      Linking.openURL(link.href as string);
                    } else {
                      router.push((link as any).route as any);
                    }
                  }}
                >
                  <View style={styles.quickIconBox}>
                    <Feather name={link.icon} size={26} color={C.primary} />
                  </View>
                  <Text style={styles.quickLabel}>{link.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* ── 오늘 시간표 ── */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>오늘 시간표</Text>
              <Pressable onPress={() => router.push("/(tabs)/timetable" as any)}>
                <Text style={styles.seeAll}>전체 보기</Text>
              </Pressable>
            </View>

            {todaySchedules.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="calendar" size={32} color={C.textTertiary} />
                <Text style={styles.emptyText}>오늘 수업이 없어요</Text>
              </View>
            ) : (
              <View style={styles.scheduleList}>
                {todaySchedules.map((s, i) => (
                  <TimetableItem key={s.id} schedule={s} colorIndex={i} />
                ))}
              </View>
            )}
          </View>

          {/* ── 할 일 ── */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>할 일</Text>
              <Pressable
                style={styles.addBtn}
                onPress={() => setShowAddTodo(true)}
              >
                <Feather name="plus" size={16} color={C.primary} />
                <Text style={styles.addBtnText}>추가</Text>
              </Pressable>
            </View>

            <View style={styles.todoCard}>
              {incomplete.length === 0 && complete.length === 0 ? (
                <View style={styles.emptyTodoBox}>
                  <Feather name="check-circle" size={32} color={C.textTertiary} />
                  <Text style={styles.emptyText}>할 일을 추가해보세요</Text>
                </View>
              ) : (
                <>
                  {[...incomplete, ...complete].map((todo) => (
                    <TodoRow
                      key={todo.id}
                      todo={todo}
                      onToggle={toggleTodo}
                      onDelete={deleteTodo}
                    />
                  ))}
                </>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {showAddTodo && (
        <AddTodoModal
          onClose={() => setShowAddTodo(false)}
          onAdd={async (data) => { await addTodo(data); setShowAddTodo(false); }}
        />
      )}
    </>
  );
}

function TimetableItem({ schedule, colorIndex }: { schedule: Schedule; colorIndex: number }) {
  const color = schedule.color || SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length];
  return (
    <View style={styles.scheduleItem}>
      <View style={styles.scheduleTimeCol}>
        <Text style={styles.scheduleTimeLabel}>시작</Text>
        <Text style={styles.scheduleTime}>{schedule.startTime}</Text>
      </View>
      <View style={styles.scheduleDivider} />
      <View style={styles.scheduleInfo}>
        <Text style={styles.scheduleSubject} numberOfLines={1}>{schedule.subjectName}</Text>
        {schedule.location ? (
          <View style={styles.scheduleLocRow}>
            <Feather name="map-pin" size={12} color={C.textSecondary} />
            <Text style={styles.scheduleLoc}>{schedule.location}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.scheduleBar, { backgroundColor: color }]} />
    </View>
  );
}

function TodoRow({
  todo, onToggle, onDelete,
}: {
  todo: Todo;
  onToggle: (id: number, v: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const cat = CATEGORY_COLORS[todo.category] || CATEGORY_COLORS["기타"];

  const confirmDelete = () => {
    Alert.alert("삭제", "이 할 일을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => onDelete(todo.id) },
    ]);
  };

  const daysLeft = todo.dueDate
    ? Math.ceil((new Date(todo.dueDate).getTime() - Date.now()) / 86400000)
    : null;
  const dLabel =
    daysLeft === null ? null
    : daysLeft < 0 ? `D+${Math.abs(daysLeft)}`
    : daysLeft === 0 ? "오늘"
    : `D-${daysLeft}`;
  const isOverdue = daysLeft !== null && daysLeft < 0 && !todo.completed;

  return (
    <View style={styles.todoRow}>
      <Pressable onPress={() => onToggle(todo.id, !todo.completed)} style={styles.todoCheck}>
        <Feather
          name={todo.completed ? "check-circle" : "circle"}
          size={22}
          color={todo.completed ? C.primary : C.border}
        />
      </Pressable>
      <View style={styles.todoInfo}>
        <Text style={[styles.todoTitle, todo.completed && styles.todoCompleted]} numberOfLines={1}>
          {todo.title}
        </Text>
        <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
          <Text style={[styles.catText, { color: cat.text }]}>{todo.category}</Text>
        </View>
      </View>
      {dLabel && (
        <View style={[styles.dDayBadge, { backgroundColor: isOverdue ? "#FEF2F2" : C.primaryLight }]}>
          <Text style={[styles.dDayText, { color: isOverdue ? C.danger : C.primary }]}>{dLabel}</Text>
        </View>
      )}
      <Pressable onPress={confirmDelete} style={styles.todoDelete}>
        <Feather name="x" size={16} color={C.textTertiary} />
      </Pressable>
    </View>
  );
}

function AddTodoModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (data: { title: string; category: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("과제");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onAdd({ title: title.trim(), category });
    setSaving(false);
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>할 일 추가</Text>

        <TextInput
          style={styles.modalInput}
          placeholder="할 일을 입력하세요"
          placeholderTextColor={C.textTertiary}
          value={title}
          onChangeText={setTitle}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />

        <Text style={styles.modalLabel}>카테고리</Text>
        <View style={styles.catRow}>
          {TODO_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={[styles.catChip, category === cat && { backgroundColor: C.primary }]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catChipText, category === cat && { color: "#fff" }]}>{cat}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.modalSaveBtn, { opacity: saving ? 0.7 : 1 }]}
          onPress={handleAdd}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.modalSaveBtnText}>추가하기</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loadWrap: { flex: 1, backgroundColor: C.background, alignItems: "center", justifyContent: "center" },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  topBrand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoWrap: { width: 32, height: 32, borderRadius: 10, overflow: "hidden", backgroundColor: C.borderLight },
  logoImg: { width: 32, height: 32 },
  logoText: { fontFamily: "Inter_700Bold", fontSize: 17, color: C.primary, letterSpacing: -0.3 },
  bellBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  content: { paddingHorizontal: 20 },

  heroSection: { marginTop: 28, marginBottom: 28 },
  heroLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: C.primary,
    marginBottom: 6,
  },
  heroDate: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    color: C.text,
    letterSpacing: -1,
    lineHeight: 42,
  },
  heroWeekday: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    color: C.border,
    letterSpacing: -1,
  },

  quickSection: { marginBottom: 28, marginHorizontal: -20 },
  quickScroll: { paddingHorizontal: 20, gap: 16 },
  quickItem: { alignItems: "center", width: 64 },
  quickIconBox: {
    width: 64,
    height: 64,
    backgroundColor: C.surface,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00427d",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 8,
  },
  quickLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: C.textSecondary,
    textAlign: "center",
    letterSpacing: 0.5,
  },

  section: { marginBottom: 28 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text, letterSpacing: -0.5 },
  seeAll: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.primary },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.primary },

  emptyCard: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary },

  scheduleList: { gap: 12 },
  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
    borderWidth: 0.5,
    borderColor: C.border,
    gap: 16,
  },
  scheduleTimeCol: { alignItems: "center", width: 48 },
  scheduleTimeLabel: { fontFamily: "Inter_700Bold", fontSize: 9, color: C.textTertiary, letterSpacing: 1, textTransform: "uppercase" },
  scheduleTime: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.primary, marginTop: 2 },
  scheduleDivider: { width: 0.5, height: 40, backgroundColor: C.border },
  scheduleInfo: { flex: 1 },
  scheduleSubject: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text },
  scheduleLocRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  scheduleLoc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  scheduleBar: { width: 5, height: 40, borderRadius: 3 },

  todoCard: {
    backgroundColor: C.surface,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  emptyTodoBox: { alignItems: "center", paddingVertical: 32, gap: 10 },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderColor: C.borderLight,
    gap: 12,
  },
  todoCheck: { padding: 2 },
  todoInfo: { flex: 1, gap: 4 },
  todoTitle: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.text, lineHeight: 20 },
  todoCompleted: { textDecorationLine: "line-through", color: C.textTertiary },
  catBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  catText: { fontFamily: "Inter_700Bold", fontSize: 10 },
  dDayBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignItems: "center" },
  dDayText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  todoDelete: { padding: 4 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  modalLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary, marginTop: 4 },
  modalInput: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
  },
  catChipText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary },
  modalSaveBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  modalSaveBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
});
