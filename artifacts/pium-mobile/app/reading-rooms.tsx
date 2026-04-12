import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Linking, RefreshControl,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const isWeb = Platform.OS === 'web';

const PYXIS_DIRECT = 'https://lib.pusan.ac.kr/pyxis-api/1/seat-rooms?homepageId=1&smufMethodCode=SEAT&branchGroupId=1';
const PYXIS_PROXY = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/library/seat-rooms`;
const PYXIS_API = isWeb ? PYXIS_PROXY : PYXIS_DIRECT;
const RESERVE_URL = 'https://lib.pusan.ac.kr/facility/seat';

interface SeatRoom {
  id: number;
  name: string;
  floor: number;
  roomType: { id: number; name: string; sortOrder: number };
  branch: { id: number; name: string; alias: string };
  isChargeable: boolean;
  unableMessage: string | null;
  waitRoomGroup: null;
  seats: {
    total: number;
    occupied: number;
    available: number;
    waiting: number;
    unavailable: number;
  };
}

type StatusKey = 'available' | 'crowded' | 'full' | 'disabled';

function getStatus(room: SeatRoom): StatusKey {
  if (room.unableMessage) return 'disabled';
  const { available, total } = room.seats;
  if (available === 0) return 'full';
  if (available / total < 0.2) return 'crowded';
  return 'available';
}

const STATUS_CONFIG: Record<StatusKey, { label: string; bg: string; text: string; dot: string }> = {
  available: { label: '여유',    bg: '#D1FAE5', text: '#059669', dot: '#10B981' },
  crowded:   { label: '혼잡',    bg: '#FEF3C7', text: '#D97706', dot: '#F59E0B' },
  full:      { label: '만석',    bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444' },
  disabled:  { label: '사용불가', bg: '#F3F4F6', text: '#9CA3AF', dot: '#D1D5DB' },
};

function groupByFloor(rooms: SeatRoom[]): Record<number, SeatRoom[]> {
  const groups: Record<number, SeatRoom[]> = {};
  for (const r of rooms) {
    if (!groups[r.floor]) groups[r.floor] = [];
    groups[r.floor].push(r);
  }
  return groups;
}

function RoomCard({ room }: { room: SeatRoom }) {
  const status = getStatus(room);
  const cfg = STATUS_CONFIG[status];
  const { total, occupied, available } = room.seats;
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const barColor = status === 'available' ? '#10B981' : status === 'crowded' ? '#F59E0B' : '#EF4444';
  const isDisabled = status === 'disabled';

  return (
    <View style={[styles.roomCard, isDisabled && styles.roomCardDisabled]}>
      <View style={styles.roomCardTop}>
        <View style={styles.roomNameRow}>
          <Text style={[styles.roomName, isDisabled && styles.disabledText]} numberOfLines={1}>
            {room.name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
            <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>

        {isDisabled ? (
          <Text style={styles.unableMsg} numberOfLines={2}>
            {(room.unableMessage || '').replace(/<br\s*\/?>/gi, ' ')}
          </Text>
        ) : (
          <View style={styles.seatCountRow}>
            <Text style={styles.availableCount}>
              <Text style={[styles.availableNum, { color: barColor }]}>{available}</Text>
              <Text style={styles.totalCount}>/{total}</Text>
            </Text>
            <Text style={styles.seatLabel}>잔여석</Text>
          </View>
        )}
      </View>

      {!isDisabled && (
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${pct}%` as any, backgroundColor: barColor },
            ]}
          />
        </View>
      )}
    </View>
  );
}

function SummaryBar({ rooms }: { rooms: SeatRoom[] }) {
  const active = rooms.filter(r => !r.unableMessage);
  const totalSeats = active.reduce((s, r) => s + r.seats.total, 0);
  const availSeats = active.reduce((s, r) => s + r.seats.available, 0);
  const fullRooms = active.filter(r => r.seats.available === 0).length;

  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryNum}>{availSeats}</Text>
        <Text style={styles.summaryLabel}>잔여석</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryNum}>{totalSeats}</Text>
        <Text style={styles.summaryLabel}>총 좌석</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryNum, fullRooms > 0 && { color: '#EF4444' }]}>{fullRooms}</Text>
        <Text style={styles.summaryLabel}>만석 열람실</Text>
      </View>
    </View>
  );
}

