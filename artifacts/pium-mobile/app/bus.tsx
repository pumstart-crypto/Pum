import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface BusSchedule {
  departureTime: string;
  route: string;
  stops?: string[];
  note?: string;
  direction?: string;
}

interface BusData {
  routeName: string;
  description?: string;
  schedules: BusSchedule[];
}

function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getNextBus(schedules: BusSchedule[]): BusSchedule | null {
  const now = new Date();
  const curMins = now.getHours() * 60 + now.getMinutes();
  return schedules.find(s => timeToMins(s.departureTime) > curMins) || null;
}

function timeUntil(depTime: string): string {
  const now = new Date();
  const curMins = now.getHours() * 60 + now.getMinutes();
  const diff = timeToMins(depTime) - curMins;
  if (diff < 0) return '출발';
  if (diff === 0) return '지금 출발';
  if (diff < 60) return `${diff}분 후`;
  return `${Math.floor(diff / 60)}시간 ${diff % 60}분 후`;
}

export default function BusScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [busData, setBusData] = useState<BusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const fetchBus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/bus/schedules`);
      if (r.ok) setBusData(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBus(); }, [fetchBus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBus();
    setRefreshing(false);
  }, [fetchBus]);

  const currentRoute = busData[selectedRoute];
  const nextBus = currentRoute ? getNextBus(currentRoute.schedules) : null;

  const now = new Date();
  const curMins = now.getHours() * 60 + now.getMinutes();

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>순환버스</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 50 : 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : busData.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="navigation" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>버스 정보 없음</Text>
            <Text style={styles.emptyDesc}>순환버스 운행 정보를 불러올 수 없습니다</Text>
          </View>
        ) : (
          <>
            {/* Route selector */}
            {busData.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routeScroll} contentContainerStyle={styles.routeContainer}>
                {busData.map((route, i) => (
                  <TouchableOpacity key={i} style={[styles.routeChip, selectedRoute === i && styles.routeChipActive]} onPress={() => setSelectedRoute(i)}>
                    <Text style={[styles.routeChipText, selectedRoute === i && styles.routeChipTextActive]}>{route.routeName}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {currentRoute && (
              <>
                {/* Next bus card */}
                {nextBus ? (
                  <View style={styles.nextBusCard}>
                    <View style={styles.nextBusIcon}>
                      <Feather name="navigation" size={24} color="#fff" />
                    </View>
                    <View style={styles.nextBusInfo}>
                      <Text style={styles.nextBusLabel}>다음 버스</Text>
                      <Text style={styles.nextBusTime}>{nextBus.departureTime}</Text>
                      {nextBus.route && <Text style={styles.nextBusRoute}>{nextBus.route}</Text>}
                    </View>
                    <View style={styles.nextBusCountdown}>
                      <Text style={styles.countdownText}>{timeUntil(nextBus.departureTime)}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noMoreCard}>
                    <Feather name="moon" size={20} color="#6B7280" />
                    <Text style={styles.noMoreText}>오늘 운행이 종료되었습니다</Text>
                  </View>
                )}

                {/* Description */}
                {currentRoute.description && (
                  <View style={styles.descCard}>
                    <Feather name="info" size={14} color="#6B7280" />
                    <Text style={styles.descText}>{currentRoute.description}</Text>
                  </View>
                )}

                {/* Schedule table */}
                <View style={styles.scheduleCard}>
                  <TouchableOpacity style={styles.scheduleHeader} onPress={() => setExpanded(e => !e)}>
                    <Text style={styles.scheduleTitle}>전체 시간표</Text>
                    <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
                  </TouchableOpacity>
                  {(expanded ? currentRoute.schedules : currentRoute.schedules.slice(0, 6)).map((s, i) => {
                    const isPast = timeToMins(s.departureTime) < curMins;
                    const isNext = s === nextBus;
                    return (
                      <View key={i} style={[styles.scheduleRow, isNext && styles.scheduleRowNext, isPast && styles.scheduleRowPast]}>
                        <Text style={[styles.scheduleTime, isPast && styles.schedulePast, isNext && styles.scheduleNextTime]}>
                          {s.departureTime}
                        </Text>
                        <Text style={[styles.scheduleRoute, isPast && styles.schedulePast]} numberOfLines={1}>
                          {s.route || s.direction || ''}
                        </Text>
                        {s.note && <Text style={styles.scheduleNote}>{s.note}</Text>}
                        {isNext && <View style={styles.nextDot} />}
                      </View>
                    );
                  })}
                  {!expanded && currentRoute.schedules.length > 6 && (
                    <TouchableOpacity style={styles.showMoreBtn} onPress={() => setExpanded(true)}>
                      <Text style={styles.showMoreText}>+{currentRoute.schedules.length - 6}개 더 보기</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
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
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  routeScroll: { marginBottom: 0 },
  routeContainer: { gap: 8, paddingVertical: 4 },
  routeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  routeChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  routeChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  routeChipTextActive: { color: C.primary },
  nextBusCard: {
    backgroundColor: C.primary, borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  nextBusIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  nextBusInfo: { flex: 1 },
  nextBusLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular' },
  nextBusTime: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#fff', marginTop: 2 },
  nextBusRoute: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  nextBusCountdown: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  countdownText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },
  noMoreCard: { backgroundColor: '#F3F4F6', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  noMoreText: { fontSize: 14, color: '#6B7280', fontFamily: 'Inter_500Medium' },
  descCard: { backgroundColor: '#FEF3C7', borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  descText: { fontSize: 13, color: '#92400E', fontFamily: 'Inter_400Regular', flex: 1 },
  scheduleCard: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  scheduleTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#111827' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', position: 'relative' },
  scheduleRowNext: { backgroundColor: '#EEF4FF' },
  scheduleRowPast: { opacity: 0.4 },
  scheduleTime: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#111827', minWidth: 50 },
  scheduleNextTime: { color: C.primary },
  scheduleRoute: { flex: 1, fontSize: 13, color: '#374151', fontFamily: 'Inter_400Regular' },
  scheduleNote: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  schedulePast: { color: '#D1D5DB' },
  nextDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  showMoreBtn: { alignItems: 'center', paddingVertical: 14 },
  showMoreText: { fontSize: 13, color: C.primary, fontFamily: 'Inter_600SemiBold' },
});
