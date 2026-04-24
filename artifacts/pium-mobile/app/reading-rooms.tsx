import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, RefreshControl, Animated,
  Modal,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import C from '@/constants/colors';

// SecureStore는 웹에서 미지원 — sessionStorage로 폴백
const secureGet = (key: string): Promise<string | null> =>
  Platform.OS === 'web'
    ? Promise.resolve(sessionStorage.getItem(key))
    : SecureStore.getItemAsync(key);
const secureSet = (key: string, val: string): Promise<void> =>
  Platform.OS === 'web'
    ? (sessionStorage.setItem(key, val), Promise.resolve())
    : SecureStore.setItemAsync(key, val);
const secureDel = (key: string): Promise<void> =>
  Platform.OS === 'web'
    ? (sessionStorage.removeItem(key), Promise.resolve())
    : SecureStore.deleteItemAsync(key);

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
// MySeatCard — 내 자리 카드
// ══════════════════════════════════════════════════════════════
interface MySeatInfo {
  roomName: string;
  seatNo: string;
  startTime: string;    // "HH:MM" 24h
  endTime?: string;     // "HH:MM" 24h — API에서 받은 실제 종료 시각 (연장 반영)
  renewableTime?: string; // "HH:MM" — renewableDate 파싱값 (연장 가능 시작 시각)
  savedDate: string;    // "YYYY-MM-DD"
  isTempAssign?: boolean;  // 임시배정 상태
  tempEndTime?: string;    // "HH:MM" - 임시배정 종료 시각
  extensionCount?: number; // 이미 연장한 횟수 (= renewalLimit - renewableCnt)
  extensionMax?: number;   // 최대 연장 가능 횟수 (= renewalLimit)
}

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = ((h * 60 + m + mins) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function calcRemaining(info: MySeatInfo): {
  text: string; pct: number; expired: boolean; totalMin: number;
  endTime: string; extensionTime: string; extensionPassed: boolean;
} {
  // API에서 받은 실제 종료 시각 우선, 없으면 시작+4h 폴백
  const endTime = info.endTime ?? addMins(info.startTime, 4 * 60);
  // renewableTime = renewableDate에서 직접 파싱 (Pyxis API). 없으면 종료-2h 폴백
  const extensionTime = info.renewableTime ?? addMins(endTime, -(2 * 60));
  const now = new Date();

  // 자정 넘김 처리: endTime < startTime이면 다음 날
  const [sh, sm] = info.startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startTotalMin = sh * 60 + sm;
  const endTotalMin   = eh * 60 + em;
  const crossesMidnight = endTotalMin < startTotalMin;

  const end = new Date(info.savedDate);
  end.setHours(eh, em, 0, 0);
  if (crossesMidnight) end.setDate(end.getDate() + 1);

  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return { text: '이용 종료', pct: 0, expired: true, totalMin: 0, endTime, extensionTime, extensionPassed: true };

  const totalMin = Math.floor(diffMs / 60000);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  const text = hh > 0 ? `${hh}시간 ${mm}분 남음` : `${mm}분 남음`;

  // 프로그레스 바: 시작 → 종료 전체 구간 기준
  const totalDuration = end.getTime() - (new Date(info.savedDate).setHours(sh, sm, 0, 0));
  const maxMs = Math.max(totalDuration, 60_000);
  const pct = Math.min(100, Math.round((diffMs / maxMs) * 100));

  const [xh, xm] = extensionTime.split(':').map(Number);
  const extDate = new Date(info.savedDate); extDate.setHours(xh, xm, 0, 0);
  const extensionPassed = now >= extDate;
  return { text, pct, expired: false, totalMin, endTime, extensionTime, extensionPassed };
}


const LIB_CONSENT_KEY = 'pium_lib_consent_v1';

// ── MySeatCard ─────────────────────────────────────────────────
function MySeatCard({ refreshTrigger = 0, showToast }: {
  refreshTrigger?: number;
  showToast: (msg: string, type?: keyof typeof TOAST_CFG, sub?: string) => void;
}) {
  const [info, setInfo] = useState<MySeatInfo | null>(null);
  const [remaining, setRemaining] = useState<ReturnType<typeof calcRemaining> | null>(null);
  const insets = useSafeAreaInsets();

  // 개인정보 제3자 제공 동의
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null); // null = 로딩 중
  const [showConsentModal, setShowConsentModal] = useState(false);

  useEffect(() => {
    secureGet(LIB_CONSENT_KEY).then(val => {
      setConsentGiven(val === 'true');
    });
  }, []);

  // WebView 자동 동기화
  const [libWebViewVisible, setLibWebViewVisible] = useState(false);
  const [webSyncLoading, setWebSyncLoading] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // 페이지 로드 전에 주입 — fetch/XHR을 가로채서 seat-charges 응답을 낚아챔
  // SPA가 자체 인증으로 API를 호출하므로 우리는 인증 걱정 없이 응답만 캡처
  const INTERCEPTOR_SCRIPT = `(function() {
    // fetch 가로채기
    var origFetch = window.fetch;
    window.fetch = function(url, opts) {
      var urlStr = typeof url === 'string' ? url : (url instanceof Request ? url.url : String(url));
      return origFetch.apply(this, arguments).then(function(response) {
        if (urlStr.indexOf('seat-charges') !== -1) {
          response.clone().json().then(function(d) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'ok', d: d }));
            }
          }).catch(function() {});
        }
        return response;
      });
    };

    // XMLHttpRequest 가로채기
    var _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      this._captureUrl = String(url || '');
      return _open.apply(this, arguments);
    };
    var _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
      var self = this;
      if (this._captureUrl && this._captureUrl.indexOf('seat-charges') !== -1) {
        this.addEventListener('load', function() {
          try {
            var d = JSON.parse(self.responseText);
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'ok', d: d }));
            }
          } catch(e) {}
        });
      }
      return _send.apply(this, arguments);
    };

    // URL 변경 감지 (로딩 인디케이터용)
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

  const openLibWebView = () => {
    setWebSyncLoading(false);
    setLibWebViewVisible(true);
  };

  // 동의 확인 후 WebView 열기
  const handleSeatCardPress = () => {
    if (consentGiven) {
      openLibWebView();
    } else {
      setShowConsentModal(true);
    }
  };

  const handleConsentAgree = async () => {
    await secureSet(LIB_CONSENT_KEY, 'true');
    setConsentGiven(true);
    setShowConsentModal(false);
    openLibWebView();
  };

  const handleConsentDecline = () => {
    setShowConsentModal(false);
  };

  const closeLibWebView = () => {
    setWebSyncLoading(false);
    setLibWebViewVisible(false);
  };

  const handleWebNavChange = (state: { url?: string }) => {
    const url = state.url ?? '';
    const onReservationPage = url.includes('/mylibrary/') && url.includes('reservations');
    setWebSyncLoading(onReservationPage);
  };

  const handleWebMessage = async (event: WebViewMessageEvent) => {
    // 메시지 출처 검증 — lib.pusan.ac.kr 외 도메인 차단
    const originUrl = event.nativeEvent.url ?? '';
    if (!originUrl.startsWith('https://lib.pusan.ac.kr')) return;

    try {
      const parsed = JSON.parse(event.nativeEvent.data);

      // URL 변경 알림 — 무시 (로딩은 onNavigationStateChange로 처리)
      if (parsed.t === 'nav') return;

      // seat-charges 응답이 아니면 무시
      if (parsed.t !== 'ok') return;

      // success:false 이면 로그인 안 된 상태 → 무시 (로그인 후 재호출됨)
      if (parsed.d?.success === false) return;
      const raw = parsed.d;
      const list: any[] =
        raw?.data?.list ??
        raw?.data?.rows ??
        raw?.list ??
        (Array.isArray(raw?.data) ? raw.data : null) ??
        [];

      const INACTIVE = ['반납', '종료', '취소', 'RETURN', 'END', 'CANCEL', 'EXPIRE'];
      const active = list.filter((item: any) => {
        const stateObj = item.state ?? item.status ?? item.chargeStatus ?? {};
        const code = typeof stateObj === 'object'
          ? (stateObj.code ?? stateObj.name ?? '')
          : String(stateObj);
        return !INACTIVE.some(k => String(code).toUpperCase().includes(k.toUpperCase()));
      });

      if (active.length === 0) {
        setLibWebViewVisible(false);
        if (info) {
          // 기존 좌석이 있었는데 없어짐 → 반납/만료
          await secureDel(MY_SEAT_KEY);
          setInfo(null); setRemaining(null);
          showToast('좌석이 반납되었어요', 'info', '반납 또는 이용 종료가 확인되었습니다');
        } else {
          showToast('예약된 좌석이 없어요', 'info', '도서관에서 먼저 좌석을 예약해 주세요');
        }
        return;
      }

      const item = active[0];

      const roomName: string =
        item.room?.name ??
        item.seatRoom?.name ??
        item.roomName ??
        item.seatRoomName ??
        '';
      const seatNum: string = String(
        item.seat?.code ?? item.seat?.no ?? item.seat?.number ??
        item.seatNo ?? item.seatNumber ?? item.no ?? ''
      );
      const startRaw: string =
        item.beginTime ?? item.startDate ?? item.startDatetime ??
        item.startTime ?? item.chargeStartDate ?? item.start ?? '';
      const startDate = new Date(startRaw.replace(' ', 'T'));

      // ── 실제 종료 시각 (연장 후에도 정확히 반영됨) ──
      const endRaw: string =
        item.endTime ?? item.endDatetime ?? item.endDate ??
        item.chargeEndDate ?? item.expireTime ?? item.expireDatetime ??
        item.endAt ?? item.finishTime ?? '';
      let endTimeHHMM: string | undefined;
      if (endRaw) {
        const ed = new Date(endRaw.replace(' ', 'T'));
        if (!isNaN(ed.getTime())) {
          endTimeHHMM = `${String(ed.getHours()).padStart(2,'0')}:${String(ed.getMinutes()).padStart(2,'0')}`;
        } else if (/^\d{2}:\d{2}/.test(endRaw)) {
          endTimeHHMM = endRaw.substring(0, 5);
        }
      }

      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const startH = startRaw
        ? String(startDate.getHours()).padStart(2, '0')
        : '00';
      const startM = startRaw
        ? String(startDate.getMinutes()).padStart(2, '0')
        : '00';

      // ── 임시배정 판별 ── (code + name 둘 다 체크)
      const stateCode = String(item.state?.code ?? item.chargeStatus?.code ?? '').toUpperCase();
      const stateName = String(item.state?.name ?? item.state?.description ?? '');
      const isTempAssign = /TEMP|임시/.test(stateCode) || /임시/.test(stateName);

      // ── 디버그: item 전체를 로그 (임시배정 시 필드 파악용) ──
      if (isTempAssign) {

      }

      // ── 임시배정 종료 시각 ── (다양한 필드명 시도)
      const tempEndRaw: string =
        item.state?.limitDatetime ?? item.state?.endDatetime ??
        item.state?.limitTime    ?? item.state?.endTime     ??
        item.state?.endAt        ??
        item.limitDatetime       ?? item.tempLimitDatetime  ??
        item.stateEndDatetime    ?? item.tempEndDatetime    ??
        item.limitTime           ?? item.tempEndTime        ??
        '';
      let tempEndTime: string | undefined;
      if (isTempAssign) {
        // 시도 1: datetime 문자열 파싱
        if (tempEndRaw) {
          const td = new Date(tempEndRaw.replace(' ', 'T'));
          if (!isNaN(td.getTime())) {
            tempEndTime = `${String(td.getHours()).padStart(2, '0')}:${String(td.getMinutes()).padStart(2, '0')}`;
          }
        }
        // 시도 2: state.name 문자열에서 "오전/오후 HH:MM" 파싱
        // 예) "임시배정 ~ 오전 12:53"
        if (!tempEndTime) {
          const m = stateName.match(/([오전후]+)\s*(\d{1,2}):(\d{2})/);
          if (m) {
            let h = Number(m[2]);
            if (m[1].includes('후') && h < 12) h += 12;
            if (m[1].includes('전') && h === 12) h = 0;
            tempEndTime = `${String(h).padStart(2, '0')}:${m[3]}`;
          }
        }
        // 시도 3: item 최상위에서 HH:MM 패턴 탐색
        if (!tempEndTime) {
          for (const key of Object.keys(item)) {
            const val = String(item[key] ?? '');
            if (/^\d{2}:\d{2}(:\d{2})?$/.test(val)) {
              if (!(`${startH}:${startM}`).startsWith(val.substring(0, 5))) {
                tempEndTime = val.substring(0, 5);

                break;
              }
            }
          }
        }
        // 시도 4: state 내 모든 datetime/time 필드 스캔
        if (!tempEndTime && item.state) {
          for (const key of Object.keys(item.state)) {
            const val = String(item.state[key] ?? '');
            // "2026-04-17 00:53:00" 또는 "00:53" 형태
            const dtMatch = val.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/);
            const timeMatch = val.match(/^(\d{2}):(\d{2})/);
            if (dtMatch) {
              const td = new Date(val.replace(' ', 'T'));
              if (!isNaN(td.getTime())) {
                const candidate = `${String(td.getHours()).padStart(2,'0')}:${String(td.getMinutes()).padStart(2,'0')}`;
                if (candidate !== `${startH}:${startM}`) {
                  tempEndTime = candidate;

                  break;
                }
              }
            } else if (timeMatch && val.length <= 8 && val !== `${startH}:${startM}`) {
              tempEndTime = `${timeMatch[1]}:${timeMatch[2]}`;

              break;
            }
          }
        }
        // 최종 폴백: 임시배정은 통상 예약 후 15분 (정확한 필드명 모를 때)
        if (!tempEndTime) {
          tempEndTime = addMins(`${startH}:${startM}`, 15);

        }
      }

      // ── 연장 횟수 ──
      // Pyxis API: renewableCnt = 남은 횟수, renewalLimit = 최대 횟수
      // 사용 횟수 = renewalLimit - renewableCnt
      const renewalLimit: number =
        item.renewalLimit ?? item.extensionLimitCount ?? item.extensionMaxCount ??
        item.maxRenewCount ?? item.extLimitCount ?? 4;
      const renewableCnt: number | undefined =
        item.renewableCnt ?? item.renewableCount ?? item.extensionRemaining;
      const extensionMax: number = renewalLimit;
      const extensionCount: number =
        renewableCnt !== undefined
          ? renewalLimit - renewableCnt          // 사용 = 최대 - 남은
          : (item.extensionCount ?? item.extensionUsedCount ?? item.renewCount ?? 0);

      // ── 연장 가능 시각 (renewableDate) ──
      const renewableDateRaw: string = item.renewableDate ?? item.renewableAt ?? '';
      let renewableTime: string | undefined;
      if (renewableDateRaw) {
        const rd = new Date(renewableDateRaw.replace(' ', 'T'));
        if (!isNaN(rd.getTime())) {
          renewableTime = `${String(rd.getHours()).padStart(2,'0')}:${String(rd.getMinutes()).padStart(2,'0')}`;
        }
      }

      const newInfo: MySeatInfo = {
        roomName: roomName || '알 수 없음',
        seatNo: seatNum,
        startTime: `${startH}:${startM}`,
        endTime: endTimeHHMM,       // 실제 종료 시각 — 연장 후 갱신됨
        renewableTime,              // renewableDate 파싱값 — 연장 가능 시작 시각
        savedDate: today,
        isTempAssign,
        tempEndTime,
        extensionCount,
        extensionMax,
      };
      const rem = calcRemaining(newInfo);
      await secureSet(MY_SEAT_KEY, JSON.stringify(newInfo));
      setInfo(newInfo);
      setRemaining(rem);
      setLibWebViewVisible(false);
    } catch {
      // 파싱 실패 시 무시 — 다음 seat-charges 응답에서 재시도
    }
  };

  const load = useCallback(async () => {
    try {
      const raw = await secureGet(MY_SEAT_KEY);
      if (!raw) return;
      const parsed: MySeatInfo = JSON.parse(raw);
      if (!parsed.startTime) { await secureDel(MY_SEAT_KEY); return; }
      const rem = calcRemaining(parsed);
      if (rem.expired) { await secureDel(MY_SEAT_KEY); return; }
      setInfo(parsed); setRemaining(rem);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!info) return;
    const id = setInterval(() => {
      const rem = calcRemaining(info);
      setRemaining(rem);
      if (rem.expired) { setInfo(null); setRemaining(null); secureDel(MY_SEAT_KEY); }
    }, 30_000);
    return () => clearInterval(id);
  }, [info]);

  // 외부 새로고침 트리거 — 내 자리 남은 시간 재계산
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!info) return;
    const rem = calcRemaining(info);
    setRemaining(rem);
    if (rem.expired) { setInfo(null); setRemaining(null); secureDel(MY_SEAT_KEY); }
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const barColor = remaining
    ? (remaining.totalMin > 60 ? '#10B981' : remaining.totalMin > 20 ? '#F59E0B' : '#EF4444')
    : '#10B981';

  return (
    <>
      {/* ── 개인정보 제3자 제공 동의 모달 ── */}
      <Modal visible={showConsentModal} transparent animationType="fade" onRequestClose={handleConsentDecline}>
        <View style={seatStyles.consentOverlay}>
          <View style={seatStyles.consentBox}>
            <View style={seatStyles.consentIconRow}>
              <Ionicons name="shield-checkmark-outline" size={32} color={C.primary} />
            </View>
            <Text style={seatStyles.consentTitle}>개인정보 제3자 제공 동의</Text>
            <Text style={seatStyles.consentBody}>
              원활한 서비스 제공을 위해 부산대학교 도서관 시스템에 세션 토큰을 제공하는 것에 동의하십니까?
            </Text>
            <View style={seatStyles.consentDetail}>
              <Text style={seatStyles.consentDetailText}>· 제공받는 자: 부산대학교 도서관 시스템</Text>
              <Text style={seatStyles.consentDetailText}>· 제공 항목: 도서관 웹사이트 세션 정보</Text>
              <Text style={seatStyles.consentDetailText}>· 제공 목적: 좌석 예약 현황 조회</Text>
              <Text style={seatStyles.consentDetailText}>· 보유 기간: 세션 종료 시 즉시 삭제</Text>
            </View>
            <Text style={seatStyles.consentNote}>
              동의하지 않아도 서비스 이용은 가능하나, 내 자리 자동 불러오기 기능을 사용할 수 없습니다.
            </Text>
            <View style={seatStyles.consentBtnRow}>
              <TouchableOpacity style={seatStyles.consentDeclineBtn} onPress={handleConsentDecline} activeOpacity={0.8}>
                <Text style={seatStyles.consentDeclineText}>거부</Text>
              </TouchableOpacity>
              <TouchableOpacity style={seatStyles.consentAgreeBtn} onPress={handleConsentAgree} activeOpacity={0.8}>
                <Text style={seatStyles.consentAgreeText}>동의</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 등록된 카드 ── */}
      {info && remaining ? (
        <TouchableOpacity style={seatStyles.card} onPress={handleSeatCardPress} activeOpacity={0.85}>
          <View style={seatStyles.cardHeader}>
            <View style={seatStyles.cardTitleRow}>
              <Ionicons name="library-outline" size={15} color={C.primary} />
              <Text style={seatStyles.cardTitle}>내 자리</Text>
              {info.isTempAssign && (
                <View style={seatStyles.tempBadge}>
                  <Text style={seatStyles.tempBadgeText}>임시배정</Text>
                  {info.tempEndTime && (
                    <Text style={seatStyles.tempBadgeTime}>~ {info.tempEndTime}</Text>
                  )}
                </View>
              )}
            </View>
            <View style={seatStyles.cardManageHint}>
              <Text style={seatStyles.cardManageHintText}>탭하여 불러오기</Text>
              <Feather name="refresh-cw" size={11} color="#9CA3AF" />
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
            <Text style={[seatStyles.metaText, remaining.extensionPassed && { color: '#10B981' }]}>
              {remaining.extensionPassed ? '연장 가능' : `연장 ${remaining.extensionTime}부터`}
            </Text>
            {info.extensionMax !== undefined && (
              <Text style={seatStyles.metaText}>
                연장 {info.extensionCount ?? 0} / {info.extensionMax}회
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={seatStyles.emptyCard} onPress={handleSeatCardPress} activeOpacity={0.85}>
          <View style={seatStyles.emptyTopRow}>
            <Ionicons name="library-outline" size={15} color={C.primary} />
            <Text style={seatStyles.emptyText}>내 자리</Text>
          </View>
          <Text style={seatStyles.emptySubText}>예약 중인 좌석이 있으면 탭하여 불러오세요</Text>
          <View style={seatStyles.emptyBtnRow}>
            <View style={seatStyles.autoSyncBtn}>
              <Ionicons name="sync-outline" size={13} color="#fff" />
              <Text style={seatStyles.autoSyncBtnText}>자동 불러오기</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* ── 도서관 WebView 자동 동기화 ── */}
      <Modal visible={libWebViewVisible} animationType="slide" onRequestClose={closeLibWebView}>
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
          {/* 헤더 */}
          <View style={seatStyles.wvHeader}>
            <Text style={seatStyles.wvTitle}>부산대 도서관</Text>
            {webSyncLoading
              ? <ActivityIndicator size="small" color={C.primary} />
              : <View style={{ width: 28 }} />
            }
            <TouchableOpacity onPress={closeLibWebView} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={seatStyles.wvCloseBtn}>
              <Feather name="x" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
          {/* 안내 배너 */}
          <View style={seatStyles.wvBanner}>
            <Ionicons name="information-circle-outline" size={13} color={C.primary} />
            <Text style={seatStyles.wvBannerText}>로그인 후 연장·반납 등 관리하면 앱에 자동 반영됩니다</Text>
          </View>
          <WebView
            ref={webViewRef}
            source={{ uri: 'https://lib.pusan.ac.kr/mylibrary/seat/reservations' }}
            injectedJavaScriptBeforeContentLoaded={INTERCEPTOR_SCRIPT}
            onNavigationStateChange={handleWebNavChange}
            onMessage={handleWebMessage}
            onShouldStartLoadWithRequest={(req) =>
              req.url.startsWith('https://lib.pusan.ac.kr')
            }
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled={false}
            mixedContentMode="never"
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            javaScriptCanOpenWindowsAutomatically={false}
            style={{ flex: 1 }}
          />
          {/* 하단 닫기 버튼 */}
          <TouchableOpacity
            onPress={closeLibWebView}
            style={[seatStyles.wvCloseBar, { paddingBottom: insets.bottom + 8 }]}
          >
            <Text style={seatStyles.wvCloseBarText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// Toast hook
// ══════════════════════════════════════════════════════════════
const TOAST_CFG = {
  success: { bg: '#F0FDF9', border: '#10B981', iconColor: '#059669', icon: 'check-circle' as const, labelColor: '#065F46' },
  info:    { bg: '#EEF4FB', border: C.primary,  iconColor: C.primary,  icon: 'info'         as const, labelColor: C.primary },
  error:   { bg: '#FFF1F2', border: '#F43F5E',  iconColor: '#E11D48',  icon: 'alert-circle' as const, labelColor: '#9F1239' },
};

function useToast() {
  const [msg, setMsg] = useState('');
  const [type, setType] = useState<keyof typeof TOAST_CFG>('info');
  const [sub, setSub] = useState('');
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, t: keyof typeof TOAST_CFG = 'info', subtitle?: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(message); setType(t); setSub(subtitle ?? '');
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 90, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -20, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    }, 3200);
  }, [opacity, translateY]);

  const cfg = TOAST_CFG[type];
  const Toast = (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          opacity,
          transform: [{ translateY }],
          top: insets.top + 12,
          backgroundColor: cfg.bg,
          borderLeftColor: cfg.border,
        },
      ]}
    >
      <View style={[styles.toastIconWrap, { backgroundColor: `${cfg.border}18` }]}>
        <Feather name={cfg.icon} size={14} color={cfg.iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toastText, { color: cfg.labelColor }]}>{msg}</Text>
        {!!sub && <Text style={styles.toastSub}>{sub}</Text>}
      </View>
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
  onRoomsReady, onSelectRoom, refreshTrigger = 0,
}: {
  branchGroupId: number; typeFilter: string | null;
  excludeNames: readonly string[];
  isActive: boolean;
  onRoomsReady: (rooms: SeatRoom[]) => void;
  onSelectRoom: (room: SeatRoom) => void;
  refreshTrigger?: number;
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

  // 외부 새로고침 트리거
  const triggerFirst = useRef(true);
  useEffect(() => {
    if (triggerFirst.current) { triggerFirst.current = false; return; }
    fetchRooms(true);
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const [mainTab, setMainTab] = useState<'rooms' | 'myseat'>('myseat');
  const [activeRoomTab, setActiveRoomTab] = useState<RoomTabKey>('saebbyukbul');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshingHeader, setIsRefreshingHeader] = useState(false);

  // 공용 인앱 WebView
  const [wvVisible, setWvVisible] = useState(false);
  const [wvUrl, setWvUrl] = useState('');
  const [wvTitle, setWvTitle] = useState('');
  const [wvLoading, setWvLoading] = useState(false);

  const openInAppWeb = useCallback((url: string, title: string) => {
    setWvUrl(url);
    setWvTitle(title);
    setWvLoading(true);
    setWvVisible(true);
  }, []);

  const handleRoomsReady = useCallback((_tabKey: RoomTabKey) => (_rooms: SeatRoom[]) => {
  }, []);

  const handleSelectRoom = useCallback((room: SeatRoom) => {
    openInAppWeb(getRoomUrl(room.name), room.name);
  }, [openInAppWeb]);

  const openQR = useCallback(() => {
    WebBrowser.openBrowserAsync(QR_URL);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshingHeader(true);
    setRefreshTrigger(t => t + 1);
    setTimeout(() => setIsRefreshingHeader(false), 800);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* ── Sticky Header ── */}
      <View style={styles.stickyHeader}>

        {/* Page Header */}
        <View style={styles.headerSection}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.universityLabel}>부산대학교</Text>
          <View style={styles.headerRow}>
            <Text style={styles.pageTitle}>도서관</Text>
            <TouchableOpacity style={styles.qrBtn} onPress={openQR} hitSlop={8}>
              <Ionicons name="qr-code-outline" size={22} color={C.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 메인 탭 토글: 열람실 현황 / 내 자리 */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleBg}>
            <TouchableOpacity
              style={[styles.toggleBtn, mainTab === 'myseat' && styles.toggleBtnActive]}
              onPress={() => setMainTab('myseat')}
            >
              <Feather name="bookmark" size={13} color={mainTab === 'myseat' ? C.primary : '#9CA3AF'} />
              <Text style={[styles.toggleText, mainTab === 'myseat' && styles.toggleTextActive]}>내 자리</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mainTab === 'rooms' && styles.toggleBtnActive]}
              onPress={() => setMainTab('rooms')}
            >
              <Feather name="book-open" size={13} color={mainTab === 'rooms' ? C.primary : '#9CA3AF'} />
              <Text style={[styles.toggleText, mainTab === 'rooms' && styles.toggleTextActive]}>열람실 현황</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 열람실 서브탭 (열람실 현황 탭일 때만) */}
        {mainTab === 'rooms' && (
          <View style={styles.roomTabBar}>
            <View style={{ flex: 1, flexDirection: 'row' }}>
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
            <TouchableOpacity onPress={handleRefresh} hitSlop={10} style={styles.tabRefreshBtn}>
              <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                {isRefreshingHeader
                  ? <ActivityIndicator size="small" color={C.primary} />
                  : <Feather name="refresh-cw" size={15} color={C.primary} />
                }
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── 내용 영역 ── */}
      {mainTab === 'rooms' ? (
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
                refreshTrigger={refreshTrigger}
              />
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.mySeatScrollContent}
        >
          <MySeatCard refreshTrigger={refreshTrigger} showToast={showToast} />

          <TouchableOpacity
            style={styles.reservationBtn}
            onPress={() => openInAppWeb(RESERVATION_URL, '좌석 예약 현황')}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={15} color={C.primary} style={{ marginRight: 6 }} />
            <Text style={styles.reservationBtnText}>내 좌석 예약 현황 보기</Text>
            <Feather name="chevron-right" size={13} color={C.primary} style={{ marginLeft: 6, opacity: 0.6 }} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── 공용 인앱 WebView 모달 ── */}
      <Modal visible={wvVisible} animationType="slide" onRequestClose={() => setWvVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: isWeb ? 67 : insets.top }}>
          {/* 헤더 */}
          <View style={styles.wvHeader}>
            <TouchableOpacity
              onPress={() => setWvVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.wvCloseBtn}
            >
              <Feather name="arrow-left" size={20} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.wvTitle} numberOfLines={1}>{wvTitle}</Text>
            {wvLoading
              ? <ActivityIndicator size="small" color={C.primary} style={{ width: 36 }} />
              : <View style={{ width: 36 }} />
            }
          </View>
          {isWeb ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 }}>
              <Feather name="smartphone" size={36} color="#D1D5DB" />
              <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 }}>
                이 기능은 모바일 앱에서 이용해 주세요.
              </Text>
            </View>
          ) : (
            <WebView
              source={{ uri: wvUrl }}
              style={{ flex: 1 }}
              onLoadStart={() => setWvLoading(true)}
              onLoadEnd={() => setWvLoading(false)}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              scalesPageToFit={false}
              onMessage={(e) => {
                try {
                  const d = JSON.parse(e.nativeEvent.data);
                  if (d.t === 'ERR') console.warn('[WV inject error]', d.m);
                  else console.log('[WV dbg]', JSON.stringify(d));
                } catch {}
              }}
              injectedJavaScript={`
                (function() {
                  try {

                    /* ═══════════════════════════════════════════════════
                       1. 헤더 / 푸터 숨기기 (Angular Material Pyxis)
                    ═══════════════════════════════════════════════════ */
                    function hide() {
                      /* 헤더 숨기기 */
                      var header = document.querySelector('.ikc-header-toolbar');
                      if (header) header.style.setProperty('display', 'none', 'important');

                      /* 푸터 숨기기 */
                      var footer = document.querySelector('.ikc-footer-toolbar');
                      if (footer) footer.style.setProperty('display', 'none', 'important');

                      /* 헤더·푸터 제거 후 남는 여백 및 오버스크롤 제거 */
                      var content = document.querySelector('.mat-sidenav-content, .mat-drawer-content');
                      if (content) {
                        content.style.setProperty('margin-top',    '0', 'important');
                        content.style.setProperty('margin-bottom', '0', 'important');
                        content.style.setProperty('padding-top',   '0', 'important');
                        content.style.setProperty('padding-bottom','0', 'important');
                      }
                      /* 바디 오버스크롤 잠금 */
                      document.body.style.setProperty('overscroll-behavior', 'none', 'important');
                      document.documentElement.style.setProperty('overscroll-behavior', 'none', 'important');
                    }
                    hide();
                    new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
                    for (var i = 1; i <= 15; i++) setTimeout(hide, i * 300);

                    /* ═══════════════════════════════════════════════════
                       2. 핀치 줌 → 확대/축소 슬라이더 연동
                    ═══════════════════════════════════════════════════ */

                    /* 2-1. 네이티브 핀치줌 비활성화 */
                    var vp = document.querySelector('meta[name="viewport"]');
                    if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0');

                    /* 2-2. 슬라이더 입력 요소 탐색 */
                    function getSliderInput() {
                      return document.querySelector('mat-slider input') ||
                             document.querySelector('input[type="range"]') ||
                             document.querySelector('.mat-slider-thumb-container input');
                    }

                    /* 2-3. Angular change detection을 통한 슬라이더 값 변경 */
                    function setSliderValue(newVal) {
                      var inp = getSliderInput();
                      if (!inp) return;
                      var min = parseFloat(inp.min !== '' ? inp.min : '0');
                      var max = parseFloat(inp.max !== '' ? inp.max : '1');
                      var clamped = Math.max(min, Math.min(max, newVal));

                      /* Angular는 네이티브 setter를 통해야 변경 감지 */
                      var desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
                      if (desc && desc.set) desc.set.call(inp, String(clamped));
                      else inp.value = String(clamped);

                      inp.dispatchEvent(new Event('input',  { bubbles: true }));
                      inp.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    /* 2-4. 두 손가락 거리 계산 */
                    function pinchDist(e) {
                      var dx = e.touches[0].clientX - e.touches[1].clientX;
                      var dy = e.touches[0].clientY - e.touches[1].clientY;
                      return Math.sqrt(dx * dx + dy * dy);
                    }

                    var startDist = null;
                    var startVal  = null;
                    var SENSITIVITY = 0.4; /* 민감도 조절: 값이 클수록 빠르게 변함 */

                    document.addEventListener('touchstart', function(e) {
                      if (e.touches.length === 2) {
                        startDist = pinchDist(e);
                        var inp = getSliderInput();
                        startVal = inp ? parseFloat(inp.value) : null;
                      } else {
                        startDist = null; startVal = null;
                      }
                    }, { passive: true });

                    document.addEventListener('touchmove', function(e) {
                      if (e.touches.length !== 2 || startDist === null || startVal === null) return;
                      e.preventDefault(); /* 페이지 스크롤 막고 핀치만 처리 */

                      var curDist = pinchDist(e);
                      var ratio   = (curDist - startDist) / startDist; /* 양수=확대, 음수=축소 */

                      var inp = getSliderInput();
                      if (!inp) return;
                      var min   = parseFloat(inp.min !== '' ? inp.min : '0');
                      var max   = parseFloat(inp.max !== '' ? inp.max : '1');
                      var range = max - min;

                      setSliderValue(startVal + ratio * range * SENSITIVITY);
                    }, { passive: false });

                    document.addEventListener('touchend', function(e) {
                      if (e.touches.length < 2) { startDist = null; startVal = null; }
                    }, { passive: true });

                  } catch(e) {
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'ERR', m: e.message }));
                    }
                  }
                  true;
                })();
              `}
            />
          )}
        </View>
      </Modal>

      {Toast}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },

  // ── Sticky Header (meals.tsx 패턴) ──
  stickyHeader: {
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 3,
  },
  headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', marginBottom: 4, marginLeft: -4 },
  universityLabel: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  pageTitle: { fontSize: 36, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: -1, lineHeight: 42 },
  qrBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },

  // ── 메인 탭 토글 (campus-map.tsx 패턴) ──
  toggleContainer: { paddingHorizontal: 20, paddingBottom: 12 },
  toggleBg: {
    flexDirection: 'row', backgroundColor: '#F3F4F6',
    borderRadius: 14, padding: 4,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  toggleText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  toggleTextActive: { color: C.primary },

  // ── Room Tab Bar (열람실 현황 탭) ──
  roomTabBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10,
  },
  roomTabItem: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 6,
  },
  roomTabItemActive: { backgroundColor: C.primary },
  roomTabLabel: { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_500Medium', fontWeight: '500' },
  roomTabLabelActive: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  tabRefreshBtn: { padding: 6, marginLeft: 4 },

  // ── Center ──
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
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8,
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

  // ── 내 자리 탭 ──
  mySeatScrollContent: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80, gap: 12,
  },
  reservationBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.primary, borderRadius: 14,
    paddingVertical: 13, backgroundColor: '#fff',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 1,
  },
  reservationBtnText: { fontSize: 14, fontWeight: '600', color: C.primary, fontFamily: 'Inter_600SemiBold' },

  // ── 인앱 WebView 헤더 ──
  wvHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  wvCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  wvTitle: {
    flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#111827',
  },

  toast: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, zIndex: 9999,
    borderLeftWidth: 4,
    shadowColor: '#00427D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  toastIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  toastText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  toastSub: { fontSize: 11, color: '#6B7280', fontFamily: 'Inter_400Regular', marginTop: 1 },
});

const seatStyles = StyleSheet.create({
  // ── 카드 ──
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: `${C.primary}22`,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: C.primary, fontFamily: 'Inter_600SemiBold' },
  tempBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFF7ED', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: '#FDBA74',
  },
  tempBadgeText: { fontSize: 10, fontWeight: '600', color: '#C2410C', fontFamily: 'Inter_600SemiBold' },
  tempBadgeTime: { fontSize: 10, color: '#EA580C', fontFamily: 'Inter_500Medium' },
  cardManageHint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardManageHintText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

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
  // ── 도서관 WebView ──
  wvHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  wvTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827', fontFamily: 'Inter_600SemiBold' },
  wvCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  wvCloseBar: {
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', paddingTop: 14,
  },
  wvCloseBarText: { fontSize: 16, fontWeight: '600', color: '#374151', fontFamily: 'Inter_600SemiBold' },
  wvBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${C.primary}0D`, paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: `${C.primary}18`,
  },
  wvBannerText: { flex: 1, fontSize: 11, color: C.primary, fontFamily: 'Inter_400Regular', lineHeight: 16 },

  // ── 개인정보 제3자 제공 동의 모달 ──
  consentOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  consentBox: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 380,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  consentIconRow: { alignItems: 'center', marginBottom: 14 },
  consentTitle: {
    fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827',
    textAlign: 'center', marginBottom: 12,
  },
  consentBody: {
    fontSize: 14, fontFamily: 'Inter_400Regular', color: '#374151',
    lineHeight: 22, textAlign: 'center', marginBottom: 16,
  },
  consentDetail: {
    backgroundColor: '#F8FAFF', borderRadius: 12,
    borderWidth: 1, borderColor: `${C.primary}20`,
    padding: 12, marginBottom: 12, gap: 5,
  },
  consentDetailText: {
    fontSize: 12, fontFamily: 'Inter_400Regular', color: '#4B5563', lineHeight: 18,
  },
  consentNote: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF',
    lineHeight: 17, textAlign: 'center', marginBottom: 20,
  },
  consentBtnRow: { flexDirection: 'row', gap: 10 },
  consentDeclineBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#F3F4F6', alignItems: 'center',
  },
  consentDeclineText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  consentAgreeBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: C.primary, alignItems: 'center',
  },
  consentAgreeText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
