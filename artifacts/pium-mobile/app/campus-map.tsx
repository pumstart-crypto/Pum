import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const isWeb = Platform.OS === 'web';

interface Building {
  code: string;
  name: string;
  alias?: string;
  group: number;
}

interface GroupInfo {
  id: number;
  label: string;
  bg: string;
  text: string;
}

interface CampusInfo {
  id: string;
  label: string;
  buildings: Building[];
  groups: GroupInfo[];
}

const PUSAN_BUILDINGS: Building[] = [
  { code: '101', name: 'MEMS/NANO 클린룸동', group: 1 },
  { code: '102', name: 'IT관', group: 1 },
  { code: '103', name: '제12공학관', group: 1 },
  { code: '105', name: '제3공학관', alias: '융합기계관', group: 1 },
  { code: '106', name: '효원문화회관', group: 1 },
  { code: '107', name: '제8공학관', alias: '항공관', group: 1 },
  { code: '108', name: '제9공학관', alias: '기전관', group: 1 },
  { code: '109', name: '공과대학 공동실험관', group: 1 },
  { code: '110', name: '에너지분야실험실', group: 1 },
  { code: '111', name: '실험폐기물처리장', group: 1 },
  { code: 'K08', name: '공과대학 제2별관', group: 1 },
  { code: '201', name: '제6공학관', alias: '컴퓨터공학관 컴공관', group: 2 },
  { code: '202', name: '운죽정', group: 2 },
  { code: '203', name: '넉넉한터', alias: '학생회관', group: 2 },
  { code: '204', name: '넉넉한터 지하주차장', group: 2 },
  { code: '205', name: '대학본부', alias: '본관', group: 2 },
  { code: '206', name: '제11공학관', alias: '조선해양공학관', group: 2 },
  { code: '207', name: '제10공학관', alias: '특성화공학관', group: 2 },
  { code: '208', name: '기계기술연구동', group: 2 },
  { code: '301', name: '구조실험동', group: 3 },
  { code: '303', name: '기계관', group: 3 },
  { code: '306', name: '인문관', group: 3 },
  { code: '307', name: '인문대 교수연구동', group: 3 },
  { code: '308', name: '제1물리관', group: 3 },
  { code: '309', name: '제2물리관', group: 3 },
  { code: '311', name: '공동연구기기동', group: 3 },
  { code: '312', name: '공동실험실습관', group: 3 },
  { code: '313', name: '자연대 연구실험동', group: 3 },
  { code: '314', name: '정보화교육관', alias: '전산실', group: 3 },
  { code: '315', name: '자유관 A동', alias: '기숙사', group: 3 },
  { code: '316', name: '자유관 B동', alias: '기숙사', group: 3 },
  { code: '318', name: '자유주차장', group: 3 },
  { code: '401', name: '건설관', group: 4 },
  { code: '402', name: '정학관', group: 4 },
  { code: '405', name: '제2공학관', alias: '재료관', group: 4 },
  { code: '408', name: '제5공학관', alias: '유기소재관', group: 4 },
  { code: '409', name: '교수회관', group: 4 },
  { code: '416', name: '생물관', group: 4 },
  { code: '417', name: '제1사범관', group: 4 },
  { code: '418', name: '제2교수연구동', group: 4 },
  { code: '419', name: '금정회관', group: 4 },
  { code: '420', name: '새벽벌도서관', alias: '상남국제회관', group: 4 },
  { code: '421', name: '사회관', group: 4 },
  { code: '422', name: '성학관', group: 4 },
  { code: '501', name: '첨단과학관', group: 5 },
  { code: '503', name: '약학관', group: 5 },
  { code: '505', name: '인덕관 철골주차장', group: 5 },
  { code: '506', name: '효원산학협동관', group: 5 },
  { code: '507', name: '인덕관', group: 5 },
  { code: '508', name: '산학협동관', group: 5 },
  { code: '509', name: '박물관 별관', group: 5 },
  { code: '510', name: '중앙도서관', alias: '도서관', group: 5 },
  { code: '511', name: '간이체육관', group: 5 },
  { code: '512', name: '테니스장', group: 5 },
  { code: '513', name: '철골주차장', group: 5 },
  { code: '514', name: '경영관', group: 5 },
  { code: '516', name: '경제통상관', group: 5 },
  { code: '601', name: '법학관', group: 6 },
  { code: '602', name: '제1행정관', group: 6 },
  { code: '603', name: '제2행정관', group: 6 },
  { code: '605', name: '학생생활관', group: 6 },
  { code: '606', name: '학생회관', group: 6 },
  { code: '607', name: '대운동장', group: 6 },
  { code: '608', name: '제2법학관', group: 6 },
  { code: '609', name: '야외음악당', group: 6 },
  { code: '701', name: '제2사범관', group: 7 },
  { code: '705', name: '경암체육관 교수연구동', group: 7 },
  { code: '706', name: '경암체육관', group: 7 },
  { code: '707', name: '음악관', group: 7 },
  { code: '709', name: '과학기술연구동', group: 7 },
  { code: '710', name: '제1연구동', group: 7 },
  { code: '711', name: '제2연구동', group: 7 },
  { code: '712', name: '제3연구동', group: 7 },
  { code: '713', name: '제4연구동', group: 7 },
  { code: '714', name: '제5연구동', group: 7 },
  { code: '715', name: '제6연구동', group: 7 },
  { code: '716', name: '제7연구동', group: 7 },
  { code: '717', name: '제8연구동', group: 7 },
];

