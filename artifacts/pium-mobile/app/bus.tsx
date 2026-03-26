import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const isWeb = Platform.OS === 'web';
const MIDPOINT = 14;

interface StopInfo {
  idx: number;
  name: string;
  arsno: string;
  nodeId: string;
  isEndPoint: boolean;
}

interface BusOnRoute {
  idx: number;
  stopName: string;
  carNo: string;
  lat: number;
  lng: number;
  lowFloor: boolean;
}

interface RouteData {
  lineId: string;
  lineName: string;
  stops: StopInfo[];
  buses: BusOnRoute[];
  fetchedAt: string;
  outboundCount: number;
  inboundCount: number;
  cached?: boolean;
}

type Direction = 'all' | 'out' | 'in';

function formatTime(d: Date) {
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function BusScreen() {
  const insets = useSafeAreaInsets();
  const topPad = isWeb ? 67 : insets.top;
  const [data, setData] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState<Direction>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoute = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/bus/route`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: RouteData = await res.json();
      if ((json as any).error) throw new Error((json as any).error);
      setData(json);
      setLastUpdated(new Date());
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRoute();
    intervalRef.current = setInterval(() => fetchRoute(true), 10_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchRoute]);

  const outboundStops = data?.stops.filter(s => s.idx <= MIDPOINT) ?? [];
  const inboundStops = data?.stops.filter(s => s.idx > MIDPOINT) ?? [];
  const displayStops =
    direction === 'out' ? outboundStops :
    direction === 'in' ? inboundStops :
    data?.stops ?? [];

  const busAtStop = (idx: number) => (data?.buses ?? []).filter(b => b.idx === idx);
  const approachingStop = (idx: number) => (data?.buses ?? []).filter(b => b.idx === idx - 1);

  const totalBuses = data?.buses.length ?? 0;

  const DIRECTION_TABS = [
    { id: 'all' as Direction, label: '전체 노선' },
    { id: 'out' as Direction, label: `출발 (${data?.outboundCount ?? 0}대)` },
    { id: 'in' as Direction, label: `복귀 (${data?.inboundCount ?? 0}대)` },
  ];

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: isWeb ? 60 : 110 }}>

        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.universityLabel}>부산대학교 교내 순환버스</Text>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.pageTitle}>금정구 7</Text>
              <Text style={styles.pageSubtitle}>부산대역 ↺ 부산대경암체육관</Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchRoute(true)}>
              <Feather name="refresh-cw" size={16} color={isRefreshing ? C.primary : '#6B7280'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Bar */}
        {data && (
          <View style={styles.statusBar}>
            <View style={styles.statusLeft}>
              <View style={styles.statusDotWrapper}>
                <View style={[styles.statusDotPing, { opacity: 0.6 }]} />
                <View style={styles.statusDot} />
              </View>
              <Text style={styles.statusText}>현재 {totalBuses}대 운행중</Text>
            </View>
            {lastUpdated && (
              <View style={styles.statusTime}>
                <Feather name="clock" size={11} color="#9CA3AF" />
                <Text style={styles.statusTimeText}>{formatTime(lastUpdated)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Direction Tabs */}
        <View style={styles.dirTabs}>
          {DIRECTION_TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.dirTab, direction === tab.id && styles.dirTabActive]}
              onPress={() => setDirection(tab.id)}
            >
              <Text style={[styles.dirTabText, direction === tab.id && styles.dirTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Direction label */}
        {data && direction !== 'all' && (
          <View style={styles.dirLabel}>
            <Feather name="navigation" size={11} color="#9CA3AF" />
            <Text style={styles.dirLabelText}>
              {direction === 'out' ? '부산대역 → 부산대경암체육관' : '부산대경암체육관 → 신한은행'}
            </Text>
          </View>
        )}

        {/* Route List */}
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.primary} size="large" />
            </View>
          ) : error ? (
            <View style={styles.errorCard}>
              <Feather name="alert-circle" size={40} color="#D1D5DB" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => fetchRoute()}>
                <Text style={styles.retryText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.routeCard}>
              {direction === 'all' && data && (
                <View style={styles.directionDivider}>
                  <Text style={styles.directionDividerText}>→ 출발 방향</Text>
                </View>
              )}

              {displayStops.map((stop, i) => {
                const buses = busAtStop(stop.idx);
                const approaching = approachingStop(stop.idx);
                const hasBus = buses.length > 0;
                const isApproaching = approaching.length > 0 && !hasBus;
                const isTurnaround = stop.isEndPoint;
                const isLast = i === displayStops.length - 1;
                const isFirstOfInbound = direction === 'all' && stop.idx === MIDPOINT + 1;

                let dotColor = '#D1D5DB';
                let dotBorder = '#CBD5E1';
                if (hasBus) { dotColor = C.primary; dotBorder = C.primary; }
                else if (isApproaching) { dotColor = '#FBBF24'; dotBorder = '#FBBF24'; }
                else if (isTurnaround) { dotColor = '#6B7280'; dotBorder = '#6B7280'; }
                else if (stop.idx === 1) { dotColor = '#9CA3AF'; dotBorder = '#9CA3AF'; }

                let rowBg = 'transparent';
                if (hasBus) rowBg = `${C.primary}0A`;
                else if (isApproaching) rowBg = '#FFFBEB';
                else if (isTurnaround) rowBg = '#F9FAFB';

                return (
                  <View key={stop.idx}>
                    {isFirstOfInbound && (
                      <View style={[styles.directionDivider, { backgroundColor: '#F0FDF4' }]}>
                        <Text style={[styles.directionDividerText, { color: '#16A34A' }]}>← 복귀 방향</Text>
                      </View>
                    )}

                    <View style={[styles.stopRow, { backgroundColor: rowBg }, !isLast && styles.stopRowBorder]}>
                      {/* Route line + dot */}
                      <View style={styles.stopLineCol}>
                        <View style={[
                          styles.stopDot,
                          isTurnaround ? styles.stopDotLarge : null,
                          { backgroundColor: dotColor, borderColor: dotBorder },
                          hasBus && styles.stopDotBus,
                        ]} />
                        {!isLast && (
                          <View style={[styles.stopLine, hasBus && styles.stopLineBus, isTurnaround && styles.stopLineDark]} />
                        )}
                      </View>

                      {/* Stop info */}
                      <View style={styles.stopInfo}>
                        <View style={styles.stopNameRow}>
                          <Text style={[
                            styles.stopName,
                            hasBus && styles.stopNameBus,
                            isTurnaround && styles.stopNameTurnaround,
                            !hasBus && !isTurnaround && styles.stopNameNormal,
                          ]}>
                            {stop.name}
                          </Text>
                          <View style={styles.stopBadges}>
                            {isTurnaround && (
                              <View style={styles.badgeTurnaround}>
                                <Text style={styles.badgeTurnaroundText}>반환점</Text>
                              </View>
                            )}
                            {stop.idx === 1 && (
                              <View style={styles.badgeDeparture}>
                                <Text style={styles.badgeDepartureText}>출발</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.stopIdx}>{stop.idx}</Text>
                        </View>

                        {/* Buses at this stop */}
                        {buses.length > 0 && (
                          <View style={styles.busList}>
                            {buses.map(bus => (
                              <View key={bus.carNo} style={styles.busChip}>
                                <Feather name="navigation" size={10} color="#fff" />
                                <Text style={styles.busChipText}>
                                  {bus.carNo.replace('70아', '')}
                                  {bus.lowFloor ? ' 저상' : ''}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Approaching */}
                        {isApproaching && (
                          <View style={styles.approachingRow}>
                            <Feather name="radio" size={10} color="#D97706" />
                            <Text style={styles.approachingText}>
                              곧 도착 ({approaching.map(b => b.carNo.replace('70아', '')).join(', ')})
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Legend */}
        {data && !isLoading && !error && (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: C.primary }]} />
              <Text style={styles.legendText}>버스 현재 위치</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FBBF24' }]} />
              <Text style={styles.legendText}>다음 정류소 도착 예정</Text>
            </View>
            <View style={styles.legendRight}>
              <Feather name="clock" size={10} color="#9CA3AF" />
              <Text style={styles.legendText}>10초 자동갱신</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },

  headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  universityLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  pageTitle: { fontSize: 36, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: -1, lineHeight: 42 },
  pageSubtitle: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_500Medium', marginTop: 2 },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },

  statusBar: { marginHorizontal: 20, marginBottom: 14, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDotWrapper: { width: 8, height: 8, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  statusDotPing: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ADE80' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  statusText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#111827' },
  statusTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusTimeText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_500Medium' },

  dirTabs: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#F3F4F6', borderRadius: 16, padding: 4, marginBottom: 12, gap: 2 },
  dirTab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  dirTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  dirTabText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#9CA3AF' },
  dirTabTextActive: { color: C.primary },

  dirLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 10 },
  dirLabelText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },

  content: { paddingHorizontal: 20 },
  center: { paddingVertical: 60, alignItems: 'center' },
  errorCard: { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  errorText: { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_500Medium', textAlign: 'center' },
  retryBtn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  retryText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },

  routeCard: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 1 },

  directionDivider: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F8FAFF' },
  directionDividerText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: `${C.primary}99`, textTransform: 'uppercase', letterSpacing: 1 },

  stopRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10 },
  stopRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },

  stopLineCol: { width: 24, alignItems: 'center', paddingTop: 2, marginRight: 10, flexShrink: 0 },
  stopDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, zIndex: 1 },
  stopDotLarge: { width: 14, height: 14, borderRadius: 7 },
  stopDotBus: { shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  stopLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginTop: 2, minHeight: 14 },
  stopLineBus: { backgroundColor: `${C.primary}44` },
  stopLineDark: { backgroundColor: '#9CA3AF' },

  stopInfo: { flex: 1, paddingBottom: 2 },
  stopNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stopName: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  stopNameBus: { color: C.primary, fontFamily: 'Inter_700Bold' },
  stopNameTurnaround: { color: '#111827', fontFamily: 'Inter_700Bold' },
  stopNameNormal: { color: '#374151' },
  stopBadges: { flexDirection: 'row', gap: 4 },
  badgeTurnaround: { backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTurnaroundText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#6B7280' },
  badgeDeparture: { backgroundColor: '#EEF4FF', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  badgeDepartureText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: C.primary },
  stopIdx: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#D1D5DB', minWidth: 16, textAlign: 'right' },

  busList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  busChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  busChipText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },

  approachingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  approachingText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#D97706' },

  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, paddingTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, color: '#9CA3AF', fontFamily: 'Inter_500Medium' },
  legendRight: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
});
