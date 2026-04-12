/**
 * SeatMapView.tsx
 *
 * Pyxis x/y 좌표로 좌석 배치도를 그리드로 렌더링합니다.
 * Expo Go에서 안정적으로 동작하도록 ScrollView 기반으로 구현합니다.
 * GestureDetector / Reanimated 없이 순수 RN ScrollView + TouchableOpacity 사용.
 */

import React, { useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { IndividualSeat } from '@/utils/seatManagement';
import C from '@/constants/colors';

const CELL = 38;
const GAP  = 5;

const STATUS_CFG: Record<string, { bg: string; border: string; text: string }> = {
  EMPTY:   { bg: '#DBEAFE', border: '#3B82F6', text: '#1D4ED8' },
  USING:   { bg: '#F3F4F6', border: '#D1D5DB', text: '#9CA3AF' },
  FIXED:   { bg: '#E5E7EB', border: '#D1D5DB', text: '#9CA3AF' },
  AWAY:    { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  MINE:    { bg: `${C.primary}22`, border: C.primary, text: C.primary },
  DEFAULT: { bg: '#E5E7EB', border: '#D1D5DB', text: '#9CA3AF' },
};

function seatCfg(seat: IndividualSeat) {
  if (seat.isMine) return STATUS_CFG.MINE;
  const code = (seat.status?.code ?? '').toUpperCase();
  return STATUS_CFG[code] ?? STATUS_CFG.DEFAULT;
}

function isReservable(seat: IndividualSeat) {
  if (seat.isMine) return false;
  return (seat.status?.code ?? '').toUpperCase() === 'EMPTY';
}

interface Props {
  seats: IndividualSeat[];
  reserving: number | null;
  onReserve: (seat: IndividualSeat) => void;
  containerHeight: number;
}

export default function SeatMapView({ seats, reserving, onReserve, containerHeight }: Props) {
  const hScrollRef = useRef<ScrollView>(null);

  // ── 좌표 있는 좌석만 추출 ─────────────────────────────────
  const seatsWithPos = useMemo(
    () => seats.filter(s => s.x !== undefined && s.y !== undefined),
    [seats],
  );

  // ── 그리드 빌드 ───────────────────────────────────────────
  // grid[row][col] = IndividualSeat | null (null = 빈 공간)
  const { grid, rows, cols, minX, minY } = useMemo(() => {
    if (seatsWithPos.length === 0) {
      return { grid: [], rows: 0, cols: 0, minX: 0, minY: 0 };
    }
    const xs = seatsWithPos.map(s => s.x!);
    const ys = seatsWithPos.map(s => s.y!);
    const mX = Math.min(...xs);
    const mY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const numCols = maxX - mX + 1;
    const numRows = maxY - mY + 1;

    // 2D 배열 초기화
    const g: (IndividualSeat | null)[][] = Array.from(
      { length: numRows },
      () => Array(numCols).fill(null),
    );
    for (const seat of seatsWithPos) {
      g[seat.y! - mY][seat.x! - mX] = seat;
    }
    return { grid: g, rows: numRows, cols: numCols, minX: mX, minY: mY };
  }, [seatsWithPos]);

  if (seatsWithPos.length === 0) {
    return (
      <View style={[styles.fallback, { height: containerHeight }]}>
        <Text style={styles.fallbackText}>좌석 배치도 데이터가 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { height: containerHeight }]}>
      {/* 가로 스크롤 (외부) */}
      <ScrollView
        ref={hScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8 }}
      >
        {/* 세로 스크롤 (내부) */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled
        >
          <View style={styles.gridContainer}>
            {grid.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.row}>
                {row.map((seat, colIdx) => {
                  if (!seat) {
                    // 빈 공간 — 자리 없음 표시
                    return <View key={colIdx} style={styles.emptySpacer} />;
                  }
                  const c = seatCfg(seat);
                  const reservable = isReservable(seat);
                  const isLoading = reserving === seat.id;

                  return (
                    <TouchableOpacity
                      key={seat.id}
                      style={[
                        styles.cell,
                        { backgroundColor: c.bg, borderColor: c.border },
                        !reservable && !seat.isMine && styles.cellDisabled,
                        seat.isMine && styles.cellMine,
                      ]}
                      onPress={() => {
                        if (reservable && reserving === null) onReserve(seat);
                      }}
                      disabled={!reservable || reserving !== null}
                      activeOpacity={0.7}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color={c.border} />
                      ) : (
                        <Text style={[styles.cellText, { color: c.text }]} numberOfLines={1}>
                          {seat.code || seat.name}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {/* 조작 힌트 */}
      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText}>↔ 좌우로 스크롤 · 위아래로 스크롤</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  gridContainer: {
    flexDirection: 'column',
    gap: GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDisabled: { opacity: 0.38 },
  cellMine: { borderWidth: 2.5 },
  cellText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  emptySpacer: {
    width: CELL,
    height: CELL,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fallbackText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: 'Inter_400Regular',
  },
  hint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  hintText: {
    fontSize: 10,
    color: '#fff',
    fontFamily: 'Inter_400Regular',
  },
});
