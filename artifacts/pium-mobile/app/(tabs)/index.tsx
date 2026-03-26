import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth, useApiUrl } from "@/contexts/AuthContext";

const C = Colors.light;

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const SUBJECT_COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316",
];

interface Schedule {
  id: number;
  subjectName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string;
  color?: string;
}

interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

interface Notice {
  id: string;
  title: string;
  date: string;
  isPinned: boolean;
}

function formatBalance(n: number) {
  const abs = Math.abs(n);
  const formatted = abs >= 10000
    ? `${Math.floor(abs / 10000)}만${abs % 10000 > 0 ? ` ${(abs % 10000).toLocaleString()}` : ""}원`
    : `${abs.toLocaleString()}원`;
  return n >= 0 ? `+${formatted}` : `-${formatted}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const apiUrl = useApiUrl();

  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeb = Platform.OS === "web";
  const topPadding = isWeb ? 67 : insets.top;
  const bottomPadding = isWeb ? 34 : 100;

  const fetchData = async () => {
    try {
      const [schRes, finRes, noticeRes] = await Promise.allSettled([
        fetch(`${apiUrl}/schedule`),
        fetch(`${apiUrl}/finance/summary?month=${now.toISOString().slice(0, 7)}`),
        fetch(`${apiUrl}/notices`),
      ]);

      if (schRes.status === "fulfilled" && schRes.value.ok) {
        const all: Schedule[] = await schRes.value.json();
        setTodaySchedules(all.filter((s) => s.dayOfWeek === dayOfWeek));
      }
      if (finRes.status === "fulfilled" && finRes.value.ok) {
        setFinance(await finRes.value.json());
      }
      if (noticeRes.status === "fulfilled" && noticeRes.value.ok) {
        const data = await noticeRes.value.json();
        const list: Notice[] = (data.notices || data || []).slice(0, 4);
        setNotices(list);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 6) return "새벽이네요";
    if (hour < 12) return "좋은 아침이에요";
    if (hour < 18) return "안녕하세요";
    return "좋은 저녁이에요";
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: topPadding }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.background }}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userName}>{user?.name || user?.username} 님</Text>
        </View>
        <Pressable
          style={styles.notifBtn}
          onPress={() => router.push("/notices")}
        >
          <Feather name="bell" size={22} color={C.text} />
        </Pressable>
      </View>

      {/* Date */}
      <View style={styles.dateRow}>
        <Text style={styles.dateText}>
          {now.getMonth() + 1}월 {now.getDate()}일 ({DAYS[dayOfWeek]})
        </Text>
        {user?.department && (
          <View style={styles.deptBadge}>
            <Text style={styles.deptText}>{user.department}</Text>
          </View>
        )}
      </View>

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <Pressable style={[styles.statCard, { backgroundColor: C.primary }]} onPress={() => router.push("/budget")}>
          <Feather name="trending-up" size={20} color="rgba(255,255,255,0.8)" />
          <Text style={styles.statLabel}>이번달 잔고</Text>
          <Text style={styles.statValue}>
            {finance
              ? `${finance.balance >= 0 ? "" : "-"}${Math.abs(finance.balance).toLocaleString()}원`
              : "—"}
          </Text>
        </Pressable>
        <Pressable style={[styles.statCard, { backgroundColor: C.accent }]} onPress={() => router.push("/grades")}>
          <Feather name="award" size={20} color="rgba(255,255,255,0.8)" />
          <Text style={styles.statLabel}>성적 확인</Text>
          <Text style={styles.statValue}>성적표 보기</Text>
        </Pressable>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>빠른 메뉴</Text>
        <View style={styles.quickActions}>
          {[
            { label: "버스", icon: "navigation", route: "/bus" },
            { label: "학사일정", icon: "book-open", route: "/calendar" },
            { label: "캠퍼스맵", icon: "map", route: "/map" },
            { label: "설정", icon: "settings", route: "/settings" },
          ].map((item) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [styles.quickItem, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={styles.quickIconBox}>
                <Feather name={item.icon as any} size={22} color={C.primary} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Today's Schedule */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>오늘 수업</Text>
          <Pressable onPress={() => router.push("/(tabs)/timetable")}>
            <Text style={styles.seeAll}>전체 보기</Text>
          </Pressable>
        </View>
        {todaySchedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="coffee" size={28} color={C.textTertiary} />
            <Text style={styles.emptyText}>오늘은 수업이 없어요</Text>
          </View>
        ) : (
          todaySchedules.map((s, i) => (
            <View key={s.id} style={styles.scheduleItem}>
              <View
                style={[
                  styles.scheduleColor,
                  { backgroundColor: s.color || SUBJECT_COLORS[i % SUBJECT_COLORS.length] },
                ]}
              />
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleName}>{s.subjectName}</Text>
                <Text style={styles.scheduleTime}>
                  {s.startTime} – {s.endTime}
                  {s.location ? ` · ${s.location}` : ""}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Notices */}
      <View style={[styles.section, { marginBottom: 8 }]}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>공지사항</Text>
          <Pressable onPress={() => router.push("/notices")}>
            <Text style={styles.seeAll}>전체 보기</Text>
          </Pressable>
        </View>
        {notices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="bell-off" size={28} color={C.textTertiary} />
            <Text style={styles.emptyText}>공지사항을 불러오는 중...</Text>
          </View>
        ) : (
          notices.map((n) => (
            <View key={n.id} style={styles.noticeItem}>
              {n.isPinned && (
                <View style={[styles.pinnedBadge, { backgroundColor: C.primaryLight }]}>
                  <Text style={[styles.pinnedText, { color: C.primary }]}>공지</Text>
                </View>
              )}
              <Text style={styles.noticeTitle} numberOfLines={1}>{n.title}</Text>
              <Text style={styles.noticeDate}>{n.date}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 4,
    backgroundColor: C.background,
  },
  greeting: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: C.textSecondary,
  },
  userName: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: C.text,
    marginTop: 2,
  },
  notifBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  dateText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.textSecondary,
  },
  deptBadge: {
    backgroundColor: C.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deptText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: C.primary,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: C.text,
  },
  seeAll: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.primary,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickItem: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  quickIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: C.textSecondary,
  },
  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  scheduleColor: {
    width: 4,
    height: "100%",
    borderRadius: 2,
    marginRight: 12,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.text,
  },
  scheduleTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textTertiary,
  },
  noticeItem: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  pinnedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  pinnedText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  noticeTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.text,
    marginBottom: 4,
  },
  noticeDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textTertiary,
  },
});
