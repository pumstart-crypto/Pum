import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, RefreshControl, Animated,
  TextInput, Modal, KeyboardAvoidingView,
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
const ROOM_LIST = [
  { section: '새벽벌도서관', rooms: ['새벽누리-열람존', '새벽누리-미디어존', '새벽별당[24h]-A', '새벽별당[24h]-B', '1열람실', '2열람실-A', '2열람실-B', '2열람실-C', '2열람실-D', '3열람실-A', '3열람실-B', '3열람실-C', '3열람실-D', '노트북열람실-A', '노트북열람실-B', '대학원캐럴실'] },
  { section: '미리내열람실', rooms: ['숲열람실', '나무열람실', '아카데미아-열람실', '아카데미아-캐럴실-A', '아카데미아-캐럴실-B'] },
  { section: '나노생명과학도서관', rooms: ['미르마루', '집중열람실'] },
  { section: '의생명과학도서관', rooms: ['행림별당'] },
];

interface MySeatInfo {
  roomName: string;
  seatNo: string;
  startTime: string; // "HH:MM" 24h
  savedDate: string; // "YYYY-MM-DD"
}

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function calcRemaining(info: MySeatInfo): {
  text: string; pct: number; expired: boolean; totalMin: number;
  endTime: string; extensionTime: string; extensionPassed: boolean;
} {
  const endTime       = addMins(info.startTime, 4 * 60);
  const extensionTime = addMins(info.startTime, 2 * 60);
  const now = new Date();
  const [eh, em] = endTime.split(':').map(Number);
  const end = new Date(info.savedDate);
  end.setHours(eh, em, 0, 0);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return { text: '이용 종료', pct: 0, expired: true, totalMin: 0, endTime, extensionTime, extensionPassed: true };
  const totalMin = Math.floor(diffMs / 60000);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  const text = hh > 0 ? `${hh}시간 ${mm}분 남음` : `${mm}분 남음`;
  const maxMs = 4 * 60 * 60 * 1000;
  const pct = Math.min(100, Math.round((diffMs / maxMs) * 100));
  const [xh, xm] = extensionTime.split(':').map(Number);
  const extDate = new Date(info.savedDate); extDate.setHours(xh, xm, 0, 0);
  const extensionPassed = now >= extDate;
  return { text, pct, expired: false, totalMin, endTime, extensionTime, extensionPassed };
}

