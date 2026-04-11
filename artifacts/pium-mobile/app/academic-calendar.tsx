import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Modal, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';
import { getNow } from '@/utils/debugTime';

const isWeb = Platform.OS === 'web';

interface CalendarEvent {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  title: string;
}

const EVENTS: CalendarEvent[] = [
  { startDate: '2025-10-31', startTime: '09:00', endDate: '2025-11-06', endTime: '18:00', title: '겨울계절 및 도약수업 복학신청기간' },
  { startDate: '2025-11-14', startTime: '09:00', endDate: '2025-11-18', endTime: '18:00', title: '겨울계절 및 도약수업 복학신청기간' },
  { startDate: '2025-11-25', startTime: '09:00', endDate: '2025-11-26', endTime: '18:00', title: '겨울계절 및 도약수업 복학신청기간' },
  { startDate: '2025-12-03', startTime: '09:00', endDate: '2025-12-04', endTime: '18:00', title: '겨울계절 및 도약수업 복학신청기간' },
  { startDate: '2025-12-22', startTime: '09:00', endDate: '2025-12-29', endTime: '18:00', title: '1학기 휴·복학 신청기간' },
  { startDate: '2026-01-09', startTime: '09:00', endDate: '2026-02-03', endTime: '17:00', title: '1학기 학사학위취득유예신청기간' },
  { startDate: '2026-01-12', startTime: '09:00', endDate: '2026-01-14', endTime: '18:00', title: '1학기 부전공 신청' },
  { startDate: '2026-01-12', startTime: '09:00', endDate: '2026-01-14', endTime: '18:00', title: '1학기 복수전공 신청' },
  { startDate: '2026-01-12', startTime: '09:00', endDate: '2026-01-23', endTime: '23:59', title: '1학기 국문·영문 교수계획표 입력' },
  { startDate: '2026-01-23', startTime: '09:00', endDate: '2026-01-29', endTime: '18:00', title: '1학기 휴·복학 신청기간' },
  { startDate: '2026-01-29', startTime: '00:00', endDate: '2026-02-05', endTime: '18:00', title: '1학기 수료후연구생 신청기간' },
  { startDate: '2026-02-02', startTime: '10:00', endDate: '2026-02-03', endTime: '17:00', title: '1학기 희망과목담기' },
  { startDate: '2026-02-04', startTime: '09:00', endDate: '2026-02-04', endTime: '18:00', title: '1학기 자동신청결과확인' },
  { startDate: '2026-02-04', startTime: '10:00', endDate: '2026-02-09', endTime: '18:00', title: '1학기 분할납부신청기간' },
  { startDate: '2026-02-05', startTime: '09:00', endDate: '2026-02-13', endTime: '18:00', title: '1학기 WEB 근로/학업지원' },
  { startDate: '2026-02-05', startTime: '09:00', endDate: '2026-02-13', endTime: '18:00', title: '1학기 ONE(교육정보) 웹신청관리' },
  { startDate: '2026-02-09', startTime: '08:00', endDate: '2026-02-11', endTime: '17:00', title: '1학기 수강신청(학부)' },
  { startDate: '2026-02-09', startTime: '08:00', endDate: '2026-02-11', endTime: '17:00', title: '1학기 수강신청(대학원)' },
  { startDate: '2026-02-09', startTime: '08:00', endDate: '2026-02-11', endTime: '17:00', title: '1학기 수강신청(타대생)' },
  { startDate: '2026-02-12', startTime: '10:00', endDate: '2026-02-13', endTime: '17:00', title: '1학기 수강신청(신입생)' },
  { startDate: '2026-02-19', startTime: '00:00', endDate: '2026-03-20', endTime: '00:00', title: '1학기 학위청구자격시험 WEB 신청_조회(치의학전문대학원)' },
  { startDate: '2026-02-19', startTime: '09:00', endDate: '2026-02-24', endTime: '18:00', title: '1학기 휴·복학 신청기간' },
  { startDate: '2026-02-19', startTime: '10:00', endDate: '2026-02-20', endTime: '17:00', title: '1학기 수강신청(학부)' },
  { startDate: '2026-02-19', startTime: '10:00', endDate: '2026-02-20', endTime: '17:00', title: '1학기 수강신청(대학원)' },
  { startDate: '2026-02-19', startTime: '10:00', endDate: '2026-02-20', endTime: '17:00', title: '1학기 수강신청(타대생)' },
  { startDate: '2026-02-19', startTime: '10:00', endDate: '2026-02-24', endTime: '23:59', title: '1학기 수료후연구생 등록금납부' },
  { startDate: '2026-02-19', startTime: '10:00', endDate: '2026-02-24', endTime: '23:59', title: '1학기 재학생 등록금납부' },
  { startDate: '2026-02-19', startTime: '10:00', endDate: '2026-03-10', endTime: '18:00', title: '1학기 학위청구자격시험 WEB 신청(대학원)' },
  { startDate: '2026-02-19', startTime: '10:00', endDate: '2026-03-10', endTime: '18:00', title: '1학기 학위청구자격시험 WEB 신청(한의학전문대학원)' },
  { startDate: '2026-02-19', startTime: '10:00', endDate: '2026-03-20', endTime: '18:00', title: '1학기 학위청구자격시험(외국어시험) WEB 신청(한의학전문대학원)' },
  { startDate: '2026-02-19', startTime: '10:00', endDate: '2026-03-20', endTime: '18:00', title: '1학기 학위청구자격시험(외국어시험) WEB 신청(대학원)' },
  { startDate: '2026-02-19', startTime: '10:00', endDate: '2026-03-31', endTime: '23:59', title: '1학기 학위청구자격시험 WEB 신청_조회(법학전문대학원)' },
  { startDate: '2026-02-24', startTime: '10:00', endDate: '2026-03-13', endTime: '18:00', title: '1학기 학위청구자격시험 WEB 신청(기술창업대학원)' },
  { startDate: '2026-02-26', startTime: '00:00', endDate: '2026-02-26', endTime: '00:00', title: '1학기 1차 폐강강좌 공고' },
  { startDate: '2026-03-03', startTime: '00:00', endDate: '2026-03-03', endTime: '00:00', title: '1학기 개강' },
  { startDate: '2026-03-03', startTime: '08:00', endDate: '2026-03-09', endTime: '17:00', title: '1학기 수강정정(학부,타대생)' },
  { startDate: '2026-03-03', startTime: '08:00', endDate: '2026-03-09', endTime: '23:59', title: '1학기 수강정정(대학원)' },
  { startDate: '2026-03-03', startTime: '09:00', endDate: '2026-03-05', endTime: '18:00', title: '1학기 휴·복학 신청기간' },
  { startDate: '2026-03-03', startTime: '10:00', endDate: '2026-03-05', endTime: '23:59', title: '1학기 재학생 등록금납부' },
  { startDate: '2026-03-03', startTime: '14:00', endDate: '2026-03-06', endTime: '18:00', title: '1학기 WEB 근로/학업지원' },
  { startDate: '2026-03-03', startTime: '14:00', endDate: '2026-03-06', endTime: '18:00', title: '1학기 ONE(교육정보) 웹신청관리' },
  { startDate: '2026-03-04', startTime: '00:00', endDate: '2026-03-11', endTime: '18:00', title: '1학기 수료후연구생 신청기간' },
  { startDate: '2026-03-10', startTime: '09:00', endDate: '2026-03-13', endTime: '18:00', title: '1학기 학위청구자격시험 WEB 신청(융합의생명과학대학원)' },
  { startDate: '2026-03-16', startTime: '00:00', endDate: '2026-03-16', endTime: '00:00', title: '1학기 2차 폐강강좌 공고' },
  { startDate: '2026-03-17', startTime: '10:00', endDate: '2026-03-18', endTime: '17:00', title: '1학기 수강정정(대학원)' },
  { startDate: '2026-03-17', startTime: '10:00', endDate: '2026-03-18', endTime: '17:00', title: '1학기 수강정정(학부,타대생)' },
  { startDate: '2026-03-21', startTime: '14:00', endDate: '2026-03-23', endTime: '09:00', title: '1학기 도서관서버점검' },
  { startDate: '2026-03-24', startTime: '09:00', endDate: '2026-03-26', endTime: '18:00', title: '1학기 휴·복학 신청기간' },
  { startDate: '2026-03-24', startTime: '10:00', endDate: '2026-03-26', endTime: '23:59', title: '1학기 재학생 등록금납부' },
  { startDate: '2026-03-24', startTime: '10:00', endDate: '2026-03-26', endTime: '23:59', title: '1학기 재학생 차등납부등록' },
  { startDate: '2026-03-24', startTime: '10:00', endDate: '2026-03-26', endTime: '23:59', title: '1학기 수료후연구생 등록금납부' },
  { startDate: '2026-03-28', startTime: '14:00', endDate: '2026-03-31', endTime: '00:00', title: '1학기 도서관서버점검' },
  { startDate: '2026-03-30', startTime: '09:00', endDate: '2026-04-02', endTime: '17:00', title: '1학기 예비군 훈련 신청기간' },
  { startDate: '2026-03-31', startTime: '09:00', endDate: '2026-04-06', endTime: '18:00', title: '1학기 수강취소' },
  { startDate: '2026-04-06', startTime: '00:00', endDate: '2026-04-06', endTime: '00:00', title: '1학기 수업일수 1/3선' },
  { startDate: '2026-04-20', startTime: '09:00', endDate: '2026-04-25', endTime: '23:59', title: '1학기 중간고사' },
  { startDate: '2026-04-23', startTime: '00:00', endDate: '2026-11-23', endTime: '00:00', title: '1학기 수업일수 1/2선' },
  { startDate: '2026-05-06', startTime: '10:00', endDate: '2026-05-07', endTime: '12:00', title: '여름계절/도약수업 희망과목담기' },
  { startDate: '2026-05-08', startTime: '09:00', endDate: '2026-05-08', endTime: '18:00', title: '여름계절/도약수업 자동신청결과확인' },
  { startDate: '2026-05-12', startTime: '08:00', endDate: '2026-05-14', endTime: '17:00', title: '여름계절/도약수업 재학생 수강신청(학부)' },
  { startDate: '2026-05-12', startTime: '08:00', endDate: '2026-05-14', endTime: '17:00', title: '여름계절/도약수업 재학생 수강신청(대학원)' },
  { startDate: '2026-05-12', startTime: '08:00', endDate: '2026-05-14', endTime: '17:00', title: '여름계절/도약수업 수강신청(타대생)' },
  { startDate: '2026-05-13', startTime: '00:00', endDate: '2026-05-13', endTime: '00:00', title: '1학기 수업일수 2/3선' },
  { startDate: '2026-05-21', startTime: '00:00', endDate: '2026-05-21', endTime: '00:00', title: '여름계절수업 1차 폐강강좌 공고' },
  { startDate: '2026-05-22', startTime: '10:00', endDate: '2026-05-26', endTime: '17:00', title: '여름계절/도약수업 수강정정(학부,타대생)' },
  { startDate: '2026-05-22', startTime: '10:00', endDate: '2026-05-26', endTime: '17:00', title: '여름계절/도약수업 수강정정(대학원)' },
  { startDate: '2026-06-02', startTime: '00:00', endDate: '2026-06-02', endTime: '00:00', title: '여름계절수업 2차 폐강강좌 공고' },
  { startDate: '2026-06-04', startTime: '10:00', endDate: '2026-06-05', endTime: '17:00', title: '여름계절/도약수업 수강정정(학부,타대생)' },
  { startDate: '2026-06-04', startTime: '10:00', endDate: '2026-06-05', endTime: '17:00', title: '여름계절/도약수업 수강정정(대학원)' },
  { startDate: '2026-06-12', startTime: '10:00', endDate: '2026-06-16', endTime: '17:00', title: '여름계절수업 등록금납부' },
  { startDate: '2026-06-12', startTime: '10:00', endDate: '2026-06-16', endTime: '17:00', title: '여름도약수업 등록금납부' },
  { startDate: '2026-06-16', startTime: '09:00', endDate: '2026-06-22', endTime: '23:59', title: '1학기 기말고사' },
  { startDate: '2026-06-23', startTime: '00:00', endDate: '2026-06-23', endTime: '00:00', title: '1학기 여름휴가 시작' },
  { startDate: '2026-06-25', startTime: '00:00', endDate: '2026-07-21', endTime: '23:59', title: '여름계절수업 강의시작종료일' },
  { startDate: '2026-07-22', startTime: '00:00', endDate: '2026-08-18', endTime: '23:59', title: '여름도약수업 강의시작종료일' },
  { startDate: '2026-08-21', startTime: '00:00', endDate: '2026-08-21', endTime: '00:00', title: '1학기 후기 학위수여식' },
];

