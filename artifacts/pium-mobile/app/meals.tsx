import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const isWeb = Platform.OS === 'web';

interface SubMenu {
  name: string;
  price: string;
  items: string[];
  isCheapBreakfast: boolean;
}

interface DayMenu {
  date: string;
  day: string;
  subMenus: SubMenu[];
}

interface MealRow {
  type: string;
  hours: string;
  days: DayMenu[];
}

interface WeekMeals {
  restaurantCode: string;
  restaurantName: string;
  campus: string;
  campusLabel: string;
  weekLabel: string;
  dates: string[];
  days: string[];
  mealRows: MealRow[];
  prevDate: string;
  nextDate: string;
  fetchedAt: string;
}

const CAMPUSES = [
  { id: 'PUSAN', label: '부산' },
  { id: 'MIRYANG', label: '밀양' },
  { id: 'YANGSAN', label: '양산' },
];

const CAMPUS_RESTAURANTS: Record<string, { code: string; name: string }[]> = {
  PUSAN: [
    { code: 'PG002', name: '금정회관\n학생식당' },
    { code: 'PH002', name: '학생회관\n식당' },
    { code: 'PG001', name: '금정회관\n교직원식당' },
  ],
  MIRYANG: [
    { code: 'M001', name: '학생회관\n학생식당' },
    { code: 'M002', name: '학생회관\n교직원식당' },
  ],
  YANGSAN: [
    { code: 'Y001', name: '편의동\n식당' },
  ],
};

const SUBMENU_STYLES: Record<string, { borderColor: string; badgeBg: string; badgeText: string }> = {
  '천원의아침':      { borderColor: '#FBBF24', badgeBg: '#FFFBEB', badgeText: '#B45309' },
  '천원의아침&정식': { borderColor: '#FBBF24', badgeBg: '#FFFBEB', badgeText: '#B45309' },
  '정식':           { borderColor: '#60A5FA', badgeBg: '#EFF6FF', badgeText: '#1D4ED8' },
  '특정식':         { borderColor: '#60A5FA', badgeBg: '#EFF6FF', badgeText: '#1D4ED8' },
  '일품':           { borderColor: '#A78BFA', badgeBg: '#F5F3FF', badgeText: '#6D28D9' },
};

function getSubMenuStyle(name: string) {
  return SUBMENU_STYLES[name] ?? { borderColor: '#D1D5DB', badgeBg: '#F9FAFB', badgeText: '#6B7280' };
}

const MEAL_COLORS: Record<string, string> = {
  '조식': '#F97316',
  '중식': '#3B82F6',
  '석식': '#8B5CF6',
};

