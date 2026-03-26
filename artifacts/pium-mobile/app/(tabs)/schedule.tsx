import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Platform, Alert, ActivityIndicator,
  RefreshControl,
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
const SLOT_H = 36; // height per 30-min slot
const HOUR_H = SLOT_H * 2;

type Tab = 'timetable' | 'grades';

const PALETTE = ['#4F46E5','#0891B2','#059669','#D97706','#DC2626','#7C3AED','#DB2777','#0F766E','#EA580C','#0284C7'];
function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesToY(minutes: number) {
  return ((minutes - START_HOUR * 60) / 30) * SLOT_H;
}

// Current semester
function getSemesterLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const sem = month >= 8 ? '2' : '1';
  return `${year}년 ${sem}학기`;
}

interface Schedule {
  id: number; subjectName: string; professor: string; location: string;
  dayOfWeek: number; startTime: string; endTime: string; credit: number; color?: string;
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
const TOTAL_GRAD_CREDITS = GRAD_REQS.reduce((s, r) => s + r.required, 0);

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
  const [showAdd, setShowAdd] = useState(false);
  const [showAddGrade, setShowAddGrade] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gradReqOpen, setGradReqOpen] = useState(true);

  // Schedule form
  const [name, setName] = useState('');
  const [prof, setProf] = useState('');
  const [loc, setLoc] = useState('');
  const [day, setDay] = useState(0);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:30');
  const [credit, setCredit] = useState('3');
  const [submitting, setSubmitting] = useState(false);

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

  const addSchedule = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectName: name.trim(), professor: prof.trim(), location: loc.trim(), dayOfWeek: day, startTime: start, endTime: end, credit: Number(credit) || 0 }),
      });
      if (r.ok) {
        await refetch();
        setName(''); setProf(''); setLoc(''); setDay(0); setStart('09:00'); setEnd('10:30'); setCredit('3');
        setShowAdd(false);
      }
    } catch { Alert.alert('오류', '수업 추가 실패'); }
    finally { setSubmitting(false); }
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

  const addGrade = async () => {
    if (!gSubject.trim()) return;
    setGSubmitting(true);
    try {
      const r = await fetch(`${API}/grades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    Alert.alert('성적 삭제', '삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await fetch(`${API}/grades/${id}`, { method: 'DELETE' });
        setGrades(prev => prev.filter(g => g.id !== id));
      }},
    ]);
  };

  // Computed stats
  const eligible = grades.filter(g => g.grade !== 'P' && g.grade !== 'NP');
  const totalCredits = eligible.reduce((s, g) => s + g.creditHours, 0);
  const weightedSum = eligible.reduce((s, g) => s + (GRADE_POINTS[g.grade] || 0) * g.creditHours, 0);
  const gpa = totalCredits > 0 ? (weightedSum / totalCredits).toFixed(2) : '—';
  const totalCreditCount = grades.reduce((s, g) => s + g.creditHours, 0);

  const totalSlots = (END_HOUR - START_HOUR) * 2;
  const totalH = totalSlots * SLOT_H;

  // Segmented tab bar
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
          {/* Timetable header */}
          <View style={styles.ttHeader}>
            <View style={styles.ttTitleRow}>
              <Text style={styles.ttTitle}>{getSemesterLabel()} 시간표</Text>
              <Feather name="chevron-down" size={18} color="#374151" style={{ marginLeft: 4, marginTop: 3 }} />
            </View>
            <View style={styles.ttHeaderRight}>
              <TouchableOpacity style={styles.iconBtn}>
                <Feather name="list" size={18} color="#374151" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.addCircleBtn} onPress={() => setShowAdd(true)}>
                <Feather name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.segWrapper}>
            <TabBar />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
            refreshControl={<RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor={C.primary} />}
            showsVerticalScrollIndicator={false}
          >
            {/* Day header row */}
            <View style={styles.dayHeader}>
              <View style={{ width: 48 }} />
              {DAYS.map(d => (
                <View key={d} style={styles.dayHeaderCell}>
                  <Text style={styles.dayHeaderText}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Timetable grid */}
            <View style={styles.gridWrapper}>
              {/* Time labels */}
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

              {/* Day columns */}
              {DAYS.map((_, dayIdx) => {
                const daySch = (schedules as Schedule[]).filter(s => s.dayOfWeek === dayIdx);
                return (
                  <View key={dayIdx} style={[styles.dayCol, { height: totalH }]}>
                    {Array.from({ length: totalSlots }, (_, i) => (
                      <View key={i} style={[styles.slot, { height: SLOT_H, borderTopColor: i % 2 === 0 ? '#E5E7EB' : '#F3F4F6' }]} />
                    ))}
                    {daySch.map(s => {
                      const startMin = timeToMinutes(s.startTime);
                      const endMin = timeToMinutes(s.endTime);
                      const y = minutesToY(startMin);
                      const h = ((endMin - startMin) / 30) * SLOT_H;
                      const color = getColor(s.subjectName);
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.block, { top: y, height: Math.max(h, SLOT_H), backgroundColor: color + '22', borderLeftColor: color }]}
                          onLongPress={() => deleteSchedule(s.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.blockName, { color }]} numberOfLines={3}>{s.subjectName}</Text>
                          {h > SLOT_H && s.location ? (
                            <Text style={[styles.blockLoc, { color }]} numberOfLines={1}>{s.location}</Text>
                          ) : null}
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
          {/* Grades header */}
          <View style={styles.gradeHeader}>
            <Text style={styles.gradeTitle}>학기별 성적 관리</Text>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowAddGrade(true)}>
              <Ionicons name="options-outline" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <View style={styles.segWrapper}>
            <TabBar />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.gradesContent, { paddingBottom: bottomPad + 100 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
            showsVerticalScrollIndicator={false}
          >
            {gradesLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
            ) : (
              <>
                {/* Stats cards */}
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

                {/* Graduation requirements */}
                <View style={styles.gradReqCard}>
                  <TouchableOpacity style={styles.gradReqHeader} onPress={() => setGradReqOpen(o => !o)}>
                    <View style={styles.gradReqTitleRow}>
                      <Ionicons name="trending-up-outline" size={16} color="#374151" />
                      <Text style={styles.gradReqTitle}>졸업요건 이수현황</Text>
                      <View style={styles.gradReqBadge}>
                        <Text style={styles.gradReqBadgeText}>0/{TOTAL_GRAD_CREDITS}학점</Text>
                      </View>
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

                {/* Grade list or empty */}
                {grades.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="school-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyText}>시간표에 등록된 학기가 없어요</Text>
                    <Text style={styles.emptyHint}>시간표 탭에서 과목을 추가하세요</Text>
                  </View>
                ) : (
                  <>
                    {Object.entries(
                      grades.reduce((acc, g) => {
                        const key = `${g.year}-${g.semester}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(g);
                        return acc;
                      }, {} as Record<string, Grade[]>)
                    ).sort(([a], [b]) => b.localeCompare(a)).map(([key, gs]) => {
                      const [year, sem] = key.split('-');
                      return (
                        <View key={key} style={styles.semesterGroup}>
                          <Text style={styles.semesterTitle}>{year}년 {sem}학기</Text>
                          {gs.map(g => {
                            const point = GRADE_POINTS[g.grade] ?? 0;
                            const gradeColor = point >= 4 ? '#059669' : point >= 3 ? '#2563EB' : point >= 2 ? '#D97706' : '#DC2626';
                            return (
                              <View key={g.id} style={styles.gradeRow}>
                                <View style={styles.gradeInfo}>
                                  <Text style={styles.gradeSubject}>{g.subject}</Text>
                                  <Text style={styles.gradeMeta}>{g.professor ? `${g.professor} · ` : ''}{g.creditHours}학점</Text>
                                </View>
                                <View style={[styles.gradeBadge, { backgroundColor: gradeColor + '18' }]}>
                                  <Text style={[styles.gradeBadgeText, { color: gradeColor }]}>{g.grade}</Text>
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

      {/* Add Schedule Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalSheet, { maxHeight: '85%' }]} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>수업 추가</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="과목명 *" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.input} value={prof} onChangeText={setProf} placeholder="교수명" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.input} value={loc} onChangeText={setLoc} placeholder="강의실" placeholderTextColor="#9CA3AF" />
            <Text style={styles.inputLabel}>요일</Text>
            <View style={styles.dayRow}>
              {DAYS.map((d, i) => (
                <TouchableOpacity key={d} style={[styles.dayChip, day === i && styles.dayChipActive]} onPress={() => setDay(i)}>
                  <Text style={[styles.dayChipText, day === i && styles.dayChipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>시작</Text>
                <TextInput style={styles.input} value={start} onChangeText={setStart} placeholder="09:00" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>종료</Text>
                <TextInput style={styles.input} value={end} onChangeText={setEnd} placeholder="10:30" placeholderTextColor="#9CA3AF" />
              </View>
            </View>
            <TextInput style={styles.input} value={credit} onChangeText={setCredit} placeholder="학점 (예: 3)" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
            <TouchableOpacity style={[styles.btn, !name.trim() && styles.btnDisabled]} onPress={addSchedule} disabled={!name.trim() || submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>추가하기</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Grade Modal */}
      <Modal visible={showAddGrade} transparent animationType="slide" onRequestClose={() => setShowAddGrade(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalSheet, { maxHeight: '85%' }]} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>성적 추가</Text>
            <TextInput style={styles.input} value={gSubject} onChangeText={setGSubject} placeholder="과목명 *" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.input} value={gProf} onChangeText={setGProf} placeholder="교수명" placeholderTextColor="#9CA3AF" />
            <Text style={styles.inputLabel}>성적</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {GRADE_OPTIONS.map(g => (
                  <TouchableOpacity key={g} style={[styles.dayChip, gGrade === g && styles.dayChipActive]} onPress={() => setGGrade(g)}>
                    <Text style={[styles.dayChipText, gGrade === g && styles.dayChipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>학점</Text>
                <TextInput style={styles.input} value={gCredits} onChangeText={setGCredits} placeholder="3" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>연도</Text>
                <TextInput style={styles.input} value={gYear} onChangeText={setGYear} placeholder="2025" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
              </View>
            </View>
            <Text style={styles.inputLabel}>학기</Text>
            <View style={styles.dayRow}>
              {SEMESTER_OPTIONS.map(s => (
                <TouchableOpacity key={s} style={[styles.dayChip, gSemester === s && styles.dayChipActive]} onPress={() => setGSemester(s)}>
                  <Text style={[styles.dayChipText, gSemester === s && styles.dayChipTextActive]}>
                    {s === '1' ? '1학기' : s === '2' ? '2학기' : `${s}학기`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.btn, !gSubject.trim() && styles.btnDisabled]} onPress={addGrade} disabled={!gSubject.trim() || gSubmitting}>
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

  // Timetable header
  ttHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: '#fff' },
  ttTitleRow: { flexDirection: 'row', alignItems: 'center' },
  ttTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#111827' },
  ttHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  addCircleBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },

  // Grades header
  gradeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: '#fff' },
  gradeTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#111827' },
  settingsBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

  // Segmented tabs
  segWrapper: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#fff' },
  segContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 3, gap: 2 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 11 },
  segBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  segText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#9CA3AF' },
  segTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },

  // Timetable grid
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

  // Grades view
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

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 16 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', fontFamily: 'Inter_400Regular', marginBottom: 10 },
  inputLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280', marginBottom: 8, marginLeft: 4 },
  dayRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  dayChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  dayChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  dayChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  dayChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
  timeRow: { flexDirection: 'row', gap: 10 },
  btn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_500Medium' },
});
