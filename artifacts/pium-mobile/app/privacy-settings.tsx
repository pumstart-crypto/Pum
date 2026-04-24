import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const INFO_ITEMS = [
  { icon: 'lock', label: '데이터 암호화', desc: '모든 데이터는 암호화되어 저장됩니다' },
  { icon: 'eye-off', label: '제3자 공유 없음', desc: '개인정보는 제3자와 공유되지 않습니다' },
  { icon: 'shield', label: 'HTTPS 통신', desc: '모든 통신은 보안 연결로 이루어집니다' },
];

export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;

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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  itemDesc: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },
});
