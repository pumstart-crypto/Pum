import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, RefreshControl, Animated,
  TextInput, Modal, KeyboardAvoidingView, Keyboard,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { WebView } from 'react-native-webview';
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


// ── MySeatCard ─────────────────────────────────────────────────
function MySeatCard() {
  const [info, setInfo] = useState<MySeatInfo | null>(null);
  const [remaining, setRemaining] = useState<ReturnType<typeof calcRemaining> | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const insets = useSafeAreaInsets();
  const minRef  = useRef<TextInput>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean; title: string; message: string; onConfirm: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });
  const showConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmDialog({ visible: true, title, message, onConfirm });
  const hideConfirm = () => setConfirmDialog(d => ({ ...d, visible: false }));

  const [selectedLib,  setSelectedLib]  = useState<string | null>(null);
  const [roomSearch,   setRoomSearch]   = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [seatNo, setSeatNo] = useState('');
  const [startHour, setStartHour] = useState('00');
  const [startMin,  setStartMin]  = useState('00');

  // WebView 자동 동기화
  const [libWebViewVisible, setLibWebViewVisible] = useState(false);
  const [webSyncLoading, setWebSyncLoading] = useState(false);
  const webViewRef = useRef<any>(null);
  const hasInjected = useRef(false);

  // SPA 내부 URL 변경을 감지하기 위해 history.pushState 가로채기
  const HISTORY_MONITOR = `(function() {
    function notifyNav() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'nav', url: location.href }));
      }
    }
    var _push = history.pushState.bind(history);
    var _replace = history.replaceState.bind(history);
    history.pushState = function() { _push.apply(history, arguments); setTimeout(notifyNav, 200); };
    history.replaceState = function() { _replace.apply(history, arguments); setTimeout(notifyNav, 200); };
    window.addEventListener('popstate', function() { setTimeout(notifyNav, 200); });
    true;
  })();`;

  // localStorage/sessionStorage/쿠키 조사 스크립트 (디버그용)
  const DEBUG_STORAGE_SCRIPT = `(function() {
    var ls = {};
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k) ls[k] = localStorage.getItem(k); } } catch(e) {}
    var ss = {};
    try { for (var i = 0; i < sessionStorage.length; i++) { var k = sessionStorage.key(i); if (k) ss[k] = sessionStorage.getItem(k); } } catch(e) {}
    window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'storage', ls: ls, ss: ss, cookie: document.cookie, url: location.href }));
    true;
  })();`;

  // 로그인 후 호출되는 실제 API 주입 스크립트
  // PUSAN_PYXIS3 쿠키에서 accessToken을 꺼내 X-Auth-Token 헤더로 전송
  const INJECT_SCRIPT = `(function() {
    var token = null;
    try {
      var cookieParts = document.cookie.split(';');
      for (var i = 0; i < cookieParts.length; i++) {
        var part = cookieParts[i].trim();
        if (part.indexOf('PUSAN_PYXIS3=') === 0) {
          var raw = part.slice('PUSAN_PYXIS3='.length);
          var obj = JSON.parse(decodeURIComponent(raw));
          token = obj.accessToken || null;
          break;
        }
      }
    } catch(e) {}

    var headers = { 'Accept': 'application/json' };
    if (token) headers['X-Auth-Token'] = token;

    fetch('/pyxis-api/1/api/seat-charges', { credentials: 'include', headers: headers })
    .then(function(r) {
      if (r.status === 401 || r.status === 403) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'unauth' }));
        return null;
      }
      if (!r.ok) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'err', m: 'HTTP ' + r.status }));
        return null;
      }
      return r.json();
    })
    .then(function(d) { if (d) window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'ok', d: d })); })
    .catch(function(e) { window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'err', m: String(e) })); });
    true;
  })()`;

  const openLibWebView = () => {
    hasInjected.current = false;
    setWebSyncLoading(false);
    setLibWebViewVisible(true);
  };

  const closeLibWebView = () => {
    hasInjected.current = false;
    setWebSyncLoading(false);
    setLibWebViewVisible(false);
  };

  const tryInject = (url: string) => {
    if (!url) return;
    console.log('[WebSync] tryInject url=' + url + ' hasInjected=' + hasInjected.current);
    const isMyLib = url.includes('/mylibrary/') || url.includes('/mypage/') || url.includes('/myLibrary/');
    if (isMyLib && !hasInjected.current) {
      console.log('[WebSync] → injecting debug+API script');
      hasInjected.current = true;
      setWebSyncLoading(true);
      setTimeout(() => {
        // 먼저 스토리지 정보 수집
        webViewRef.current?.injectJavaScript(DEBUG_STORAGE_SCRIPT);
        // 그 다음 API 호출
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(INJECT_SCRIPT);
        }, 300);
      }, 1500);
    }
  };

  // 일반 페이지 로드(전체 새로고침) 완료 시
  const handleWebLoadEnd = (event: { nativeEvent: { url?: string } }) => {
    tryInject(event.nativeEvent.url ?? '');
  };

  // onNavigationStateChange는 전체 페이지 이동 시 추가 보험
  const handleWebNavChange = (state: { url?: string }) => {
    tryInject(state.url ?? '');
  };

  const handleWebMessage = async (event: { nativeEvent: { data: string } }) => {
    try {
      const parsed = JSON.parse(event.nativeEvent.data);
      console.log('[WebSync] message t=' + parsed.t, parsed.t === 'nav' ? parsed.url : parsed.t === 'ok' ? JSON.stringify(parsed.d).slice(0, 200) : parsed.m ?? '');

      // SPA 내부 URL 변경 알림
      if (parsed.t === 'nav') {
        tryInject(parsed.url ?? '');
        return;
      }

      // 스토리지 디버그 덤프
      if (parsed.t === 'storage') {
        console.log('[WebSync][storage] url=' + parsed.url);
        console.log('[WebSync][storage] cookie=' + parsed.cookie);
        console.log('[WebSync][storage] ls keys=' + Object.keys(parsed.ls ?? {}).join(','));
        console.log('[WebSync][storage] ss keys=' + Object.keys(parsed.ss ?? {}).join(','));
        Object.entries(parsed.ls ?? {}).forEach(([k, v]) => console.log('[WebSync][ls] ' + k + '=' + String(v).slice(0, 80)));
        Object.entries(parsed.ss ?? {}).forEach(([k, v]) => console.log('[WebSync][ss] ' + k + '=' + String(v).slice(0, 80)));
        return;
      }

      // 인증 안 됨 → hasInjected 리셋해서 로그인 후 재시도 가능하게
      if (parsed.t === 'unauth') {
        console.log('[WebSync] 401 unauth → reset');
        setWebSyncLoading(false);
        hasInjected.current = false;
        return;
      }

      // 에러
      if (parsed.t !== 'ok') {
        console.log('[WebSync] error → reset');
        setWebSyncLoading(false);
        hasInjected.current = false;
        return;
      }

      setWebSyncLoading(false);
      const raw = parsed.d;
      console.log('[WebSync] raw keys=' + Object.keys(raw ?? {}).join(','));
      console.log('[WebSync] raw.data keys=' + Object.keys(raw?.data ?? {}).join(','));
      const list: any[] =
        raw?.data?.list ??
        raw?.data?.rows ??
        raw?.list ??
        (Array.isArray(raw?.data) ? raw.data : null) ??
        [];

      console.log('[WebSync] list.length=' + list.length);
      if (list.length > 0) console.log('[WebSync] list[0] keys=' + Object.keys(list[0]).join(','));

      const active = list.filter((item: any) => {
        const status: string =
          item.status ?? item.chargeStatus ?? item.state ?? item.statusCode ?? '';
        return !['반납', '종료', '취소', 'RETURN', 'END', 'CANCEL', 'return', 'end', 'cancel'].some(k =>
          String(status).toUpperCase().includes(k.toUpperCase())
        );
      });

      console.log('[WebSync] active.length=' + active.length);

      if (active.length === 0) {
        console.log('[WebSync] no active reservations');
        hasInjected.current = false;
        return;
      }

      const item = active[0];
      const roomName: string =
        item.seatRoom?.name ??
        item.room?.name ??
        item.roomName ??
        item.seatRoomName ??
        '';
      const seatNum: string = String(
        item.seat?.no ?? item.seat?.number ??
        item.seatNo ?? item.seatNumber ?? item.no ?? ''
      );
      const startRaw: string =
        item.startDate ?? item.startDatetime ?? item.startTime ?? item.start ?? '';
      const startDate = new Date(startRaw);

      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const startH = startRaw
        ? String(startDate.getHours()).padStart(2, '0')
        : '00';
      const startM = startRaw
        ? String(startDate.getMinutes()).padStart(2, '0')
        : '00';

      const newInfo: MySeatInfo = {
        roomName: roomName || '알 수 없음',
        seatNo: seatNum,
        startTime: `${startH}:${startM}`,
        savedDate: today,
      };
      const rem = calcRemaining(newInfo);
      await AsyncStorage.setItem(MY_SEAT_KEY, JSON.stringify(newInfo));
      setInfo(newInfo);
      setRemaining(rem);
      setLibWebViewVisible(false);
      hasInjected.current = false;
    } catch {
      hasInjected.current = false;
    }
  };

  const onHourChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (digits === '') { setStartHour(''); return; }
    if (Number(digits) > 23) return;
    setStartHour(digits);
    if (digits.length === 2) minRef.current?.focus();
  };
  const onHourBlur = () => setStartHour(h => h.length === 1 ? h.padStart(2, '0') : h || '00');

  const onMinChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (digits === '') { setStartMin(''); return; }
    if (Number(digits) > 59) return;
    setStartMin(digits);
    if (digits.length === 2) Keyboard.dismiss();
  };
  const onMinBlur = () => setStartMin(m => m.length === 1 ? m.padStart(2, '0') : m || '00');

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
    setModalVisible(true);
  };

  const save = async () => {
    if (!selectedRoom || !seatNo.trim()) return;
    const startTime = `${startHour.padStart(2,'0')}:${startMin.padStart(2,'0')}`;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const newInfo: MySeatInfo = { roomName: selectedRoom, seatNo: seatNo.trim(), startTime, savedDate: today };
    const rem = calcRemaining(newInfo);
    await AsyncStorage.setItem(MY_SEAT_KEY, JSON.stringify(newInfo));
    setInfo(newInfo); setRemaining(rem); setModalVisible(false);
  };

  const clear = async () => {
    await AsyncStorage.removeItem(MY_SEAT_KEY);
    setInfo(null); setRemaining(null); setModalVisible(false);
  };

  const extend = () => {
    showConfirm('연장', '연장하시겠습니까?', async () => {
      if (!info) return;
      const newStart = addMins(info.startTime, 2 * 60);
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const newInfo = { ...info, startTime: newStart, savedDate: today };
      const rem = calcRemaining(newInfo);
      await AsyncStorage.setItem(MY_SEAT_KEY, JSON.stringify(newInfo));
      setInfo(newInfo); setRemaining(rem);
    });
  };

  const returnSeat = () => {
    showConfirm('반납', '반납하시겠습니까?', async () => {
      await AsyncStorage.removeItem(MY_SEAT_KEY);
      setInfo(null); setRemaining(null);
    });
  };

  const barColor = remaining
    ? (remaining.totalMin > 60 ? '#10B981' : remaining.totalMin > 20 ? '#F59E0B' : '#EF4444')
    : '#10B981';

  return (
    <>
      {/* ── 등록된 카드 ── */}
      {info && remaining ? (
        <View style={seatStyles.card}>
          <View style={seatStyles.cardHeader}>
            <View style={seatStyles.cardTitleRow}>
              <Ionicons name="library-outline" size={15} color={C.primary} />
              <Text style={seatStyles.cardTitle}>내 자리</Text>
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
          </View>

          <View style={seatStyles.cardBtnRow}>
            <TouchableOpacity style={seatStyles.extendBtn} onPress={extend} activeOpacity={0.8}>
              <Text style={seatStyles.extendBtnText}>연장</Text>
            </TouchableOpacity>
            <TouchableOpacity style={seatStyles.returnBtn} onPress={returnSeat} activeOpacity={0.8}>
              <Text style={seatStyles.returnBtnText}>반납</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={seatStyles.emptyCard}>
          <View style={seatStyles.emptyTopRow}>
            <Ionicons name="library-outline" size={15} color={C.primary} />
            <Text style={seatStyles.emptyText}>내 자리 등록</Text>
          </View>
          <Text style={seatStyles.emptySubText}>예약 후 좌석 정보를 불러오거나 직접 입력하세요</Text>
          <View style={seatStyles.emptyBtnRow}>
            <TouchableOpacity style={seatStyles.autoSyncBtn} onPress={openLibWebView} activeOpacity={0.85}>
              <Ionicons name="sync-outline" size={13} color="#fff" />
              <Text style={seatStyles.autoSyncBtnText}>자동 불러오기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={seatStyles.manualBtn} onPress={openEdit} activeOpacity={0.85}>
              <Feather name="edit-2" size={13} color={C.primary} />
              <Text style={seatStyles.manualBtnText}>직접 입력</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── 입력 바텀시트 ── */}
      <Modal visible={modalVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setModalVisible(false)}>
        {/* 배경 딤 */}
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1}
          onPress={() => { Keyboard.dismiss(); setModalVisible(false); }}
        />
        {/* 시트 — absolute bottom:0 으로 화면 최하단에 완전히 붙임 */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'position' : undefined}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        >
          <View style={seatStyles.sheet}>
            <View style={seatStyles.sheetHandle} />
            <Text style={seatStyles.sheetTitle}>내 자리 등록</Text>

            {/* ── 도서관 탭 ── */}
            <Text style={seatStyles.inputLabel}>열람실</Text>
            <View style={seatStyles.libTabRow}>
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
            </View>

            {/* ── 열람실 검색 + 칩 ── */}
            {selectedLib ? (
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
                <ScrollView style={seatStyles.chipScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  <View style={seatStyles.chipGrid}>
                    {(roomSearch
                      ? (ROOM_LIST.find(l => l.section === selectedLib)?.rooms ?? []).filter(r => r.includes(roomSearch))
                      : (ROOM_LIST.find(l => l.section === selectedLib)?.rooms ?? [])
                    ).map(r => {
                      const active = selectedRoom === r;
                      return (
                        <TouchableOpacity key={r} style={[seatStyles.chip, active && seatStyles.chipSelected]} onPress={() => setSelectedRoom(r)} activeOpacity={0.7}>
                          <Text style={[seatStyles.chipText, active && seatStyles.chipTextSelected]}>{r}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            ) : (
              <Text style={seatStyles.libHint}>도서관을 먼저 선택해주세요</Text>
            )}

            {/* ── 좌석 번호 ── */}
            <Text style={[seatStyles.inputLabel, { marginTop: 16 }]}>좌석 번호</Text>
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
            <Text style={[seatStyles.inputLabel, { marginTop: 16 }]}>이용 시작 시간</Text>
            <View style={seatStyles.timeInputRow}>
              <View style={seatStyles.timeInputWrap}>
                <Text style={seatStyles.timeInputLabel}>시</Text>
                <TextInput
                  style={seatStyles.timeInput}
                  value={startHour}
                  onChangeText={onHourChange}
                  onBlur={onHourBlur}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  placeholderTextColor="#D1D5DB"
                  textAlign="center"
                  selectTextOnFocus
                  returnKeyType="next"
                  onSubmitEditing={() => minRef.current?.focus()}
                />
              </View>
              <Text style={seatStyles.timeInputColon}>:</Text>
              <View style={seatStyles.timeInputWrap}>
                <Text style={seatStyles.timeInputLabel}>분</Text>
                <TextInput
                  ref={minRef}
                  style={seatStyles.timeInput}
                  value={startMin}
                  onChangeText={onMinChange}
                  onBlur={onMinBlur}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  placeholderTextColor="#D1D5DB"
                  textAlign="center"
                  selectTextOnFocus
                />
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
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 도서관 WebView 자동 동기화 ── */}
      <Modal visible={libWebViewVisible} animationType="slide" statusBarTranslucent onRequestClose={closeLibWebView}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={seatStyles.wvHeader}>
            <TouchableOpacity onPress={closeLibWebView} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color="#374151" />
            </TouchableOpacity>
            <Text style={seatStyles.wvTitle}>부산대 도서관</Text>
            {webSyncLoading
              ? <ActivityIndicator size="small" color={C.primary} />
              : <View style={{ width: 20 }} />
            }
          </View>
          <View style={seatStyles.wvBanner}>
            <Ionicons name="information-circle-outline" size={13} color={C.primary} />
            <Text style={seatStyles.wvBannerText}>로그인 후 예약현황 페이지로 이동하면 자동으로 정보를 가져옵니다</Text>
          </View>
          <WebView
            ref={webViewRef}
            source={{ uri: 'https://lib.pusan.ac.kr/mylibrary/seat/reservations' }}
            injectedJavaScriptBeforeContentLoaded={HISTORY_MONITOR}
            onLoadEnd={handleWebLoadEnd}
            onNavigationStateChange={handleWebNavChange}
            onMessage={handleWebMessage}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            javaScriptEnabled
            domStorageEnabled
            style={{ flex: 1 }}
          />
        </SafeAreaView>
      </Modal>

      {/* ── 인앱 확인 다이얼로그 ── */}
      <Modal visible={confirmDialog.visible} transparent animationType="fade" statusBarTranslucent onRequestClose={hideConfirm}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={seatStyles.confirmBox}>
            <Text style={seatStyles.confirmTitle}>{confirmDialog.title}</Text>
            <Text style={seatStyles.confirmMsg}>{confirmDialog.message}</Text>
            <View style={seatStyles.confirmBtnRow}>
              <TouchableOpacity style={seatStyles.confirmCancelBtn} onPress={hideConfirm} activeOpacity={0.8}>
                <Text style={seatStyles.confirmCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={seatStyles.confirmOkBtn}
                onPress={() => { hideConfirm(); confirmDialog.onConfirm(); }}
                activeOpacity={0.8}
              >
                <Text style={seatStyles.confirmOkText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
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
        <TouchableOpacity
          style={styles.reservationBtn}
          onPress={() => WebBrowser.openBrowserAsync(RESERVATION_URL)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={15} color={C.primary} style={{ marginRight: 6 }} />
          <Text style={styles.reservationBtnText}>내 좌석 예약 현황 보기</Text>
          <Feather name="external-link" size={12} color={C.primary} style={{ marginLeft: 6, opacity: 0.6 }} />
        </TouchableOpacity>
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

  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 56 },

  mySeatWrapper: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: '#F8F9FB' },
  reservationBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.primary, borderRadius: 12,
    paddingVertical: 10, marginTop: 8,
  },
  reservationBtnText: { fontSize: 13, fontWeight: '600', color: C.primary, fontFamily: 'Inter_600SemiBold' },

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
  cardBtnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  extendBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.primary, alignItems: 'center',
  },
  extendBtnText: { fontSize: 13, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold' },
  returnBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#EF4444', alignItems: 'center',
  },
  returnBtnText: { fontSize: 13, fontWeight: '700', color: '#EF4444', fontFamily: 'Inter_700Bold' },

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
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed',
    gap: 8,
  },
  emptyTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emptyText: { fontSize: 13, fontWeight: '600', color: C.primary, fontFamily: 'Inter_600SemiBold' },
  emptySubText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  emptyBtnRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  autoSyncBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 10,
    backgroundColor: C.primary,
  },
  autoSyncBtnText: { fontSize: 13, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },
  manualBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.primary,
  },
  manualBtnText: { fontSize: 13, fontWeight: '600', color: C.primary, fontFamily: 'Inter_600SemiBold' },

  // ── 도서관 WebView ──
  wvHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  wvTitle: { fontSize: 15, fontWeight: '600', color: '#111827', fontFamily: 'Inter_600SemiBold' },
  wvBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${C.primary}0D`, paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: `${C.primary}18`,
  },
  wvBannerText: { flex: 1, fontSize: 11, color: C.primary, fontFamily: 'Inter_400Regular', lineHeight: 16 },

  // ── 모달 ──
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold', marginBottom: 4, textAlign: 'center' },

  inputLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_500Medium', fontWeight: '500', marginBottom: 8, marginTop: 4 },
  sectionLabel: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginBottom: 6, marginTop: 4 },

  // ── 도서관 탭 ──
  libTabRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12,
  },
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

  chipScroll: { maxHeight: 160, marginBottom: 4 },

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

  // ── 시간 입력 ──
  timeInputRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, marginBottom: 4,
  },
  timeInputWrap: { alignItems: 'center', flex: 1 },
  timeInputLabel: {
    fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_500Medium',
    fontWeight: '500', marginBottom: 6, letterSpacing: 0.5,
  },
  timeInput: {
    width: '100%', paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#FAFAFA',
    fontSize: 32, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold',
  },
  timeInputColon: {
    fontSize: 28, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold',
    marginTop: 20,
  },

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

  // ── 인앱 확인 다이얼로그 ──
  confirmBox: {
    width: '100%', backgroundColor: '#fff', borderRadius: 18,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12,
  },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold', marginBottom: 8 },
  confirmMsg: { fontSize: 14, color: '#6B7280', fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  confirmBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#F3F4F6', alignItems: 'center',
  },
  confirmCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280', fontFamily: 'Inter_600SemiBold' },
  confirmOkBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: C.primary, alignItems: 'center',
  },
  confirmOkText: { fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
});