const YANGSAN_BUILDINGS: Building[] = [
  { code: 'Y01', name: '경암의학관', group: 1 },
  { code: 'Y02', name: '치의학전문대학원', group: 1 },
  { code: 'Y03', name: '한의학전문대학원', group: 1 },
  { code: 'Y04', name: '간호대학', group: 1 },
  { code: 'Y05', name: '행림관', alias: '기숙사', group: 1 },
  { code: 'Y06', name: '지진방재연구센터', group: 1 },
  { code: 'Y07', name: '파워플랜트', group: 1 },
  { code: 'Y08', name: '쓰레기집하장', group: 1 },
  { code: 'Y09', name: '나래관', group: 1 },
  { code: 'Y10', name: '의생명과학도서관', group: 1 },
  { code: 'Y11', name: '충격공학연구센터 시험연구동', group: 1 },
  { code: 'Y12', name: '운동장', group: 1 },
  { code: 'Y13', name: '테니스장', group: 1 },
  { code: 'Y14', name: '한국그린인프라·저영향개발센터', group: 1 },
  { code: 'Y15', name: '첨단의생명융합센터', group: 1 },
  { code: 'Y16', name: '지행관', alias: '기숙사', group: 1 },
  { code: 'Y17', name: '경암공학관', group: 1 },
  { code: 'YH01', name: '양산부산대학교병원', group: 2 },
  { code: 'YH02', name: '어린이병원', group: 2 },
  { code: 'YH03', name: '치과병원', group: 2 },
  { code: 'YH04', name: '한방병원', group: 2 },
  { code: 'YH05', name: '재활병원', group: 2 },
  { code: 'YH06', name: '전문질환센터', group: 2 },
  { code: 'YH07', name: '한의약임상연구센터', group: 2 },
  { code: 'YH08', name: '편의시설동', group: 2 },
  { code: 'YH09', name: '교수연구동·행정동', group: 2 },
  { code: 'YH11', name: '의생명창의연구동', group: 2 },
  { code: 'YH12', name: '직장어린이집', group: 2 },
  { code: 'YH13', name: '로날드맥도날드하우스', group: 2 },
  { code: 'YH14', name: '직원기숙사', group: 2 },
  { code: 'YH15', name: '한방병원 원외탕전실', group: 2 },
];

const MIRYANG_BUILDINGS: Building[] = [
  { code: 'M01', name: '행정지원본부동', group: 1 },
  { code: 'M01-1', name: '나노생명과학도서관', group: 1 },
  { code: 'M02', name: '나노과학기술관', group: 1 },
  { code: 'M03', name: '생명자원과학관', group: 1 },
  { code: 'M04', name: '학생회관', group: 1 },
  { code: 'M05', name: '비마관 및 매화관', alias: '기숙사', group: 1 },
  { code: 'M05-1', name: '청학관', alias: '기숙사', group: 1 },
  { code: 'M06', name: '종합실험실습관', group: 1 },
  { code: 'M07', name: '정문수위실', group: 1 },
  { code: 'M08', name: '운동장', group: 1 },
  { code: 'M09', name: '공동실험실습관', group: 1 },
  { code: 'M10', name: '테니스장', group: 1 },
  { code: 'M11', name: '첨단온실', group: 1 },
];

const AMI_BUILDINGS: Building[] = [
  { code: 'AH01', name: 'A동', alias: '본관', group: 1 },
  { code: 'AH04', name: 'B동', alias: '외래센터', group: 1 },
  { code: 'AH05', name: 'E동', alias: '부산권응급의료센터', group: 1 },
  { code: 'AH06', name: 'C동', alias: '부산지역암센터', group: 1 },
  { code: 'AH07', name: 'CE동', alias: '부산지역암센터 별관', group: 1 },
  { code: 'AH08', name: '주차타워', group: 1 },
  { code: 'AH09', name: 'H동', alias: '복지동', group: 1 },
  { code: 'AH10', name: 'J동', alias: '장기려관', group: 1 },
  { code: 'AH20', name: '의생명연구원', group: 1 },
];