type FilterTab = '전체' | '진행중' | '예정' | '지난' | '즐겨찾기';
const TABS: FilterTab[] = ['전체', '진행중', '예정', '지난', '즐겨찾기'];

function getEvId(ev: CalendarEvent) { return ev.startDate + '|' + ev.title; }

function getStatus(ev: CalendarEvent, now: Date): '진행중' | '예정' | '지난' {
  const start = new Date(`${ev.startDate}T${ev.startTime === '00:00' ? '00:00:00' : ev.startTime}`);
  const end = new Date(`${ev.endDate}T${ev.endTime === '00:00' ? '23:59:59' : ev.endTime}`);
  if (now < start) return '예정';
  if (now > end) return '지난';
  return '진행중';
}

function formatMonth(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parts[0]}년 ${parseInt(parts[1])}월`;
}

const TAB_ACTIVE_COLORS: Record<FilterTab, string> = {
  '전체': '#374151',
  '진행중': '#22C55E',
  '예정': C.primary,
  '지난': '#9CA3AF',
  '즐겨찾기': '#F59E0B',
};

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  '진행중': { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  '예정': { bg: '#EFF6FF', text: C.primary, border: '#BFDBFE' },
  '지난': { bg: '#F3F4F6', text: '#9CA3AF', border: '#E5E7EB' },
};

export default function AcademicCalendarScreen() {
  const insets = useSafeAreaInsets();
  const topPad = isWeb ? 67 : insets.top;
  const [filter, setFilter] = useState<FilterTab>('전체');
  const [headerShadow, setHeaderShadow] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const now = getNow();

  const scrollRef = useRef<ScrollView>(null);
  const targetRef = useRef<View | null>(null);
  const autoScrolled = useRef(false);
  const scrollViewScreenY = useRef(0);

  // 즐겨찾기 로드
  useEffect(() => {
    AsyncStorage.getItem('pium_calendar_bookmarks').then(val => {
      if (val) {
        try { setBookmarks(new Set(JSON.parse(val))); } catch {}
      }
    });
  }, []);

  // 즐겨찾기 토글
  const toggleBookmark = useCallback((ev: CalendarEvent) => {
    const id = getEvId(ev);
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem('pium_calendar_bookmarks', JSON.stringify([...next]));
      return next;
    });
    setSelectedEvent(null);
  }, []);

  const targetEventId = useMemo(() => {
    if (filter !== '전체') return null;
    const ongoing = EVENTS.find(ev => getStatus(ev, now) === '진행중');
    if (ongoing) return getEvId(ongoing);
    const upcoming = EVENTS.find(ev => getStatus(ev, now) === '예정');
    return upcoming ? getEvId(upcoming) : null;
  }, [filter]);

  useEffect(() => {
    autoScrolled.current = false;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [filter]);

  const handleTargetLayout = useCallback(() => {
    if (autoScrolled.current || !targetRef.current) return;
    setTimeout(() => {
      if (!targetRef.current || autoScrolled.current) return;
      targetRef.current.measureInWindow((_x, y) => {
        const offset = y - scrollViewScreenY.current;
        scrollRef.current?.scrollTo({ y: Math.max(0, offset - 20), animated: true });
        autoScrolled.current = true;
      });
    }, 250);
  }, []);

  const filtered = EVENTS.filter(ev => {
    if (filter === '즐겨찾기') return bookmarks.has(getEvId(ev));
    if (filter === '전체') return true;
    return getStatus(ev, now) === filter;
  });

  const grouped: Record<string, CalendarEvent[]> = {};
  for (const ev of filtered) {
    const key = formatMonth(ev.startDate);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  }

  const countFor = (tab: FilterTab) => {
    if (tab === '즐겨찾기') return bookmarks.size;
    return EVENTS.filter(ev => getStatus(ev, now) === tab).length;
  };

  const selectedIsBookmarked = selectedEvent ? bookmarks.has(getEvId(selectedEvent)) : false;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* Sticky Header */}
      <View style={[styles.stickyHeader, headerShadow && styles.stickyHeaderShadow]}>
        <View style={styles.headerSection}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.universityLabel}>부산대학교</Text>
          <Text style={styles.pageTitle}>학사일정</Text>
          <Text style={styles.pageSubtitle}>2025~2026학년도 1학기</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer} style={styles.tabsScroll}>
          {TABS.map(tab => {
            const isActive = filter === tab;
            const count = tab !== '전체' ? countFor(tab) : null;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, isActive && { backgroundColor: TAB_ACTIVE_COLORS[tab] }]}
                onPress={() => setFilter(tab)}
              >
                {tab === '즐겨찾기' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons
                      name={isActive ? 'star' : 'star-outline'}
                      size={12}
                      color={isActive ? '#fff' : '#9CA3AF'}
                    />
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      즐겨찾기{count ? ` ${count}` : ''}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab}{count !== null ? ` ${count}` : ''}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Scrollable Events */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 60 : 110, paddingTop: 8 }}
        scrollEventThrottle={16}
        onScroll={(e) => setHeaderShadow(e.nativeEvent.contentOffset.y > 2)}
        onLayout={(e) => { scrollViewScreenY.current = e.nativeEvent.layout.y; }}
      >
        <View style={styles.content}>
          {Object.keys(grouped).length === 0 ? (
            <View style={styles.empty}>
              {filter === '즐겨찾기' ? (
                <>
                  <Ionicons name="star-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>즐겨찾기한 일정이 없어요.</Text>
                  <Text style={styles.emptySubText}>일정을 길게 누르면 즐겨찾기에 추가할 수 있어요.</Text>
                </>
              ) : (
                <>
                  <Feather name="calendar" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>해당하는 일정이 없습니다.</Text>
                </>
              )}
            </View>
          ) : (
            Object.entries(grouped).map(([month, events]) => (
              <View key={month} style={styles.monthGroup}>
                <Text style={styles.monthLabel}>{month}</Text>
                <View style={styles.eventList}>
                  {events.map((ev, i) => {
                    const status = getStatus(ev, now);
                    const badge = STATUS_BADGE[status];
                    const isSameDay = ev.startDate === ev.endDate;
                    const isOngoing = status === '진행중';
                    const evId = getEvId(ev);
                    const isTarget = evId === targetEventId;
                    const isBookmarked = bookmarks.has(evId);

                    let pct = 0;
                    if (isOngoing && !isSameDay) {
                      const start = new Date(ev.startDate).getTime();
                      const end = new Date(ev.endDate).getTime();
                      pct = Math.min(100, Math.max(0, ((now.getTime() - start) / (end - start)) * 100));
                    }

                    return (
                      <TouchableOpacity
                        key={i}
                        ref={isTarget ? (r) => { targetRef.current = r as any; } : undefined}
                        onLayout={isTarget ? handleTargetLayout : undefined}
                        style={[
                          styles.eventCard,
                          isOngoing && styles.eventCardOngoing,
                          isBookmarked && styles.eventCardBookmarked,
                        ]}
                        onLongPress={() => setSelectedEvent(ev)}
                        delayLongPress={350}
                        activeOpacity={0.85}
                      >
                        <View style={styles.eventRow}>
                          <View style={styles.eventLeft}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                              {isBookmarked && (
                                <Ionicons name="star" size={13} color="#F59E0B" style={{ marginTop: 2 }} />
                              )}
                              <Text style={[styles.eventTitle, status === '지난' && styles.eventTitlePast, { flex: 1 }]}>
                                {ev.title}
                              </Text>
                            </View>
                            <View style={styles.eventDateRow}>
                              <Feather name="clock" size={11} color="#9CA3AF" />
                              <Text style={styles.eventDateText}>
                                {isSameDay
                                  ? `${ev.startDate.replace(/-/g, '.')}${ev.startTime !== '00:00' ? ' ' + ev.startTime : ''}`
                                  : `${ev.startDate.replace(/-/g, '.')} ${ev.startTime !== '00:00' ? ev.startTime : ''} ~ ${ev.endDate.replace(/-/g, '.')} ${ev.endTime !== '00:00' ? ev.endTime : ''}`
                                }
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                            <Text style={[styles.badgeText, { color: badge.text }]}>{status}</Text>
                          </View>
                        </View>
                        {isOngoing && !isSameDay && (
                          <View style={styles.progressBg}>
                            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── 즐겨찾기 바텀시트 ── */}
      <Modal
        visible={!!selectedEvent}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setSelectedEvent(null)}>
          <Pressable style={styles.sheetContainer} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            {/* 일정 정보 */}
            <View style={styles.sheetEventInfo}>
              <View style={[
                styles.sheetStatusDot,
                { backgroundColor: selectedEvent ? (STATUS_BADGE[getStatus(selectedEvent, now)]?.text ?? '#9CA3AF') : '#9CA3AF' }
              ]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetEventTitle}>{selectedEvent?.title}</Text>
                {selectedEvent && (
                  <Text style={styles.sheetEventDate}>
                    {selectedEvent.startDate.replace(/-/g, '.')}
                    {selectedEvent.startDate !== selectedEvent.endDate
                      ? ` ~ ${selectedEvent.endDate.replace(/-/g, '.')}`
                      : ''}
                  </Text>
                )}
              </View>
            </View>

            {/* 즐겨찾기 토글 버튼 */}
            {selectedEvent && (
              <TouchableOpacity
                style={[styles.sheetActionBtn, selectedIsBookmarked && styles.sheetActionBtnActive]}
                onPress={() => toggleBookmark(selectedEvent)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={selectedIsBookmarked ? 'star' : 'star-outline'}
                  size={20}
                  color={selectedIsBookmarked ? '#fff' : '#374151'}
                />
                <Text style={[styles.sheetActionText, selectedIsBookmarked && styles.sheetActionTextActive]}>
                  {selectedIsBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setSelectedEvent(null)}
            >
              <Text style={styles.sheetCancelText}>닫기</Text>
            </TouchableOpacity>

            <View style={{ height: insets.bottom }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },

  stickyHeader: {
    backgroundColor: '#F9FAFB',
    zIndex: 10,
  },
  stickyHeaderShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },

  backBtn: { width: 36, height: 36, justifyContent: 'center', marginBottom: 4, marginLeft: -4 },
  headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  universityLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  pageTitle: { fontSize: 36, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: -1, lineHeight: 42 },
  pageSubtitle: { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_400Regular', marginTop: 4 },

  tabsScroll: { marginBottom: 20 },
  tabsContainer: { paddingHorizontal: 20, gap: 8, paddingRight: 20 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#F3F4F6' },
  tabText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#6B7280' },
  tabTextActive: { color: '#fff' },

  content: { paddingHorizontal: 20, gap: 28 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  emptySubText: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 20 },

  monthGroup: { gap: 10 },
  monthLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#9CA3AF', letterSpacing: 2, textTransform: 'uppercase', paddingLeft: 2 },
  eventList: { gap: 8 },

  eventCard: {
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  eventCardOngoing: { borderColor: '#BBF7D0', backgroundColor: 'rgba(240,253,244,0.6)' },
  eventCardBookmarked: { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  eventLeft: { flex: 1 },
  eventTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#111827', lineHeight: 18 },
  eventTitlePast: { color: '#9CA3AF' },
  eventDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  eventDateText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', flex: 1 },

  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, flexShrink: 0 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },

  progressBg: { height: 4, backgroundColor: '#DCFCE7', borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#4ADE80', borderRadius: 999 },

  // 바텀시트
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  sheetEventInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20, paddingHorizontal: 2 },
  sheetStatusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  sheetEventTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827', lineHeight: 22, marginBottom: 4 },
  sheetEventDate: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular' },

  sheetActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#F9FAFB', borderRadius: 16, paddingVertical: 16,
    borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 10,
  },
  sheetActionBtnActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  sheetActionText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#374151' },
  sheetActionTextActive: { color: '#fff' },

  sheetCancelBtn: {
    backgroundColor: '#F3F4F6', borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', marginBottom: 8,
  },
  sheetCancelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
});
