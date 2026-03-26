import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Linking, Platform, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const BUILDINGS = [
  { id: 1, name: '본관', nameEn: 'Main Building', code: '본관', category: '행정', desc: '총장실, 기획처, 행정처', floor: '4층' },
  { id: 2, name: '제1공학관', nameEn: 'Engineering Hall 1', code: '1공', category: '강의', desc: '공과대학 강의실 및 실험실', floor: '8층' },
  { id: 3, name: '제2공학관', nameEn: 'Engineering Hall 2', code: '2공', category: '강의', desc: '기계공학, 항공우주공학', floor: '7층' },
  { id: 4, name: 'IT대학', nameEn: 'College of IT', code: 'IT', category: '강의', desc: '컴퓨터공학, 정보컴퓨터공학', floor: '7층' },
  { id: 5, name: '자연과학관', nameEn: 'Science Hall', code: '자과', category: '강의', desc: '수학, 물리, 화학, 생물학과', floor: '6층' },
  { id: 6, name: '인문관', nameEn: 'Humanities Hall', code: '인문', category: '강의', desc: '국어국문, 영어영문학과', floor: '5층' },
  { id: 7, name: '학생회관', nameEn: 'Student Union', code: '학생', category: '학생지원', desc: '학생처, 동아리실, 편의점', floor: '4층' },
  { id: 8, name: '도서관', nameEn: 'Library', code: '도서관', category: '학생지원', desc: '열람실, 자료실, 스터디룸', floor: '6층' },
  { id: 9, name: '대운동장', nameEn: 'Main Stadium', code: '운동장', category: '체육', desc: '육상트랙, 잔디구장', floor: '-' },
  { id: 10, name: '금정문화관', nameEn: 'Geumjeong Culture Hall', code: '금문', category: '문화', desc: '대강당, 소공연장', floor: '4층' },
  { id: 11, name: '효원회관', nameEn: 'Hyowon Hall', code: '효원', category: '식당', desc: '학생식당, 카페테리아', floor: '4층' },
  { id: 12, name: 'PNU 게스트하우스', nameEn: 'Guest House', code: '게하', category: '숙박', desc: '방문자 및 학생 숙박 시설', floor: '7층' },
];

const CATEGORIES = ['전체', '강의', '행정', '학생지원', '식당', '체육', '문화', '숙박'];
const CAT_COLORS: Record<string, string> = {
  강의: '#3B82F6', 행정: '#6B7280', 학생지원: '#8B5CF6', 식당: '#F59E0B',
  체육: '#10B981', 문화: '#EC4899', 숙박: '#0891B2',
};

export default function CampusMapScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');

  const filtered = BUILDINGS.filter(b =>
    (category === '전체' || b.category === category) &&
    (!search || b.name.includes(search) || b.nameEn.toLowerCase().includes(search.toLowerCase()) || b.desc.includes(search))
  );

  const openNaverMap = (name: string) => {
    Linking.openURL(`nmap://place?lat=35.2330&lng=129.0865&name=${encodeURIComponent(`부산대학교 ${name}`)}&appname=pium`);
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>캠퍼스 지도</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://www.pusan.ac.kr/kor/CMS/CampusMap/CampusMap.do')} style={styles.mapBtn}>
          <Feather name="map" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="건물 검색"
          placeholderTextColor="#9CA3AF"
        />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={16} color="#9CA3AF" /></TouchableOpacity>}
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity key={cat} style={[styles.filterChip, category === cat && styles.filterChipActive]} onPress={() => setCategory(cat)}>
            <Text style={[styles.filterText, category === cat && styles.filterTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map link banner */}
      <TouchableOpacity style={styles.mapBanner} onPress={() => Linking.openURL('https://www.pusan.ac.kr/kor/CMS/CampusMap/CampusMap.do')}>
        <View style={styles.mapBannerLeft}>
          <Feather name="map-pin" size={20} color={C.primary} />
          <View>
            <Text style={styles.mapBannerTitle}>캠퍼스 전체 지도 보기</Text>
            <Text style={styles.mapBannerSub}>부산대학교 공식 캠퍼스 지도</Text>
          </View>
        </View>
        <Feather name="external-link" size={16} color="#9CA3AF" />
      </TouchableOpacity>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 50 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.resultCount}>건물 {filtered.length}개</Text>
        {filtered.map(b => {
          const catColor = CAT_COLORS[b.category] || '#6B7280';
          return (
            <View key={b.id} style={styles.buildingCard}>
              <View style={[styles.buildingCode, { backgroundColor: catColor + '18' }]}>
                <Text style={[styles.buildingCodeText, { color: catColor }]}>{b.code}</Text>
              </View>
              <View style={styles.buildingInfo}>
                <Text style={styles.buildingName}>{b.name}</Text>
                <Text style={styles.buildingNameEn}>{b.nameEn}</Text>
                <Text style={styles.buildingDesc} numberOfLines={1}>{b.desc}</Text>
                <View style={styles.buildingMeta}>
                  <View style={[styles.catBadge, { backgroundColor: catColor + '18' }]}>
                    <Text style={[styles.catText, { color: catColor }]}>{b.category}</Text>
                  </View>
                  <Text style={styles.floorText}>{b.floor}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => openNaverMap(b.name)} style={styles.navBtn}>
                <Feather name="navigation" size={18} color={C.primary} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' },
  mapBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', fontFamily: 'Inter_400Regular' },
  filterScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterContainer: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  filterChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  filterText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  filterTextActive: { color: C.primary },
  mapBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EEF4FF', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: `${C.primary}20` },
  mapBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mapBannerTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#111827' },
  mapBannerSub: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  resultCount: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginBottom: 8 },
  buildingCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  buildingCode: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  buildingCodeText: { fontSize: 12, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  buildingInfo: { flex: 1 },
  buildingName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#111827' },
  buildingNameEn: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 1 },
  buildingDesc: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular', marginTop: 4 },
  buildingMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  catBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  catText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  floorText: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
});
