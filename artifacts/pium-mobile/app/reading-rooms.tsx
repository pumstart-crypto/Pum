import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Linking, RefreshControl,
  Animated,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';
import SchoolLoginModal from '@/components/SchoolLoginModal';
import SeatPickerModal from '@/components/SeatPickerModal';
import {
  getMySeat, extendSeat, returnSeat,
  MySeatData,
} from '@/utils/seatManagement';
import {
  getSchoolSession, clearSchoolSession, SchoolSession,
} from '@/utils/schoolAuth';

const isWeb = Platform.OS === 'web';
const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const RESERVE_URL = 'https://lib.pusan.ac.kr/facility/seat';

function pyxisUrl(branchGroupId: number) {
  return isWeb
    ? `https://${DOMAIN}/api/library/seat-rooms?branchGroupId=${branchGroupId}`
    : `https://lib.pusan.ac.kr/pyxis-api/1/seat-rooms?homepageId=1&smufMethodCode=SEAT&branchGroupId=${branchGroupId}`;
}

// ── Types ─────────────────────────────────────────────────────
interface SeatRoom {
  id: number; name: string; floor: number;
  roomType: { id: number; name: string; sortOrder: number };
  branch: { id: number; name: string; alias: string };
  isChargeable: boolean; unableMessage: string | null;
  waitRoomGroup: null;
  seats: { total: number; occupied: number; available: number; waiting: number; unavailable: number };
}
type StatusKey = 'available' | 'crowded' | 'full' | 'disabled';

// ── Status helpers ─────────────────────────────────────────────
function getStatus(room: SeatRoom): StatusKey {
  if (room.unableMessage) return 'disabled';
  const { available, total } = room.seats;
  if (available === 0) return 'full';
  if (available / total < 0.2) return 'crowded';
  return 'available';
}
const STATUS_CFG: Record<StatusKey, { label: string; bg: string; text: string; dot: string; bar: string }> = {
  available: { label: '여유',    bg: '#D1FAE5', text: '#059669', dot: '#10B981', bar: '#10B981' },
  crowded:   { label: '혼잡',    bg: '#FEF3C7', text: '#D97706', dot: '#F59E0B', bar: '#F59E0B' },
  full:      { label: '만석',    bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444', bar: '#EF4444' },
  disabled:  { label: '사용불가', bg: '#F3F4F6', text: '#9CA3AF', dot: '#D1D5DB', bar: '#D1D5DB' },
};
function groupByFloor(rooms: SeatRoom[]): [number, SeatRoom[]][] {
  const map: Record<number, SeatRoom[]> = {};
  for (const r of rooms) { if (!map[r.floor]) map[r.floor] = []; map[r.floor].push(r); }
  return Object.entries(map).map(([k, v]) => [Number(k), v] as [number, SeatRoom[]]).sort((a, b) => a[0] - b[0]);
}

// ── Tabs ──────────────────────────────────────────────────────
const TABS = [
  { key: 'saebbyukbul', label: '새벽벌', branchGroupId: 1, typeFilter: '새벽벌', short: '새벽벌도서관' },
  { key: 'mirinai',     label: '미리내', branchGroupId: 1, typeFilter: '미리내', short: '미리내열람실' },
  { key: 'nano',        label: '나노생명', branchGroupId: 2, typeFilter: null,   short: '나노생명과학도서관' },
  { key: 'medical',     label: '의생명', branchGroupId: 4, typeFilter: null,    short: '의생명과학도서관' },
] as const;
type TabKey = typeof TABS[number]['key'];

// ══════════════════════════════════════════════════════════════
// Toast
// ══════════════════════════════════════════════════════════════
function useToast() {
  const [msg, setMsg] = useState('');
  const [type, setType] = useState<'success' | 'error'>('success');
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, t: 'success' | 'error' = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(message); setType(t);
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    }, 3000);
  }, [opacity]);

  const Toast = (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { opacity, backgroundColor: type === 'success' ? '#064E3B' : '#7F1D1D' },
      ]}
    >
      <Feather name={type === 'success' ? 'check-circle' : 'alert-circle'} size={15} color="#fff" />
      <Text style={styles.toastText}>{msg}</Text>
    </Animated.View>
  );
  return { show, Toast };
}