export default function ReadingRoomsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = isWeb ? 67 : insets.top;
  const [rooms, setRooms] = useState<SeatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const res = await fetch(PYXIS_API, {
        headers: {
          'User-Agent': 'Mozilla/5.0 Chrome/146.0.0.0',
          'Accept': 'application/json',
          'Referer': 'https://lib.pusan.ac.kr/facility/seat',
        },
      });
      const json = await res.json();
      if (json.success && json.data?.list) {
        setRooms(json.data.list as SeatRoom[]);
        setLastUpdated(new Date());
      } else {
        setError('데이터를 불러올 수 없습니다.');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    intervalRef.current = setInterval(() => fetchRooms(true), 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchRooms]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchRooms(true);
  }, [fetchRooms]);

  const grouped = groupByFloor(rooms);
  const floors = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>열람실 현황</Text>
          <Text style={styles.headerSub}>새벽벌도서관 · 실시간</Text>
        </View>
        <TouchableOpacity
          onPress={() => fetchRooms()}
          hitSlop={12}
          style={styles.refreshBtn}
          disabled={isLoading}
        >
          {isLoading && !isRefreshing ? (
            <ActivityIndicator size="small" color={C.primary} />
          ) : (
            <Feather name="refresh-cw" size={20} color={C.primary} />
          )}
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Feather name="wifi-off" size={40} color="#D1D5DB" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchRooms()}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading && rooms.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>좌석 현황을 불러오는 중...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Summary */}
          {rooms.length > 0 && <SummaryBar rooms={rooms} />}

          {/* Last updated */}
          {timeStr ? (
            <View style={styles.updatedRow}>
              <Feather name="clock" size={12} color="#9CA3AF" />
              <Text style={styles.updatedText}>마지막 갱신: {timeStr} (1분마다 자동 갱신)</Text>
            </View>
          ) : null}

          {/* Floor groups */}
          {floors.map(floor => (
            <View key={floor} style={styles.floorSection}>
              <View style={styles.floorHeader}>
                <View style={styles.floorBadge}>
                  <Text style={styles.floorBadgeText}>{floor}F</Text>
                </View>
                <Text style={styles.floorLabel}>{floor}층</Text>
                <View style={styles.floorDivider} />
              </View>
              {grouped[floor].map(room => (
                <RoomCard key={room.id} room={room} />
              ))}
            </View>
          ))}

          {/* Reserve CTA */}
          <TouchableOpacity
            style={styles.reserveBtn}
            onPress={() => Linking.openURL(RESERVE_URL)}
            activeOpacity={0.85}
          >
            <Ionicons name="bookmark-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.reserveBtnText}>도서관 홈페이지에서 예약하기</Text>
            <Feather name="external-link" size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1, fontFamily: 'Inter_400Regular' },
  refreshBtn: { padding: 4, width: 32, alignItems: 'center' },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  errorText: { fontSize: 14, color: '#6B7280', textAlign: 'center', fontFamily: 'Inter_400Regular' },
  retryBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryNum: { fontSize: 22, fontWeight: '800', color: C.primary, fontFamily: 'Inter_700Bold' },
  summaryLabel: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  summaryDivider: { width: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },

  updatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  updatedText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  floorSection: { marginBottom: 12 },
  floorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  floorBadge: {
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  floorBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
  floorLabel: { fontSize: 13, fontWeight: '600', color: '#374151', fontFamily: 'Inter_600SemiBold' },
  floorDivider: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },

  roomCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  roomCardDisabled: {
    backgroundColor: '#F9FAFB',
    opacity: 0.75,
  },
  roomCardTop: { marginBottom: 10 },
  roomNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  disabledText: { color: '#9CA3AF' },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  seatCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  availableCount: {},
  availableNum: { fontSize: 20, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  totalCount: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  seatLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular' },

  unableMsg: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },

  barTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },

  reserveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 8,
    marginBottom: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  reserveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
