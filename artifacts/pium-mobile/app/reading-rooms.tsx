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
  getMySeat, extendSeat, returnSeat, cancelSeat,
  MySeatData, extractSeatName, extractRoomName, extractBranchName,
} from '@/utils/seatManagement';
import {
  getSchoolSession, logoutFromLibrary, getPyxisCookieHeader, SchoolSession,
} from '@/utils/schoolAuth';
import { saveFavoriteSeat } from '@/utils/favoriteSeat';
import {
  recordStudySession, getWeeklyBarData, formatMinutes,
  getTodayMinutes, getWeekMinutes, parseTimeToday,
} from '@/utils/studySessions';

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
type MainTab = 'my-seat' | 'rooms';

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

/** 배정확정 여부: temporaryEndTime 있으면 미확정(배정확정 전) */
function isUnconfirmedSeat(mySeat: MySeatData): boolean {
  if (mySeat.temporaryEndTime) return true;
  const code = mySeat.state?.code ?? '';
  return code.toUpperCase().includes('WAIT') || code.toUpperCase().includes('TEMP');
}

// ── Tabs ──────────────────────────────────────────────────────
const ROOM_TABS = [
  { key: 'saebbyukbul', label: '새벽벌', branchGroupId: 1, typeFilter: '새벽벌', short: '새벽벌도서관' },
  { key: 'mirinai',     label: '미리내', branchGroupId: 1, typeFilter: '미리내', short: '미리내열람실' },
  { key: 'nano',        label: '나노생명', branchGroupId: 2, typeFilter: null,   short: '나노생명과학도서관' },
  { key: 'medical',     label: '의생명', branchGroupId: 4, typeFilter: null,    short: '의생명과학도서관' },
] as const;
type RoomTabKey = typeof ROOM_TABS[number]['key'];