// ── DrumPicker ─────────────────────────────────────────────────
const DRUM_H = 48;
function DrumPicker({ values, selected, onSelect }: {
  values: string[]; selected: string; onSelect: (v: string) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const [cur, setCur] = useState(() => Math.max(0, values.indexOf(selected)));

  useEffect(() => {
    const idx = Math.max(0, values.indexOf(selected));
    const t = setTimeout(() => ref.current?.scrollTo({ y: idx * DRUM_H, animated: false }), 80);
    return () => clearTimeout(t);
  }, []);

  const snap = useCallback((y: number) => {
    const i = Math.max(0, Math.min(values.length - 1, Math.round(y / DRUM_H)));
    setCur(i); onSelect(values[i]);
    ref.current?.scrollTo({ y: i * DRUM_H, animated: true });
  }, [values, onSelect]);

  return (
    <View style={{ height: DRUM_H * 3, overflow: 'hidden' }}>
      <View style={seatStyles.drumHighlight} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={DRUM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: DRUM_H }}
        onMomentumScrollEnd={e => snap(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={e => snap(e.nativeEvent.contentOffset.y)}
      >
        {values.map((v, i) => (
          <TouchableOpacity
            key={v}
            style={seatStyles.drumItem}
            onPress={() => snap(i * DRUM_H)}
            activeOpacity={0.7}
          >
            <Text style={[seatStyles.drumText, v === values[cur] && seatStyles.drumTextSelected]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// ── MySeatCard ─────────────────────────────────────────────────
function MySeatCard() {
  const [info, setInfo] = useState<MySeatInfo | null>(null);
  const [remaining, setRemaining] = useState<ReturnType<typeof calcRemaining> | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [selectedLib,  setSelectedLib]  = useState<string | null>(null);
  const [roomSearch,   setRoomSearch]   = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [seatNo, setSeatNo] = useState('');
  const [startHour, setStartHour] = useState('00');
  const [startMin,  setStartMin]  = useState('00');
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(MY_SEAT_KEY);
      if (!raw) return;
      const parsed: MySeatInfo = JSON.parse(raw);
      if (!parsed.startTime) { await AsyncStorage.removeItem(MY_SEAT_KEY); return; }
      const rem = calcRemaining(parsed);
      if (rem.expired) { await AsyncStorage.removeItem(MY_SEAT_KEY); return; }
      setInfo(parsed); setRemaining(rem);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!info) return;
    const id = setInterval(() => {
      const rem = calcRemaining(info);
      setRemaining(rem);
      if (rem.expired) { setInfo(null); setRemaining(null); AsyncStorage.removeItem(MY_SEAT_KEY); }
    }, 30_000);
    return () => clearInterval(id);
  }, [info]);

  const openEdit = () => {
    if (info) {
      // find which library this room belongs to
      const lib = ROOM_LIST.find(l => l.rooms.includes(info.roomName));
      setSelectedLib(lib?.section ?? null);
      setSelectedRoom(info.roomName);
      setSeatNo(info.seatNo);
      const [h, m] = info.startTime.split(':');
      setStartHour(h);
      setStartMin(m);
    } else {
      setSelectedLib(null);
      setSelectedRoom(''); setSeatNo('');
      setStartHour('00'); setStartMin('00');
    }
    setRoomSearch('');
    setTimePickerOpen(false);
    setModalVisible(true);
  };

  const save = async () => {
    if (!selectedRoom || !seatNo.trim()) return;
    const startTime = `${startHour}:${startMin}`;
    const today = new Date().toISOString().slice(0, 10);
    const newInfo: MySeatInfo = { roomName: selectedRoom, seatNo: seatNo.trim(), startTime, savedDate: today };
    const rem = calcRemaining(newInfo);
    if (rem.expired) return;
    await AsyncStorage.setItem(MY_SEAT_KEY, JSON.stringify(newInfo));
    setInfo(newInfo); setRemaining(rem); setModalVisible(false);
  };

  const clear = async () => {
    await AsyncStorage.removeItem(MY_SEAT_KEY);
    setInfo(null); setRemaining(null); setModalVisible(false);
  };

  const barColor = remaining
    ? (remaining.totalMin > 60 ? '#10B981' : remaining.totalMin > 20 ? '#F59E0B' : '#EF4444')
    : '#10B981';

  return (
    <>
      {/* ── 등록된 카드 ── */}
      {info && remaining ? (
        <TouchableOpacity style={seatStyles.card} onPress={() => WebBrowser.openBrowserAsync(RESERVATION_URL)} activeOpacity={0.85}>
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
                <Text style={seatStyles.seatNo}>{info.seatNo}번</Text>
              </View>
            </View>
            <View style={seatStyles.timeBox}>
              <Text style={[seatStyles.timeText, { color: barColor }]}>{remaining.text}</Text>
              <Text style={seatStyles.endTimeText}>종료 {remaining.endTime}</Text>
            </View>
          </View>

          <View style={seatStyles.barTrack}>
            <View style={[seatStyles.barFill, { width: `${remaining.pct}%` as any, backgroundColor: barColor }]} />
          </View>

          <View style={seatStyles.metaRow}>
            <View style={seatStyles.metaItem}>
              <Feather name="refresh-cw" size={10} color={remaining.extensionPassed ? '#10B981' : '#9CA3AF'} />
              <Text style={[seatStyles.metaText, remaining.extensionPassed && { color: '#10B981' }]}>
                {remaining.extensionPassed ? '연장 가능' : `연장 ${remaining.extensionTime}부터`}
              </Text>
            </View>
            <View style={seatStyles.metaItem}>
              <Feather name="external-link" size={10} color={C.primary} />
              <Text style={[seatStyles.metaText, { color: C.primary }]}>예약 현황 확인</Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={seatStyles.emptyCard} onPress={openEdit} activeOpacity={0.8}>
          <Feather name="plus-circle" size={15} color={C.primary} />
          <View style={{ flex: 1 }}>
            <Text style={seatStyles.emptyText}>내 자리 등록</Text>
            <Text style={seatStyles.emptySubText}>예약 후 열람실과 좌석 번호를 등록해두세요</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── 입력 바텀시트 ── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={seatStyles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={seatStyles.sheet}>
              <View style={seatStyles.sheetHandle} />
              <Text style={seatStyles.sheetTitle}>내 자리 등록</Text>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* ── 도서관 탭 ── */}
                <Text style={seatStyles.inputLabel}>열람실</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                  {ROOM_LIST.map(({ section }) => {
                    const active = selectedLib === section;
                    return (
                      <TouchableOpacity
                        key={section}
                        style={[seatStyles.libTab, active && seatStyles.libTabActive]}
                        onPress={() => { setSelectedLib(section); setSelectedRoom(''); setRoomSearch(''); }}
                        activeOpacity={0.75}
                      >
                        <Text style={[seatStyles.libTabText, active && seatStyles.libTabTextActive]}>{section}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* ── 열람실 검색 + 칩 ── */}
                {selectedLib ? (() => {
                  const libRooms = ROOM_LIST.find(l => l.section === selectedLib)?.rooms ?? [];
                  const filtered = roomSearch
                    ? libRooms.filter(r => r.includes(roomSearch))
                    : libRooms;
                  return (
                    <>
                      <View style={seatStyles.searchBox}>
                        <Feather name="search" size={14} color="#9CA3AF" />
                        <TextInput
                          style={seatStyles.searchInput}
                          value={roomSearch}
                          onChangeText={setRoomSearch}
                          placeholder="열람실 검색..."
                          placeholderTextColor="#C4C9D4"
                        />
                      </View>
                      <View style={seatStyles.chipGrid}>
                        {filtered.map(r => {
                          const active = selectedRoom === r;
                          return (
                            <TouchableOpacity
                              key={r}
                              style={[seatStyles.chip, active && seatStyles.chipSelected]}
                              onPress={() => setSelectedRoom(r)}
                              activeOpacity={0.7}
                            >
                              <Text style={[seatStyles.chipText, active && seatStyles.chipTextSelected]}>{r}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  );
                })() : (
                  <Text style={seatStyles.libHint}>도서관을 먼저 선택해주세요</Text>
                )}

                {/* ── 좌석 번호 ── */}
                <Text style={[seatStyles.inputLabel, { marginTop: 20 }]}>좌석 번호</Text>
                <TextInput
                  style={seatStyles.input}
                  value={seatNo}
                  onChangeText={t => setSeatNo(t.replace(/[^0-9]/g, ''))}
                  placeholder="숫자만 입력 (예: 42)"
                  placeholderTextColor="#C4C9D4"
                  keyboardType="number-pad"
                  maxLength={4}
                />

                {/* ── 시작 시간 ── */}
                <Text style={[seatStyles.inputLabel, { marginTop: 20 }]}>이용 시작 시간</Text>
                <TouchableOpacity
                  style={seatStyles.timeDisplayBtn}
                  onPress={() => setTimePickerOpen(o => !o)}
                  activeOpacity={0.8}
                >
                  <Feather name="clock" size={15} color={C.primary} />
                  <Text style={seatStyles.timeDisplayText}>{startHour}:{startMin}</Text>
                  <Feather name={timePickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color="#9CA3AF" />
                </TouchableOpacity>

                {timePickerOpen && (
                  <View style={seatStyles.drumRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={seatStyles.drumLabel}>시</Text>
                      <DrumPicker values={HOURS} selected={startHour} onSelect={setStartHour} />
                    </View>
                    <Text style={seatStyles.drumColon}>:</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={seatStyles.drumLabel}>분</Text>
                      <DrumPicker values={MINUTES} selected={startMin} onSelect={setStartMin} />
                    </View>
                  </View>
                )}

                {/* ── 자동 계산 표시 ── */}
                <View style={seatStyles.autoCalcBox}>
                  <View style={seatStyles.autoCalcRow}>
                    <Feather name="clock" size={12} color="#6B7280" />
                    <Text style={seatStyles.autoCalcText}>
                      종료: {addMins(`${startHour}:${startMin}`, 4 * 60)}
                    </Text>
                  </View>
                  <View style={seatStyles.autoCalcRow}>
                    <Feather name="refresh-cw" size={12} color="#6B7280" />
                    <Text style={seatStyles.autoCalcText}>
                      연장 가능: {addMins(`${startHour}:${startMin}`, 2 * 60)}부터
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[seatStyles.saveBtn, (!selectedRoom || !seatNo.trim()) && seatStyles.saveBtnDisabled]}
                  onPress={save}
                  activeOpacity={0.85}
                >
                  <Text style={seatStyles.saveBtnText}>저장</Text>
                </TouchableOpacity>

                {info && (
                  <TouchableOpacity style={seatStyles.clearBtn} onPress={clear}>
                    <Text style={seatStyles.clearBtnText}>등록 취소</Text>
                  </TouchableOpacity>
                )}
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
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
  // ── 카드 ──
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
  seatNo: { fontSize: 18, fontWeight: '700', color: '#374151', fontFamily: 'Inter_700Bold' },

  timeBox: { alignItems: 'flex-end' },
  timeText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  endTimeText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },

  barTrack: { height: 5, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: 5, borderRadius: 3 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  // ── 빈 카드 ──
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: C.primary, fontFamily: 'Inter_600SemiBold' },
  emptySubText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },

  // ── 모달 ──
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  overlayInner: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '90%',
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold', marginBottom: 4, textAlign: 'center' },

  inputLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_500Medium', fontWeight: '500', marginBottom: 8, marginTop: 4 },
  sectionLabel: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginBottom: 6, marginTop: 4 },

  // ── 도서관 탭 ──
  libTab: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#F3F4F8', borderWidth: 0,
  },
  libTabActive: {
    backgroundColor: C.primary,
    shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  libTabText: { fontSize: 12, fontWeight: '500', color: '#666', fontFamily: 'Inter_500Medium' },
  libTabTextActive: { color: '#fff', fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  libHint: { fontSize: 13, color: '#AAAAAA', fontStyle: 'italic', fontFamily: 'Inter_400Regular', marginBottom: 8 },

  // ── 열람실 검색 ──
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8F9FB', borderRadius: 10,
    borderWidth: 1, borderColor: '#E8E9F0',
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10,
  },
  searchInput: {
    flex: 1, fontSize: 13, color: '#374151', fontFamily: 'Inter_400Regular', padding: 0,
  },

  // ── 열람실 칩 ──
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8E9F0',
  },
  chipSelected: { backgroundColor: `${C.primary}0F`, borderColor: C.primary },
  chipText: { fontSize: 13, color: '#555', fontFamily: 'Inter_400Regular' },
  chipTextSelected: { color: C.primary, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  chip24h: { fontSize: 9, fontWeight: '700', color: '#E67E22', fontFamily: 'Inter_700Bold' },

  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular', backgroundColor: '#FAFAFA',
  },

  // ── 시간 표시 버튼 ──
  timeDisplayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FAFAFA',
  },
  timeDisplayText: {
    flex: 1, fontSize: 18, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },

  // ── 드럼 피커 ──
  drumRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8F9FB', borderRadius: 14, padding: 8 },
  drumLabel: { textAlign: 'center', fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginBottom: 4 },
  drumHighlight: {
    position: 'absolute', top: DRUM_H, left: 4, right: 4, height: DRUM_H,
    backgroundColor: `${C.primary}12`, borderRadius: 8, zIndex: 0,
  },
  drumItem: { height: DRUM_H, alignItems: 'center', justifyContent: 'center' },
  drumText: { fontSize: 18, color: '#C4C9D4', fontFamily: 'Inter_400Regular' },
  drumTextSelected: { fontSize: 24, color: C.primary, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  drumColon: { fontSize: 24, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold', paddingTop: 20 },

  // ── 자동 계산 표시 ──
  autoCalcBox: {
    backgroundColor: '#F0F9F4', borderRadius: 10, padding: 10, marginTop: 10, gap: 4,
  },
  autoCalcRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  autoCalcText: { fontSize: 12, color: '#374151', fontFamily: 'Inter_400Regular' },

  saveBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnDisabled: { backgroundColor: '#D1D5DB' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  clearBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  clearBtnText: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
});
