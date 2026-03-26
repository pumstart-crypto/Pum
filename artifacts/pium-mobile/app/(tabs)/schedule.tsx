import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Platform, Alert, ActivityIndicator,
  RefreshControl, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetSchedules } from '@workspace/api-client-react';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const DAYS = ['월', '화', '수', '목', '금'];
const DAYS_FULL = ['월요일', '화요일', '수요일', '목요일', '금요일'];
const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_HEIGHT = 60;

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
  return ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

interface Schedule {
  id: number;
  subjectName: string;
  professor: string;
  location: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  credit: number;
  color?: string;
}

interface Grade {
  id: number;
  subject: string;
  professor: string;
  grade: string;
  creditHours: number;
  semester: string;
  year: number;
  score?: number;
}

const GRADE_POINTS: Record<string, number> = {
  'A+': 4.5, 'A': 4.0, 'A0': 4.0,
  'B+': 3.5, 'B': 3.0, 'B0': 3.0,
  'C+': 2.5, 'C': 2.0, 'C0': 2.0,
  'D+': 1.5, 'D': 1.0, 'D0': 1.0,
  'F': 0, 'P': 0, 'NP': 0,
};

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [tab, setTab] = useState<Tab>('timetable');
  const { data: schedules = [], refetch, isLoading } = useGetSchedules();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesFetched, setGradesFetched] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddGrade, setShowAddGrade] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add schedule form
  const [name, setName] = useState('');
  const [prof, setProf] = useState('');
  const [loc, setLoc] = useState('');
  const [day, setDay] = useState(0);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:30');
  const [credit, setCredit] = useState('3');
  const [submitting, setSubmitting] = useState(false);

  // Add grade form
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
    if (!name.trim() || !start || !end) return;
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
        const newGrade = await r.json();
        setGrades(prev => [...prev, newGrade]);
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

  // Compute GPA
  const eligible = grades.filter(g => g.grade !== 'P' && g.grade !== 'NP');
  const totalCredits = eligible.reduce((s, g) => s + g.creditHours, 0);
  const weightedSum = eligible.reduce((s, g) => s + (GRADE_POINTS[g.grade] || 0) * g.creditHours, 0);
  const gpa = totalCredits > 0 ? (weightedSum / totalCredits).toFixed(2) : '—';
  const totalCreditCount = grades.reduce((s, g) => s + g.creditHours, 0);

  const totalHours = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={styles.pageTitle}>학업 관리</Text>
        <View style={styles.tabRow}>
          {(['timetable', 'grades'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => onTabChange(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === 'timetable' ? '시간표' : '성적'}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => tab === 'timetable' ? setShowAdd(true) : setShowAddGrade(true)} style={styles.addBtn}>
            <Feather name="plus" size={20} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {tab === 'timetable' ? (
        /* === TIMETABLE VIEW === */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: isWeb ? 34 : 100 }}
          refreshControl={<RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Day headers */}
          <View style={styles.dayHeader}>
            <View style={{ width: 44 }} />
            {DAYS.map((d, i) => (
              <View key={d} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Grid */}
          <View style={styles.grid}>
            {/* Hour labels */}
            <View style={styles.hourLabels}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                <View key={i} style={[styles.hourLabel, { height: HOUR_HEIGHT }]}>
                  <Text style={styles.hourText}>{START_HOUR + i}시</Text>
                </View>
              ))}
            </View>

            {/* Columns */}
            {DAYS.map((_, dayIdx) => {
              const daySchedules = (schedules as Schedule[]).filter(s => s.dayOfWeek === dayIdx);
              return (
                <View key={dayIdx} style={[styles.column, { height: totalHours }]}>
                  {/* Hour lines */}
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                    <View key={i} style={[styles.hourLine, { top: i * HOUR_HEIGHT }]} />
                  ))}
                  {/* Schedule blocks */}
                  {daySchedules.map(s => {
                    const startMin = timeToMinutes(s.startTime);
                    const endMin = timeToMinutes(s.endTime);
                    const y = minutesToY(startMin);
                    const h = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                    const color = getColor(s.subjectName);
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.block, { top: y, height: Math.max(h, 30), backgroundColor: color + '22', borderLeftColor: color }]}
                        onLongPress={() => deleteSchedule(s.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.blockName, { color }]} numberOfLines={2}>{s.subjectName}</Text>
                        {h > 36 && s.location ? (
                          <Text style={[styles.blockLoc, { color }]} numberOfLines={1}>{s.location}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>

          {/* List view below grid */}
          {(schedules as Schedule[]).length > 0 && (
            <View style={styles.listSection}>
              <Text style={styles.listTitle}>수업 목록</Text>
              {DAYS.map((d, dayIdx) => {
                const daySched = (schedules as Schedule[]).filter(s => s.dayOfWeek === dayIdx).sort((a, b) => a.startTime.localeCompare(b.startTime));
                if (!daySched.length) return null;
                return (
                  <View key={dayIdx}>
                    <Text style={styles.dayLabel}>{DAYS_FULL[dayIdx]}</Text>
                    {daySched.map(s => (
                      <View key={s.id} style={[styles.scheduleRow, { borderLeftColor: getColor(s.subjectName) }]}>
                        <View style={styles.scheduleRowInfo}>
                          <Text style={styles.scheduleRowName}>{s.subjectName}</Text>
                          <Text style={styles.scheduleRowMeta}>{s.startTime}~{s.endTime} {s.location ? `· ${s.location}` : ''} {s.professor ? `· ${s.professor}` : ''}</Text>
                        </View>
                        <TouchableOpacity onPress={() => deleteSchedule(s.id)} style={styles.deleteBtn}>
                          <Feather name="trash-2" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}

          {(schedules as Schedule[]).length === 0 && !isLoading && (
            <View style={styles.empty}>
              <Feather name="calendar" size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>등록된 수업이 없어요</Text>
              <Text style={styles.emptyHint}>+ 버튼으로 수업을 추가하세요</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* === GRADES VIEW === */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.gradesContent, { paddingBottom: isWeb ? 34 : 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {gradesLoading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* GPA Summary */}
              <View style={styles.gpaCard}>
                <View style={styles.gpaItem}>
                  <Text style={styles.gpaValue}>{gpa}</Text>
                  <Text style={styles.gpaLabel}>평점 (4.5)</Text>
                </View>
                <View style={styles.gpaDivider} />
                <View style={styles.gpaItem}>
                  <Text style={styles.gpaValue}>{totalCreditCount}</Text>
                  <Text style={styles.gpaLabel}>이수 학점</Text>
                </View>
                <View style={styles.gpaDivider} />
                <View style={styles.gpaItem}>
                  <Text style={styles.gpaValue}>{grades.length}</Text>
                  <Text style={styles.gpaLabel}>과목 수</Text>
                </View>
              </View>

              {grades.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="award" size={40} color="#D1D5DB" />
                  <Text style={styles.emptyText}>등록된 성적이 없어요</Text>
                </View>
              ) : (
                <>
                  {/* Group by year/semester */}
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
                          const point = GRADE_POINTS[g.grade];
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
                </>
              )}
            </>
          )}
        </ScrollView>
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
              <View style={styles.gradeRow2}>
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
                  <Text style={[styles.dayChipText, gSemester === s && styles.dayChipTextActive]}>{s === '1' ? '1학기' : s === '2' ? '2학기' : s}학기</Text>
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
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  headerArea: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pageTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#111827', paddingBottom: 8 },
  tabRow: { flexDirection: 'row', alignItems: 'center', marginBottom: -1 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: C.primary },
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  tabTextActive: { color: C.primary },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  dayHeader: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  dayHeaderText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  grid: { flexDirection: 'row', paddingHorizontal: 4 },
  hourLabels: { width: 44 },
  hourLabel: { justifyContent: 'flex-start', paddingTop: 4 },
  hourText: { fontSize: 10, color: '#D1D5DB', fontFamily: 'Inter_400Regular' },
  column: { flex: 1, position: 'relative' },
  hourLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#F3F4F6' },
  block: {
    position: 'absolute', left: 2, right: 2, borderRadius: 6, borderLeftWidth: 3, padding: 4, overflow: 'hidden',
  },
  blockName: { fontSize: 10, fontFamily: 'Inter_700Bold', lineHeight: 14 },
  blockLoc: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 1 },
  listSection: { paddingHorizontal: 16, paddingTop: 12 },
  listTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 12 },
  dayLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#6B7280', marginBottom: 6, marginTop: 8 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 6, borderLeftWidth: 3 },
  scheduleRowInfo: { flex: 1 },
  scheduleRowName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  scheduleRowMeta: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular', marginTop: 2 },
  deleteBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, color: '#9CA3AF', fontFamily: 'Inter_500Medium' },
  emptyHint: { fontSize: 13, color: '#D1D5DB', fontFamily: 'Inter_400Regular' },
  gradesContent: { paddingHorizontal: 16, paddingTop: 12 },
  gpaCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  gpaItem: { alignItems: 'center', gap: 4 },
  gpaValue: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.primary },
  gpaLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  gpaDivider: { width: 1, backgroundColor: '#F3F4F6' },
  semesterGroup: { marginBottom: 16 },
  semesterTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#6B7280', marginBottom: 8 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 6, gap: 10 },
  gradeRow2: { flexDirection: 'row', gap: 8 },
  gradeInfo: { flex: 1 },
  gradeSubject: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  gradeMeta: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },
  gradeBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  gradeBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
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