// 현재 식사 시간 판별
function getCurrentMealType(): '조식' | '중식' | '석식' | null {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur >= 480 && cur < 660)  return '조식'; // 08:00~11:00
  if (cur >= 660 && cur < 1020) return '중식'; // 11:00~17:00
  if (cur >= 1020 && cur < 1110) return '석식'; // 17:00~18:30
  return null;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function appendSunday(json: WeekMeals): WeekMeals {
  const satIdx = json.days.indexOf('토');
  if (satIdx === -1) return json;
  if (json.days.includes('일')) return json;
  const sunDate = addDays(json.dates[satIdx], 1);
  const newDates = [...json.dates, sunDate];
  const newDays = [...json.days, '일'];
  const newMealRows = json.mealRows.map(row => ({
    ...row,
    days: [...row.days, { date: sunDate, day: '일', subMenus: [] }],
  }));
  return { ...json, dates: newDates, days: newDays, mealRows: newMealRows };
}

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function MealsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = isWeb ? 67 : insets.top;
  const [campus, setCampus] = useState('PUSAN');
  const [restaurant, setRestaurant] = useState('PG002');
  const [queryDate, setQueryDate] = useState(getTodayStr());
  const [data, setData] = useState<WeekMeals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [error, setError] = useState('');

  const activeMealType = getCurrentMealType();
  const today = getTodayStr();
  const effDayIdx = selectedDayIdx ?? 0;
  const isToday = data ? data.dates[effDayIdx] === today : false;

  const fetchMeals = useCallback(async (rest: string, date: string) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/meals?restaurant=${rest}&date=${date}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: WeekMeals = await res.json();
      if ((json as any).error) throw new Error((json as any).error);
      const extJson = appendSunday(json);
      setData(extJson);
      const todayIdx = extJson.dates.findIndex(d => d === today);
      setSelectedDayIdx(todayIdx >= 0 ? todayIdx : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchMeals(restaurant, queryDate); }, [restaurant, queryDate, fetchMeals]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMeals(restaurant, queryDate);
  };

  const handleCampusChange = (campusId: string) => {
    setCampus(campusId);
    const firstRest = CAMPUS_RESTAURANTS[campusId]?.[0]?.code ?? 'PG002';
    setRestaurant(firstRest);
  };

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
            <Text style={styles.pageTitle}>오늘의 식단</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
              <Feather name="refresh-cw" size={16} color={isRefreshing ? C.primary : '#6B7280'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Campus Tabs */}
        <View style={styles.campusTabs}>
          {CAMPUSES.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.campusTab, campus === c.id && styles.campusTabActive]}
              onPress={() => handleCampusChange(c.id)}
            >
              <Text style={[styles.campusTabText, campus === c.id && styles.campusTabTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Restaurant Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.restContainer}
          style={styles.restScroll}
        >
          {(CAMPUS_RESTAURANTS[campus] ?? []).map(r => (
            <TouchableOpacity
              key={r.code}
              style={[styles.restChip, restaurant === r.code && styles.restChipActive]}
              onPress={() => setRestaurant(r.code)}
            >
              <Text style={[styles.restChipText, restaurant === r.code && styles.restChipTextActive]}>
                {r.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Week Navigation */}
        {data && (
          <View style={styles.weekNav}>
            <TouchableOpacity
              style={[styles.navBtn, !data.prevDate && styles.navBtnDisabled]}
              onPress={() => data.prevDate && setQueryDate(data.prevDate)}
              disabled={!data.prevDate}
            >
              <Feather name="chevron-left" size={20} color={data.prevDate ? '#374151' : '#D1D5DB'} />
            </TouchableOpacity>
            <Text style={styles.weekLabel}>{data.weekLabel}</Text>
            <TouchableOpacity
              style={[styles.navBtn, !data.nextDate && styles.navBtnDisabled]}
              onPress={() => data.nextDate && setQueryDate(data.nextDate)}
              disabled={!data.nextDate}
            >
              <Feather name="chevron-right" size={20} color={data.nextDate ? '#374151' : '#D1D5DB'} />
            </TouchableOpacity>
          </View>
        )}

        {/* Day Tabs */}
        {data && data.dates.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayTabsContainer}
            style={styles.dayTabsScroll}
          >
            {data.dates.map((date, idx) => {
              const isTodayDate = date === today;
              const isSelected = idx === effDayIdx;
              return (
                <TouchableOpacity
                  key={date}
                  style={[
                    styles.dayTab,
                    isSelected && styles.dayTabSelected,
                    isTodayDate && !isSelected && styles.dayTabToday,
                  ]}
                  onPress={() => setSelectedDayIdx(idx)}
                >
                  <Text style={[styles.dayTabDay, isSelected && styles.dayTabTextActive, isTodayDate && !isSelected && styles.dayTabTodayText]}>
                    {data.days[idx]}
                  </Text>
                  <Text style={[styles.dayTabDate, isSelected && styles.dayTabTextActive, isTodayDate && !isSelected && styles.dayTabTodayText]}>
                    {date.slice(8)}
                  </Text>
                  {isTodayDate && !isSelected && <View style={styles.dayDot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Scrollable Meal Content ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: isWeb ? 60 : 110 }}>
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.primary} size="large" />
            </View>
          ) : error ? (
            <View style={styles.errorCard}>
              <Feather name="alert-circle" size={40} color="#D1D5DB" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => fetchMeals(restaurant, queryDate)}>
                <Text style={styles.retryText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          ) : !data || data.mealRows.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="coffee" size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>식단 정보가 없습니다.</Text>
            </View>
          ) : (
            <>
              {data.mealRows.map((row, ri) => {
                const dayMenu = row.days[effDayIdx];
                const hasMenus = dayMenu && dayMenu.subMenus.length > 0;
                const accentColor = MEAL_COLORS[row.type] ?? '#6B7280';
                // 오늘 날짜 선택된 경우에만 운영 중 하이라이트
                const isActiveNow = isToday && activeMealType === row.type && hasMenus;

                return (
                  <View
                    key={ri}
                    style={[
                      styles.mealCard,
                      isActiveNow && styles.mealCardActive,
                    ]}
                  >
                    <View style={styles.mealHeader}>
                      <View style={styles.mealTypeRow}>
                        <Text style={[styles.mealType, { color: hasMenus ? accentColor : '#D1D5DB' }]}>
                          {row.type}
                        </Text>
                        {row.hours ? (
                          <Text style={styles.mealHours}>{row.hours}</Text>
                        ) : null}
                        {isActiveNow && (
                          <View style={styles.nowBadge}>
                            <Text style={styles.nowBadgeText}>지금 운영 중</Text>
                          </View>
                        )}
                      </View>
                      {!hasMenus && <Text style={styles.noOperating}>미운영</Text>}
                    </View>

                    {hasMenus ? (
                      <View style={styles.subMenuList}>
                        {dayMenu.subMenus.map((sub, si) => {
                          const style = getSubMenuStyle(sub.name);
                          return (
                            <View key={si} style={[styles.subMenuItem, { borderLeftColor: style.borderColor }]}>
                              <View style={styles.subMenuHeader}>
                                <View style={[styles.subMenuBadge, { backgroundColor: style.badgeBg }]}>
                                  <Text style={[styles.subMenuBadgeText, { color: style.badgeText }]}>
                                    {sub.isCheapBreakfast ? '천원의아침' : sub.name}
                                  </Text>
                                </View>
                                {sub.price ? <Text style={styles.subMenuPrice}>{sub.price}</Text> : null}
                              </View>
                              {/* 메뉴 항목 칩(태그) 형태 */}
                              <View style={styles.chipsRow}>
                                {sub.items.map((item, ii) => (
                                  <View key={ii} style={[styles.menuChip, isActiveNow && styles.menuChipActive]}>
                                    <Text style={styles.menuChipText}>{item}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={{ height: 4 }} />
                    )}
                  </View>
                );
              })}
              {data.restaurantName ? (
                <Text style={styles.footerText}>{data.restaurantName}</Text>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },

  stickyHeader: {
    backgroundColor: '#F9FAFB',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },

  backBtn: { width: 36, height: 36, justifyContent: 'center', marginBottom: 4, marginLeft: -4 },
  headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  universityLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  pageTitle: { fontSize: 36, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: -1 },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },

  campusTabs: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#F3F4F6', borderRadius: 16, padding: 4, marginBottom: 14 },
  campusTab: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
  campusTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  campusTabText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#9CA3AF' },
  campusTabTextActive: { color: C.primary },

  restScroll: { marginBottom: 14 },
  restContainer: { paddingHorizontal: 20, gap: 8 },
  restChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  restChipActive: { backgroundColor: C.primary, borderColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 3 },
  restChipText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#6B7280', textAlign: 'center' },
  restChipTextActive: { color: '#fff' },

  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  navBtnDisabled: { opacity: 0.4 },
  weekLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#111827' },

  dayTabsScroll: { marginBottom: 16 },
  dayTabsContainer: { paddingHorizontal: 20, gap: 8 },
  dayTab: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', minWidth: 48 },
  dayTabSelected: { backgroundColor: C.primary, borderColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 3 },
  dayTabToday: { backgroundColor: '#EFF6FF', borderColor: `${C.primary}33` },
  dayTabDay: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#9CA3AF' },
  dayTabDate: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#111827', marginTop: 2 },
  dayTabTextActive: { color: '#fff' },
  dayTabTodayText: { color: C.primary },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.primary, marginTop: 2 },

  content: { paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  center: { paddingVertical: 60, alignItems: 'center' },
  errorCard: { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  errorText: { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_500Medium', textAlign: 'center' },
  retryBtn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  retryText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  emptyText: { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_500Medium' },

  mealCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  mealCardActive: {
    borderLeftWidth: 4,
    borderLeftColor: C.primary,
    borderColor: `${C.primary}33`,
    backgroundColor: '#EFF6FF',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },

  mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  mealTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
  mealType: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  mealHours: { fontSize: 10, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  noOperating: { fontSize: 11, color: '#D1D5DB', fontFamily: 'Inter_500Medium' },

  nowBadge: {
    backgroundColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nowBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },

  subMenuList: { paddingHorizontal: 18, paddingBottom: 14, gap: 10 },
  subMenuItem: { borderLeftWidth: 2, paddingLeft: 10 },
  subMenuHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  subMenuBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  subMenuBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  subMenuPrice: { fontSize: 11, color: '#6B7280', fontFamily: 'Inter_500Medium' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  menuChip: {
    backgroundColor: '#E8EAED',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  menuChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#374151', lineHeight: 18 },
  menuChipActive: {
    backgroundColor: '#fff',
    borderColor: '#CBD5E1',
  },

  footerText: { textAlign: 'center', fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_500Medium', paddingVertical: 4 },
});
