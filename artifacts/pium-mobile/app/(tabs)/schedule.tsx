import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Platform, Alert, ActivityIndicator,
  RefreshControl, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetSchedules } from '@workspace/api-client-react';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const DAYS = ['월', '화', '수', '목', '금'];
const START_HOUR = 9;
const END_HOUR = 21;
const SLOT_H = 36;
const HOUR_H = SLOT_H * 2;

type Tab = 'timetable' | 'grades';

interface Semester { year: number; sem: string; }

const PALETTE = ['#4F46E5','#0891B2','#059669','#D97706','#DC2626','#7C3AED','#DB2777','#0F766E','#EA580C','#0284C7'];
function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function minutesToY(minutes: number) {
  return ((minutes - START_HOUR * 60) / 30) * SLOT_H;
}
function addMinutes(time: string, mins: number): string {
  const total = timeToMinutes(time) + mins;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function formatTimeDisplay(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(h12).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${period}`;
}

function getCurrentSemester(): Semester {
  const now = new Date();
  const month = now.getMonth() + 1;
  return { year: now.getFullYear(), sem: month >= 8 ? '2' : '1' };
}

interface Schedule {
  id: number; subjectName: string; professor: string; location: string;
  dayOfWeek: number; startTime: string; endTime: string; credit: number;
}
interface Grade {
  id: number; subject: string; professor: string; grade: string;
  creditHours: number; semester: string; year: number;
}
const GRADE_POINTS: Record<string, number> = {
  'A+': 4.5, 'A': 4.0, 'A0': 4.0, 'B+': 3.5, 'B': 3.0, 'B0': 3.0,
  'C+': 2.5, 'C': 2.0, 'C0': 2.0, 'D+': 1.5, 'D': 1.0, 'D0': 1.0,
  'F': 0, 'P': 0, 'NP': 0,
};
const GRAD_REQS = [
  { label: '전공필수', color: '#2563EB', required: 39 },
  { label: '전공기초', color: '#2563EB', required: 15 },
  { label: '전공선택', color: '#2563EB', required: 21 },
  { label: '효원핵심교양', color: '#7C3AED', required: 21 },
  { label: '효원균형·창의교양', color: '#7C3AED', required: 9 },
  { label: '일반선택', color: '#374151', required: 30 },
];
const TOTAL_GRAD = GRAD_REQS.reduce((s, r) => s + r.required, 0);
const ISU_OPTIONS = ['전공필수', '전공기초', '전공선택', '효원핵심교양', '효원균형교양', '효원창의교양', '일반선택', '교직과목'];
const YEAR_FILTERS = ['전체', '1학년', '2학년', '3학년', '4학년'];
const CATEGORY_FILTERS = ['전체', '전공필수', '전공기초', '전공선택', '효원핵심교양', '효원균형교양', '효원창의교양', '일반선택', '교직과목'];
const DEPT_LIST = [
  '컴퓨터공학과','전자공학과','기계공학부','화학공학부','경영학과','경제학과',
  '국어국문학과','영어영문학과','수학과','물리학과','화학과','생명과학부',
  '간호학과','의학과','법학전문대학원','사범대학','예술대학','사회학과',
];

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : 0;

  const [tab, setTab] = useState<Tab>('timetable');
  const { data: schedules = [], refetch, isLoading } = useGetSchedules();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesFetched, setGradesFetched] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gradReqOpen, setGradReqOpen] = useState(true);

  // Semester management
  const initSem = getCurrentSemester();
  const [semesters, setSemesters] = useState<Semester[]>([initSem]);
  const [selectedSemIdx, setSelectedSemIdx] = useState(0);
  const [showSemModal, setShowSemModal] = useState(false);
  const [newSemYear, setNewSemYear] = useState(String(initSem.year));
  const [newSemSem, setNewSemSem] = useState<'1' | '2'>('1');
  const [showAddSem, setShowAddSem] = useState(false);

  const currentSem = semesters[selectedSemIdx] ?? initSem;
  const semLabel = `${currentSem.year}년 ${currentSem.sem}학기`;

  // Modal state
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [showCourseSearch, setShowCourseSearch] = useState(false);
  const [showDirectAdd, setShowDirectAdd] = useState(false);
  const [showAddGrade, setShowAddGrade] = useState(false);

  // Direct add form
  const [dName, setDName] = useState('');
  const [dProf, setDProf] = useState('');
  const [dLoc, setDLoc] = useState('');
  const [dIsu, setDIsu] = useState('전공필수');
  const [dCredit, setDCredit] = useState(3);
  const [dDays, setDDays] = useState<number[]>([0]);
  const [dStart, setDStart] = useState('09:00');
  const [dEnd, setDEnd] = useState('10:15');
  const [dSubmitting, setDSubmitting] = useState(false);
  const [showIsuPicker, setShowIsuPicker] = useState(false);

  // Course search
  const [csDept, setCsDept] = useState('');
  const [csYear, setCsYear] = useState('전체');
  const [csCategory, setCsCategory] = useState('전체');
  const [csKeyword, setCsKeyword] = useState('');
  const [csResults, setCsResults] = useState<any[]>([]);
  const [csLoading, setCsLoading] = useState(false);
  const [csSelected, setCsSelected] = useState<any>(null);
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  // Grade form
  const [gSubject, setGSubject] = useState('');
  const [gProf, setGProf] = useState('');
  const [gGrade, setGGrade] = useState('A+');
  const [gCredits, setGCredits] = useState('3');
  const [gSemester, setGSemester] = useState('1');
  const [gYear, setGYear] = useState(String(new Date().getFullYear()));
  const [gSubmitting, setGSubmitting] = useState(false);

  const GRADE_OPTIONS = ['A+', 'A0', 'B+', 'B0', 'C+', 'C0', 'D+', 'D0', 'F', 'P', 'NP'];
  const SEMESTER_OPTIONS = ['1', '여름', '2', '겨울'];

  // Auto end time
  useEffect(() => {
    setDEnd(addMinutes(dStart, 75));
  }, [dStart]);

  const fetchGrades = useCallback(async () => {
    setGradesLoading(true);
    try {
      const r = await fetch(`${API}/grades`);
      if (r.ok) setGrades(await r.json());
    } catch {}
    finally { setGradesLoading(false); setGradesFetched(true); }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    if (gradesFetched) await fetchGrades();
    setRefreshing(false);
  }, [refetch, fetchGrades, gradesFetched]);

  const onTabChange = (t: Tab) => {
    setTab(t);
    if (t === 'grades' && !gradesFetched) fetchGrades();
  };

  const toggleDay = (i: number) => {
    setDDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]);
  };

  const addScheduleDirect = async () => {
    if (!dName.trim() || dDays.length === 0) return;
    setDSubmitting(true);
    try {
      await Promise.all(dDays.map(d =>
        fetch(`${API}/schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectName: dName.trim(), professor: dProf.trim(),
            location: dLoc.trim(), dayOfWeek: d,
            startTime: dStart, endTime: dEnd, credit: dCredit,
          }),
        })
      ));
      await refetch();
      setDName(''); setDProf(''); setDLoc(''); setDIsu('전공필수'); setDCredit(3);
      setDDays([0]); setDStart('09:00'); setDEnd('10:15');
      setShowDirectAdd(false);
    } catch { Alert.alert('오류', '수업 추가 실패'); }
    finally { setDSubmitting(false); }
  };

  const deleteSchedule = (id: number) => {
    Alert.alert('수업 삭제', '이 수업을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await fetch(`${API}/schedules/${id}`, { method: 'DELETE' });
        refetch();
      }},
    ]);
  };

  const searchCourses = async () => {
    if (!csDept && !csKeyword) return;
    setCsLoading(true);
    try {
      const params = new URLSearchParams();
      if (csDept) params.set('dept', csDept);
      if (csYear !== '전체') params.set('year', csYear.replace('학년', ''));
      if (csCategory !== '전체') params.set('category', csCategory);
      if (csKeyword) params.set('keyword', csKeyword);
      const r = await fetch(`${API}/courses?${params}`);
      if (r.ok) setCsResults(await r.json());
      else setCsResults([]);
    } catch { setCsResults([]); }
    finally { setCsLoading(false); }
  };

  const addCourseFromSearch = async () => {
    if (!csSelected) return;
    try {
      await fetch(`${API}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: csSelected.name, professor: csSelected.professor,
          location: csSelected.location, dayOfWeek: csSelected.dayOfWeek,
          startTime: csSelected.startTime, endTime: csSelected.endTime,
          credit: csSelected.credit,
        }),
      });
      await refetch();
      setShowCourseSearch(false);
      setCsSelected(null);
    } catch { Alert.alert('오류', '수업 추가 실패'); }
  };

  const addSemester = () => {
    const y = parseInt(newSemYear, 10);
    if (!y || y < 2000 || y > 2100) { Alert.alert('오류', '올바른 연도를 입력하세요'); return; }
    const exists = semesters.some(s => s.year === y && s.sem === newSemSem);
    if (exists) { Alert.alert('이미 존재', '이미 추가된 학기입니다'); return; }
    const newS: Semester = { year: y, sem: newSemSem };
    setSemesters(prev => [...prev, newS]);
    setSelectedSemIdx(semesters.length);
    setShowAddSem(false);
  };

  const addGrade = async () => {
    if (!gSubject.trim()) return;
    setGSubmitting(true);
    try {
      const r = await fetch(`${API}/grades`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: gSubject.trim(), professor: gProf.trim(), grade: gGrade, creditHours: Number(gCredits), semester: gSemester, year: Number(gYear) }),
      });
      if (r.ok) {
        const ng = await r.json();
        setGrades(prev => [...prev, ng]);
        setGSubject(''); setGProf(''); setGGrade('A+'); setGCredits('3'); setGSemester('1');
        setShowAddGrade(false);
      }
    } catch { Alert.alert('오류', '성적 추가 실패'); }
    finally { setGSubmitting(false); }
  };

  const deleteGrade = (id: number) => {
    Alert.alert('삭제', '삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await fetch(`${API}/grades/${id}`, { method: 'DELETE' });
        setGrades(prev => prev.filter(g => g.id !== id));
      }},
    ]);
  };

  const eligible = grades.filter(g => g.grade !== 'P' && g.grade !== 'NP');
  const totalCredits = eligible.reduce((s, g) => s + g.creditHours, 0);
  const weightedSum = eligible.reduce((s, g) => s + (GRADE_POINTS[g.grade] || 0) * g.creditHours, 0);
  const gpa = totalCredits > 0 ? (weightedSum / totalCredits).toFixed(2) : '—';
  const totalCreditCount = grades.reduce((s, g) => s + g.creditHours, 0);

  const totalSlots = (END_HOUR - START_HOUR) * 2;
  const totalH = totalSlots * SLOT_H;

  const TabBar = () => (
    <View style={styles.segContainer}>
      <TouchableOpacity style={[styles.segBtn, tab === 'timetable' && styles.segBtnActive]} onPress={() => onTabChange('timetable')}>
        <Ionicons name="grid-outline" size={15} color={tab === 'timetable' ? C.primary : '#9CA3AF'} />
        <Text style={[styles.segText, tab === 'timetable' && styles.segTextActive]}>시간표</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.segBtn, tab === 'grades' && styles.segBtnActive]} onPress={() => onTabChange('grades')}>
        <Ionicons name="school-outline" size={15} color={tab === 'grades' ? C.primary : '#9CA3AF'} />
        <Text style={[styles.segText, tab === 'grades' && styles.segTextActive]}>성적 관리</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {tab === 'timetable' ? (
        <>
          <View style={styles.ttHeader}>
            <View style={styles.ttTitleRow}>
              <Text style={styles.ttTitle}>{semLabel} 시간표</Text>
              <Feather name="chevron-down" size={18} color="#374151" style={{ marginLeft: 4, marginTop: 3 }} />
            </View>
            <View style={styles.ttHeaderRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSemModal(true)}>
                <Feather name="list" size={18} color="#374151" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.addCircleBtn} onPress={() => setShowAddMethod(true)}>
                <Feather name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.segWrapper}><TabBar /></View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
            refreshControl={<RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor={C.primary} />}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.dayHeader}>
              <View style={{ width: 48 }} />
              {DAYS.map(d => (
                <View key={d} style={styles.dayHeaderCell}>
                  <Text style={styles.dayHeaderText}>{d}</Text>
                </View>
              ))}
            </View>
            <View style={styles.gridWrapper}>
              <View style={{ width: 48 }}>
                {Array.from({ length: totalSlots }, (_, i) => {
                  const h = START_HOUR + Math.floor(i / 2);
                  const m = i % 2 === 0 ? '00' : '30';
                  const label = i % 2 === 0 ? `${String(h).padStart(2, '0')}:${m}` : '';
                  return (
                    <View key={i} style={[styles.timeCell, { height: SLOT_H }]}>
                      {label ? <Text style={styles.timeText}>{label}</Text> : null}
                    </View>
                  );
                })}
              </View>
              {DAYS.map((_, dayIdx) => {
                const daySch = (schedules as Schedule[]).filter(s => s.dayOfWeek === dayIdx);
                return (
                  <View key={dayIdx} style={[styles.dayCol, { height: totalH }]}>
                    {Array.from({ length: totalSlots }, (_, i) => (
                      <View key={i} style={[styles.slot, { height: SLOT_H, borderTopColor: i % 2 === 0 ? '#E5E7EB' : '#F3F4F6' }]} />
                    ))}
                    {daySch.map(s => {
                      const y = minutesToY(timeToMinutes(s.startTime));
                      const h = ((timeToMinutes(s.endTime) - timeToMinutes(s.startTime)) / 30) * SLOT_H;
                      const color = getColor(s.subjectName);
                      return (
                        <TouchableOpacity key={s.id}
                          style={[styles.block, { top: y, height: Math.max(h, SLOT_H), backgroundColor: color + '22', borderLeftColor: color }]}
                          onLongPress={() => deleteSchedule(s.id)} activeOpacity={0.8}>
                          <Text style={[styles.blockName, { color }]} numberOfLines={3}>{s.subjectName}</Text>
                          {h > SLOT_H && s.location ? <Text style={[styles.blockLoc, { color }]} numberOfLines={1}>{s.location}</Text> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
            {(schedules as Schedule[]).length === 0 && !isLoading && (
              <View style={styles.empty}>
                <Feather name="calendar" size={40} color="#D1D5DB" />
                <Text style={styles.emptyText}>등록된 수업이 없어요</Text>
                <Text style={styles.emptyHint}>+ 버튼으로 수업을 추가하세요</Text>
              </View>
            )}
          </ScrollView>
        </>
      ) : (
        <>
          <View style={styles.gradeHeader}>
            <Text style={styles.gradeTitle}>학기별 성적 관리</Text>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowAddGrade(true)}>
              <Ionicons name="options-outline" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
          <View style={styles.segWrapper}><TabBar /></View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.gradesContent, { paddingBottom: bottomPad + 100 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
            showsVerticalScrollIndicator={false}
          >
            {gradesLoading ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} /> : (
              <>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Ionicons name="ribbon-outline" size={28} color={C.primary} style={{ marginBottom: 4 }} />
                    <Text style={styles.statValue}>{gpa}</Text>
                    <Text style={styles.statLabel}>전체 평점 / 4.5</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Ionicons name="school-outline" size={28} color={C.primary} style={{ marginBottom: 4 }} />
                    <Text style={styles.statValue}>{totalCreditCount}</Text>
                    <Text style={styles.statLabel}>총 이수학점</Text>
                  </View>
                </View>
                <View style={styles.gradReqCard}>
                  <TouchableOpacity style={styles.gradReqHeader} onPress={() => setGradReqOpen(o => !o)}>
                    <View style={styles.gradReqTitleRow}>
                      <Ionicons name="trending-up-outline" size={16} color="#374151" />
                      <Text style={styles.gradReqTitle}>졸업요건 이수현황</Text>
                      <View style={styles.gradReqBadge}><Text style={styles.gradReqBadgeText}>0/{TOTAL_GRAD}학점</Text></View>
                    </View>
                    <Ionicons name={gradReqOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                  {gradReqOpen && (
                    <View style={styles.gradReqBody}>
                      {GRAD_REQS.map((req, i) => (
                        <View key={req.label} style={[styles.gradReqRow, i === GRAD_REQS.length - 1 && { borderBottomWidth: 0 }]}>
                          <Text style={[styles.gradReqLabel, { color: req.color }]}>{req.label}</Text>
                          <Text style={styles.gradReqValue}>0/{req.required}학점</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                {grades.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="school-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyText}>시간표에 등록된 학기가 없어요</Text>
                    <Text style={styles.emptyHint}>시간표 탭에서 과목을 추가하세요</Text>
                  </View>
                ) : (
                  <>
                    {Object.entries(grades.reduce((acc, g) => {
                      const key = `${g.year}-${g.semester}`;
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(g);
                      return acc;
                    }, {} as Record<string, Grade[]>)).sort(([a], [b]) => b.localeCompare(a)).map(([key, gs]) => {
                      const [year, sem] = key.split('-');
                      return (
                        <View key={key} style={styles.semesterGroup}>
                          <Text style={styles.semesterTitle}>{year}년 {sem}학기</Text>
                          {gs.map(g => {
                            const point = GRADE_POINTS[g.grade] ?? 0;
                            const gc = point >= 4 ? '#059669' : point >= 3 ? '#2563EB' : point >= 2 ? '#D97706' : '#DC2626';
                            return (
                              <View key={g.id} style={styles.gradeRow}>
                                <View style={styles.gradeInfo}>
                                  <Text style={styles.gradeSubject}>{g.subject}</Text>
                                  <Text style={styles.gradeMeta}>{g.professor ? `${g.professor} · ` : ''}{g.creditHours}학점</Text>
                                </View>
                                <View style={[styles.gradeBadge, { backgroundColor: gc + '18' }]}>
                                  <Text style={[styles.gradeBadgeText, { color: gc }]}>{g.grade}</Text>
                                </View>
                                <TouchableOpacity onPress={() => deleteGrade(g.id)} style={styles.deleteBtn}>
                                  <Feather name="trash-2" size={14} color="#EF4444" />
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                    <TouchableOpacity style={styles.addGradeBtn} onPress={() => setShowAddGrade(true)}>
                      <Feather name="plus" size={16} color={C.primary} />
                      <Text style={styles.addGradeBtnText}>성적 추가</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* ── 학기 관리 Modal ── */}
      <Modal visible={showSemModal} transparent animationType="slide" onRequestClose={() => setShowSemModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSemModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>학기 관리</Text>
              <TouchableOpacity style={styles.closeCircle} onPress={() => setShowSemModal(false)}>
                <Feather name="x" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {semesters.map((s, i) => (
                <TouchableOpacity key={i} style={[styles.semRow, selectedSemIdx === i && styles.semRowActive]}
                  onPress={() => { setSelectedSemIdx(i); setShowSemModal(false); }}>
                  <View style={styles.semRowLeft}>
                    <Ionicons name="calendar-outline" size={18} color={selectedSemIdx === i ? '#fff' : C.primary} />
                    <Text style={[styles.semRowText, selectedSemIdx === i && { color: '#fff' }]}>{s.year}년 {s.sem}학기</Text>
                  </View>
                  {selectedSemIdx === i && <Feather name="check" size={18} color="#fff" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {!showAddSem ? (
              <TouchableOpacity style={styles.addSemBtn} onPress={() => setShowAddSem(true)}>
                <Feather name="plus" size={16} color="#9CA3AF" />
                <Text style={styles.addSemText}>새 학기 추가</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.addSemForm}>
                <TextInput
                  style={styles.addSemInput}
                  value={newSemYear}
                  onChangeText={setNewSemYear}
                  placeholder="연도 (예: 2026)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
                <View style={styles.semSemRow}>
                  {(['1', '2'] as const).map(s => (
                    <TouchableOpacity key={s} style={[styles.semSemChip, newSemSem === s && styles.semSemChipActive]} onPress={() => setNewSemSem(s)}>
                      <Text style={[styles.semSemText, newSemSem === s && styles.semSemTextActive]}>{s}학기</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.btn, { flex: 1, paddingVertical: 12 }]} onPress={addSemester}>
                    <Text style={styles.btnText}>추가</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelBtn2, { flex: 1 }]} onPress={() => setShowAddSem(false)}>
                    <Text style={styles.cancelText}>취소</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 수업 추가 방식 선택 Modal ── */}
      <Modal visible={showAddMethod} transparent animationType="slide" onRequestClose={() => setShowAddMethod(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddMethod(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>수업 추가</Text>
            <TouchableOpacity style={styles.methodRow} onPress={() => { setShowAddMethod(false); setShowCourseSearch(true); }}>
              <View style={styles.methodIcon}><Ionicons name="book-outline" size={22} color={C.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodTitle}>수강편람에서 추가</Text>
                <Text style={styles.methodDesc}>부산대 수강편람에서 수업을 검색해 추가</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#D1D5DB" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.methodRow} onPress={() => { setShowAddMethod(false); setShowDirectAdd(true); }}>
              <View style={styles.methodIcon}><Feather name="edit-2" size={20} color={C.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodTitle}>직접 추가</Text>
                <Text style={styles.methodDesc}>과목명, 시간, 장소를 직접 입력해 추가</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#D1D5DB" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddMethod(false)}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 수강편람 검색 Modal ── */}
      <Modal visible={showCourseSearch} transparent animationType="slide" onRequestClose={() => setShowCourseSearch(false)}>
        <View style={styles.modalOverlayFull}>
          <View style={[styles.modalSheetFull, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            {/* Header */}
            <View style={styles.csHeaderRow}>
              <View style={styles.methodIcon}><Ionicons name="book-outline" size={20} color={C.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.csTitle}>수강편람 검색</Text>
                <Text style={styles.csSubtitle}>부산대학교 {currentSem.year}학년도 {currentSem.sem}학기 수강편람</Text>
              </View>
              <TouchableOpacity style={styles.closeCircle} onPress={() => setShowCourseSearch(false)}>
                <Feather name="x" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Department picker */}
            <TouchableOpacity style={styles.csDropdown} onPress={() => setShowDeptPicker(true)}>
              <Text style={[styles.csDropdownText, !csDept && { color: '#9CA3AF' }]}>{csDept || '학과/학부 선택'}</Text>
              <Feather name="chevron-down" size={16} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Year filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {YEAR_FILTERS.map(y => (
                <TouchableOpacity key={y} style={[styles.filterChip, csYear === y && styles.filterChipActive, y === '과목명' && styles.filterChipSearch]}
                  onPress={() => setCsYear(y)}>
                  {y === '과목명' ? <Feather name="search" size={12} color={csYear === y ? '#fff' : '#6B7280'} /> : null}
                  <Text style={[styles.filterChipText, csYear === y && styles.filterChipTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.filterSearchBox}>
                <Feather name="search" size={12} color="#9CA3AF" />
                <TextInput
                  style={styles.filterSearchInput}
                  value={csKeyword}
                  onChangeText={setCsKeyword}
                  placeholder="과목명"
                  placeholderTextColor="#9CA3AF"
                  onSubmitEditing={searchCourses}
                  returnKeyType="search"
                />
              </View>
            </ScrollView>

            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {CATEGORY_FILTERS.map(c => (
                <TouchableOpacity key={c} style={[styles.filterChip, csCategory === c && styles.filterChipActive]} onPress={() => setCsCategory(c)}>
                  <Text style={[styles.filterChipText, csCategory === c && styles.filterChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Results */}
            <ScrollView style={styles.csResults} showsVerticalScrollIndicator={false}>
              {csLoading ? (
                <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
              ) : csResults.length === 0 ? (
                <View style={styles.csEmpty}>
                  <Ionicons name="book-outline" size={44} color="#D1D5DB" />
                  <Text style={styles.csEmptyText}>학과 선택, 학년/이수구분 필터 또는 과목명으로 검색하세요.</Text>
                </View>
              ) : (
                csResults.map((course, i) => (
                  <TouchableOpacity key={i} style={[styles.courseRow, csSelected?.id === course.id && styles.courseRowSelected]}
                    onPress={() => setCsSelected(course)}>
                    <Text style={styles.courseName}>{course.name}</Text>
                    <Text style={styles.courseMeta}>{course.professor} · {course.credit}학점</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.btn, { marginHorizontal: 0, opacity: csSelected ? 1 : 0.5 }]}
              onPress={addCourseFromSearch}
              disabled={!csSelected}
            >
              <Text style={styles.btnText}>수업을 선택하세요</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dept picker */}
        <Modal visible={showDeptPicker} transparent animationType="fade" onRequestClose={() => setShowDeptPicker(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDeptPicker(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { maxHeight: '70%' }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>학과/학부 선택</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {DEPT_LIST.map(d => (
                  <TouchableOpacity key={d} style={[styles.deptRow, csDept === d && styles.deptRowActive]}
                    onPress={() => { setCsDept(d); setShowDeptPicker(false); searchCourses(); }}>
                    <Text style={[styles.deptText, csDept === d && { color: C.primary, fontFamily: 'Inter_600SemiBold' }]}>{d}</Text>
                    {csDept === d && <Feather name="check" size={16} color={C.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* ── 직접 추가 Modal ── */}
      <Modal visible={showDirectAdd} transparent animationType="slide" onRequestClose={() => setShowDirectAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlayFull}>
            <ScrollView
              style={[styles.modalSheetFull, { maxHeight: '92%' }]}
              contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetTitleRow}>
                <Text style={styles.sheetTitle}>직접 추가</Text>
                <TouchableOpacity style={styles.closeCircle} onPress={() => setShowDirectAdd(false)}>
                  <Feather name="x" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.dLabel}>과목명 *</Text>
              <TextInput style={styles.dInput} value={dName} onChangeText={setDName} placeholder="예: 기초프로그래밍" placeholderTextColor="#9CA3AF" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dLabel}>교수명</Text>
                  <TextInput style={styles.dInput} value={dProf} onChangeText={setDProf} placeholder="홍길동" placeholderTextColor="#9CA3AF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dLabel}>강의실</Text>
                  <TextInput style={styles.dInput} value={dLoc} onChangeText={setDLoc} placeholder="308호" placeholderTextColor="#9CA3AF" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dLabel}>이수구분</Text>
                  <TouchableOpacity style={[styles.dInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setShowIsuPicker(true)}>
                    <Text style={{ color: '#111827', fontFamily: 'Inter_400Regular', fontSize: 15 }}>{dIsu}</Text>
                    <Feather name="chevron-down" size={14} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dLabel}>학점</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[1, 2, 3, 4].map(n => (
                      <TouchableOpacity key={n} style={[styles.creditChip, dCredit === n && styles.creditChipActive]} onPress={() => setDCredit(n)}>
                        <Text style={[styles.creditChipText, dCredit === n && styles.creditChipTextActive]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.dLabel}>요일 <Text style={styles.dLabelHint}>(복수 선택 가능)</Text></Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {DAYS.map((d, i) => (
                  <TouchableOpacity key={d} style={[styles.dayChip, dDays.includes(i) && styles.dayChipActive]} onPress={() => toggleDay(i)}>
                    <Text style={[styles.dayChipText, dDays.includes(i) && styles.dayChipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dLabel}>시작 시간</Text>
                  <TextInput
                    style={styles.dInputTime}
                    value={formatTimeDisplay(dStart)}
                    onChangeText={v => {
                      const match = v.match(/^(\d{1,2}):(\d{2})/);
                      if (match) {
                        let h = parseInt(match[1]); const m = parseInt(match[2]);
                        if (v.includes('PM') && h < 12) h += 12;
                        if (v.includes('AM') && h === 12) h = 0;
                        setDStart(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                      }
                    }}
                    placeholder="09:00 AM"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dLabel}>종료 시간 <Text style={styles.dLabelHint}>+75분 자동</Text></Text>
                  <View style={styles.dInputTime}>
                    <Text style={{ color: '#111827', fontFamily: 'Inter_400Regular', fontSize: 15 }}>{formatTimeDisplay(dEnd)}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.btn, { marginTop: 8, opacity: !dName.trim() || dDays.length === 0 ? 0.4 : 1 }]}
                onPress={addScheduleDirect}
                disabled={!dName.trim() || dDays.length === 0 || dSubmitting}
              >
                {dSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>시간표 추가</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* 이수구분 picker */}
        <Modal visible={showIsuPicker} transparent animationType="fade" onRequestClose={() => setShowIsuPicker(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowIsuPicker(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>이수구분</Text>
              {ISU_OPTIONS.map(opt => (
                <TouchableOpacity key={opt} style={[styles.deptRow, dIsu === opt && styles.deptRowActive]}
                  onPress={() => { setDIsu(opt); setShowIsuPicker(false); }}>
                  <Text style={[styles.deptText, dIsu === opt && { color: C.primary, fontFamily: 'Inter_600SemiBold' }]}>{opt}</Text>
                  {dIsu === opt && <Feather name="check" size={16} color={C.primary} />}
                </TouchableOpacity>
              ))}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* ── 성적 추가 Modal ── */}
      <Modal visible={showAddGrade} transparent animationType="slide" onRequestClose={() => setShowAddGrade(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalSheet, { maxHeight: '85%' }]} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>성적 추가</Text>
            <TextInput style={styles.dInput} value={gSubject} onChangeText={setGSubject} placeholder="과목명 *" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.dInput} value={gProf} onChangeText={setGProf} placeholder="교수명" placeholderTextColor="#9CA3AF" />
            <Text style={styles.dLabel}>성적</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {GRADE_OPTIONS.map(g => (
                  <TouchableOpacity key={g} style={[styles.dayChip, gGrade === g && styles.dayChipActive]} onPress={() => setGGrade(g)}>
                    <Text style={[styles.dayChipText, gGrade === g && styles.dayChipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dLabel}>학점</Text>
                <TextInput style={styles.dInput} value={gCredits} onChangeText={setGCredits} placeholder="3" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dLabel}>연도</Text>
                <TextInput style={styles.dInput} value={gYear} onChangeText={setGYear} placeholder="2025" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
              </View>
            </View>
            <Text style={styles.dLabel}>학기</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {SEMESTER_OPTIONS.map(s => (
                <TouchableOpacity key={s} style={[styles.dayChip, gSemester === s && styles.dayChipActive]} onPress={() => setGSemester(s)}>
                  <Text style={[styles.dayChipText, gSemester === s && styles.dayChipTextActive]}>
                    {s === '1' ? '1학기' : s === '2' ? '2학기' : `${s}학기`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.btn, !gSubject.trim() && { opacity: 0.4 }]} onPress={addGrade} disabled={!gSubject.trim() || gSubmitting}>
              {gSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>추가하기</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddGrade(false)}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  ttHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  ttTitleRow: { flexDirection: 'row', alignItems: 'center' },
  ttTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#111827' },
  ttHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  addCircleBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },

  gradeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  gradeTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#111827' },
  settingsBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

  segWrapper: { paddingHorizontal: 20, paddingBottom: 12 },
  segContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 3, gap: 2 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 11 },
  segBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  segText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#9CA3AF' },
  segTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },

  dayHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  dayHeaderText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  gridWrapper: { flexDirection: 'row' },
  timeCell: { justifyContent: 'flex-start', paddingTop: 2, paddingLeft: 6 },
  timeText: { fontSize: 9, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  dayCol: { flex: 1, position: 'relative', borderLeftWidth: 1, borderLeftColor: '#F3F4F6' },
  slot: { borderTopWidth: 1 },
  block: { position: 'absolute', left: 2, right: 2, borderRadius: 6, borderLeftWidth: 3, padding: 3, overflow: 'hidden' },
  blockName: { fontSize: 9, fontFamily: 'Inter_700Bold', lineHeight: 13 },
  blockLoc: { fontSize: 8, fontFamily: 'Inter_400Regular', marginTop: 1 },

  gradesContent: { paddingHorizontal: 16, paddingTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#EEF4FF', borderRadius: 18, padding: 16, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.primary },
  statLabel: { fontSize: 11, color: '#6B7280', fontFamily: 'Inter_400Regular', textAlign: 'center' },
  gradReqCard: { backgroundColor: '#F9FAFB', borderRadius: 18, marginBottom: 16, overflow: 'hidden' },
  gradReqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  gradReqTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gradReqTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  gradReqBadge: { backgroundColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  gradReqBadgeText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  gradReqBody: { paddingHorizontal: 16, paddingBottom: 8 },
  gradReqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  gradReqLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  gradReqValue: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280' },
  semesterGroup: { marginBottom: 16 },
  semesterTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#6B7280', marginBottom: 8 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 12, marginBottom: 6, gap: 10 },
  gradeInfo: { flex: 1 },
  gradeSubject: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  gradeMeta: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },
  gradeBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  gradeBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  deleteBtn: { padding: 8 },
  addGradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed', marginBottom: 20 },
  addGradeBtnText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontFamily: 'Inter_500Medium' },
  emptyHint: { fontSize: 12, color: '#D1D5DB', fontFamily: 'Inter_400Regular' },

  // Shared modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 12 },
  modalSheetFull: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 16 },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

  // Semester modal
  semRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, marginBottom: 8, backgroundColor: '#F9FAFB' },
  semRowActive: { backgroundColor: C.primary },
  semRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  semRowText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  addSemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed', marginTop: 4 },
  addSemText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#9CA3AF' },
  addSemForm: { marginTop: 12, gap: 10 },
  addSemInput: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular' },
  semSemRow: { flexDirection: 'row', gap: 10 },
  semSemChip: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  semSemChipActive: { backgroundColor: '#EEF4FF', borderWidth: 1.5, borderColor: C.primary },
  semSemText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  semSemTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },

  // Method selection
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F9FAFB', borderRadius: 18, padding: 16, marginBottom: 12 },
  methodIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  methodTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#111827', marginBottom: 2 },
  methodDesc: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },

  // Course search
  csHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  csTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827' },
  csSubtitle: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  csDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  csDropdownText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#111827' },
  filterRow: { marginBottom: 10 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterChipActive: { backgroundColor: C.primary },
  filterChipSearch: {},
  filterChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  filterChipTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  filterSearchBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  filterSearchInput: { fontSize: 13, color: '#111827', fontFamily: 'Inter_400Regular', minWidth: 80 },
  csResults: { flex: 1, marginBottom: 12 },
  csEmpty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  csEmptyText: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 20 },
  courseRow: { padding: 14, borderRadius: 14, backgroundColor: '#F9FAFB', marginBottom: 8 },
  courseRowSelected: { backgroundColor: '#EEF4FF', borderWidth: 1.5, borderColor: C.primary },
  courseName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  courseMeta: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },

  // Dept picker
  deptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  deptRowActive: { },
  deptText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#374151' },

  // Direct add form
  dLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#374151', marginBottom: 8, marginTop: 4 },
  dLabelHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  dInput: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular', marginBottom: 10 },
  dInputTime: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 10, justifyContent: 'center' },
  creditChip: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  creditChipActive: { backgroundColor: C.primary },
  creditChipText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  creditChipTextActive: { color: '#fff' },
  dayChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  dayChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  dayChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  dayChipTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  btn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelBtn2: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: '#F3F4F6' },
  cancelText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_500Medium' },
});