const CAMPUSES: CampusInfo[] = [
  {
    id: 'pusan', label: '부산', buildings: PUSAN_BUILDINGS,
    groups: [
      { id: 1, label: '1존 공학서쪽', bg: '#DBEAFE', text: '#1D4ED8' },
      { id: 2, label: '2존 대학본부', bg: '#EDE9FE', text: '#6D28D9' },
      { id: 3, label: '3존 인문·자연', bg: '#D1FAE5', text: '#047857' },
      { id: 4, label: '4존 사회·사범', bg: '#FEF3C7', text: '#B45309' },
      { id: 5, label: '5존 도서관', bg: '#FFE4E6', text: '#BE123C' },
      { id: 6, label: '6존 법학·행정', bg: '#CFFAFE', text: '#0E7490' },
      { id: 7, label: '7존 체육·연구', bg: '#FFEDD5', text: '#C2410C' },
    ],
  },
  {
    id: 'yangsan', label: '양산', buildings: YANGSAN_BUILDINGS,
    groups: [
      { id: 1, label: '캠퍼스', bg: '#DBEAFE', text: '#1D4ED8' },
      { id: 2, label: '병원', bg: '#FFE4E6', text: '#BE123C' },
    ],
  },
  {
    id: 'miryang', label: '밀양', buildings: MIRYANG_BUILDINGS,
    groups: [
      { id: 1, label: '전체', bg: '#D1FAE5', text: '#047857' },
    ],
  },
  {
    id: 'ami', label: '아미', buildings: AMI_BUILDINGS,
    groups: [
      { id: 1, label: '병원', bg: '#EDE9FE', text: '#6D28D9' },
    ],
  },
];

