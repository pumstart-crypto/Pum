import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { useApiUrl } from "@/contexts/AuthContext";

const C = Colors.light;

interface CalEvent {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  category?: string;
  color?: string;
}

const EVENT_COLORS: Record<string, string> = {
  시험: "#EF4444",
  수강신청: "#8B5CF6",
  방학: "#10B981",
  행사: "#F59E0B",
  등록: "#3B82F6",
  기타: "#6B7280",
};

const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

export default function CalendarScreen() {
  const apiUrl = useApiUrl();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const year = now.getFullYear();

  const fetchCalendar = async () => {
    try {
      const res = await fetch(`${apiUrl}/schedule/academic`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || data || []);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchCalendar(); }, []);

  const monthEvents = events.filter((e) => {
    const d = new Date(e.startDate);
    return d.getMonth() === selectedMonth;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCalendar();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* Month Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.monthScroll}
        contentContainerStyle={styles.monthList}
      >
        {MONTHS.map((m, i) => (
          <Pressable
            key={m}
            style={[styles.monthChip, i === selectedMonth && { backgroundColor: C.primary }]}
            onPress={() => setSelectedMonth(i)}
          >
            <Text style={[styles.monthText, i === selectedMonth && { color: "#fff" }]}>{m}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        >
          <Text style={styles.monthHeader}>{year}년 {MONTHS[selectedMonth]}</Text>

          {monthEvents.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="calendar" size={48} color={C.textTertiary} />
              <Text style={styles.emptyText}>이번 달 일정이 없습니다</Text>
            </View>
          ) : (
            monthEvents.map((e) => {
              const d = new Date(e.startDate);
              const color = e.color || EVENT_COLORS[e.category || "기타"] || C.primary;
              return (
                <View key={e.id} style={styles.eventCard}>
                  <View style={[styles.dateBadge, { backgroundColor: color + "20" }]}>
                    <Text style={[styles.dateDay, { color }]}>{d.getDate()}</Text>
                    <Text style={[styles.dateWeekday, { color }]}>
                      {["일", "월", "화", "수", "목", "금", "토"][d.getDay()]}
                    </Text>
                  </View>
                  <View style={styles.eventInfo}>
                    <View style={styles.eventTitleRow}>
                      <View style={[styles.eventDot, { backgroundColor: color }]} />
                      <Text style={styles.eventTitle}>{e.title}</Text>
                    </View>
                    {e.category && (
                      <View style={[styles.catBadge, { backgroundColor: color + "20" }]}>
                        <Text style={[styles.catBadgeText, { color }]}>{e.category}</Text>
                      </View>
                    )}
                    {e.endDate && e.endDate !== e.startDate && (
                      <Text style={styles.eventEnd}>
                        ~ {new Date(e.endDate).getMonth() + 1}/{new Date(e.endDate).getDate()}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  monthScroll: { maxHeight: 48, marginTop: 8 },
  monthList: { paddingHorizontal: 16, gap: 8 },
  monthChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  monthText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary },
  monthHeader: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text, marginBottom: 16 },
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textTertiary },
  eventCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dateBadge: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dateDay: { fontFamily: "Inter_700Bold", fontSize: 22 },
  dateWeekday: { fontFamily: "Inter_500Medium", fontSize: 11 },
  eventInfo: { flex: 1, gap: 4 },
  eventTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eventDot: { width: 6, height: 6, borderRadius: 3 },
  eventTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, flex: 1 },
  catBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  eventEnd: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary },
});
