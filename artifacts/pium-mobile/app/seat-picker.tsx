import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import C from '@/constants/colors';

export default function SeatPickerScreen() {
  const insets = useSafeAreaInsets();
  const { roomName, branchName } = useLocalSearchParams<{ roomName: string; branchName: string }>();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{roomName ?? '열람실'}</Text>
          {branchName ? <Text style={styles.headerSub}>{branchName}</Text> : null}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="construct-outline" size={52} color={`${C.primary}70`} />
        </View>

        <Text style={styles.title}>자리 선택 준비 중</Text>
        <Text style={styles.desc}>
          도서관 좌석 예약 기능을{'\n'}준비하고 있습니다.{'\n'}조금만 기다려 주세요.
        </Text>

        <View style={styles.infoCard}>
          <Feather name="info" size={14} color="#6B7280" />
          <Text style={styles.infoText}>
            현재 캠퍼스 외부에서 도서관 서버{'\n'}접근 권한을 요청 중입니다.
          </Text>
        </View>

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
          <Feather name="arrow-left" size={15} color={C.primary} />
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: insets.bottom + 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flex: 1, alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16, fontWeight: '700', color: '#111827',
    fontFamily: 'Inter_700Bold',
  },
  headerSub: {
    fontSize: 11, color: '#9CA3AF',
    fontFamily: 'Inter_400Regular', marginTop: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 0,
  },
  iconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: `${C.primary}0D`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: '#111827',
    fontFamily: 'Inter_700Bold', marginBottom: 12, textAlign: 'center',
  },
  desc: {
    fontSize: 15, color: '#6B7280', textAlign: 'center',
    fontFamily: 'Inter_400Regular', lineHeight: 24, marginBottom: 28,
  },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    marginBottom: 32, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  infoText: {
    flex: 1, fontSize: 13, color: '#6B7280',
    fontFamily: 'Inter_400Regular', lineHeight: 20,
  },
  backButton: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1.5, borderColor: C.primary,
    borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 14, fontWeight: '600', color: C.primary,
    fontFamily: 'Inter_600SemiBold',
  },
});
