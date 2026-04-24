import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const INFO_ITEMS = [
  { icon: 'lock', label: '데이터 암호화', desc: '모든 데이터는 암호화되어 저장됩니다' },
  { icon: 'eye-off', label: '제3자 공유 없음', desc: '개인정보는 제3자와 공유되지 않습니다' },
  { icon: 'shield', label: 'HTTPS 통신', desc: '모든 통신은 보안 연결로 이루어집니다' },
  { icon: 'server', label: '자체 서버 저장', desc: '외부 클라우드 없이 자체 서버에만 저장됩니다' },
];

export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const { token, logout } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const handleWithdraw = async () => {
    if (!token) return;
    setWithdrawing(true);
    try {
      const r = await fetch(`${API}/auth/withdraw`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setShowModal(false);
        await AsyncStorage.clear();
        await logout();
        router.replace('/login');
      } else {
        const body = await r.json().catch(() => ({}));
        Alert.alert('오류', body.message || '탈퇴 처리 중 오류가 발생했습니다.');
      }
    } catch {
      Alert.alert('오류', '네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>개인정보 보호</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 보안 정책 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>보안 정책</Text>
          <View style={styles.sectionCard}>
            {INFO_ITEMS.map((item, idx) => (
              <View key={item.label} style={[styles.infoRow, idx < INFO_ITEMS.length - 1 && styles.rowBorder]}>
                <View style={styles.infoIcon}>
                  <Feather name={item.icon as any} size={18} color={C.primary} />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemDesc}>{item.desc}</Text>
                </View>
                <Feather name="check" size={16} color="#059669" />
              </View>
            ))}
          </View>
        </View>

        {/* 학생증 이미지 안내 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>학생증 이미지 처리</Text>
          <View style={[styles.sectionCard, styles.noticeCard]}>
            <View style={styles.noticeRow}>
              <Feather name="check-circle" size={18} color="#059669" style={{ marginTop: 1 }} />
              <Text style={styles.noticeText}>
                학생증 이미지는 재학생 인증 즉시 처리되며, 원본 이미지는 서버에 저장되지 않습니다. 인증 완료 여부만 기록됩니다.
              </Text>
            </View>
          </View>
        </View>

        {/* 회원 탈퇴 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정 관리</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.withdrawRow}
              onPress={() => setShowModal(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.infoIcon, { backgroundColor: '#FEF2F2' }]}>
                <Feather name="user-x" size={18} color="#EF4444" />
              </View>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemLabel, { color: '#EF4444' }]}>회원 탈퇴</Text>
                <Text style={styles.itemDesc}>계정 및 모든 데이터를 영구 삭제합니다</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* 탈퇴 확인 모달 */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Feather name="alert-triangle" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>정말 탈퇴하시겠습니까?</Text>
            <Text style={styles.modalDesc}>
              탈퇴하면 아래의 모든 데이터가{'\n'}
              <Text style={{ fontFamily: 'Inter_700Bold' }}>즉시 영구 삭제</Text>되며 복구할 수 없습니다.
            </Text>
            <View style={styles.deleteList}>
              {['계정 정보 (아이디·이름·학번)', '게시글 및 댓글', '시간표·성적·할 일 목록', '알림 설정 및 기타 모든 데이터'].map(item => (
                <View key={item} style={styles.deleteItem}>
                  <Feather name="x-circle" size={13} color="#EF4444" />
                  <Text style={styles.deleteItemText}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
                disabled={withdrawing}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.withdrawBtn, withdrawing && { opacity: 0.6 }]}
                onPress={handleWithdraw}
                disabled={withdrawing}
              >
                {withdrawing
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.withdrawBtnText}>탈퇴하기</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  itemDesc: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },
  noticeCard: { backgroundColor: '#F0FDF4' },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  noticeText: { flex: 1, fontSize: 13, color: '#065F46', fontFamily: 'Inter_400Regular', lineHeight: 20 },
  withdrawRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 380 },
  modalIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center', marginBottom: 10 },
  modalDesc: { fontSize: 14, color: '#6B7280', fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  deleteList: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, gap: 8, marginBottom: 20 },
  deleteItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteItemText: { fontSize: 13, color: '#7F1D1D', fontFamily: 'Inter_400Regular' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  withdrawBtn: { flex: 1, backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  withdrawBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
