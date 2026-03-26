import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Platform, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface CalendarEvent {
  id?: number;
  title: string;
  startDate: string;
  endDate?: string;
  category: string;
  description?: string;
  source?: string;
}

const CAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '학사': { bg: '#DBEAFE', text: '#1D4ED8', border: '#3B82F6' },
  '시험': { bg: '#FEE2E2', text: '#DC2626', border: '#EF4444' },
  '행사': { bg: '#D1FAE5', text: '#059669', border: '#10B981' },
  '등록': { bg: '#EDE9FE', text: '#7C3AED', border: '#8B5CF6' },
  '방학': { bg: '#FEF3C7', text: '#D97706', border: '#F59E0B' },
};
const DEFAULT_CAT = { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' };

function fmtDate(d: string) {
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function fmtDateFull(d: string) {
  const date = new Date(d);
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. (${weekDays[date.getDay()]})`;
}

function isUpcoming(event: CalendarEvent) {
  const end = new Date(event.endDate || event.startDate);
  end.setHours(23, 59, 59);
  return end >= new Date();
}

export default function AcademicCalendarScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterCat, setFilterCat] = useState('전체');
  const [showPastEvents, setShowPastEvents] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const r = await fetch(`${API}/academic-calendar`);
      if (r.ok) setEvents(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, [fetchEvents]);

  const categories = ['전체', ...Array.from(new Set(events.map(e => e.category))).filter(Boolean)];
  const filtered = events.filter(e => filterCat === '전체' || e.category === filterCat)
    .filter(e => showPastEvents || isUpcoming(e));

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>학사일정</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://www.pusan.ac.kr/kor/CMS/UniversitySchedule/list.do')} style={styles.externalBtn}>
          <Feather name="external-link" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
        {categories.map(cat => (
          <TouchableOpacity key={cat} style={[styles.filterChip, filterCat === cat && styles.filterChipActive]} onPress={() => setFilterCat(cat)}>
            <Text style={[styles.filterText, filterCat === cat && styles.filterTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 50 : 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="calendar" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>일정이 없습니다</Text>
            {!showPastEvents && events.length > 0 && (
              <TouchableOpacity onPress={() => setShowPastEvents(true)}>
                <Text style={styles.showPastText}>지난 일정 보기</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {filtered.map((event, i) => {
              const cat = CAT_COLORS[event.category] || DEFAULT_CAT;
              const hasRange = event.endDate && event.endDate !== event.startDate;
              const today = new Date();
              const start = new Date(event.startDate);
              const end = new Date(event.endDate || event.startDate);
              const isOngoing = start <= today && end >= today;
              return (
                <View key={i} style={[styles.eventCard, { borderLeftColor: cat.border }]}>
                  <View style={styles.eventLeft}>
                    <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
                      <Text style={[styles.catText, { color: cat.text }]}>{event.category}</Text>
                    </View>
                    {isOngoing && (
                      <View style={styles.ongoingBadge}>
                        <View style={styles.ongoingDot} />
                        <Text style={styles.ongoingText}>진행중</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventDate}>
                      {fmtDateFull(event.startDate)}{hasRange ? ` ~ ${fmtDateFull(event.endDate!)}` : ''}
                    </Text>
                    {event.description && <Text style={styles.eventDesc}>{event.description}</Text>}
                  </View>
                </View>
              );
            })}
            {!showPastEvents && (
              <TouchableOpacity style={styles.showPastBtn} onPress={() => setShowPastEvents(true)}>
                <Feather name="clock" size={14} color="#6B7280" />
                <Text style={styles.showPastBtnText}>지난 일정 포함</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' },
  externalBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  filterScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterContainer: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  filterChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  filterText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  filterTextActive: { color: C.primary },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#374151' },
  showPastText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  eventCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1, flexDirection: 'row', gap: 12 },
  eventLeft: { gap: 6, alignItems: 'flex-start' },
  catBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  catText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  ongoingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  ongoingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#059669' },
  ongoingText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#059669' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827', lineHeight: 20 },
  eventDate: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular', marginTop: 4 },
  eventDesc: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 4 },
  showPastBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  showPastBtnText: { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_500Medium' },
});