// ══════════════════════════════════════════════════════════════
// MySeatBanner
// ══════════════════════════════════════════════════════════════
interface MySeatBannerProps {
  mySeat: MySeatData | null;
  loading: boolean;
  onExtend: () => void;
  onReturn: () => void;
  onLogout: () => void;
  extending: boolean;
  returning: boolean;
}
function MySeatBanner({ mySeat, loading, onExtend, onReturn, onLogout, extending, returning }: MySeatBannerProps) {
  if (loading) {
    return (
      <View style={styles.mySeatBanner}>
        <ActivityIndicator size="small" color={C.primary} />
        <Text style={styles.mySeatLoadingText}>내 좌석 확인 중...</Text>
      </View>
    );
  }
  if (!mySeat || !mySeat.seatName) {
    return (
      <View style={[styles.mySeatBanner, styles.mySeatEmpty]}>
        <Feather name="map-pin" size={14} color="#9CA3AF" />
        <Text style={styles.mySeatEmptyText}>현재 이용 중인 좌석이 없습니다</Text>
        <TouchableOpacity onPress={onLogout} hitSlop={8}>
          <Feather name="log-out" size={14} color="#D1D5DB" />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.mySeatBanner}>
      <View style={styles.mySeatLeft}>
        <View style={styles.mySeatIconBox}>
          <Ionicons name="library" size={16} color={C.primary} />
        </View>
        <View>
          <Text style={styles.mySeatName} numberOfLines={1}>
            {mySeat.seatName}
            {mySeat.roomName ? <Text style={styles.mySeatRoom}> · {mySeat.roomName}</Text> : null}
          </Text>
          {mySeat.endTime ? (
            <Text style={styles.mySeatTime}>~{mySeat.endTime} 이용 가능</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.mySeatActions}>
        <TouchableOpacity
          style={[styles.mySeatBtn, styles.mySeatExtendBtn]}
          onPress={onExtend}
          disabled={extending || returning}
        >
          {extending
            ? <ActivityIndicator size="small" color={C.primary} />
            : <Text style={styles.mySeatExtendText}>연장</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mySeatBtn, styles.mySeatReturnBtn]}
          onPress={onReturn}
          disabled={extending || returning}
        >
          {returning
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.mySeatReturnText}>반납</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogout} hitSlop={8}>
          <Feather name="log-out" size={14} color="#D1D5DB" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// SummaryBar
// ══════════════════════════════════════════════════════════════
function SummaryBar({ rooms }: { rooms: SeatRoom[] }) {
  const active = rooms.filter(r => !r.unableMessage);
  const totalSeats = active.reduce((s, r) => s + r.seats.total, 0);
  const availSeats = active.reduce((s, r) => s + r.seats.available, 0);
  const fullRooms  = active.filter(r => r.seats.available === 0).length;
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
        <Text style={styles.summaryLabel}>만석</Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// RoomCard
// ══════════════════════════════════════════════════════════════
function RoomCard({ room, onSelect, sessionActive }: {
  room: SeatRoom;
  onSelect: (room: SeatRoom) => void;
  sessionActive: boolean;
}) {
  const status = getStatus(room);
  const cfg    = STATUS_CFG[status];
  const { total, occupied, available } = room.seats;
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const isDisabled = status === 'disabled';
  const canSelect = !isDisabled && available > 0;

  return (
    <View style={[styles.roomCard, isDisabled && styles.roomCardDisabled]}>
      <View style={styles.roomCardTop}>
        <View style={styles.roomNameRow}>
          <Text style={[styles.roomName, isDisabled && styles.disabledText]} numberOfLines={1}>{room.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
            <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>
        {isDisabled ? (
          <Text style={styles.unableMsg} numberOfLines={2}>
            {(room.unableMessage || '').replace(/<br\s*\/?>/gi, ' · ')}
          </Text>
        ) : (
          <View style={styles.seatCountRow}>
            <Text style={[styles.availableNum, { color: cfg.bar }]}>{available}</Text>
            <Text style={styles.totalCount}>/{total} 잔여석</Text>
          </View>
        )}
      </View>
      {!isDisabled && (
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: cfg.bar }]} />
        </View>
      )}
      {canSelect && (
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => onSelect(room)}
          activeOpacity={0.8}
        >
          <Feather name={sessionActive ? 'map-pin' : 'log-in'} size={13} color={C.primary} />
          <Text style={styles.selectBtnText}>
            {sessionActive ? '자리 선택' : '로그인하여 예약'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// TabContent
// ══════════════════════════════════════════════════════════════
function TabContent({
  branchGroupId, typeFilter, isActive,
  onRoomsReady, onSelectRoom, sessionActive,
}: {
  branchGroupId: number; typeFilter: string | null;
  isActive: boolean;
  onRoomsReady: (rooms: SeatRoom[]) => void;
  onSelectRoom: (room: SeatRoom) => void;
  sessionActive: boolean;
}) {
  const [rooms, setRooms] = useState<SeatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetched = useRef(false);

  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const res = await fetch(pyxisUrl(branchGroupId), {
        headers: {
          'User-Agent': 'Mozilla/5.0 Chrome/146.0.0.0',
          'Accept': 'application/json',
          'Referer': 'https://lib.pusan.ac.kr/facility/seat',
        },
      });
      const json = await res.json();
      if (json.success && json.data?.list) {
        let list: SeatRoom[] = json.data.list;
        if (typeFilter) list = list.filter(r => r.roomType?.name?.includes(typeFilter));
        setRooms(list); onRoomsReady(list); setLastUpdated(new Date());
      } else { setError('데이터를 불러올 수 없습니다.'); }
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setIsLoading(false); setIsRefreshing(false); }
  }, [branchGroupId, typeFilter, onRoomsReady]);

  useEffect(() => {
    if (!hasFetched.current) { hasFetched.current = true; fetchRooms(); }
    if (isActive) {
      intervalRef.current = setInterval(() => fetchRooms(true), 60_000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive, fetchRooms]);

  if (error) return (
    <View style={styles.loadingContainer}>
      <Feather name="wifi-off" size={36} color="#D1D5DB" />
      <Text style={styles.loadingText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtnFull} onPress={() => fetchRooms()}>
        <Text style={styles.retryBtnText}>다시 시도</Text>
      </TouchableOpacity>
    </View>
  );
  if (isLoading && rooms.length === 0) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={styles.loadingText}>좌석 현황을 불러오는 중...</Text>
    </View>
  );

  const grouped = groupByFloor(rooms);
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchRooms(true); }} tintColor={C.primary} colors={[C.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {rooms.length > 0 && <SummaryBar rooms={rooms} />}
      {timeStr ? (
        <View style={styles.updatedRow}>
          <Feather name="clock" size={11} color="#9CA3AF" />
          <Text style={styles.updatedText}>{timeStr} 기준 · 1분마다 자동 갱신</Text>
        </View>
      ) : null}
      {grouped.map(([floor, floorRooms]) => (
        <View key={floor} style={styles.floorSection}>
          <View style={styles.floorHeader}>
            <View style={styles.floorBadge}><Text style={styles.floorBadgeText}>{floor}F</Text></View>
            <Text style={styles.floorLabel}>{floor}층</Text>
            <View style={styles.floorDivider} />
            <Text style={styles.floorCount}>{floorRooms.length}개 열람실</Text>
          </View>
          {floorRooms.map(room => (
            <RoomCard key={room.id} room={room} onSelect={onSelectRoom} sessionActive={sessionActive} />
          ))}
        </View>
      ))}
      <TouchableOpacity style={styles.reserveBtn} onPress={() => Linking.openURL(RESERVE_URL)} activeOpacity={0.85}>
        <Ionicons name="bookmark-outline" size={17} color="#fff" style={{ marginRight: 7 }} />
        <Text style={styles.reserveBtnText}>도서관 홈페이지에서 예약하기</Text>
        <Feather name="external-link" size={13} color="rgba(255,255,255,0.75)" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════
// Main Screen
// ══════════════════════════════════════════════════════════════
export default function ReadingRoomsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = isWeb ? 67 : insets.top;
  const { show: showToast, Toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('saebbyukbul');
  const [tabRooms, setTabRooms] = useState<Record<TabKey, SeatRoom[]>>({
    saebbyukbul: [], mirinai: [], nano: [], medical: [],
  });

  // ── Session & my seat ──────────────────────────────────────
  const [session, setSession] = useState<SchoolSession | null>(null);
  const [mySeat, setMySeat] = useState<MySeatData | null>(null);
  const [mySeatLoading, setMySeatLoading] = useState(false);
  const [extending, setExtending] = useState(false);
  const [returning, setReturning] = useState(false);

  // ── Modals ─────────────────────────────────────────────────
  const [showLogin, setShowLogin] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerRoom, setPickerRoom] = useState<{ id: number; name: string; branch?: string } | null>(null);
  const pendingRoom = useRef<{ id: number; name: string; branch?: string } | null>(null);

  // ── Load session on mount ──────────────────────────────────
  const loadMySeat = useCallback(async () => {
    setMySeatLoading(true);
    const result = await getMySeat();
    setMySeatLoading(false);
    if (result.needsLogin) { setSession(null); await clearSchoolSession(); setMySeat(null); return; }
    if (result.success) setMySeat(result.data ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await getSchoolSession();
      if (stored) { setSession(stored); loadMySeat(); }
    })();
  }, [loadMySeat]);

  // ── Session expired handler ────────────────────────────────
  const handleSessionExpired = useCallback(() => {
    setSession(null);
    setMySeat(null);
    clearSchoolSession();
    setShowLogin(true);
  }, []);

  // ── Login success ──────────────────────────────────────────
  const handleLoginSuccess = useCallback((s: SchoolSession) => {
    setSession(s);
    setShowLogin(false);
    loadMySeat();
    if (pendingRoom.current) {
      setPickerRoom(pendingRoom.current);
      pendingRoom.current = null;
      setShowPicker(true);
    }
  }, [loadMySeat]);

  // ── Room select ────────────────────────────────────────────
  const handleSelectRoom = useCallback((room: SeatRoom) => {
    const r = { id: room.id, name: room.name, branch: room.branch?.name };
    if (!session) {
      pendingRoom.current = r;
      setShowLogin(true);
    } else {
      setPickerRoom(r);
      setShowPicker(true);
    }
  }, [session]);

  // ── Extend ─────────────────────────────────────────────────
  const handleExtend = useCallback(async () => {
    setExtending(true);
    const result = await extendSeat();
    setExtending(false);
    if (result.needsLogin) { handleSessionExpired(); return; }
    showToast(result.message, result.success ? 'success' : 'error');
    if (result.success) loadMySeat();
  }, [handleSessionExpired, showToast, loadMySeat]);

  // ── Return ─────────────────────────────────────────────────
  const handleReturn = useCallback(async () => {
    setReturning(true);
    const result = await returnSeat();
    setReturning(false);
    if (result.needsLogin) { handleSessionExpired(); return; }
    showToast(result.message, result.success ? 'success' : 'error');
    if (result.success) { setMySeat(null); }
  }, [handleSessionExpired, showToast]);

  // ── Logout ─────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await clearSchoolSession();
    setSession(null); setMySeat(null);
    showToast('로그아웃되었습니다.', 'success');
  }, [showToast]);

  const handleRoomsReady = useCallback((tabKey: TabKey) => (rooms: SeatRoom[]) => {
    setTabRooms(prev => ({ ...prev, [tabKey]: rooms }));
  }, []);

  const activeTabDef = TABS.find(t => t.key === activeTab)!;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>열람실 현황</Text>
          <Text style={styles.headerSub}>{activeTabDef.short} · 실시간</Text>
        </View>
        {/* Login/status indicator */}
        {session ? (
          <View style={styles.sessionIndicator}>
            <View style={styles.sessionDot} />
            <Text style={styles.sessionText}>로그인됨</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.headerLoginBtn}
            onPress={() => { setLoginTitle(''); setShowLogin(true); }}
            hitSlop={8}
          >
            <Feather name="log-in" size={14} color={C.primary} />
            <Text style={styles.headerLoginText}>로그인</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── My Seat Banner (shown when logged in) ── */}
      {session && (
        <MySeatBanner
          mySeat={mySeat}
          loading={mySeatLoading}
          onExtend={handleExtend}
          onReturn={handleReturn}
          onLogout={handleLogout}
          extending={extending}
          returning={returning}
        />
      )}

      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
            {tabRooms[tab.key].length > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                  {tabRooms[tab.key].reduce((s, r) => s + r.seats.available, 0)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab Content ── */}
      <View style={{ flex: 1 }}>
        {TABS.map(tab => (
          <View
            key={tab.key}
            style={[
              StyleSheet.absoluteFill,
              { opacity: activeTab === tab.key ? 1 : 0, zIndex: activeTab === tab.key ? 1 : 0 },
            ]}
            pointerEvents={activeTab === tab.key ? 'auto' : 'none'}
          >
            <TabContent
              branchGroupId={tab.branchGroupId}
              typeFilter={tab.typeFilter}
              isActive={activeTab === tab.key}
              onRoomsReady={handleRoomsReady(tab.key)}
              onSelectRoom={handleSelectRoom}
              sessionActive={!!session}
            />
          </View>
        ))}
      </View>

      <View style={{ height: insets.bottom }} />

      {/* ── Toast ── */}
      {Toast}

      {/* ── Login Modal ── */}
      <SchoolLoginModal
        visible={showLogin}
        onSuccess={handleLoginSuccess}
        onDismiss={() => { setShowLogin(false); pendingRoom.current = null; }}
      />

      {/* ── Seat Picker Modal ── */}
      <SeatPickerModal
        visible={showPicker}
        room={pickerRoom}
        onDismiss={() => setShowPicker(false)}
        onReserved={(msg) => { showToast(msg, 'success'); loadMySeat(); }}
        onSessionExpired={() => { setShowPicker(false); handleSessionExpired(); }}
      />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1, fontFamily: 'Inter_400Regular' },

  sessionIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sessionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
  sessionText: { fontSize: 11, color: '#10B981', fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  headerLoginBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerLoginText: { fontSize: 12, color: C.primary, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  // My Seat Banner
  mySeatBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  mySeatEmpty: { gap: 8 },
  mySeatLoadingText: { fontSize: 13, color: '#9CA3AF', marginLeft: 8, fontFamily: 'Inter_400Regular' },
  mySeatEmptyText: { flex: 1, fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  mySeatLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 8 },
  mySeatIconBox: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: `${C.primary}12`, alignItems: 'center', justifyContent: 'center',
  },
  mySeatName: { fontSize: 14, fontWeight: '600', color: '#111827', fontFamily: 'Inter_600SemiBold' },
  mySeatRoom: { fontSize: 13, fontWeight: '400', color: '#6B7280', fontFamily: 'Inter_400Regular' },
  mySeatTime: { fontSize: 11, color: '#9CA3AF', marginTop: 1, fontFamily: 'Inter_400Regular' },
  mySeatActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mySeatBtn: { borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6, minWidth: 44, alignItems: 'center' },
  mySeatExtendBtn: { borderWidth: 1.5, borderColor: C.primary, backgroundColor: '#fff' },
  mySeatReturnBtn: { backgroundColor: C.primary },
  mySeatExtendText: { fontSize: 12, fontWeight: '600', color: C.primary, fontFamily: 'Inter_600SemiBold' },
  mySeatReturnText: { fontSize: 12, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },

  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, gap: 5,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: C.primary },
  tabLabel: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', fontFamily: 'Inter_500Medium' },
  tabLabelActive: { color: C.primary, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  tabBadge: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  tabBadgeActive: { backgroundColor: `${C.primary}18` },
  tabBadgeText: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', fontFamily: 'Inter_600SemiBold' },
  tabBadgeTextActive: { color: C.primary },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  retryBtnFull: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, marginTop: 4 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  summaryBar: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 8, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryNum: { fontSize: 20, fontWeight: '800', color: C.primary, fontFamily: 'Inter_700Bold' },
  summaryLabel: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  summaryDivider: { width: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },

  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12, paddingHorizontal: 2 },
  updatedText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  floorSection: { marginBottom: 12 },
  floorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  floorBadge: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  floorBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
  floorLabel: { fontSize: 13, fontWeight: '600', color: '#374151', fontFamily: 'Inter_600SemiBold' },
  floorDivider: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  floorCount: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  roomCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  roomCardDisabled: { backgroundColor: '#F9FAFB', opacity: 0.7 },
  roomCardTop: { marginBottom: 10 },
  roomNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  roomName: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8, fontFamily: 'Inter_600SemiBold' },
  disabledText: { color: '#9CA3AF' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  seatCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  availableNum: { fontSize: 20, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  totalCount: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  unableMsg: { fontSize: 12, color: '#9CA3AF', marginTop: 2, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  barTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  barFill: { height: 6, borderRadius: 3 },

  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 2,
  },
  selectBtnText: { fontSize: 13, fontWeight: '600', color: C.primary, fontFamily: 'Inter_600SemiBold' },

  reserveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14,
    marginTop: 8, marginBottom: 8,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  reserveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  toast: {
    position: 'absolute', bottom: 28, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, zIndex: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  toastText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '500', fontFamily: 'Inter_500Medium' },
});
