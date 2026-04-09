import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Platform, Alert, ActivityIndicator,
  RefreshControl, KeyboardAvoidingView, Keyboard, SectionList, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetSchedules } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const DAYS = ['월', '화', '수', '목', '금'];
const START_HOUR = 9;
const END_HOUR = 21;
const SLOT_H = 36;
const HOUR_H = SLOT_H * 2;

type Tab = 'timetable' | 'grades';

interface Semester { year: number; sem: string; }

const SEM_ORDER: Record<string, number> = {
  '1': 0, '여름계절': 1, '여름도약': 2, '2': 3, '겨울계절': 4, '겨울도약': 5,
};
const SEM_LABELS: Record<string, string> = {
  '1': '1학기', '여름계절': '여름계절수업', '여름도약': '여름도약수업',
  '2': '2학기', '겨울계절': '겨울계절수업', '겨울도약': '겨울도약수업',
};
const SEM_SHORT: Record<string, string> = {
  '1': '1학기', '여름계절': '여름계절', '여름도약': '여름도약',
  '2': '2학기', '겨울계절': '겨울계절', '겨울도약': '겨울도약',
};
const SEM_CODES = ['1', '여름계절', '여름도약', '2', '겨울계절', '겨울도약'] as const;
function formatSem(s: Semester) { return `${s.year}년 ${SEM_LABELS[s.sem] ?? s.sem}`; }
function sortSemesters(list: Semester[]): Semester[] {
  return [...list].sort((a, b) => {
    if (b.year !== a.year) return a.year - b.year;
    return (SEM_ORDER[a.sem] ?? 99) - (SEM_ORDER[b.sem] ?? 99);
  });
}

const PALETTE = ['#C4EBDC','#FFD6C4','#FFCFCF','#E6D9F3','#E8F5D8','#D0EBFA','#FDD6DC','#FEE6BF'];
function buildColorMap(subjects: string[]): Record<string, string> {
  const unique = Array.from(new Set(subjects));
  const map: Record<string, string> = {};
  unique.forEach((name, i) => { map[name] = PALETTE[i % PALETTE.length]; });
  return map;
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
  year?: number; semester?: string; credits?: number; category?: string;
}
interface Grade {
  id: number; subjectName: string; grade: string;
  credits: number; semester: string; year: number; category?: string;
  isRetake?: boolean;
}
const GRADE_POINTS: Record<string, number> = {
  'A+': 4.5, 'A': 4.0, 'A0': 4.0, 'B+': 3.5, 'B': 3.0, 'B0': 3.0,
  'C+': 2.5, 'C': 2.0, 'C0': 2.0, 'D+': 1.5, 'D': 1.0, 'D0': 1.0,
  'F': 0, 'P': 0, 'NP': 0,
};
const gradeColor = (g: string): string =>
  g === 'P' ? '#059669'
  : (GRADE_POINTS[g] ?? 0) >= 4 ? '#059669'
  : (GRADE_POINTS[g] ?? 0) >= 3 ? '#2563EB'
  : (GRADE_POINTS[g] ?? 0) >= 2 ? '#D97706'
  : (GRADE_POINTS[g] ?? 0) > 0 ? '#DC2626'
  : '#6B7280';
const GRADE_OPTIONS = ['A+', 'A0', 'B+', 'B0', 'C+', 'C0', 'D+', 'D0', 'F', 'P', 'NP'];
const MAJOR_CATEGORIES = ['전공필수', '전공기초', '전공선택'];
const CATEGORY_ORDER: Record<string, number> = {
  '전공기초': 0, '전공선택': 1, '전공필수': 2,
  '교양선택': 3, '교양필수': 4, '일반선택': 5,
};
const GRAD_REQS = [
  { label: '전공필수', color: '#2563EB', required: 39, categories: ['전공필수'] },
  { label: '전공기초', color: '#2563EB', required: 15, categories: ['전공기초'] },
  { label: '전공선택', color: '#2563EB', required: 21, categories: ['전공선택'] },
  { label: '효원핵심교양(교양필수)', color: '#7C3AED', required: 21, categories: ['효원핵심교양', '교양필수'] },
  { label: '효원균형·창의교양(교양선택)', color: '#7C3AED', required: 9, categories: ['효원균형교양', '효원창의교양', '교양선택'] },
  { label: '일반선택', color: '#374151', required: 30, categories: ['일반선택'] },
];
const TOTAL_GRAD = GRAD_REQS.reduce((s, r) => s + r.required, 0);
const ISU_OPTIONS = ['전공필수', '전공기초', '전공선택', '효원핵심교양', '효원균형교양', '효원창의교양', '일반선택', '교직과목'];
const YEAR_FILTERS = ['전체', '1학년', '2학년', '3학년', '4학년'];
function getCategoryFilters(year: number): string[] {
  if (year < 2025) {
    return ['전체', '전공필수', '전공기초', '전공선택', '교양필수', '교양선택', '일반선택', '교직과목'];
  }
  return ['전체', '전공필수', '전공기초', '전공선택', '효원핵심교양', '효원균형교양', '효원창의교양', '일반선택', '교직과목'];
}
const DAY_MAP: Record<string, number> = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };

// ── 한글 초성 인덱스 유틸 ──────────────────────────────────────────
const INITIALS = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function getInitial(str: string): string {
  const code = str.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return '#';
  const idx = Math.floor(code / (21 * 28));
  return INITIALS[Math.min(idx, INITIALS.length - 1)];
}
interface DeptSection { title: string; data: string[] }
function buildDeptSections(list: string[], query: string): DeptSection[] {
  const filtered = query ? list.filter(d => d.includes(query)) : list;
  if (query) return [{ title: '검색 결과', data: filtered }];
  const map = new Map<string, string[]>();
  for (const d of filtered) {
    const init = getInitial(d);
    if (!map.has(init)) map.set(init, []);
    map.get(init)!.push(d);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => INITIALS.indexOf(a) - INITIALS.indexOf(b))
    .map(([title, data]) => ({ title, data }));
}

// ── 시간 충돌 감지 ────────────────────────────────────────────────
function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = timeToMinutes(aStart), ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart), be = timeToMinutes(bEnd);
  return as < be && ae > bs;
}
function getConflicts(
  course: any,
  existing: Schedule[],
): string[] {
  const slots = parseTimeRoom(course.timeRoom || '', addMinutes);
  if (!slots.length) return [];
  const conflicts: string[] = [];
  for (const slot of slots) {
    for (const s of existing) {
      if (s.dayOfWeek === slot.dayOfWeek && timesOverlap(slot.startTime, slot.endTime, s.startTime, s.endTime)) {
        if (!conflicts.includes(s.subjectName)) conflicts.push(s.subjectName);
      }
    }
  }
  return conflicts;
}