// ══════════════════════════════════════════════════════════════
// Toast hook
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
// StudyStatsDashboard
// ══════════════════════════════════════════════════════════════
function StudyStatsDashboard() {
  const [barData, setBarData] = useState<{ date: string; label: string; dayLabel: string; minutes: number }[]>([]);
  const [todayMin, setTodayMin] = useState(0);
  const [weekMin, setWeekMin] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [bars, today, week] = await Promise.all([
        getWeeklyBarData(), getTodayMinutes(), getWeekMinutes(),
      ]);
      setBarData(bars);
      setTodayMin(today);
      setWeekMin(week);
      setLoading(false);
    })();
  }, []);

  const maxMin = Math.max(...barData.map(d => d.minutes), 30);
  const todayStr = new Date().toISOString().slice(0, 10);

  const motivMsg = weekMin === 0
    ? '도서관 이용 후 기록이 자동으로 쌓입니다 📚'
    : weekMin < 120
    ? '꾸준함이 실력입니다. 오늘도 화이팅! 💪'
    : weekMin < 300
    ? '이번 주 정말 열심히 하고 있어요! 🔥'
    : '이번 주 학습량이 대단합니다! 최고에요! 🏆';

  return (
    <View style={styles.statsDash}>
      <View style={styles.statsHeader}>
        <Ionicons name="stats-chart" size={16} color={C.primary} />
        <Text style={styles.statsTitleText}>학습 통계</Text>
        <Text style={styles.statsSubText}>도서관 이용 기록 기반</Text>
      </View>

      {loading ? (
        <View style={styles.statsLoading}>
          <ActivityIndicator size="small" color={C.primary} />
        </View>
      ) : (
        <>
          {/* Summary cards */}
          <View style={styles.statsSummaryRow}>
            <View style={[styles.statsSummaryCard, { backgroundColor: `${C.primary}10` }]}>
              <Text style={[styles.statsSummaryNum, { color: C.primary }]}>{formatMinutes(todayMin)}</Text>
              <Text style={styles.statsSummaryLabel}>오늘 학습</Text>
            </View>
            <View style={[styles.statsSummaryCard, { backgroundColor: '#F0FDF4' }]}>
              <Text style={[styles.statsSummaryNum, { color: '#059669' }]}>{formatMinutes(weekMin)}</Text>
              <Text style={styles.statsSummaryLabel}>이번 주</Text>
            </View>
          </View>

          {/* Bar chart */}
          <View style={styles.barChart}>
            {barData.map(d => {
              const isToday = d.date === todayStr;
              const barH = Math.max(4, Math.round((d.minutes / maxMin) * 80));
              return (
                <View key={d.date} style={styles.barCol}>
                  <View style={styles.barOuter}>
                    {d.minutes > 0 && (
                      <View
                        style={[
                          styles.barInner,
                          { height: barH, backgroundColor: isToday ? C.primary : `${C.primary}55` },
                        ]}
                      />
                    )}
                  </View>
                  {d.minutes > 0 && (
                    <Text style={[styles.barMin, { color: isToday ? C.primary : '#9CA3AF' }]}>
                      {d.minutes >= 60 ? `${Math.floor(d.minutes / 60)}h` : `${d.minutes}m`}
                    </Text>
                  )}
                  <Text style={[styles.barDayLabel, isToday && { color: C.primary, fontFamily: 'Inter_700Bold' }]}>
                    {d.dayLabel}
                  </Text>
                  <Text style={styles.barDateLabel}>{d.label}</Text>
                </View>
              );
            })}
          </View>

          {/* Motivational message */}
          <View style={styles.motivBox}>
            <Text style={styles.motivText}>{motivMsg}</Text>
          </View>
        </>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// MySeatManagement (내 좌석 관리 탭 콘텐츠)
// ══════════════════════════════════════════════════════════════
interface MySeatManagementProps {
  session: SchoolSession | null;
  mySeat: MySeatData | null;
  mySeatLoading: boolean;
  extending: boolean;
  returning: boolean;
  cancelling: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onExtend: () => void;
  onReturn: () => void;
  onCancel: () => void;
  onReserve: () => void;
  onSaveFavorite: () => void;
}
function MySeatManagement({
  session, mySeat, mySeatLoading,
  extending, returning, cancelling,
  onLogin, onLogout, onExtend, onReturn, onCancel, onReserve, onSaveFavorite,
}: MySeatManagementProps) {

  // ─ 미로그인 ────────────────────────────────────────────────
  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.myScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.loginPrompt}>
          <View style={styles.loginPromptIcon}>
            <Ionicons name="library-outline" size={48} color={`${C.primary}60`} />
          </View>
          <Text style={styles.loginPromptTitle}>도서관 로그인이 필요합니다</Text>
          <Text style={styles.loginPromptSub}>학교 포털 계정으로 로그인하면{'\n'}내 좌석을 관리할 수 있습니다.</Text>
          <TouchableOpacity style={styles.loginPromptBtn} onPress={onLogin} activeOpacity={0.85}>
            <Feather name="log-in" size={16} color="#fff" />
            <Text style={styles.loginPromptBtnText}>학교 포털 로그인</Text>
          </TouchableOpacity>
        </View>
        <StudyStatsDashboard />
        <View style={{ height: 32 }} />
      </ScrollView>
    );
  }

  // ─ 로딩 ───────────────────────────────────────────────────
  if (mySeatLoading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>좌석 정보 확인 중...</Text>
      </View>
    );
  }

  const seatName = extractSeatName(mySeat);
  const roomName = extractRoomName(mySeat);
  const branchName = extractBranchName(mySeat);

  // ─ 예약 없음 ──────────────────────────────────────────────
  if (!mySeat || !seatName) {
    return (
      <ScrollView contentContainerStyle={styles.myScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="map-pin" size={32} color={`${C.primary}50`} />
          </View>
          <Text style={styles.emptyTitle}>현재 예약된 좌석이 없습니다</Text>
          <Text style={styles.emptySub}>열람실 현황 탭에서 원하는 좌석을 선택하거나{'\n'}아래 버튼으로 바로 이동하세요.</Text>
          <TouchableOpacity style={styles.reservePromptBtn} onPress={onReserve} activeOpacity={0.85}>
            <Feather name="book-open" size={16} color="#fff" />
            <Text style={styles.reservePromptBtnText}>좌석 예약하기</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout} style={styles.logoutLink}>
            <Feather name="log-out" size={12} color="#D1D5DB" />
            <Text style={styles.logoutLinkText}>로그아웃</Text>
          </TouchableOpacity>
        </View>
        <StudyStatsDashboard />
        <View style={{ height: 32 }} />
      </ScrollView>
    );
  }

  const unconfirmed = isUnconfirmedSeat(mySeat);
  const deadlineTime = mySeat.temporaryEndTime ?? mySeat.extendableTime;

  // ─ 배정확정 전 ────────────────────────────────────────────
  if (unconfirmed) {
    return (
      <ScrollView contentContainerStyle={styles.myScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.ticketCard}>
          {/* 임시배정 경고 배너 */}
          <View style={styles.ticketWarnBanner}>
            <Feather name="alert-triangle" size={13} color="#D97706" />
            <Text style={styles.ticketWarnText}>임시 배정 중 — 마감 전 좌석에서 배정확정 필요</Text>
          </View>

          <View style={styles.ticketBody}>
            <View style={styles.ticketLeft}>
              <View style={styles.ticketIconBox}>
                <Ionicons name="library" size={22} color={C.primary} />
              </View>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketSeatNum}>{seatName}번 좌석</Text>
                {roomName && <Text style={styles.ticketRoomName}>{roomName}</Text>}
                {branchName && <Text style={styles.ticketBranch}>{branchName}</Text>}
              </View>
            </View>
            {deadlineTime && (
              <View style={styles.deadlineBox}>
                <Text style={styles.deadlineLabel}>배정확정 마감</Text>
                <Text style={styles.deadlineTime}>{deadlineTime}</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.ticketActions}>
            <TouchableOpacity
              style={[styles.ticketActionBtn, styles.cancelBtn, cancelling && { opacity: 0.6 }]}
              onPress={onCancel}
              disabled={cancelling || returning}
              activeOpacity={0.8}
            >
              {cancelling
                ? <ActivityIndicator size="small" color="#DC2626" />
                : <><Feather name="x-circle" size={14} color="#DC2626" /><Text style={styles.cancelBtnText}>예약 취소</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ticketActionBtn, styles.favSeatBtn]}
              onPress={onSaveFavorite}
              activeOpacity={0.8}
            >
              <Feather name="heart" size={14} color="#EC4899" />
              <Text style={styles.favSeatBtnText}>선호좌석 등록</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.confirmGuide}>
          <Feather name="info" size={13} color="#6B7280" />
          <Text style={styles.confirmGuideText}>
            좌석에 직접 가서 키오스크 또는 QR 코드로 배정을 확정하세요. 마감 시간 내 확정하지 않으면 예약이 취소됩니다.
          </Text>
        </View>

        <TouchableOpacity onPress={onLogout} style={styles.logoutLink}>
          <Feather name="log-out" size={12} color="#D1D5DB" />
          <Text style={styles.logoutLinkText}>로그아웃</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    );
  }

  // ─ 배정확정 ───────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.myScrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.ticketCard}>
        {/* Confirmed badge */}
        <View style={styles.ticketConfirmedBanner}>
          <View style={styles.confirmedDot} />
          <Text style={styles.ticketConfirmedText}>배정 확정됨</Text>
        </View>

        <View style={styles.ticketBody}>
          <View style={styles.ticketLeft}>
            <View style={styles.ticketIconBox}>
              <Ionicons name="library" size={22} color={C.primary} />
            </View>
            <View style={styles.ticketInfo}>
              <Text style={styles.ticketSeatNum}>{seatName}번 좌석</Text>
              {roomName && <Text style={styles.ticketRoomName}>{roomName}</Text>}
              {branchName && <Text style={styles.ticketBranch}>{branchName}</Text>}
            </View>
          </View>
          {mySeat.endTime && (
            <View style={styles.deadlineBox}>
              <Text style={styles.deadlineLabel}>이용 마감</Text>
              <Text style={[styles.deadlineTime, { color: C.primary }]}>{mySeat.endTime}</Text>
            </View>
          )}
        </View>

        {/* extendable time hint */}
        {mySeat.extendableTime && (
          <View style={styles.extendHint}>
            <Feather name="clock" size={12} color="#6B7280" />
            <Text style={styles.extendHintText}>{mySeat.extendableTime} 이후 연장 가능</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.ticketActions}>
          <TouchableOpacity
            style={[styles.ticketActionBtn, styles.extendBtn, extending && { opacity: 0.6 }]}
            onPress={onExtend}
            disabled={extending || returning}
            activeOpacity={0.8}
          >
            {extending
              ? <ActivityIndicator size="small" color={C.primary} />
              : <><Feather name="refresh-cw" size={14} color={C.primary} /><Text style={styles.extendBtnText}>연장</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ticketActionBtn, styles.returnBtn, returning && { opacity: 0.6 }]}
            onPress={onReturn}
            disabled={extending || returning}
            activeOpacity={0.8}
          >
            {returning
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Feather name="log-out" size={14} color="#fff" /><Text style={styles.returnBtnText}>반납</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ticketActionBtn, styles.favSeatBtn]}
            onPress={onSaveFavorite}
            activeOpacity={0.8}
          >
            <Feather name="heart" size={14} color="#EC4899" />
            <Text style={styles.favSeatBtnText}>선호좌석</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={onLogout} style={styles.logoutLink}>
        <Feather name="log-out" size={12} color="#D1D5DB" />
        <Text style={styles.logoutLinkText}>로그아웃</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
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
            {total > 0 && (
              <View style={[styles.pctBadge, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.pctText, { color: cfg.text }]}>
                  {Math.round((available / total) * 100)}% 여유
                </Text>
              </View>
            )}
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
// TabContent (열람실별 좌석 현황)
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
    <View style={styles.centerBox}>
      <Feather name="wifi-off" size={36} color="#D1D5DB" />
      <Text style={styles.loadingText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtnFull} onPress={() => fetchRooms()}>
        <Text style={styles.retryBtnText}>다시 시도</Text>
      </TouchableOpacity>
    </View>
  );
  if (isLoading && rooms.length === 0) return (
    <View style={styles.centerBox}>
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

  const [mainTab, setMainTab] = useState<MainTab>(isWeb ? 'rooms' : 'my-seat');
  const [activeRoomTab, setActiveRoomTab] = useState<RoomTabKey>('saebbyukbul');
  const [tabRooms, setTabRooms] = useState<Record<RoomTabKey, SeatRoom[]>>({
    saebbyukbul: [], mirinai: [], nano: [], medical: [],
  });

  // ── Session & my seat ──────────────────────────────────────
  const [session, setSession] = useState<SchoolSession | null>(null);
  const [mySeat, setMySeat] = useState<MySeatData | null>(null);
  const [mySeatLoading, setMySeatLoading] = useState(false);
  const [extending, setExtending] = useState(false);
  const [returning, setReturning] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ── Modals ─────────────────────────────────────────────────
  const [showLogin, setShowLogin] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerRoom, setPickerRoom] = useState<{ id: number; name: string; branch?: string } | null>(null);
  const pendingRoom = useRef<{ id: number; name: string; branch?: string } | null>(null);

  // ── Load session ───────────────────────────────────────────
  const loadMySeat = useCallback(async (forceLogoutOnExpiry = false) => {
    setMySeatLoading(true);
    const result = await getMySeat();
    setMySeatLoading(false);
    if (result.needsLogin) {
      // 세션 토큰 자체가 없는 경우에만 로그아웃 처리
      // Pyxis 서버 오류(needLogin 코드)는 로그인 상태 유지
      const cookie = await getPyxisCookieHeader();
      if (!cookie || forceLogoutOnExpiry) {
        setSession(null);
        await logoutFromLibrary();
      }
      setMySeat(null);
      return;
    }
    if (result.success) setMySeat(result.data ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await getSchoolSession();
      if (stored) { setSession(stored); loadMySeat(); }
    })();
  }, [loadMySeat]);

  const handleSessionExpired = useCallback(async () => {
    // 쿠키가 없는 경우에만 실제 로그아웃, 있으면 로그인 모달만 표시
    const cookie = await getPyxisCookieHeader();
    if (!cookie) {
      setSession(null); setMySeat(null);
      await logoutFromLibrary();
    }
    setShowLogin(true);
  }, []);

  // SeatPickerModal에 안정된 참조로 전달 — 인라인 함수 사용 시 useEffect 무한 루프 발생
  const handleSeatSessionExpired = useCallback(() => {
    setShowPicker(false);
    handleSessionExpired();
  }, [handleSessionExpired]);

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
    if (result.success) {
      // 학습 기록 저장
      if (mySeat?.startTime) {
        const roomN = extractRoomName(mySeat) ?? '열람실';
        const start = parseTimeToday(mySeat.startTime);
        const now = new Date();
        const durationMin = start ? Math.round((now.getTime() - start.getTime()) / 60000) : 0;
        if (durationMin > 0) {
          const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          await recordStudySession({
            date: todayDate,
            startTime: mySeat.startTime,
            endTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
            durationMinutes: durationMin,
            roomName: roomN,
          });
        }
      }
      setMySeat(null);
    }
  }, [handleSessionExpired, showToast, mySeat]);

  // ── Cancel (배정확정 전 취소) ───────────────────────────────
  const handleCancel = useCallback(async () => {
    setCancelling(true);
    const result = await cancelSeat();
    setCancelling(false);
    if (result.needsLogin) { handleSessionExpired(); return; }
    showToast(result.message, result.success ? 'success' : 'error');
    if (result.success) setMySeat(null);
  }, [handleSessionExpired, showToast]);

  // ── Logout ─────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await logoutFromLibrary();
    setSession(null); setMySeat(null);
    showToast('로그아웃되었습니다.', 'success');
  }, [showToast]);

  // ── Save favorite seat ─────────────────────────────────────
  const handleSaveFavorite = useCallback(async () => {
    if (!mySeat) return;
    const seatId = mySeat.seat?.id ?? mySeat.seatId;
    const seatName = extractSeatName(mySeat);
    const roomId = mySeat.seat?.seatRoom?.id ?? mySeat.seatRoom?.id;
    const roomName = extractRoomName(mySeat);
    const branchName = extractBranchName(mySeat);
    if (!seatId || !seatName || !roomId || !roomName) {
      showToast('좌석 정보를 저장할 수 없습니다.', 'error');
      return;
    }
    await saveFavoriteSeat({
      seatId, seatName, roomId, roomName,
      branchName: branchName ?? '',
    });
    showToast(`${roomName} ${seatName}번을 선호좌석으로 등록했습니다.`, 'success');
  }, [mySeat, showToast]);

  // ── Navigate to reserve ────────────────────────────────────
  const handleGoReserve = useCallback(() => {
    setMainTab('rooms');
  }, []);

  const handleRoomsReady = useCallback((tabKey: RoomTabKey) => (rooms: SeatRoom[]) => {
    setTabRooms(prev => ({ ...prev, [tabKey]: rooms }));
  }, []);

  const activeRoomTabDef = ROOM_TABS.find(t => t.key === activeRoomTab)!;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>도서관</Text>
          <Text style={styles.headerSub}>
            {mainTab === 'my-seat' ? '내 좌석 관리' : `${activeRoomTabDef.short} · 실시간`}
          </Text>
        </View>
        {session ? (
          <View style={styles.sessionIndicator}>
            <View style={styles.sessionDot} />
            <Text style={styles.sessionText}>{session.userName ?? '로그인됨'}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.headerLoginBtn} onPress={() => setShowLogin(true)} hitSlop={8}>
            <Feather name="log-in" size={14} color={C.primary} />
            <Text style={styles.headerLoginText}>로그인</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Main Tab Segment (모바일 전용, 웹 미표시) ── */}
      {!isWeb && (
        <View style={styles.mainTabWrap}>
          <View style={styles.tabSegment}>
            {(['my-seat', 'rooms'] as MainTab[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tabSegItem, mainTab === t && styles.tabSegItemActive]}
                onPress={() => setMainTab(t)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabSegText, mainTab === t && styles.tabSegTextActive]}>
                  {t === 'my-seat' ? '내 좌석 관리' : '열람실 현황'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Content ── */}
      <View style={{ flex: 1 }}>
        {/* 내 좌석 관리 */}
        {mainTab === 'my-seat' && (
          <MySeatManagement
            session={session}
            mySeat={mySeat}
            mySeatLoading={mySeatLoading}
            extending={extending}
            returning={returning}
            cancelling={cancelling}
            onLogin={() => setShowLogin(true)}
            onLogout={handleLogout}
            onExtend={handleExtend}
            onReturn={handleReturn}
            onCancel={handleCancel}
            onReserve={handleGoReserve}
            onSaveFavorite={handleSaveFavorite}
          />
        )}

        {/* 열람실 현황 */}
        {mainTab === 'rooms' && (
          <View style={{ flex: 1 }}>
            {/* Room subtabs */}
            <View style={styles.roomTabBar}>
              {ROOM_TABS.map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.roomTabItem, activeRoomTab === tab.key && styles.roomTabItemActive]}
                  onPress={() => setActiveRoomTab(tab.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.roomTabLabel, activeRoomTab === tab.key && styles.roomTabLabelActive]}>
                    {tab.label}
                  </Text>
                  {tabRooms[tab.key].length > 0 && (
                    <View style={[styles.roomTabBadge, activeRoomTab === tab.key && styles.roomTabBadgeActive]}>
                      <Text style={[styles.roomTabBadgeText, activeRoomTab === tab.key && styles.roomTabBadgeTextActive]}>
                        {tabRooms[tab.key].reduce((s, r) => s + r.seats.available, 0)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {/* Room content — display:none으로 탭 마운트 유지 + zIndex 충돌 없음 */}
            <View style={{ flex: 1 }}>
              {ROOM_TABS.map(tab => (
                <View
                  key={tab.key}
                  style={{ flex: 1, display: activeRoomTab === tab.key ? 'flex' : 'none' }}
                >
                  <TabContent
                    branchGroupId={tab.branchGroupId}
                    typeFilter={tab.typeFilter}
                    isActive={mainTab === 'rooms' && activeRoomTab === tab.key}
                    onRoomsReady={handleRoomsReady(tab.key)}
                    onSelectRoom={handleSelectRoom}
                    sessionActive={!!session}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={{ height: insets.bottom }} />

      {Toast}

      <SchoolLoginModal
        visible={showLogin}
        onSuccess={handleLoginSuccess}
        onDismiss={() => { setShowLogin(false); pendingRoom.current = null; }}
      />
      <SeatPickerModal
        visible={showPicker}
        room={pickerRoom}
        onDismiss={() => setShowPicker(false)}
        onReserved={(msg) => { showToast(msg, 'success'); loadMySeat(); }}
        onSessionExpired={handleSeatSessionExpired}
      />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Header
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

  // Main Tab Segment (notices.tsx style)
  mainTabWrap: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  tabSegment: {
    flexDirection: 'row', backgroundColor: '#F3F4F6',
    borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#E5E7EB',
  },
  tabSegItem: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
  tabSegItemActive: {
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tabSegText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  tabSegTextActive: { color: C.primary, fontFamily: 'Inter_700Bold' },

  // Room subtabs
  roomTabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingHorizontal: 4,
  },
  roomTabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, gap: 5,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  roomTabItemActive: { borderBottomColor: C.primary },
  roomTabLabel: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', fontFamily: 'Inter_500Medium' },
  roomTabLabelActive: { color: C.primary, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  roomTabBadge: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  roomTabBadgeActive: { backgroundColor: `${C.primary}18` },
  roomTabBadgeText: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', fontFamily: 'Inter_600SemiBold' },
  roomTabBadgeTextActive: { color: C.primary },

  // Common
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  retryBtnFull: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, marginTop: 4 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // 내 좌석 관리 scroll
  myScrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Login prompt
  loginPrompt: {
    alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16,
    backgroundColor: '#fff', borderRadius: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  loginPromptIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: `${C.primary}0D`, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  loginPromptTitle: { fontSize: 17, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold', marginBottom: 8 },
  loginPromptSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 20, marginBottom: 20 },
  loginPromptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  loginPromptBtnText: { fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },

  // Empty state
  emptyState: {
    alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16,
    backgroundColor: '#fff', borderRadius: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${C.primary}0D`, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 20 },
  reservePromptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 12, marginBottom: 12,
  },
  reservePromptBtnText: { fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },

  // Ticket card
  ticketCard: {
    backgroundColor: '#fff', borderRadius: 20, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  ticketWarnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#FEF3C7',
  },
  ticketWarnText: { fontSize: 12, color: '#92400E', fontFamily: 'Inter_500Medium', flex: 1 },
  ticketConfirmedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#ECFDF5', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#D1FAE5',
  },
  confirmedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
  ticketConfirmedText: { fontSize: 12, color: '#065F46', fontFamily: 'Inter_600SemiBold' },
  ticketBody: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  ticketLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  ticketIconBox: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: `${C.primary}12`, alignItems: 'center', justifyContent: 'center',
  },
  ticketInfo: { flex: 1 },
  ticketSeatNum: { fontSize: 18, fontWeight: '800', color: '#111827', fontFamily: 'Inter_700Bold' },
  ticketRoomName: { fontSize: 13, color: '#374151', fontFamily: 'Inter_500Medium', marginTop: 2 },
  ticketBranch: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 1 },
  deadlineBox: { alignItems: 'flex-end', gap: 2 },
  deadlineLabel: { fontSize: 10, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  deadlineTime: { fontSize: 16, fontWeight: '700', color: '#D97706', fontFamily: 'Inter_700Bold' },
  extendHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  extendHintText: { fontSize: 11, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  ticketActions: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  ticketActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 12, paddingVertical: 10,
  },
  cancelBtn: { borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#DC2626', fontFamily: 'Inter_600SemiBold' },
  extendBtn: { borderWidth: 1.5, borderColor: C.primary, backgroundColor: '#fff' },
  extendBtnText: { fontSize: 13, fontWeight: '600', color: C.primary, fontFamily: 'Inter_600SemiBold' },
  returnBtn: { backgroundColor: C.primary },
  returnBtnText: { fontSize: 13, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },
  favSeatBtn: { borderWidth: 1.5, borderColor: '#FBCFE8', backgroundColor: '#FDF2F8' },
  favSeatBtnText: { fontSize: 13, fontWeight: '600', color: '#EC4899', fontFamily: 'Inter_600SemiBold' },

  confirmGuide: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  confirmGuideText: { flex: 1, fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular', lineHeight: 18 },

  // Logout link
  logoutLink: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', paddingVertical: 8 },
  logoutLinkText: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  // StudyStatsDashboard
  statsDash: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statsHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  statsTitleText: { fontSize: 15, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold', flex: 1 },
  statsSubText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  statsLoading: { paddingVertical: 24, alignItems: 'center' },

  statsSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statsSummaryCard: {
    flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    alignItems: 'center', gap: 4,
  },
  statsSummaryNum: { fontSize: 18, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  statsSummaryLabel: { fontSize: 11, color: '#6B7280', fontFamily: 'Inter_400Regular' },

  // Bar chart
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 12, height: 110 },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  barOuter: { width: '100%', height: 80, justifyContent: 'flex-end', alignItems: 'center' },
  barInner: { width: '70%', borderRadius: 4 },
  barMin: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  barDayLabel: { fontSize: 11, color: '#6B7280', fontFamily: 'Inter_500Medium' },
  barDateLabel: { fontSize: 9, color: '#D1D5DB', fontFamily: 'Inter_400Regular' },

  motivBox: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  motivText: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular', textAlign: 'center' },

  // Room list
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
  seatCountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pctBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 2 },
  pctText: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
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
