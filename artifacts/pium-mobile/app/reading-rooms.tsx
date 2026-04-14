import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, RefreshControl, Animated,
  TextInput, Modal, KeyboardAvoidingView, Pressable,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import C from '@/constants/colors';

const isWeb = Platform.OS === 'web';
const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const SEAT_URL        = 'https://lib.pusan.ac.kr/facility/seat';
const QR_URL          = 'https://lib.pusan.ac.kr/mobile/membership-card';
const RESERVATION_URL = 'https://lib.pusan.ac.kr/mylibrary/seat/reservations?openPanelId=29619';
const MY_SEAT_KEY     = 'pium_my_seat_v1';

function pyxisUrl(branchGroupId: number) {
  return isWeb
    ? `https://${DOMAIN}/api/library/seat-rooms?branchGroupId=${branchGroupId}`
    : `https://lib.pusan.ac.kr/pyxis-api/1/seat-rooms?homepageId=1&smufMethodCode=SEAT&branchGroupId=${branchGroupId}`;
}

const BASE_ROOM = 'https://lib.pusan.ac.kr/facility/seat/reading-rooms-for-reservation';

/** 열람실 이름으로 예약 페이지 URL 반환 (매칭 실패 시 통합 예약 페이지) */
function getRoomUrl(name: string): string {
  const n = name.replace(/\s/g, '');
  // 새벽누리
  if (n.includes('새벽누리') && n.includes('열람')) return `${BASE_ROOM}/3`;
  if (n.includes('새벽누리') && n.includes('미디어')) return `${BASE_ROOM}/2`;
  // 새벽별당
  if (n.includes('새벽별당') && /[Aa]/.test(n)) return `${BASE_ROOM}/7`;
  if (n.includes('새벽별당') && /[Bb]/.test(n)) return `${BASE_ROOM}/8`;
  if (n.includes('새벽별당')) return `${BASE_ROOM}/7`;
  // 1열람실
  if (/^1열람실/.test(n) || n === '1열람실') return `${BASE_ROOM}/69`;
  // 2열람실
  if (n.includes('2열람실') && /[Dd]/.test(n)) return `${BASE_ROOM}/12`;
  if (n.includes('2열람실') && /[Cc]/.test(n)) return `${BASE_ROOM}/11`;
  if (n.includes('2열람실') && /[Bb]/.test(n)) return `${BASE_ROOM}/10`;
  if (n.includes('2열람실') && /[Aa]/.test(n)) return `${BASE_ROOM}/9`;
  if (n.includes('2열람실')) return `${BASE_ROOM}/9`;
  // 3열람실
  if (n.includes('3열람실') && /[Dd]/.test(n)) return `${BASE_ROOM}/18`;
  if (n.includes('3열람실') && /[Cc]/.test(n)) return `${BASE_ROOM}/17`;
  if (n.includes('3열람실') && /[Bb]/.test(n)) return `${BASE_ROOM}/16`;
  if (n.includes('3열람실') && /[Aa]/.test(n)) return `${BASE_ROOM}/15`;
  if (n.includes('3열람실')) return `${BASE_ROOM}/15`;
  // 노트북열람실
  if (n.includes('노트북') && /[Bb]/.test(n)) return `${BASE_ROOM}/14`;
  if (n.includes('노트북') && /[Aa]/.test(n)) return `${BASE_ROOM}/13`;
  if (n.includes('노트북')) return `${BASE_ROOM}/13`;
  // 대학원캐럴실
  if (n.includes('대학원') && n.includes('캐럴')) return `${BASE_ROOM}/19`;
  // 미리내
  if (n.includes('숲열람실')) return `${BASE_ROOM}/20`;
  if (n.includes('나무열람실')) return `${BASE_ROOM}/21`;
  if (n.includes('아카데미아') && n.includes('열람')) return `${BASE_ROOM}/22`;
  if (n.includes('아카데미아') && n.includes('캐럴') && /[Bb]/.test(n)) return `${BASE_ROOM}/24`;
  if (n.includes('아카데미아') && n.includes('캐럴')) return `${BASE_ROOM}/23`;
  // 나노생명
  if (n.includes('미르마루')) return `${BASE_ROOM}/26`;
  if (n.includes('집중열람실')) return `${BASE_ROOM}/27`;
  // 의생명
  if (n.includes('행림')) return `${BASE_ROOM}/25`;
  // fallback
  return SEAT_URL;
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
const ROOM_TABS = [
  { key: 'saebbyukbul', label: '새벽벌',  branchGroupId: 1, typeFilter: '새벽벌', short: '새벽벌도서관',      excludeNames: ['PC', '1노트북열람실', '대학원생 캐럴실'] },
  { key: 'mirinai',     label: '미리내',  branchGroupId: 1, typeFilter: '미리내', short: '미리내열람실',      excludeNames: [] },
  { key: 'nano',        label: '나노생명', branchGroupId: 2, typeFilter: null,    short: '나노생명과학도서관', excludeNames: [] },
  { key: 'medical',     label: '의생명',  branchGroupId: 4, typeFilter: null,    short: '의생명과학도서관',   excludeNames: ['PC'] },
] as const;
type RoomTabKey = typeof ROOM_TABS[number]['key'];

// ══════════════════════════════════════════════════════════════
// MySeatCard — 내 자리 카드 (수동 입력)
// ══════════════════════════════════════════════════════════════
interface MySeatInfo {
  roomName: string;
  seatNo: string;
  endTime: string; // "HH:MM" 24h
  savedDate: string; // "YYYY-MM-DD"
}

function calcRemaining(info: MySeatInfo): { text: string; pct: number; expired: boolean; totalMin: number } {
  const now = new Date();
  const [h, m] = info.endTime.split(':').map(Number);
  const end = new Date(info.savedDate);
  end.setHours(h, m, 0, 0);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return { text: '이용 종료', pct: 0, expired: true, totalMin: 0 };
  const totalMin = Math.floor(diffMs / 60000);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  const text = hh > 0 ? `${hh}시간 ${mm}분 남음` : `${mm}분 남음`;
  // 최대 8시간 기준 진행률
  const maxMs = 8 * 60 * 60 * 1000;
  const pct = Math.min(100, Math.round((diffMs / maxMs) * 100));
  return { text, pct, expired: false, totalMin };
}

function MySeatCard() {
  const [info, setInfo] = useState<MySeatInfo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [seatNo, setSeatNo] = useState('');
  const [endTime, setEndTime] = useState('');
  const [remaining, setRemaining] = useState<ReturnType<typeof calcRemaining> | null>(null);
  const [endTimeError, setEndTimeError] = useState('');

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(MY_SEAT_KEY);
      if (!raw) return;
      const parsed: MySeatInfo = JSON.parse(raw);
      const rem = calcRemaining(parsed);
      if (rem.expired) { await AsyncStorage.removeItem(MY_SEAT_KEY); return; }
      setInfo(parsed);
      setRemaining(rem);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!info) return;
    const id = setInterval(() => {
      const rem = calcRemaining(info);
      setRemaining(rem);
      if (rem.expired) { setInfo(null); AsyncStorage.removeItem(MY_SEAT_KEY); }
    }, 30_000);
    return () => clearInterval(id);
  }, [info]);

  const openEdit = () => {
    setRoomName(info?.roomName ?? '');
    setSeatNo(info?.seatNo ?? '');
    setEndTime(info?.endTime ?? '');
    setEndTimeError('');
    setModalVisible(true);
  };

  const save = async () => {
    if (!roomName.trim() || !seatNo.trim()) return;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(endTime.trim())) {
      setEndTimeError('HH:MM 형식으로 입력해주세요 (예: 14:30)');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const newInfo: MySeatInfo = { roomName: roomName.trim(), seatNo: seatNo.trim(), endTime: endTime.trim(), savedDate: today };
    const rem = calcRemaining(newInfo);
    if (rem.expired) { setEndTimeError('이미 지난 시간입니다'); return; }
    await AsyncStorage.setItem(MY_SEAT_KEY, JSON.stringify(newInfo));
    setInfo(newInfo);
    setRemaining(rem);
    setModalVisible(false);
  };

  const clear = async () => {
    await AsyncStorage.removeItem(MY_SEAT_KEY);
    setInfo(null);
    setRemaining(null);
    setModalVisible(false);
  };

  const barColor = remaining
    ? (remaining.totalMin > 60 ? '#10B981' : remaining.totalMin > 20 ? '#F59E0B' : '#EF4444')
    : '#10B981';

  return (
    <>
      {/* 카드 */}
      {info && remaining ? (
        <TouchableOpacity
          style={seatStyles.card}
          onPress={() => WebBrowser.openBrowserAsync(RESERVATION_URL)}
          activeOpacity={0.85}
        >
          <View style={seatStyles.cardHeader}>
            <View style={seatStyles.cardTitleRow}>
              <Ionicons name="library-outline" size={15} color={C.primary} />
              <Text style={seatStyles.cardTitle}>내 자리</Text>
            </View>
            <View style={seatStyles.cardActions}>
              <TouchableOpacity onPress={openEdit} hitSlop={8} style={seatStyles.editBtn}>
                <Feather name="edit-2" size={13} color="#9CA3AF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={clear} hitSlop={8} style={seatStyles.editBtn}>
                <Feather name="x" size={14} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={seatStyles.seatRow}>
            <View style={seatStyles.seatInfo}>
              <Text style={seatStyles.seatRoom} numberOfLines={1}>{info.roomName}</Text>
              <View style={seatStyles.seatNoRow}>
                <Text style={seatStyles.seatNoLabel}>좌석</Text>
                <Text style={seatStyles.seatNo}>{info.seatNo}</Text>
              </View>
            </View>
            <View style={seatStyles.timeBox}>
              <Text style={[seatStyles.timeText, { color: barColor }]}>{remaining.text}</Text>
              <Text style={seatStyles.endTimeText}>~ {info.endTime}</Text>
            </View>
          </View>

          <View style={seatStyles.barTrack}>
            <View style={[seatStyles.barFill, { width: `${remaining.pct}%` as any, backgroundColor: barColor }]} />
          </View>

          <View style={seatStyles.linkRow}>
            <Text style={seatStyles.linkText}>예약 현황 확인하기</Text>
            <Feather name="external-link" size={11} color={C.primary} />
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={seatStyles.emptyCard} onPress={openEdit} activeOpacity={0.8}>
          <Feather name="plus-circle" size={15} color={C.primary} />
          <Text style={seatStyles.emptyText}>내 자리 등록</Text>
          <Text style={seatStyles.emptySubText}>예약 후 좌석 번호와 종료 시간을 입력해두세요</Text>
        </TouchableOpacity>
      )}

      {/* 입력 모달 */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={seatStyles.overlay} onPress={() => setModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={seatStyles.overlayInner}>
            <Pressable style={seatStyles.sheet} onPress={e => e.stopPropagation()}>
              <Text style={seatStyles.sheetTitle}>내 자리 등록</Text>

              <Text style={seatStyles.inputLabel}>열람실 이름</Text>
              <TextInput
                style={seatStyles.input}
                value={roomName}
                onChangeText={setRoomName}
                placeholder="예: 2열람실-A"
                placeholderTextColor="#D1D5DB"
              />

              <Text style={seatStyles.inputLabel}>좌석 번호</Text>
              <TextInput
                style={seatStyles.input}
                value={seatNo}
                onChangeText={setSeatNo}
                placeholder="예: A-042"
                placeholderTextColor="#D1D5DB"
              />

              <Text style={seatStyles.inputLabel}>이용 종료 시간</Text>
              <TextInput
                style={[seatStyles.input, endTimeError ? seatStyles.inputError : null]}
                value={endTime}
                onChangeText={t => { setEndTime(t); setEndTimeError(''); }}
                placeholder="HH:MM (예: 14:30)"
                placeholderTextColor="#D1D5DB"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              {endTimeError ? <Text style={seatStyles.errorText}>{endTimeError}</Text> : null}

              <TouchableOpacity style={seatStyles.saveBtn} onPress={save} activeOpacity={0.85}>
                <Text style={seatStyles.saveBtnText}>저장</Text>
              </TouchableOpacity>

              {info && (
                <TouchableOpacity style={seatStyles.clearBtn} onPress={clear}>
                  <Text style={seatStyles.clearBtnText}>등록 취소</Text>
                </TouchableOpacity>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

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
function RoomCard({ room, onSelect }: {
  room: SeatRoom;
  onSelect: (room: SeatRoom) => void;
}) {
  const status = getStatus(room);
  const cfg    = STATUS_CFG[status];
  const { total, occupied, available } = room.seats;
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const isDisabled = status === 'disabled';

  const cardContent = (
    <>
      <View style={styles.roomCardTop}>
        <View style={styles.roomNameRow}>
          <Text style={[styles.roomName, isDisabled && styles.disabledText]} numberOfLines={1}>{room.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
              <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
            </View>
            {!isDisabled && (
              <Feather name="chevron-right" size={15} color="#9CA3AF" style={{ opacity: 0.7 }} />
            )}
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
    </>
  );

  if (!isDisabled) {
    return (
      <TouchableOpacity
        style={[styles.roomCard, styles.roomCardTappable]}
        onPress={() => onSelect(room)}
        activeOpacity={0.75}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.roomCard, styles.roomCardDisabled]}>
      {cardContent}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// TabContent
// ══════════════════════════════════════════════════════════════
function TabContent({
  branchGroupId, typeFilter, excludeNames, isActive,
  onRoomsReady, onSelectRoom,
}: {
  branchGroupId: number; typeFilter: string | null;
  excludeNames: readonly string[];
  isActive: boolean;
  onRoomsReady: (rooms: SeatRoom[]) => void;
  onSelectRoom: (room: SeatRoom) => void;
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
        if (excludeNames.length > 0) {
          list = list.filter(r =>
            !excludeNames.some(ex => r.name?.includes(ex) || r.roomType?.name?.includes(ex))
          );
        }
        setRooms(list); onRoomsReady(list); setLastUpdated(new Date());
      } else { setError('데이터를 불러올 수 없습니다.'); }
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setIsLoading(false); setIsRefreshing(false); }
  }, [branchGroupId, typeFilter, excludeNames, onRoomsReady]);

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
            <RoomCard key={room.id} room={room} onSelect={onSelectRoom} />
          ))}
        </View>
      ))}
      <TouchableOpacity
        style={styles.reserveBtn}
        onPress={() => WebBrowser.openBrowserAsync(SEAT_URL)}
        activeOpacity={0.85}
      >
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

  const [activeRoomTab, setActiveRoomTab] = useState<RoomTabKey>('saebbyukbul');
  const [tabRooms, setTabRooms] = useState<Record<RoomTabKey, SeatRoom[]>>({
    saebbyukbul: [], mirinai: [], nano: [], medical: [],
  });

  const activeRoomTabDef = ROOM_TABS.find(t => t.key === activeRoomTab)!;

  const handleRoomsReady = useCallback((tabKey: RoomTabKey) => (rooms: SeatRoom[]) => {
    setTabRooms(prev => ({ ...prev, [tabKey]: rooms }));
  }, []);

  const handleSelectRoom = useCallback((room: SeatRoom) => {
    WebBrowser.openBrowserAsync(getRoomUrl(room.name));
  }, []);

  const openQR = useCallback(() => {
    WebBrowser.openBrowserAsync(QR_URL);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>도서관</Text>
          <Text style={styles.headerSub}>{activeRoomTabDef.short} · 실시간</Text>
        </View>
        <TouchableOpacity style={styles.qrBtn} onPress={openQR} hitSlop={8}>
          <Ionicons name="qr-code-outline" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* ── 내 자리 카드 ── */}
      <View style={styles.mySeatWrapper}>
        <MySeatCard />
      </View>

      {/* ── Room subtabs ── */}
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
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab content ── */}
      <View style={{ flex: 1 }}>
        {ROOM_TABS.map(tab => (
          <View
            key={tab.key}
            style={{ flex: 1, display: activeRoomTab === tab.key ? 'flex' : 'none' }}
          >
            <TabContent
              branchGroupId={tab.branchGroupId}
              typeFilter={tab.typeFilter}
              excludeNames={tab.excludeNames}
              isActive={activeRoomTab === tab.key}
              onRoomsReady={handleRoomsReady(tab.key)}
              onSelectRoom={handleSelectRoom}
            />
          </View>
        ))}
      </View>

      <View style={{ height: insets.bottom }} />
      {Toast}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1, fontFamily: 'Inter_400Regular' },
  qrBtn: { padding: 4 },

  // Room Tab Bar
  roomTabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 6,
  },
  roomTabItem: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F3F4F6',
  },
  roomTabItemActive: { backgroundColor: C.primary },
  roomTabLabel: { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_500Medium', fontWeight: '500' },
  roomTabLabelActive: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontWeight: '600' },

  // Center
  centerBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24,
  },
  loadingText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtnFull: {
    backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  // Summary bar
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
  roomCardTappable: { borderWidth: 1, borderColor: `${C.primary}22` },
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

  reserveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14,
    marginTop: 8, marginBottom: 8,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  reserveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  mySeatWrapper: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, backgroundColor: '#F8F9FB' },

  toast: {
    position: 'absolute', bottom: 28, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, zIndex: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  toastText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '500', fontFamily: 'Inter_500Medium' },
});

