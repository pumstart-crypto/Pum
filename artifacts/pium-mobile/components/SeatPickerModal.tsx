import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getSeatRoomSeats, reserveSeat, IndividualSeat } from '@/utils/seatManagement';
import C from '@/constants/colors';

interface SeatRoom {
  id: number;
  name: string;
  branch?: string;
}

interface Props {
  visible: boolean;
  room: SeatRoom | null;
  onDismiss: () => void;
  onReserved: (message: string) => void;
  onSessionExpired: () => void;
}

type SeatStatus = 'EMPTY' | 'USING' | 'AWAY' | 'FIXED' | 'MINE' | string;

const STATUS_CFG: Record<string, { bg: string; border: string; text: string; label: string }> = {
  EMPTY:   { bg: '#D1FAE5', border: '#10B981', text: '#065F46', label: '가능' },
  USING:   { bg: '#F3F4F6', border: '#D1D5DB', text: '#9CA3AF', label: '사용중' },
  FIXED:   { bg: '#F3F4F6', border: '#D1D5DB', text: '#9CA3AF', label: '고정' },
  AWAY:    { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', label: '자리비움' },
  MINE:    { bg: `${C.primary}18`, border: C.primary, text: C.primary, label: '내자리' },
  DEFAULT: { bg: '#F3F4F6', border: '#E5E7EB', text: '#9CA3AF', label: '불가' },
};

function getSeatCfg(seat: IndividualSeat) {
  if (seat.isMine) return STATUS_CFG.MINE;
  const code = (seat.status?.code ?? '').toUpperCase();
  return STATUS_CFG[code] ?? STATUS_CFG.DEFAULT;
}

function isReservable(seat: IndividualSeat): boolean {
  if (seat.isMine) return false;
  const code = (seat.status?.code ?? '').toUpperCase();
  return code === 'EMPTY';
}

export default function SeatPickerModal({ visible, room, onDismiss, onReserved, onSessionExpired }: Props) {
  const [seats, setSeats] = useState<IndividualSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState('');

  const fetchSeats = useCallback(async () => {
    if (!room) return;
    setLoading(true);
    setFetchError('');
    const result = await getSeatRoomSeats(room.id);
    setLoading(false);
    if (result.needsLogin) { onSessionExpired(); return; }
    if (!result.success) { setFetchError(result.message); return; }
    setSeats(result.data ?? []);
  }, [room, onSessionExpired]);

  useEffect(() => {
    if (visible && room) { setSeats([]); fetchSeats(); }
  }, [visible, room, fetchSeats]);

  const handleReserve = async (seat: IndividualSeat) => {
    if (!isReservable(seat) || reserving !== null) return;
    setReserving(seat.id);
    const result = await reserveSeat(seat.id);
    setReserving(null);
    if (result.needsLogin) { onDismiss(); onSessionExpired(); return; }
    if (result.success) {
      onReserved(result.message);
      onDismiss();
    } else {
      setFetchError(result.message);
    }
  };

  const available = seats.filter(s => isReservable(s)).length;
  const mine = seats.find(s => s.isMine);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title} numberOfLines={1}>{room?.name ?? '열람실'}</Text>
              {room?.branch ? <Text style={styles.branch}>{room.branch}</Text> : null}
            </View>
            <TouchableOpacity onPress={onDismiss} hitSlop={12}>
              <Feather name="x" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* My seat banner */}
          {mine && (
            <View style={styles.mineBanner}>
              <Feather name="check-circle" size={14} color={C.primary} />
              <Text style={styles.mineBannerText}>
                현재 <Text style={{ fontWeight: '700' }}>{mine.name}</Text> 좌석을 이용 중입니다.
              </Text>
            </View>
          )}

          {/* Legend */}
          {!loading && seats.length > 0 && (
            <View style={styles.legend}>
              {[
                { code: 'EMPTY', label: `이용가능 (${available})` },
                { code: 'USING', label: '사용중' },
                { code: 'AWAY',  label: '자리비움' },
                ...(mine ? [{ code: 'MINE', label: '내자리' }] : []),
              ].map(({ code, label }) => {
                const cfg = STATUS_CFG[code];
                return (
                  <View key={code} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: cfg.bg, borderColor: cfg.border }]} />
                    <Text style={styles.legendText}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Content */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.loadingText}>좌석 정보를 불러오는 중...</Text>
            </View>
          ) : fetchError ? (
            <View style={styles.center}>
              <Feather name="alert-circle" size={32} color="#D1D5DB" />
              <Text style={styles.errorText}>{fetchError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchSeats}>
                <Text style={styles.retryText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          ) : seats.length === 0 ? (
            <View style={styles.center}>
              <Feather name="inbox" size={32} color="#D1D5DB" />
              <Text style={styles.errorText}>좌석 정보가 없습니다.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
              {seats.map(seat => {
                const cfg = getSeatCfg(seat);
                const reservable = isReservable(seat);
                const isLoading = reserving === seat.id;
                return (
                  <TouchableOpacity
                    key={seat.id}
                    style={[
                      styles.seatCell,
                      { backgroundColor: cfg.bg, borderColor: cfg.border },
                      !reservable && !seat.isMine && styles.seatCellDisabled,
                    ]}
                    onPress={() => handleReserve(seat)}
                    disabled={!reservable || reserving !== null}
                    activeOpacity={0.75}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={cfg.border} />
                    ) : (
                      <>
                        <Text style={[styles.seatCode, { color: cfg.text }]} numberOfLines={1}>
                          {seat.code || seat.name}
                        </Text>
                        <Text style={[styles.seatLabel, { color: cfg.text }]}>{cfg.label}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CELL = 72;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingBottom: 36,
    maxHeight: '90%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 10, marginBottom: 14,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', fontFamily: 'Inter_700Bold', maxWidth: 260 },
  branch: { fontSize: 12, color: '#9CA3AF', marginTop: 2, fontFamily: 'Inter_400Regular' },

  mineBanner: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    backgroundColor: `${C.primary}10`, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12,
  },
  mineBannerText: { fontSize: 13, color: C.primary, fontFamily: 'Inter_400Regular' },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14, paddingHorizontal: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 3, borderWidth: 1.5 },
  legendText: { fontSize: 11, color: '#6B7280', fontFamily: 'Inter_400Regular' },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  loadingText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  errorText: { fontSize: 14, color: '#6B7280', textAlign: 'center', fontFamily: 'Inter_400Regular' },
  retryBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingVertical: 4, paddingHorizontal: 2, paddingBottom: 16,
  },
  seatCell: {
    width: CELL, height: CELL, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  seatCellDisabled: { opacity: 0.55 },
  seatCode: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', textAlign: 'center' },
  seatLabel: { fontSize: 9, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
