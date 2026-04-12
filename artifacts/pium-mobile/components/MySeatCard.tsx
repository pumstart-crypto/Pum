/**
 * MySeatCard.tsx
 *
 * 홈 화면 도서관 좌석 대시보드 카드.
 * - 다이내믹 티켓 UI: 현재 좌석·열람실·도서관 정보 표시
 * - 진행 바 + 카운트다운 타이머 (1초 단위 업데이트)
 * - 스마트 연장 버튼: extendableTime 이전에는 비활성화
 * - 빨간 반납 버튼
 * - 임시배정 상태 시 확정 마감시간 표시
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Animated,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import C from '@/constants/colors';
import { getSchoolSession, clearSchoolSession, SchoolSession } from '@/utils/schoolAuth';
import {
  getMySeat, extendSeat, returnSeat, MySeatData,
  extractSeatName, extractRoomName, extractBranchName,
} from '@/utils/seatManagement';

// ── 시간 파싱 ─────────────────────────────────────────────────
function parseDateTime(str: string | null | undefined): Date | null {
  if (!str) return null;
  // ISO datetime (e.g. "2024-01-15T09:00:00" or "2024-01-15 09:00:00")
  const normalized = str.replace(' ', 'T');
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;
  // HH:mm or HH:mm:ss — treat as today
  const parts = str.split(':').map(Number);
  if (parts.length >= 2) {
    const today = new Date();
    today.setHours(parts[0], parts[1], parts[2] ?? 0, 0);
    return today;
  }
  return null;
}

function formatTime(date: Date | null): string {
  if (!date) return '--:--';
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

function formatCountdownKo(ms: number): string {
  if (ms <= 0) return '시간이 종료되었습니다';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분 남음`;
  return `${m}분 남음`;
}

// ── 실제 구현 컴포넌트 ──────────────────────────────────────────
interface ToastState { msg: string; type: 'success' | 'error' }

function MySeatCardImpl() {
  const [session, setSession] = useState<SchoolSession | null>(null);
  const [seatData, setSeatData] = useState<MySeatData | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingSeat, setLoadingSeat] = useState(false);
  const [extending, setExtending] = useState(false);
  const [returning, setReturning] = useState(false);
  const [now, setNow] = useState(new Date());
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // 1초 타이머
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // 세션 로드
  useEffect(() => {
    getSchoolSession().then(s => {
      setSession(s);
      setLoadingSession(false);
    });
  }, []);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
    toastTimer.current = setTimeout(() => setToast(null), 2700);
  }, [toastOpacity]);

  const loadSeat = useCallback(async () => {
    setSeatLoading(true);
    const r = await getMySeat();
    setSeatLoading(false);
    if (r.needsLogin) {
      setSession(null);
      await clearSchoolSession();
      setSeatData(null);
    } else if (r.success) {
      setSeatData((r.data as MySeatData) ?? null);
    }
  }, []);

  // seat loading helper (avoids capturing stale state)
  function setSeatLoading(v: boolean) { setLoadingSeat(v); }

  useEffect(() => {
    if (session) loadSeat();
    else setSeatData(null);
  }, [session, loadSeat]);

  // ── 계산값 ────────────────────────────────────────────────────
  const seatName    = extractSeatName(seatData);
  const roomName    = extractRoomName(seatData);
  const branchName  = extractBranchName(seatData);
  const startTime   = parseDateTime(seatData?.startTime);
  const endTime     = parseDateTime(seatData?.endTime);
  const extTime     = parseDateTime(seatData?.extendableTime);
  const tempDeadline = parseDateTime(seatData?.temporaryEndTime);
  const remaining   = endTime ? Math.max(0, endTime.getTime() - now.getTime()) : 0;
  const totalMs     = (startTime && endTime) ? endTime.getTime() - startTime.getTime() : 0;
  const elapsed     = startTime ? now.getTime() - startTime.getTime() : 0;
  const progress    = totalMs > 0 ? Math.min(1, Math.max(0, elapsed / totalMs)) : 0;
  const canExtend   = !extTime || now >= extTime;
  const isTemp      = seatData?.state?.code === 'T';
  const hasSeat     = !!seatName;

  // 남은 시간에 따른 바 색상
  const barColor = remaining < 10 * 60 * 1000 ? '#EF4444'
    : remaining < 30 * 60 * 1000 ? '#F59E0B'
    : '#10B981';

  // ── 액션 핸들러 ────────────────────────────────────────────────
  const handleExtend = async () => {
    if (!canExtend) {
      const h = extTime!.getHours();
      const m = String(extTime!.getMinutes()).padStart(2, '0');
      showToast(`${h}시 ${m}분부터 연장 가능해요`, 'error');
      return;
    }
    setExtending(true);
    const r = await extendSeat();
    setExtending(false);
    if (r.needsLogin) { setSession(null); clearSchoolSession(); return; }
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) loadSeat();
  };

  const handleReturn = async () => {
    setReturning(true);
    const r = await returnSeat();
    setReturning(false);
    if (r.needsLogin) { setSession(null); clearSchoolSession(); return; }
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) setSeatData(null);
  };

  // ── 렌더 분기 ─────────────────────────────────────────────────
  if (loadingSession) return null;

  // 미로그인
  if (!session) {
    return (
      <TouchableOpacity style={styles.ctaCard} onPress={() => router.push('/reading-rooms')} activeOpacity={0.82}>
        <View style={styles.ctaIconBox}>
          <Ionicons name="library-outline" size={24} color={C.primary} />
        </View>
        <View style={styles.ctaTexts}>
          <Text style={styles.ctaTitle}>도서관 좌석 관리</Text>
          <Text style={styles.ctaSub}>로그인 후 예약·연장·반납을 여기서 관리하세요</Text>
        </View>
        <Feather name="chevron-right" size={18} color="#D1D5DB" />
      </TouchableOpacity>
    );
  }

  // 로딩 중
  if (loadingSeat) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={C.primary} size="small" />
        <Text style={styles.loadingText}>좌석 정보를 불러오는 중...</Text>
      </View>
    );
  }

  // 로그인됐지만 좌석 없음
  if (!hasSeat) {
    return (
      <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/reading-rooms')} activeOpacity={0.82}>
        <View style={styles.emptyLeft}>
          <View style={styles.emptyDot} />
          <View>
            <Text style={styles.emptyTitle}>예약된 좌석이 없어요</Text>
            <Text style={styles.emptySub}>{session.userName ? `${session.userName} · ` : ''}도서관에서 자리 예약하기</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={16} color="#D1D5DB" />
      </TouchableOpacity>
    );
  }

  // ── 좌석 티켓 카드 ──────────────────────────────────────────────
  const accentColor = isTemp ? '#F59E0B' : C.primary;
  const extendBtnAvailable = canExtend;
  const extendLabel = extendBtnAvailable ? '연장하기' : (() => {
    if (!extTime) return '연장하기';
    const h = extTime.getHours();
    const m = String(extTime.getMinutes()).padStart(2, '0');
    return `${h}:${m} 이후 가능`;
  })();

  return (
    <View style={styles.ticketCard}>
      {/* 상단 헤더 */}
      <View style={[styles.ticketHeader, { backgroundColor: accentColor }]}>
        <View style={styles.ticketHeaderLeft}>
          <View style={styles.stateDot} />
          <Text style={styles.stateName} numberOfLines={1}>
            {isTemp ? '임시배정' : (seatData?.state?.name ?? '이용중')}
          </Text>
          {(branchName || roomName) && (
            <Text style={styles.locationText} numberOfLines={1}>
              {[branchName, roomName].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={() => router.push('/reading-rooms')} hitSlop={10}>
          <Feather name="external-link" size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* 임시배정 마감 경고 */}
      {isTemp && tempDeadline && (
        <View style={styles.tempWarning}>
          <Feather name="alert-triangle" size={13} color="#D97706" />
          <Text style={styles.tempWarningText}>
            {formatTime(tempDeadline)}까지 입장 확정 필요
          </Text>
        </View>
      )}

      {/* 티켓 구분선 */}
      <View style={styles.perforation}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={i} style={styles.perforationDot} />
        ))}
      </View>

      {/* 좌석 번호 */}
      <View style={styles.seatRow}>
        <Text style={styles.seatNumber}>{seatName}</Text>
        <Text style={styles.seatSuffix}>번 좌석</Text>
      </View>

      {/* 타임라인 + 진행 바 */}
      {(startTime || endTime) ? (
        <View style={styles.timeSection}>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>{formatTime(startTime)}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${progress * 100}%` as any, backgroundColor: barColor }]} />
            </View>
            <Text style={styles.timeLabel}>{formatTime(endTime)}</Text>
          </View>
          <Text style={styles.remainingText}>
            {remaining > 0
              ? `남은 시간  ${formatCountdown(remaining)}`
              : '이용 시간이 종료되었습니다'}
          </Text>
        </View>
      ) : null}

      {/* 버튼 영역 */}
      <View style={styles.actionRow}>
        {/* 연장 버튼 */}
        <TouchableOpacity
          style={[
            styles.extendBtn,
            !extendBtnAvailable && styles.extendBtnDisabled,
            { borderColor: accentColor },
          ]}
          onPress={handleExtend}
          disabled={extending || returning}
          activeOpacity={0.8}
        >
          {extending ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <>
              <Feather name="clock" size={14} color={extendBtnAvailable ? accentColor : '#9CA3AF'} />
              <Text style={[styles.extendBtnText, !extendBtnAvailable && styles.extendBtnTextDisabled, { color: extendBtnAvailable ? accentColor : '#9CA3AF' }]}>
                {extendLabel}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* 반납 버튼 */}
        <TouchableOpacity
          style={[styles.returnBtn, (extending || returning) && styles.btnDisabled]}
          onPress={handleReturn}
          disabled={extending || returning}
          activeOpacity={0.8}
        >
          {returning ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="log-out" size={14} color="#fff" />
              <Text style={styles.returnBtnText}>반납하기</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 인라인 토스트 */}
      {toast && (
        <Animated.View style={[styles.inlineToast, { opacity: toastOpacity, backgroundColor: toast.type === 'success' ? '#065F46' : '#7F1D1D' }]}>
          <Feather name={toast.type === 'success' ? 'check-circle' : 'alert-circle'} size={13} color="#fff" />
          <Text style={styles.toastText}>{toast.msg}</Text>
        </Animated.View>
      )}
    </View>
  );
}

// ── Public wrapper (web guard) ────────────────────────────────
export default function MySeatCard() {
  if (Platform.OS === 'web') return null;
  return <MySeatCardImpl />;
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  // CTA 카드 (미로그인)
  ctaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: `${C.primary}0A`, borderRadius: 16,
    padding: 16, borderWidth: 1.5, borderColor: `${C.primary}20`,
  },
  ctaIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: `${C.primary}14`,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaTexts: { flex: 1 },
  ctaTitle: { fontSize: 15, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold' },
  ctaSub: { fontSize: 12, color: '#6B7280', marginTop: 2, fontFamily: 'Inter_400Regular' },

  // 로딩 카드
  loadingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F9FAFB', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#F3F4F6',
  },
  loadingText: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  // 빈 좌석 카드
  emptyCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  emptyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#374151', fontFamily: 'Inter_600SemiBold' },
  emptySub: { fontSize: 12, color: '#9CA3AF', marginTop: 1, fontFamily: 'Inter_400Regular' },

  // 티켓 카드
  ticketCard: {
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10, shadowRadius: 10, elevation: 4,
  },
  ticketHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 13,
  },
  ticketHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  stateDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.85)' },
  stateName: { fontSize: 12, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
  locationText: { fontSize: 12, color: 'rgba(255,255,255,0.80)', fontFamily: 'Inter_400Regular', flex: 1 },

  tempWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 18, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#FED7AA',
  },
  tempWarningText: { fontSize: 12, color: '#D97706', fontFamily: 'Inter_600SemiBold' },

  perforation: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 2,
    backgroundColor: '#fff',
  },
  perforationDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#F3F4F6' },

  seatRow: {
    flexDirection: 'row', alignItems: 'baseline',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6,
    gap: 4,
  },
  seatNumber: { fontSize: 52, fontWeight: '800', color: '#111827', fontFamily: 'Inter_700Bold', lineHeight: 60 },
  seatSuffix: { fontSize: 18, fontWeight: '500', color: '#6B7280', fontFamily: 'Inter_500Medium', marginBottom: 4 },

  timeSection: { paddingHorizontal: 18, paddingBottom: 14 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  timeLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', fontFamily: 'Inter_600SemiBold', width: 38 },
  barTrack: {
    flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  remainingText: { fontSize: 13, color: '#374151', fontFamily: 'Inter_600SemiBold', textAlign: 'right' },

  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 18, paddingTop: 4 },

  extendBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 12,
    paddingVertical: 12, backgroundColor: '#fff',
  },
  extendBtnDisabled: { borderColor: '#E5E7EB' },
  extendBtnText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  extendBtnTextDisabled: { color: '#9CA3AF' },

  returnBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 12,
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  returnBtnText: { fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
  btnDisabled: { opacity: 0.6 },

  inlineToast: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 16, marginBottom: 14,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  toastText: { flex: 1, fontSize: 13, color: '#fff', fontFamily: 'Inter_500Medium' },
});