const seatStyles = StyleSheet.create({
  // 등록된 자리 카드
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: `${C.primary}22`,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: C.primary, fontFamily: 'Inter_600SemiBold' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editBtn: { padding: 2 },

  seatRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  seatInfo: { flex: 1, marginRight: 12 },
  seatRoom: { fontSize: 15, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold', marginBottom: 4 },
  seatNoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seatNoLabel: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  seatNo: { fontSize: 15, fontWeight: '700', color: '#374151', fontFamily: 'Inter_700Bold' },

  timeBox: { alignItems: 'flex-end' },
  timeText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  endTimeText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },

  barTrack: { height: 5, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  barFill: { height: 5, borderRadius: 3 },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontSize: 11, color: C.primary, fontFamily: 'Inter_500Medium', fontWeight: '500' },

  // 빈 카드 (등록 전)
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: C.primary, fontFamily: 'Inter_600SemiBold', flex: 1 },
  emptySubText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  // 모달
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  overlayInner: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 36,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold', marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_500Medium', fontWeight: '500', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular', backgroundColor: '#FAFAFA',
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { fontSize: 11, color: '#EF4444', fontFamily: 'Inter_400Regular', marginTop: 4 },
  saveBtn: {
    backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  clearBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  clearBtnText: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
});
