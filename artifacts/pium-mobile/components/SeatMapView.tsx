/**
 * SeatMapView.tsx
 *
 * Pyxis API의 x/y 좌표 데이터를 사용해 실제 열람실 좌석 배치도를
 * 핀치 줌 + 팬 제스처로 탐색 가능하게 렌더링하는 컴포넌트.
 */

import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { IndividualSeat } from '@/utils/seatManagement';
import C from '@/constants/colors';

const { width: SCREEN_W } = Dimensions.get('window');

const CELL = 34;
const GAP  = 4;
const STEP = CELL + GAP;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

const STATUS_CFG: Record<string, { bg: string; border: string; text: string }> = {
  EMPTY:   { bg: '#DBEAFE', border: '#3B82F6', text: '#1D4ED8' },
  USING:   { bg: '#F3F4F6', border: '#D1D5DB', text: '#9CA3AF' },
  FIXED:   { bg: '#E5E7EB', border: '#D1D5DB', text: '#9CA3AF' },
  AWAY:    { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  MINE:    { bg: `${C.primary}20`, border: C.primary, text: C.primary },
  DEFAULT: { bg: '#E5E7EB', border: '#D1D5DB', text: '#9CA3AF' },
};

function cfg(seat: IndividualSeat) {
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
  // ── 그리드 범위 계산 ──────────────────────────────────────
  const { seatsWithPos, minX, minY, mapW, mapH } = useMemo(() => {
    const withPos = seats.filter(s => s.x !== undefined && s.y !== undefined);
    if (withPos.length === 0) return { seatsWithPos: [], minX: 0, minY: 0, mapW: 0, mapH: 0 };
    const xs = withPos.map(s => s.x!);
    const ys = withPos.map(s => s.y!);
    const mX = Math.min(...xs);
    const mY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return {
      seatsWithPos: withPos,
      minX: mX,
      minY: mY,
      mapW: (maxX - mX + 1) * STEP + GAP,
      mapH: (maxY - mY + 1) * STEP + GAP,
    };
  }, [seats]);

  // ── 초기 스케일: 화면 너비에 맞게 ───────────────────────
  const initScale = useMemo(() => {
    if (mapW === 0) return 1;
    const s = (SCREEN_W - 32) / mapW;
    return Math.min(Math.max(s, MIN_SCALE), 1);
  }, [mapW]);

  // ── 제스처 상태 ───────────────────────────────────────────
  const scale      = useSharedValue(initScale);
  const savedScale = useSharedValue(initScale);
  const tx         = useSharedValue(0);
  const ty         = useSharedValue(0);
  const savedTx    = useSharedValue(0);
  const savedTy    = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      const next = savedScale.value * e.scale;
      scale.value = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .minDistance(2)
    .onUpdate(e => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  // ── 좌석 없음 / 좌표 없음 처리 ───────────────────────────
  if (seatsWithPos.length === 0) {
    return (
      <View style={[styles.fallback, { height: containerHeight }]}>
        <Text style={styles.fallbackText}>좌석 배치도 데이터가 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvas, animStyle, { width: mapW, height: mapH }]}>
          {seatsWithPos.map(seat => {
            const c = cfg(seat);
            const reservable = isReservable(seat);
            const isLoading = reserving === seat.id;
            const left = (seat.x! - minX) * STEP + GAP;
            const top  = (seat.y! - minY) * STEP + GAP;
            return (
              <TouchableOpacity
                key={seat.id}
                style={[
                  styles.cell,
                  { left, top, backgroundColor: c.bg, borderColor: c.border },
                  !reservable && !seat.isMine && styles.cellDisabled,
                  seat.isMine && styles.cellMine,
                ]}
                onPress={() => reservable && !isLoading && onReserve(seat)}
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
        </Animated.View>
      </GestureDetector>

      {/* 힌트 */}
      <View style={styles.hint}>
        <Text style={styles.hintText}>두 손가락으로 확대/축소 · 드래그로 이동</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  canvas: {
    position: 'absolute',
  },
  cell: {
    position: 'absolute',
    width: CELL,
    height: CELL,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDisabled: { opacity: 0.45 },
  cellMine: { borderWidth: 2 },
  cellText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.45)',
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