function parseTimeRoom(timeRoom: string, addMinutesFn: (t: string, m: number) => string) {
  if (!timeRoom) return [];
  const parts = timeRoom.split(/,\s*(?=[월화수목금토일]\s)/);
  const results: { dayOfWeek: number; startTime: string; endTime: string; location: string }[] = [];
  for (const part of parts) {
    const dayMatch = part.match(/^([월화수목금토일])\s+(\d{1,2}:\d{2})/);
    if (!dayMatch) continue;
    const dayOfWeek = DAY_MAP[dayMatch[1]];
    const startTime = dayMatch[2].padStart(5, '0');
    const rangeMatch = part.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
    const durMatch = part.match(/(\d{1,2}:\d{2})\((\d+)\)/);
    let endTime: string;
    if (rangeMatch) {
      endTime = rangeMatch[2].padStart(5, '0');
    } else if (durMatch) {
      endTime = addMinutesFn(durMatch[1].padStart(5, '0'), parseInt(durMatch[2]));
    } else {
      endTime = addMinutesFn(startTime, 75);
    }
    const locMatch = part.match(/\d{2}:\d{2}(?:-\d{2}:\d{2}|\(\d+\))?\s+(.+)$/);
    let location = locMatch ? locMatch[1].replace(/\(외부\)\S*/g, '외부').trim() : '';
    results.push({ dayOfWeek, startTime, endTime, location });
  }
  return results;
}