export default function CampusMapScreen() {
  const insets = useSafeAreaInsets();
  const topPad = isWeb ? 67 : insets.top;

  const [campusId, setCampusId] = useState('pusan');
  const [tab, setTab] = useState<'map' | 'search'>('map');
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<number | null>(null);

  const campus = CAMPUSES.find(c => c.id === campusId)!;

  function handleCampusChange(id: string) {
    setCampusId(id);
    setQuery('');
    setGroupFilter(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campus.buildings.filter(b => {
      const matchGroup = groupFilter === null || b.group === groupFilter;
      if (!matchGroup) return false;
      if (!q) return true;
      return (
        b.code.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        (b.alias?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [query, groupFilter, campus]);

  const getGroup = (id: number) => campus.groups.find(g => g.id === id);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 60 : 110 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.universityLabel}>부산대학교</Text>
          <Text style={styles.pageTitle}>캠퍼스 맵</Text>
        </View>

        {/* Campus Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.campusTabsScroll}
          contentContainerStyle={styles.campusTabsContainer}
        >
          {CAMPUSES.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.campusTab, campusId === c.id && styles.campusTabActive]}
              onPress={() => handleCampusChange(c.id)}
            >
              <Text style={[styles.campusTabText, campusId === c.id && styles.campusTabTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* View Toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleBg}>
            <TouchableOpacity
              style={[styles.toggleBtn, tab === 'map' && styles.toggleBtnActive]}
              onPress={() => setTab('map')}
            >
              <Feather name="map" size={13} color={tab === 'map' ? C.primary : '#9CA3AF'} />
              <Text style={[styles.toggleText, tab === 'map' && styles.toggleTextActive]}>지도</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, tab === 'search' && styles.toggleBtnActive]}
              onPress={() => setTab('search')}
            >
              <Feather name="search" size={13} color={tab === 'search' ? C.primary : '#9CA3AF'} />
              <Text style={[styles.toggleText, tab === 'search' && styles.toggleTextActive]}>건물 찾기</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 지도 탭 */}
        {tab === 'map' && (
          <View style={styles.mapPlaceholder}>
            <Feather name="map" size={48} color="rgba(0,0,0,0.08)" />
            <Text style={styles.mapPlaceholderTitle}>{campus.label}캠퍼스 지도</Text>
            <Text style={styles.mapPlaceholderSub}>추후 추가 예정</Text>
          </View>
        )}

        {/* 건물 찾기 탭 */}
        {tab === 'search' && (
          <View style={styles.searchSection}>
            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Feather name="search" size={15} color="rgba(0,0,0,0.2)" />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="건물명 또는 코드 검색"
                placeholderTextColor="rgba(0,0,0,0.2)"
              />
              {!!query && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Feather name="x" size={15} color="rgba(0,0,0,0.2)" />
                </TouchableOpacity>
              )}
            </View>

            {/* Group Filter (multi-group 캠퍼스만) */}
            {campus.groups.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.groupFilterScroll}
                contentContainerStyle={styles.groupFilterContainer}
              >
                <TouchableOpacity
                  style={[styles.groupChip, groupFilter === null && styles.groupChipAll]}
                  onPress={() => setGroupFilter(null)}
                >
                  <Text style={[styles.groupChipText, groupFilter === null && styles.groupChipTextAll]}>전체</Text>
                </TouchableOpacity>
                {campus.groups.map(g => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.groupChip, groupFilter === g.id && styles.groupChipAll]}
                    onPress={() => setGroupFilter(groupFilter === g.id ? null : g.id)}
                  >
                    <Text style={[styles.groupChipText, groupFilter === g.id && styles.groupChipTextAll]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Count */}
            <Text style={styles.resultCount}>{filtered.length}개 건물</Text>

            {/* Building List */}
            {campus.buildings.length === 0 || filtered.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name={filtered.length === 0 && !!query ? 'search' : 'grid'} size={36} color="rgba(0,0,0,0.1)" />
                <Text style={styles.emptyText}>
                  {filtered.length === 0 && !!query ? '검색 결과가 없습니다' : `${campus.label}캠퍼스 건물 정보 추후 추가 예정`}
                </Text>
              </View>
            ) : (
              <View style={styles.buildingList}>
                {filtered.map((b, i) => {
                  const group = getGroup(b.group);
                  return (
                    <View
                      key={b.code}
                      style={[
                        styles.buildingRow,
                        i < filtered.length - 1 && styles.buildingRowBorder,
                      ]}
                    >
                      <Text style={styles.buildingCode}>{b.code}</Text>
                      <View style={styles.buildingInfo}>
                        <Text style={styles.buildingName}>{b.name}</Text>
                        {b.alias && (
                          <Text style={styles.buildingAlias}>{b.alias.split(' ')[0]}</Text>
                        )}
                      </View>
                      {campus.groups.length > 1 && group && (
                        <View style={[styles.groupBadge, { backgroundColor: group.bg }]}>
                          <Text style={[styles.groupBadgeText, { color: group.text }]}>
                            {group.label.split(' ')[0]}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },

  backBtn: { width: 36, height: 36, justifyContent: 'center', marginBottom: 4, marginLeft: -4 },
  headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  universityLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  pageTitle: { fontSize: 36, fontFamily: 'Inter_700Bold', color: '#111827', letterSpacing: -1, lineHeight: 42 },

  campusTabsScroll: { marginBottom: 12 },
  campusTabsContainer: { paddingHorizontal: 20, gap: 8 },
  campusTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
  },
  campusTabActive: {
    backgroundColor: C.primary, borderColor: C.primary,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 4,
  },
  campusTabText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#6B7280' },
  campusTabTextActive: { color: '#fff' },

  toggleContainer: { paddingHorizontal: 20, marginBottom: 16 },
  toggleBg: { flexDirection: 'row', backgroundColor: '#F1F2F4', borderRadius: 16, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 13 },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  toggleText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#9CA3AF' },
  toggleTextActive: { color: C.primary },

  mapPlaceholder: {
    marginHorizontal: 20, borderRadius: 24, backgroundColor: '#fff',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    height: 340, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  mapPlaceholderTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: 'rgba(0,0,0,0.25)' },
  mapPlaceholderSub: { fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(0,0,0,0.18)' },

  searchSection: { paddingHorizontal: 20 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', fontFamily: 'Inter_500Medium' },

  groupFilterScroll: { marginBottom: 10, marginHorizontal: -20 },
  groupFilterContainer: { paddingHorizontal: 20, gap: 8 },
  groupChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1F2F4' },
  groupChipAll: { backgroundColor: '#111827' },
  groupChipText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#6B7280' },
  groupChipTextAll: { color: '#fff' },

  resultCount: { fontSize: 11, fontFamily: 'Inter_500Medium', color: 'rgba(0,0,0,0.28)', marginBottom: 10 },

  emptyBox: { backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: 'rgba(0,0,0,0.3)', textAlign: 'center', paddingHorizontal: 20 },

  buildingList: {
    backgroundColor: '#fff', borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 1,
    overflow: 'hidden',
  },
  buildingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  buildingRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  buildingCode: { fontSize: 11, fontFamily: 'Inter_700Bold', color: 'rgba(0,0,0,0.3)', width: 44, textAlign: 'right' },
  buildingInfo: { flex: 1 },
  buildingName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#111827', lineHeight: 18 },
  buildingAlias: { fontSize: 11, fontFamily: 'Inter_500Medium', color: 'rgba(0,0,0,0.35)', marginTop: 2 },
  groupBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  groupBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
});