// ── 학기별 평점 스파크라인 ────────────────────────────────────────
function Sparkline({ data, width = 180, height = 44 }: { data: { label: string; gpa: number }[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const gpas = data.map(d => d.gpa);
  const min = Math.max(0, Math.min(...gpas) - 0.3);
  const max = Math.min(4.5, Math.max(...gpas) + 0.3);
  const range = max - min || 1;
  const PAD = 6;
  const points = gpas.map((v, i) => ({
    x: PAD + (i / (gpas.length - 1)) * (width - PAD * 2),
    y: PAD + (1 - (v - min) / range) * (height - PAD * 2),
  }));
  const rising = gpas[gpas.length - 1] >= gpas[0];
  const lineColor = rising ? '#059669' : '#EF4444';
  return (
    <View style={{ width, height, position: 'relative' }}>
      {points.slice(0, -1).map((p, i) => {
        const n = points[i + 1];
        const dx = n.x - p.x; const dy = n.y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const mx = (p.x + n.x) / 2; const my = (p.y + n.y) / 2;
        return (
          <View key={i} style={{
            position: 'absolute',
            left: mx - len / 2, top: my - 1.5,
            width: len, height: 3, borderRadius: 2,
            backgroundColor: lineColor,
            transform: [{ rotate: `${angle}deg` }],
          }} />
        );
      })}
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        return (
          <View key={i} style={{
            position: 'absolute',
            left: p.x - (isLast ? 5 : 3.5),
            top: p.y - (isLast ? 5 : 3.5),
            width: isLast ? 10 : 7,
            height: isLast ? 10 : 7,
            borderRadius: isLast ? 5 : 3.5,
            backgroundColor: isLast ? lineColor : '#fff',
            borderWidth: isLast ? 2.5 : 2,
            borderColor: lineColor,
          }} />
        );
      })}
    </View>
  );
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : 0;

  const { token } = useAuth();
  const { colors } = useTheme();
  const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};

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
  const [newSemSem, setNewSemSem] = useState<string>('1');
  const [showAddSem, setShowAddSem] = useState(false);

  // 졸업요건 설정 (m값 편집 가능)
  const [gradReqRequired, setGradReqRequired] = useState<Record<string, number>>(
    Object.fromEntries(GRAD_REQS.map(r => [r.label, r.required]))
  );
  const [showGradSettings, setShowGradSettings] = useState(false);
  const [gradSettingsDraft, setGradSettingsDraft] = useState<Record<string, string>>({});
  const gradReqLoaded = useRef(false);

  // AsyncStorage 로드 (최초 1회)
  useEffect(() => {
    AsyncStorage.getItem('pium_grad_req_settings').then(val => {
      if (val) {
        try {
          const saved: Record<string, number> = JSON.parse(val);
          setGradReqRequired(prev => ({ ...prev, ...saved }));
        } catch {}
      }
      gradReqLoaded.current = true;
    });
  }, []);

  // gradReqRequired 변경 시 자동 저장 (로드 완료 후에만)
  useEffect(() => {
    if (!gradReqLoaded.current) return;
    AsyncStorage.setItem('pium_grad_req_settings', JSON.stringify(gradReqRequired));
  }, [gradReqRequired]);

  const openGradSettings = () => {
    setGradSettingsDraft(Object.fromEntries(
      GRAD_REQS.map(r => [r.label, String(gradReqRequired[r.label] ?? r.required)])
    ));
    setShowGradSettings(true);
  };

  const saveGradSettings = () => {
    const parsed: Record<string, number> = {};
    for (const [k, v] of Object.entries(gradSettingsDraft)) {
      const n = parseInt(v);
      if (!isNaN(n) && n >= 0) parsed[k] = n;
    }
    setGradReqRequired(prev => ({ ...prev, ...parsed }));
    setShowGradSettings(false);
  };

  const currentSem = semesters[selectedSemIdx] ?? initSem;
  const currentSemSchedules = (schedules as Schedule[]).filter(
    s => s.year === currentSem.year && s.semester === currentSem.sem
  );

  // 스케줄 데이터에서 학기 목록 자동 도출
  useEffect(() => {
    const all = (schedules as Schedule[]);
    if (all.length === 0) return;
    const map = new Map<string, Semester>();
    for (const s of all) {
      if (s.year && s.semester) {
        const key = `${s.year}-${s.semester}`;
        if (!map.has(key)) map.set(key, { year: s.year, sem: s.semester });
      }
    }
    const initKey = `${initSem.year}-${initSem.sem}`;
    if (!map.has(initKey)) map.set(initKey, initSem);
    const sorted = sortSemesters(Array.from(map.values()));
    setSemesters(prev => {
      const prevCurrent = prev[selectedSemIdx] ?? initSem;
      const newIdx = sorted.findIndex(s => s.year === prevCurrent.year && s.sem === prevCurrent.sem);
      setSelectedSemIdx(Math.max(0, newIdx));
      return sorted;
    });
  }, [schedules]);

  // Modal state
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [showCourseSearch, setShowCourseSearch] = useState(false);
  const [showDirectAdd, setShowDirectAdd] = useState(false);
  const [showAddGrade, setShowAddGrade] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);

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
  const categoryFilters = getCategoryFilters(currentSem.year);
  const [csDept, setCsDept] = useState('');
  const [csDeptSearch, setCsDeptSearch] = useState('');
  const [csYear, setCsYear] = useState('전체');
  const [csCategory, setCsCategory] = useState('전체');

  // 학기 연도 변경 시 유효하지 않은 카테고리 자동 초기화
  useEffect(() => {
    if (!getCategoryFilters(currentSem.year).includes(csCategory)) {
      setCsCategory('전체');
    }
  }, [currentSem.year]);
  const [csKeyword, setCsKeyword] = useState('');
  const [csProfessor, setCsProfessor] = useState('');
  const [csResults, setCsResults] = useState<any[]>([]);
  const [csLoading, setCsLoading] = useState(false);
  const [csSelected, setCsSelected] = useState<any[]>([]);
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [deptList, setDeptList] = useState<string[]>([]);
  const [deptsLoading, setDeptsLoading] = useState(false);
  const deptSectionListRef = useRef<SectionList<string>>(null);

  // Grade form
  const [gSubject, setGSubject] = useState('');
  const [gProf, setGProf] = useState('');
  const [gGrade, setGGrade] = useState('-');
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

  const SEASONAL_SEMS = ['여름계절', '겨울계절', '여름도약', '겨울도약'];

  useEffect(() => {
    if (showCourseSearch) {
      setCsDept('');
      setCsDeptSearch('');
      setCsYear('전체');
      setCsCategory('전체');
      setCsKeyword('');
      setCsResults([]);
      setCsSelected(null);
      fetchDepts(currentSem.year, currentSem.sem);
      // 계절·도약학기는 전체 과목 수가 적으므로 모달 열리자마자 자동 검색
      if (SEASONAL_SEMS.includes(currentSem.sem)) {
        searchCourses({ year: currentSem.year, sem: currentSem.sem });
      }
    }
  }, [showCourseSearch]);

  const toggleDay = (i: number) => {
    setDDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]);
  };

  const addScheduleDirect = async () => {
    if (!dName.trim() || dDays.length === 0) return;
    setDSubmitting(true);
    try {
      await Promise.all(dDays.map(d =>
        fetch(`${API}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            subjectName: dName.trim(), professor: dProf.trim(),
            location: dLoc.trim(), dayOfWeek: d,
            startTime: dStart, endTime: dEnd, credits: dCredit,
            year: currentSem.year, semester: currentSem.sem,
            category: dIsu,
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

  const deleteSchedule = (s: Schedule) => {
    Alert.alert('수업 삭제', '이 수업을 모든 요일에서 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        const toDelete = (schedules as Schedule[]).filter(sc =>
          sc.subjectName === s.subjectName &&
          sc.year === s.year &&
          sc.semester === s.semester
        );
        await Promise.all(toDelete.map(sc =>
          fetch(`${API}/schedule/${sc.id}`, { method: 'DELETE', headers: { ...authHeader } })
        ));
        refetch();
      }},
    ]);
  };

  const fetchDepts = useCallback(async (year: number, sem: string) => {
    setDeptsLoading(true);
    try {
      const r = await fetch(`${API}/courses/departments?catalogYear=${year}&catalogSemester=${sem}`);
      if (r.ok) setDeptList(await r.json());
    } catch {}
    finally { setDeptsLoading(false); }
  }, []);

  const searchCourses = async (overrideSem?: { year: number; sem: string }) => {
    Keyboard.dismiss();
    const semCtx = overrideSem ?? currentSem;
    // 필터가 하나도 없을 때: 계절·도약학기는 전체 조회 허용, 정규학기는 막음
    const hasFilter = !!(csDept || csKeyword || csProfessor || csCategory !== '전체' || csYear !== '전체');
    if (!hasFilter && !SEASONAL_SEMS.includes(semCtx.sem)) return;
    setCsLoading(true);
    setCsSelected([]);
    try {
      const params = new URLSearchParams();
      params.set('catalogYear', String(semCtx.year));
      params.set('catalogSemester', semCtx.sem);
      if (csDept) params.set('dept', csDept);
      if (csYear !== '전체') params.set('gradeYear', csYear.replace('학년', ''));
      if (csCategory !== '전체') params.set('category', csCategory);
      if (csKeyword) params.set('search', csKeyword);
      if (csProfessor) params.set('professor', csProfessor);
      const r = await fetch(`${API}/courses?${params}`);
      if (r.ok) setCsResults(await r.json());
      else setCsResults([]);
    } catch {
      setCsResults([]);
    }
    finally { setCsLoading(false); }
  };

  const addCourseFromSearch = async () => {
    if (csSelected.length === 0) return;
    const validCourses = csSelected.filter(c => parseTimeRoom(c.timeRoom || '', addMinutes).length > 0);
    const noTime = csSelected.filter(c => parseTimeRoom(c.timeRoom || '', addMinutes).length === 0);
    if (noTime.length > 0 && validCourses.length === 0) {
      Alert.alert('시간 정보 없음', '선택한 강의에 시간표 정보가 없습니다.\n직접 추가를 이용해 주세요.');
      return;
    }
    try {
      await Promise.all(validCourses.flatMap(course => {
        const slots = parseTimeRoom(course.timeRoom || '', addMinutes);
        return slots.map(slot =>
          fetch(`${API}/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({
              subjectName: course.subjectName,
              professor: course.professor || '',
              location: slot.location || '',
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              credits: course.credits || 0,
              year: currentSem.year,
              semester: currentSem.sem,
              category: course.category || '',
            }),
          })
        );
      }));
      await refetch();
      setShowCourseSearch(false);
      setCsSelected([]);
      if (noTime.length > 0) Alert.alert('일부 추가됨', `시간 정보 없는 ${noTime.map(c => c.subjectName).join(', ')} 은(는) 제외됐습니다.`);
    } catch { Alert.alert('오류', '수업 추가 실패'); }
  };

  const addSemester = () => {
    const y = parseInt(newSemYear, 10);
    if (!y || y < 2000 || y > 2100) { Alert.alert('오류', '올바른 연도를 입력하세요'); return; }
    const exists = semesters.some(s => s.year === y && s.sem === newSemSem);
    if (exists) { Alert.alert('이미 존재', '이미 추가된 학기입니다'); return; }
    const newS: Semester = { year: y, sem: newSemSem };
    const sorted = sortSemesters([...semesters, newS]);
    setSemesters(sorted);
    const newIdx = sorted.findIndex(s => s.year === newS.year && s.sem === newS.sem);
    setSelectedSemIdx(Math.max(0, newIdx));
    setShowAddSem(false);
  };

  const deleteSemester = (idx: number) => {
    const target = semesters[idx];
    const label = formatSem(target);
    const semSchedules = (schedules as Schedule[]).filter(
      s => s.year === target.year && s.semester === target.sem
    );
    const msg = semSchedules.length > 0
      ? `${label} 시간표와 수업 ${semSchedules.length}개가 모두 삭제됩니다.`
      : `${label} 시간표를 삭제하시겠습니까?`;
    Alert.alert('학기 삭제', msg, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await Promise.all(
          semSchedules.map(s => fetch(`${API}/schedule/${s.id}`, { method: 'DELETE', headers: { ...authHeader } }))
        );
        setSemesters(prev => {
          const next = prev.filter((_, i) => i !== idx);
          setSelectedSemIdx(i => {
            if (i === idx) return Math.max(0, idx - 1);
            if (i > idx) return i - 1;
            return i;
          });
          return next;
        });
        refetch();
      }},
    ]);
  };

  const addGrade = async () => {
    if (!gSubject.trim()) return;

    setGSubmitting(true);
    try {
      const r = await fetch(`${API}/grades`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectName: gSubject.trim(), grade: gGrade, credits: Number(gCredits), semester: gSemester, year: Number(gYear) }),
      });
      if (r.ok) {
        const ng = await r.json();
        setGrades(prev => [...prev, ng]);
        setGSubject(''); setGProf(''); setGGrade('-'); setGCredits('3'); setGSemester('1');
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

  const updateGradeValue = async (id: number, newGrade: string) => {
    try {
      const res = await fetch(`${API}/grades/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: newGrade }),
      });
      if (!res.ok) throw new Error();
      setGrades(prev => prev.map(g => g.id === id ? { ...g, grade: newGrade } : g));
      setEditingGrade(prev => prev ? { ...prev, grade: newGrade } : null);
    } catch {
      Alert.alert('오류', '학점 변경 실패');
    }
  };

  const toggleRetake = async (id: number, newVal: boolean) => {
    try {
      const res = await fetch(`${API}/grades/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRetake: newVal }),
      });
      if (!res.ok) throw new Error();
      setGrades(prev => prev.map(g => g.id === id ? { ...g, isRetake: newVal } : g));
      setEditingGrade(prev => prev ? { ...prev, isRetake: newVal } : null);
    } catch {
      Alert.alert('오류', '재수강 변경 실패');
    }
  };

  const [gradeSyncing, setGradeSyncing] = useState(false);

  const syncGradesWithSchedule = useCallback(async () => {
    if (gradeSyncing) return;
    setGradeSyncing(true);
    try {
      const allSchedules = schedules as Schedule[];

      // 시간표에서 고유 과목 목록 추출 (year+semester+subjectName 기준)
      const seen = new Set<string>();
      const uniqueSubjects: { year: number; semester: string; subject: string; professor: string; credits: number; category?: string }[] = [];
      for (const s of allSchedules) {
        if (!s.year || !s.semester) continue;
        const key = `${s.year}-${s.semester}-${s.subjectName}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueSubjects.push({
            year: s.year, semester: s.semester,
            subject: s.subjectName, professor: s.professor || '',
            credits: s.credits ?? 3,
            category: s.category,
          });
        }
      }

      // 현재 성적 목록 조회 (최신)
      const gRes = await fetch(`${API}/grades`);
      const currentGrades: Grade[] = gRes.ok ? await gRes.json() : grades;

      const gradeKeyMap = new Map<string, number>(
        currentGrades.map(g => [`${g.year}-${g.semester}-${g.subjectName}`, g.id])
      );
      const scheduleKeySet = new Set(uniqueSubjects.map(s => `${s.year}-${s.semester}-${s.subject}`));

      // 추가: 시간표에 있지만 성적에 없는 과목
      await Promise.all(
        uniqueSubjects
          .filter(s => !gradeKeyMap.has(`${s.year}-${s.semester}-${s.subject}`))
          .map(s => fetch(`${API}/grades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subjectName: s.subject, grade: 'A+', credits: s.credits, semester: s.semester, year: s.year, category: s.category }),
          }))
      );

      // credits 불일치 업데이트: 시간표 학점 ≠ 성적 학점인 기존 레코드 수정
      await Promise.all(
        uniqueSubjects
          .filter(s => {
            const id = gradeKeyMap.get(`${s.year}-${s.semester}-${s.subject}`);
            if (!id) return false;
            const existing = currentGrades.find(g => g.id === id);
            return existing && Math.abs(existing.credits - s.credits) > 0.001;
          })
          .map(s => {
            const id = gradeKeyMap.get(`${s.year}-${s.semester}-${s.subject}`)!;
            return fetch(`${API}/grades/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credits: s.credits }),
            });
          })
      );

      // 삭제: 성적에는 있지만 시간표에 없는 과목
      await Promise.all(
        currentGrades
          .filter(g => !scheduleKeySet.has(`${g.year}-${g.semester}-${g.subjectName}`))
          .map(g => fetch(`${API}/grades/${g.id}`, { method: 'DELETE' }))
      );

      await fetchGrades();
    } catch { Alert.alert('오류', '동기화 실패'); }
    finally { setGradeSyncing(false); }
  }, [gradeSyncing, schedules, grades, fetchGrades]);

  const [openSems, setOpenSems] = useState<Set<string>>(new Set());
  const toggleSemCollapse = (key: string) => setOpenSems(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // isRetake=true: 재수강으로 대체된 구 성적 → 평점·이수학점 제외
  const activeGrades = grades.filter(g => !g.isRetake);
  const eligible = activeGrades.filter(g => g.grade !== 'P' && g.grade !== 'NP');
  const totalCredits = eligible.reduce((s, g) => s + g.credits, 0);
  const weightedSum = eligible.reduce((s, g) => s + (GRADE_POINTS[g.grade] ?? 0) * g.credits, 0);
  const gpa = totalCredits > 0 ? (weightedSum / totalCredits).toFixed(2) : '—';
  const totalCreditCount = activeGrades.reduce((s, g) => s + g.credits, 0);
  // 전공평점: 전공필수/기초/선택만
  const majorEligible = eligible.filter(g => g.category && MAJOR_CATEGORIES.includes(g.category));
  const majorCredits = majorEligible.reduce((s, g) => s + g.credits, 0);
  const majorGpa = majorCredits > 0
    ? (majorEligible.reduce((s, g) => s + (GRADE_POINTS[g.grade] ?? 0) * g.credits, 0) / majorCredits).toFixed(2)
    : '—';

  // 학기별 평점 추이 (스파크라인용, 오래된 순 정렬)
  const semesterGpas = React.useMemo(() => {
    const map = new Map<string, { year: number; sem: string; gpas: number[] }>();
    for (const g of grades) {
      if (g.isRetake || g.grade === 'P' || g.grade === 'NP') continue;
      const key = `${g.year}-${g.semester}`;
      if (!map.has(key)) map.set(key, { year: g.year, sem: g.semester, gpas: [] });
      const raw = GRADE_POINTS[g.grade];
      if (raw !== undefined) map.get(key)!.gpas.push(raw);
    }
    return Array.from(map.values())
      .filter(v => v.gpas.length > 0)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return (SEM_ORDER[a.sem] ?? 99) - (SEM_ORDER[b.sem] ?? 99);
      })
      .map(v => ({
        label: `${v.year} ${SEM_SHORT[v.sem] ?? v.sem}`,
        gpa: parseFloat((v.gpas.reduce((s, p) => s + p, 0) / v.gpas.length).toFixed(2)),
      }));
  }, [grades]);

  // 졸업요건 이수학점: schedules의 category 기준으로 중복 제거 후 계산
  const earnedByCategory: Record<string, number> = {};
  const seenSchedKeys = new Set<string>();
  for (const s of (schedules as Schedule[])) {
    if (!s.category || !s.credits || !s.year || !s.semester) continue;
    const key = `${s.year}-${s.semester}-${s.subjectName}`;
    if (seenSchedKeys.has(key)) continue;
    seenSchedKeys.add(key);
    earnedByCategory[s.category] = (earnedByCategory[s.category] || 0) + s.credits;
  }
  const getEarned = (req: typeof GRAD_REQS[0]) =>
    req.categories.reduce((s, cat) => s + (earnedByCategory[cat] || 0), 0);
  const getRequired = (req: typeof GRAD_REQS[0]) => gradReqRequired[req.label] ?? req.required;
  const totalRequired = GRAD_REQS.reduce((s, req) => s + getRequired(req), 0);
  const totalEarned = GRAD_REQS.reduce((s, req) => s + Math.min(getEarned(req), getRequired(req)), 0);

  const totalSlots = (END_HOUR - START_HOUR) * 2;
  const totalH = totalSlots * SLOT_H;

  const curSemScheds = (schedules as Schedule[]).filter(
    s => s.year === currentSem.year && s.semester === currentSem.sem
  );
  const hasSaturday = curSemScheds.some(s => s.dayOfWeek === 5);
  const displayDays = hasSaturday ? ['월', '화', '수', '목', '금', '토'] : DAYS;

  const TabBar = () => (
    <View style={[styles.segContainer, { borderColor: colors.border }]}>
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
    <View style={[styles.root, { paddingTop: topPad, backgroundColor: colors.background }]}>
      {tab === 'timetable' ? (
        <>
          <View style={[styles.ttHeader, { backgroundColor: colors.background }]}>
            <View>
              <Text style={[styles.envLabel, { color: colors.textSecondary }]}>시간 관리</Text>
              <Text style={[styles.ttTitle, { color: colors.text }]}>{formatSem(currentSem)} <Text style={{ color: C.primary }}>시간표</Text></Text>
            </View>
            <View style={styles.ttHeaderRight}>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.inputBg }]} onPress={() => setShowSemModal(true)}>
                <Feather name="list" size={18} color={colors.textSecondary} />
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
              {displayDays.map(d => (
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
              {(() => {
                const curScheds = (schedules as Schedule[]).filter(
                  s => s.year === currentSem.year && s.semester === currentSem.sem
                );
                const colorMap = buildColorMap(curScheds.map(s => s.subjectName));
                return displayDays.map((_, dayIdx) => {
                const daySch = curScheds.filter(s => s.dayOfWeek === dayIdx);
                return (
                  <View key={dayIdx} style={[styles.dayCol, { height: totalH }]}>
                    {Array.from({ length: totalSlots }, (_, i) => (
                      <View key={i} style={[styles.slot, { height: SLOT_H, borderTopColor: i % 2 === 0 ? '#E5E7EB' : '#F3F4F6' }]} />
                    ))}
                    {daySch.map(s => {
                      const y = minutesToY(timeToMinutes(s.startTime));
                      const h = ((timeToMinutes(s.endTime) - timeToMinutes(s.startTime)) / 30) * SLOT_H;
                      const color = colorMap[s.subjectName] ?? PALETTE[0];
                      return (
                        <TouchableOpacity key={s.id}
                          style={[styles.block, { top: y, height: Math.max(h, SLOT_H), backgroundColor: color }]}
                          onLongPress={() => deleteSchedule(s)} activeOpacity={0.8}>
                          <Text style={[styles.blockName, { color: '#1F2937' }]} numberOfLines={2}>{s.subjectName}</Text>
                          {h > SLOT_H && s.location ? <Text style={[styles.blockLoc, { color: '#4B5563' }]} numberOfLines={1}>{s.location}</Text> : null}
                          {h > SLOT_H && s.professor ? <Text style={[styles.blockLoc, { color: '#6B7280' }]} numberOfLines={1}>{s.professor}</Text> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })
              })()}
            </View>
            {(schedules as Schedule[]).filter(s => s.year === currentSem.year && s.semester === currentSem.sem).length === 0 && !isLoading && (
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
            <View>
              <Text style={[styles.envLabel, { color: colors.textSecondary }]}>시간 관리</Text>
              <Text style={[styles.gradeTitle, { color: colors.text }]}>학기별 <Text style={{ color: C.primary }}>성적 관리</Text></Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: colors.inputBg }]}
                onPress={openGradSettings}
                activeOpacity={0.7}
              >
                <Feather name="sliders" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: colors.inputBg }]}
                onPress={syncGradesWithSchedule}
                disabled={gradeSyncing}
                activeOpacity={0.7}
              >
                {gradeSyncing
                  ? <ActivityIndicator size="small" color={C.primary} />
                  : <Feather name="refresh-cw" size={18} color={colors.textSecondary} />
                }
              </TouchableOpacity>
            </View>
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
                    <Ionicons name="ribbon-outline" size={22} color={C.primary} style={{ marginBottom: 2 }} />
                    <Text style={[styles.statValue, { fontSize: 22 }]}>{gpa}</Text>
                    <Text style={styles.statLabel}>전체 평점</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Ionicons name="book-outline" size={22} color="#7C3AED" style={{ marginBottom: 2 }} />
                    <Text style={[styles.statValue, { fontSize: 22, color: '#7C3AED' }]}>{majorGpa}</Text>
                    <Text style={styles.statLabel}>전공 평점</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Ionicons name="school-outline" size={22} color={C.primary} style={{ marginBottom: 2 }} />
                    <Text style={[styles.statValue, { fontSize: 22 }]}>{totalCreditCount}</Text>
                    <Text style={styles.statLabel}>이수학점/{totalRequired}</Text>
                  </View>
                </View>

                {/* 학기별 평점 추이 스파크라인 */}
                {semesterGpas.length >= 2 && (() => {
                  const gpas = semesterGpas.map(d => d.gpa);
                  const rising = gpas[gpas.length - 1] >= gpas[0];
                  const diff = (gpas[gpas.length - 1] - gpas[0]).toFixed(2);
                  const trendColor = rising ? '#059669' : '#EF4444';
                  return (
                    <View style={styles.sparkCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sparkTitle}>학기별 평점 추이</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                          <Text style={[styles.sparkTrend, { color: trendColor }]}>
                            {rising ? '▲' : '▼'} {Math.abs(parseFloat(diff)).toFixed(2)}
                          </Text>
                          <Text style={styles.sparkSub}>
                            ({semesterGpas[0].label} → {semesterGpas[semesterGpas.length - 1].label})
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          {semesterGpas.map((d, i) => (
                            <View key={i} style={{ alignItems: 'center' }}>
                              <Text style={{ fontSize: 9, color: '#9CA3AF', fontFamily: 'Inter_400Regular' }}>{d.label.split(' ')[1] ?? ''}</Text>
                              <Text style={{ fontSize: 11, color: '#374151', fontFamily: 'Inter_600SemiBold' }}>{d.gpa}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <Sparkline data={semesterGpas} width={130} height={52} />
                    </View>
                  );
                })()}

                <View style={styles.gradReqCard}>
                  <TouchableOpacity style={styles.gradReqHeader} onPress={() => setGradReqOpen(o => !o)}>
                    <View style={styles.gradReqTitleRow}>
                      <Ionicons name="trending-up-outline" size={16} color="#374151" />
                      <Text style={styles.gradReqTitle}>졸업요건 이수현황</Text>
                      <View style={styles.gradReqBadge}><Text style={styles.gradReqBadgeText}>{totalEarned}/{totalRequired}학점</Text></View>
                    </View>
                    <Ionicons name={gradReqOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                  {gradReqOpen && (
                    <View style={styles.gradReqBody}>
                      {GRAD_REQS.map((req, i) => {
                        const earned = getEarned(req);
                        const reqCr = getRequired(req);
                        const done = earned >= reqCr;
                        const pct = reqCr > 0 ? Math.min(100, (earned / reqCr) * 100) : 0;
                        const barColor = done ? '#059669' : req.color;
                        return (
                          <View key={req.label} style={[styles.gradReqRow, i === GRAD_REQS.length - 1 && { borderBottomWidth: 0 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                              <Text style={[styles.gradReqLabel, { color: done ? '#059669' : req.color }]}>{req.label}</Text>
                              <Text style={[styles.gradReqValue, done && { color: '#059669', fontFamily: 'Inter_600SemiBold' }]}>
                                {earned}/{reqCr}학점{done ? ' ✓' : ''}
                              </Text>
                            </View>
                            <View style={styles.progTrack}>
                              <View style={[styles.progFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                            </View>
                          </View>
                        );
                      })}
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
                    }, {} as Record<string, Grade[]>))
                    .sort(([a], [b]) => {
                      const [ay, as_] = a.split('-'); const [by, bs] = b.split('-');
                      if (ay !== by) return parseInt(ay) - parseInt(by);
                      return (SEM_ORDER[as_] ?? 99) - (SEM_ORDER[bs] ?? 99);
                    })
                    .map(([key, gs]) => {
                      const sorted_gs = [...gs].sort((a, b) => {
                        const ca = CATEGORY_ORDER[a.category ?? ''] ?? 99;
                        const cb = CATEGORY_ORDER[b.category ?? ''] ?? 99;
                        if (ca !== cb) return ca - cb;
                        return a.subjectName.localeCompare(b.subjectName, 'ko-KR');
                      });
                      const [year, sem] = key.split('-');
                      const collapsed = !openSems.has(key);
                      const semEl = gs.filter(g => !g.isRetake && g.grade !== 'P' && g.grade !== 'NP');
                      const semTotalCr = semEl.reduce((s, g) => s + g.credits, 0);
                      const semGpa = semTotalCr > 0
                        ? (semEl.reduce((s, g) => s + (GRADE_POINTS[g.grade] ?? 0) * g.credits, 0) / semTotalCr).toFixed(2)
                        : '—';
                      const semTotalCredits = gs.filter(g => !g.isRetake).reduce((s, g) => s + g.credits, 0);
                      return (
                        <View key={key} style={styles.semesterGroup}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                            onPress={() => toggleSemCollapse(key)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.semesterTitle}>{year}년 {SEM_LABELS[sem] ?? sem}</Text>
                              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1, fontFamily: 'Inter_400Regular' }}>
                                평점 {semGpa} · {semTotalCredits}학점
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontSize: 12, color: C.primary, fontFamily: 'Inter_500Medium' }}>
                                {collapsed ? '자세히보기' : '닫기'}
                              </Text>
                              <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={14} color={C.primary} />
                            </View>
                          </TouchableOpacity>
                          {!collapsed && sorted_gs.map(g => {
                            const gc = gradeColor(g.grade);
                            return (
                              <View key={g.id} style={[styles.gradeRow, g.isRetake && { opacity: 0.5, backgroundColor: '#F9FAFB' }]}>
                                <View style={styles.gradeInfo}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Text style={[styles.gradeSubject, g.isRetake && { textDecorationLine: 'line-through', color: '#9CA3AF' }]}>{g.subjectName}</Text>
                                    {g.isRetake && (
                                      <View style={[styles.retakeBadge, { backgroundColor: '#E5E7EB' }]}>
                                        <Text style={[styles.retakeBadgeText, { color: '#6B7280' }]}>재수강됨</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.gradeMeta}>
                                    {g.credits}학점{g.category ? ` · ${g.category}` : ''}{g.isRetake ? ' · 평점 제외' : ''}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  onPress={() => setEditingGrade(g)}
                                  style={[styles.gradeBadge, { backgroundColor: gc + '18' }]}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.gradeBadgeText, { color: gc }]}>{g.grade}</Text>
                                  <Ionicons name="pencil" size={9} color={gc} style={{ marginLeft: 2 }} />
                                </TouchableOpacity>
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

      {/* ── 졸업요건 설정 Modal ── */}
      <Modal visible={showGradSettings} transparent animationType="slide" onRequestClose={() => setShowGradSettings(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              {/* 헤더 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: 0 }]}>졸업 필요학점 설정</Text>
                <TouchableOpacity onPress={() => setShowGradSettings(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'Inter_400Regular', marginBottom: 16 }}>
                학과별로 다를 수 있어요. 숫자를 탭해 직접 입력하세요.
              </Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {GRAD_REQS.map((req, idx) => {
                  const val = gradSettingsDraft[req.label] ?? String(gradReqRequired[req.label] ?? req.required);
                  return (
                    <View key={req.label} style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingVertical: 12,
                      borderBottomWidth: idx < GRAD_REQS.length - 1 ? 1 : 0,
                      borderBottomColor: colors.inputBg,
                    }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: req.color, marginRight: 10 }} />
                      <Text style={{ flex: 1, fontSize: 13, color: colors.text, fontFamily: 'Inter_500Medium', flexWrap: 'wrap' }}>{req.label}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TextInput
                          style={{
                            width: 52, textAlign: 'center',
                            fontSize: 17, color: colors.text,
                            fontFamily: 'Inter_700Bold',
                            paddingVertical: 4, paddingHorizontal: 4,
                            borderBottomWidth: 2,
                            borderBottomColor: val !== String(gradReqRequired[req.label] ?? req.required) ? C.primary : colors.border,
                            backgroundColor: 'transparent',
                          }}
                          value={val}
                          onChangeText={v => setGradSettingsDraft(prev => ({ ...prev, [req.label]: v.replace(/[^0-9]/g, '') }))}
                          keyboardType="number-pad"
                          selectTextOnFocus
                          returnKeyType="done"
                        />
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'Inter_400Regular' }}>학점</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              {/* 저장 버튼 — 변경사항 있을 때만 활성화 */}
              {(() => {
                const hasChanges = GRAD_REQS.some(req => {
                  const draft = parseInt(gradSettingsDraft[req.label] ?? '');
                  const current = gradReqRequired[req.label] ?? req.required;
                  return !isNaN(draft) && draft !== current;
                });
                return (
                  <TouchableOpacity
                    style={[styles.addBtn, { marginTop: 16, opacity: hasChanges ? 1 : 0.4 }]}
                    onPress={hasChanges ? saveGradSettings : undefined}
                    activeOpacity={hasChanges ? 0.8 : 1}
                  >
                    <Text style={styles.addBtnText}>저장</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 시간표 관리 Modal ── */}
      <Modal visible={showSemModal} transparent animationType="slide" onRequestClose={() => setShowSemModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSemModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>시간표 관리</Text>
              <TouchableOpacity style={styles.closeCircle} onPress={() => setShowSemModal(false)}>
                <Feather name="x" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {semesters.map((s, i) => (
                <View key={i} style={[styles.semRow, selectedSemIdx === i && styles.semRowActive]}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
                    onPress={() => { setSelectedSemIdx(i); setShowSemModal(false); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={18} color={selectedSemIdx === i ? '#fff' : C.primary} />
                    <Text style={[styles.semRowText, selectedSemIdx === i && { color: '#fff' }]}>{formatSem(s)}</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {selectedSemIdx === i && <Feather name="check" size={16} color="#fff" />}
                    {semesters.length > 1 && (
                      <TouchableOpacity
                        onPress={() => deleteSemester(i)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="trash-2" size={16} color={selectedSemIdx === i ? 'rgba(255,255,255,0.7)' : '#EF4444'} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
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
                <View style={[styles.semSemRow, { flexWrap: 'wrap' }]}>
                  {SEM_CODES.map(s => (
                    <TouchableOpacity key={s} style={[styles.semSemChip, newSemSem === s && styles.semSemChipActive, { paddingVertical: 9 }]} onPress={() => setNewSemSem(s)}>
                      <Text style={[styles.semSemText, newSemSem === s && styles.semSemTextActive, { fontSize: 12 }]}>{SEM_SHORT[s]}</Text>
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
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 수업 추가 방식 선택 Modal ── */}
      <Modal visible={showAddMethod} transparent animationType="slide" onRequestClose={() => setShowAddMethod(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddMethod(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>수업 추가</Text>
            <TouchableOpacity style={styles.methodRow} onPress={() => {
                setShowAddMethod(false);
                setCsKeyword('');
                setCsProfessor('');
                setCsDept('');
                setCsDeptSearch('');
                setCsYear('전체');
                setCsCategory('전체');
                setCsResults([]);
                setCsSelected([]);
                setShowCourseSearch(true);
              }}>
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
          <View style={[styles.modalSheetFull, { height: '92%', paddingBottom: insets.bottom + 16 }]}>
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

            {/* Keyword search */}
            <View style={styles.csSearchRow}>
              <Feather name="search" size={14} color="#9CA3AF" />
              <TextInput
                style={styles.csSearchInput}
                value={csKeyword}
                onChangeText={setCsKeyword}
                placeholder="과목명으로 검색"
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={() => searchCourses()}
                returnKeyType="search"
              />
              {csKeyword ? (
                <TouchableOpacity onPress={() => setCsKeyword('')}>
                  <Feather name="x-circle" size={14} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Professor search */}
            <View style={[styles.csSearchRow, { marginTop: 0 }]}>
              <Feather name="user" size={14} color="#9CA3AF" />
              <TextInput
                style={styles.csSearchInput}
                value={csProfessor}
                onChangeText={setCsProfessor}
                placeholder="교수명으로 검색"
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={() => searchCourses()}
                returnKeyType="search"
              />
              {csProfessor ? (
                <TouchableOpacity onPress={() => setCsProfessor('')}>
                  <Feather name="x-circle" size={14} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Year filter */}
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                {YEAR_FILTERS.map(y => (
                  <TouchableOpacity key={y} style={[styles.filterChip, csYear === y && styles.filterChipActive]} onPress={() => setCsYear(y)}>
                    <Text style={[styles.filterChipText, csYear === y && styles.filterChipTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Category filter */}
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                {categoryFilters.map(c => (
                  <TouchableOpacity key={c} style={[styles.filterChip, csCategory === c && styles.filterChipActive]} onPress={() => setCsCategory(c)}>
                    <Text style={[styles.filterChipText, csCategory === c && styles.filterChipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Search button */}
            <TouchableOpacity
              style={{ backgroundColor: C.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginBottom: 8 }}
              onPress={() => searchCourses()}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' }}>검색</Text>
            </TouchableOpacity>

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
                csResults.map((course, i) => {
                  const isSelected = (csSelected ?? []).some(c => c.id === course.id);
                  const conflicts = getConflicts(course, currentSemSchedules);
                  const hasConflict = conflicts.length > 0;
                  return (
                  <TouchableOpacity key={i}
                    style={[styles.courseRow, isSelected && styles.courseRowSelected, hasConflict && styles.courseRowConflict]}
                    onPress={() => setCsSelected(prev => (prev ?? []).filter(c => c.id !== course.id).concat(isSelected ? [] : [course]))}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={[styles.courseName, { flex: 1 }, isSelected && { color: C.primary }]} numberOfLines={2}>{course.subjectName}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.courseMeta, { marginLeft: 8 }]}>{course.credits}학점</Text>
                        {isSelected && <Feather name="check-circle" size={16} color={C.primary} />}
                      </View>
                    </View>
                    <Text style={styles.courseMeta}>{[course.professor, course.offeringDept, course.category].filter(Boolean).join(' · ')}</Text>
                    {course.timeRoom ? <Text style={[styles.courseMeta, { color: '#9CA3AF', fontSize: 11 }]} numberOfLines={1}>{course.timeRoom}</Text> : null}
                    {hasConflict && (
                      <View style={styles.conflictBadge}>
                        <Feather name="alert-triangle" size={11} color="#DC2626" />
                        <Text style={styles.conflictBadgeText}>
                          시간 겹침 · {conflicts.slice(0, 2).join(', ')}{conflicts.length > 2 ? ` 외 ${conflicts.length - 2}개` : ''}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {(csSelected?.length ?? 0) > 0 && (
              <View style={{ backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: C.primary }}>{csSelected.length}개 선택됨</Text>
                  <TouchableOpacity onPress={() => setCsSelected([])}>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' }}>초기화</Text>
                  </TouchableOpacity>
                </View>
                {csSelected.map((c, i) => (
                  <Text key={i} style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#374151' }} numberOfLines={1}>· {c.subjectName}</Text>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={[styles.btn, { marginHorizontal: 0, opacity: (csSelected?.length ?? 0) > 0 ? 1 : 0.5 }]}
              onPress={addCourseFromSearch}
              disabled={(csSelected?.length ?? 0) === 0}
            >
              <Text style={styles.btnText}>{(csSelected?.length ?? 0) > 0 ? `${csSelected.length}개 시간표에 추가` : '수업을 선택하세요'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dept picker – SectionList + 초성 인덱스 바 */}
        <Modal visible={showDeptPicker} transparent animationType="fade" onRequestClose={() => setShowDeptPicker(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDeptPicker(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { maxHeight: '80%' }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>학과/학부 선택</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, marginHorizontal: 16, marginBottom: 8 }}>
                <Feather name="search" size={14} color="#9CA3AF" />
                <TextInput
                  style={{ flex: 1, paddingVertical: 8, paddingLeft: 8, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#111827' }}
                  value={csDeptSearch}
                  onChangeText={setCsDeptSearch}
                  placeholder="학과 검색"
                  placeholderTextColor="#9CA3AF"
                />
                {csDeptSearch ? (
                  <TouchableOpacity onPress={() => setCsDeptSearch('')}>
                    <Feather name="x-circle" size={14} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}
              </View>
              {deptsLoading ? (
                <ActivityIndicator color={C.primary} style={{ marginTop: 20 }} />
              ) : (() => {
                const sections = buildDeptSections(deptList, csDeptSearch);
                const sectionInitials = sections.map(s => s.title);
                return (
                  <View style={{ height: 380, flexDirection: 'row' }}>
                    <SectionList
                      ref={deptSectionListRef}
                      sections={sections}
                      keyExtractor={(item, i) => item + i}
                      style={{ flex: 1 }}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      stickySectionHeadersEnabled
                      renderSectionHeader={({ section }) => (
                        <View style={styles.deptSectionHeader}>
                          <Text style={styles.deptSectionHeaderText}>{section.title}</Text>
                        </View>
                      )}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.deptRow, csDept === item && styles.deptRowActive]}
                          onPress={() => { setCsDept(item); setCsDeptSearch(''); setShowDeptPicker(false); }}
                        >
                          <Text style={[styles.deptText, csDept === item && { color: C.primary, fontFamily: 'Inter_600SemiBold' }]}>{item}</Text>
                          {csDept === item && <Feather name="check" size={16} color={C.primary} />}
                        </TouchableOpacity>
                      )}
                      ListEmptyComponent={
                        <View style={{ alignItems: 'center', paddingTop: 40 }}>
                          <Feather name="search" size={32} color="#D1D5DB" />
                          <Text style={{ fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 8 }}>검색 결과가 없습니다</Text>
                        </View>
                      }
                    />
                    {/* 우측 초성 인덱스 바 */}
                    {!csDeptSearch && (
                      <View style={styles.indexBar}>
                        {sectionInitials.map((initial, si) => (
                          <TouchableOpacity
                            key={initial}
                            style={styles.indexBarItem}
                            onPress={() => {
                              deptSectionListRef.current?.scrollToLocation({
                                sectionIndex: si,
                                itemIndex: 0,
                                animated: true,
                                viewOffset: 0,
                              });
                            }}
                          >
                            <Text style={styles.indexBarText}>{initial}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })()}
            </TouchableOpacity>
          </TouchableOpacity>
          </KeyboardAvoidingView>
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
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {(dCredit !== null && ![1, 1.5, 2, 3, 4].includes(dCredit)
                      ? [dCredit, 1, 1.5, 2, 3, 4]
                      : [1, 1.5, 2, 3, 4]
                    ).map(n => (
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
            <Text style={styles.dLabel}>성적</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* 미선택 '-' 칩 */}
                <TouchableOpacity
                  key="-"
                  style={[styles.dayChip, gGrade === '-' && { borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' }]}
                  onPress={() => setGGrade('-')}
                >
                  <Text style={[styles.dayChipText, { color: gGrade === '-' ? '#9CA3AF' : '#9CA3AF' }]}>-</Text>
                </TouchableOpacity>
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

      {/* 학점 편집 바텀시트 */}
      <Modal visible={!!editingGrade} transparent animationType="slide" onRequestClose={() => setEditingGrade(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>학점 변경</Text>
            {editingGrade && (
              <>
                <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 16 }}>
                  {editingGrade.subjectName}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
                  {GRADE_OPTIONS.map(g => {
                    const pts = GRADE_POINTS[g];
                    const isSelected = editingGrade.grade === g;
                    const gc = gradeColor(g);
                    return (
                      <TouchableOpacity
                        key={g}
                        onPress={() => updateGradeValue(editingGrade.id, g)}
                        style={{
                          width: 62, alignItems: 'center', paddingVertical: 10, borderRadius: 14,
                          backgroundColor: isSelected ? gc : gc + '14',
                          borderWidth: isSelected ? 0 : 1, borderColor: gc + '40',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: isSelected ? '#fff' : gc }}>{g}</Text>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: isSelected ? 'rgba(255,255,255,0.8)' : '#9CA3AF', marginTop: 2 }}>
                          {g === 'P' || g === 'NP' ? 'P/F' : (pts !== undefined ? pts.toFixed(1) : '')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {/* 미선택/수강중 '-' 옵션 — 오른쪽 하단 */}
                  {(() => {
                    const isSelected = editingGrade.grade === '-';
                    return (
                      <TouchableOpacity
                        key="-"
                        onPress={() => updateGradeValue(editingGrade.id, '-')}
                        style={{
                          width: 62, alignItems: 'center', paddingVertical: 10, borderRadius: 14,
                          backgroundColor: isSelected ? '#6B7280' : '#F3F4F6',
                          borderWidth: isSelected ? 0 : 1, borderColor: '#D1D5DB',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: isSelected ? '#fff' : '#9CA3AF' }}>-</Text>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: isSelected ? 'rgba(255,255,255,0.8)' : '#9CA3AF', marginTop: 2 }}>수강중</Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
                {/* 재수강 토글 */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: editingGrade.isRetake ? '#FEF2F2' : '#F9FAFB',
                  borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12,
                  borderWidth: 1, borderColor: editingGrade.isRetake ? '#FECACA' : '#F3F4F6',
                }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' }}>재수강으로 대체됨</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#6B7280', marginTop: 2 }}>
                      {editingGrade.isRetake
                        ? '이 성적은 평점·이수학점에서 제외됩니다'
                        : '이후 재수강으로 이 과목 성적이 대체됐다면 켜세요'}
                    </Text>
                  </View>
                  <Switch
                    value={!!editingGrade.isRetake}
                    onValueChange={(v) => toggleRetake(editingGrade.id, v)}
                    trackColor={{ false: '#E5E7EB', true: '#FCA5A5' }}
                    thumbColor={editingGrade.isRetake ? '#EF4444' : '#9CA3AF'}
                  />
                </View>
              </>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingGrade(null)}>
              <Text style={styles.cancelText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  ttHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  ttTitleRow: { flexDirection: 'row', alignItems: 'center' },
  ttTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', marginTop: 2 },
  ttHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  addCircleBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },

  gradeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  gradeTitle: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  settingsBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

  segWrapper: { paddingHorizontal: 20, paddingBottom: 12 },
  segContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 3, gap: 2, borderWidth: 1 },
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
  block: { position: 'absolute', left: 2, right: 2, borderRadius: 6, padding: 4, overflow: 'hidden' },
  blockName: { fontSize: 11, fontFamily: 'Inter_700Bold', lineHeight: 15 },
  blockLoc: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 1 },

  gradesContent: { paddingHorizontal: 16, paddingTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#EEF4FF', borderRadius: 18, padding: 16, alignItems: 'center', gap: 2 },
  sparkCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 16, gap: 8,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  sparkTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  sparkTrend: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  sparkSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  statValue: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.primary },
  statLabel: { fontSize: 11, color: '#6B7280', fontFamily: 'Inter_400Regular', textAlign: 'center' },
  gradReqCard: { backgroundColor: '#F9FAFB', borderRadius: 18, marginBottom: 16, overflow: 'hidden' },
  gradReqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  gradReqTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gradReqTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  gradReqBadge: { backgroundColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  gradReqBadgeText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  gradReqBody: { paddingHorizontal: 16, paddingBottom: 8 },
  gradReqRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  gradReqLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  gradReqValue: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#6B7280' },
  progTrack: { height: 5, borderRadius: 3, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  progFill: { height: 5, borderRadius: 3 },
  semesterGroup: { marginBottom: 16 },
  semesterTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#6B7280', marginBottom: 8 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 12, marginBottom: 6, gap: 10 },
  gradeInfo: { flex: 1 },
  gradeSubject: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  gradeMeta: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },
  gradeBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' },
  gradeBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  retakeBadge: { backgroundColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  retakeBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#1D4ED8' },
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
  csSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  csSearchInput: { flex: 1, fontSize: 14, color: '#111827', fontFamily: 'Inter_400Regular', padding: 0 },
  filterRow: { marginBottom: 8, height: 26, overflow: 'hidden' },
  filterChip: { height: 26, paddingHorizontal: 12, paddingVertical: 0, borderRadius: 13, backgroundColor: '#F3F4F6', marginRight: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  filterChipActive: { backgroundColor: C.primary },
  filterChipSearch: {},
  filterChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  filterChipTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  csResults: { flex: 1, marginBottom: 12 },
  csEmpty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  csEmptyText: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 20 },
  courseRow: { padding: 14, borderRadius: 14, backgroundColor: '#F9FAFB', marginBottom: 8 },
  courseRowSelected: { backgroundColor: '#EEF4FF', borderWidth: 1.5, borderColor: C.primary },
  courseRowConflict: { borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  conflictBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6, alignSelf: 'flex-start' },
  conflictBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#DC2626' },
  courseName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  courseMeta: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },

  // Dept picker
  deptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  deptRowActive: { },
  deptText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#374151' },
  deptSectionHeader: { backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 5 },
  deptSectionHeaderText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 1 },
  indexBar: { width: 24, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', gap: 1 },
  indexBarItem: { paddingVertical: 2, alignItems: 'center', justifyContent: 'center', minWidth: 20 },
  indexBarText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: C.primary },

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

  // Header
  envLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  // Schedule list in semester modal
  scheduleListDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  scheduleListTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  scheduleListRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  scheduleListDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  scheduleListName: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  scheduleListTime: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  scheduleListDelete: { padding: 6 },
});
