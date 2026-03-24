import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Clock, MapPin, User, Trash2, Search, CheckSquare, BookOpen, ChevronDown, AlertCircle, GraduationCap, TrendingUp, Award, ChevronRight, ChevronUp } from "lucide-react";
import { Layout } from "@/components/Layout";
import {
  useGetSchedules,
  useCreateSchedule,
  useDeleteSchedule,
  type Schedule,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const DAYS = ["월", "화", "수", "목", "금"];
// 30-minute slots: 09:00 → 18:30 (20 slots × 30px = 600px)
const HALF_HOURS = Array.from({ length: 20 }, (_, i) => {
  const total = 9 * 60 + i * 30;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
});
const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD",
  "#D4A5A5", "#9B59B6", "#1ABC9C", "#F1C40F", "#E67E22",
];

const DAY_MAP: Record<string, number> = {
  월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6,
};

interface ApiCourse {
  id: number;
  subjectName: string;
  subjectCode: string | null;
  section: string | null;
  professor: string | null;
  timeRoom: string | null;
  year: number | null;
  category: string | null;
  offeringDept: string | null;
  credits: number | null;
  isOnline: boolean | null;
  isForeign: boolean | null;
}

interface ParsedSlot {
  subjectName: string;
  professor: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string;
}

function parseTimeSlots(timeRoom: string, subject: string, professor: string): ParsedSlot[] {
  if (!timeRoom) return [];
  const parts = timeRoom.split(/,?\s*<br\s*\/?>\s*/i);
  const result: ParsedSlot[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const dayMatch = trimmed.match(/^([월화수목금토일])\s+/);
    if (!dayMatch) continue;
    const day = dayMatch[1];
    const dayOfWeek = DAY_MAP[day];
    const rest = trimmed.slice(dayMatch[0].length);
    const timeMatch = rest.match(/^(\d{2}:\d{2})/);
    if (!timeMatch) continue;
    const startTime = timeMatch[1];
    const afterStart = rest.slice(startTime.length);
    let endTime = "";
    let location = "";
    const endTimeMatch = afterStart.match(/^-(\d{2}:\d{2})/);
    if (endTimeMatch) {
      endTime = endTimeMatch[1];
      location = afterStart.slice(endTimeMatch[0].length).replace(/\(외부\)[^\s]*/g, "온라인").trim();
    } else {
      const durationMatch = afterStart.match(/^\((\d+)\)/);
      if (durationMatch) {
        const duration = parseInt(durationMatch[1]);
        const [h, m] = startTime.split(":").map(Number);
        const endMins = h * 60 + m + duration;
        endTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
        location = afterStart.slice(durationMatch[0].length).replace(/\(외부\)[^\s]*/g, "온라인").trim();
      } else {
        const [h, m] = startTime.split(":").map(Number);
        const endMins = h * 60 + m + 50;
        endTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
        location = afterStart.replace(/\(외부\)[^\s]*/g, "온라인").trim();
      }
    }
    if (location.match(/^knu10|^(외부)/)) location = "온라인";
    result.push({ subjectName: subject, professor, dayOfWeek, startTime, endTime, location });
  }
  return result;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function fetchDepartments(): Promise<string[]> {
  const res = await fetch(`${BASE}/api/courses/departments`);
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json();
}

async function fetchCourses(dept: string, year: string, search: string): Promise<ApiCourse[]> {
  const params = new URLSearchParams();
  if (dept) params.set("dept", dept);
  if (year && year !== "전체") params.set("year", year);
  if (search) params.set("search", search);
  const res = await fetch(`${BASE}/api/courses?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch courses");
  return res.json();
}

// ────────────────────── Grade Types & Constants ──────────────────────
interface GradeEntry {
  id: number;
  year: number;
  semester: string;
  subjectName: string;
  credits: number;
  grade: string;
}

const GRADE_POINTS: Record<string, number> = {
  "A+": 4.5, "A0": 4.0, "B+": 3.5, "B0": 3.0,
  "C+": 2.5, "C0": 2.0, "D+": 1.5, "D0": 1.0, "F": 0.0,
};
const GRADE_OPTIONS = Object.keys(GRADE_POINTS);
const SEMESTER_OPTIONS = ["1학기", "2학기", "여름계절", "겨울계절"];
const CURRENT_YEAR = new Date().getFullYear();

function calcGPA(grades: GradeEntry[]) {
  const counted = grades.filter(g => g.grade !== "F" || GRADE_POINTS[g.grade] !== undefined);
  const totalCredits = counted.reduce((s, g) => s + g.credits, 0);
  const totalPoints = counted.reduce((s, g) => s + (GRADE_POINTS[g.grade] ?? 0) * g.credits, 0);
  const earnedCredits = grades.filter(g => g.grade !== "F").reduce((s, g) => s + g.credits, 0);
  const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
  return { gpa, totalCredits, earnedCredits };
}

async function fetchGrades(): Promise<GradeEntry[]> {
  const res = await fetch(`${BASE}/api/grades`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function createGrade(data: Omit<GradeEntry, "id">): Promise<GradeEntry> {
  const res = await fetch(`${BASE}/api/grades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function deleteGrade(id: number): Promise<void> {
  await fetch(`${BASE}/api/grades/${id}`, { method: "DELETE" });
}

export function SchedulePage() {
  const { data: schedules = [], isLoading } = useGetSchedules();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"timetable" | "grades">("timetable");

  return (
    <Layout>
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <div>
          <p className="text-muted-foreground font-medium mb-1">{format(new Date(), "MM월 dd일")}</p>
          <h1 className="text-3xl text-foreground">
            {activeTab === "timetable" ? <>이번 주 <span className="text-primary">시간표</span></> : <>학기별 <span className="text-primary">성적 관리</span></>}
          </h1>
        </div>
        {activeTab === "timetable" && (
          <div className="flex items-center gap-2">
            <button onClick={() => setIsBrowseOpen(true)}
              className="flex items-center gap-1.5 bg-secondary text-secondary-foreground rounded-full px-4 py-2.5 text-sm font-semibold hover:bg-secondary/80 active:scale-95 transition-all shadow-sm">
              <BookOpen className="w-4 h-4" />수강편람
            </button>
            <button onClick={() => setIsAddOpen(true)}
              className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="px-4 mb-4">
        <div className="flex bg-secondary/60 rounded-2xl p-1 gap-1">
          <button onClick={() => setActiveTab("timetable")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all", activeTab === "timetable" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <BookOpen className="w-4 h-4" />시간표
          </button>
          <button onClick={() => setActiveTab("grades")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all", activeTab === "grades" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <GraduationCap className="w-4 h-4" />성적 관리
          </button>
        </div>
      </div>

      {/* Timetable Tab */}
      {activeTab === "timetable" && (
        <div className="px-4 pb-10">
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-border/50 relative overflow-x-auto">
            {isLoading ? (
              <div className="h-[600px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="min-w-[400px]">
                <div className="flex mb-2">
                  <div className="w-14" />
                  {DAYS.map((day) => (
                    <div key={day} className="flex-1 text-center font-bold text-muted-foreground text-sm py-2">{day}</div>
                  ))}
                </div>
                <div className="relative">
                  {/* Grid rows — 30px each, no time label inside */}
                  {HALF_HOURS.map((slot) => (
                    <div key={slot} className="flex border-t border-border/40 h-[30px]">
                      <div className="w-14 shrink-0" />
                      {DAYS.map((_, i) => (<div key={i} className="flex-1 border-l border-border/40" />))}
                    </div>
                  ))}
                  {/* Time labels — absolutely placed so they sit ABOVE each line */}
                  {HALF_HOURS.map((slot, i) => (
                    <div
                      key={`lbl-${slot}`}
                      className="absolute text-[10px] text-muted-foreground font-medium text-right pr-2 leading-none"
                      style={{ top: i * 30 + 2, left: 0, width: 56 }}
                    >
                      {slot}
                    </div>
                  ))}
                  {schedules.map((schedule) => (<ScheduleBlock key={schedule.id} schedule={schedule} />))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grades Tab */}
      {activeTab === "grades" && <GradeSection />}

      {isAddOpen && <AddScheduleDialog onClose={() => setIsAddOpen(false)} />}
      {isBrowseOpen && <CourseBrowserDialog onClose={() => setIsBrowseOpen(false)} />}
    </Layout>
  );
}

function ScheduleBlock({ schedule }: { schedule: Schedule }) {
  const queryClient = useQueryClient();
  const [showDetail, setShowDetail] = useState(false);

  const deleteMutation = useDeleteSchedule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
        setShowDetail(false);
      },
    },
  });

  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const startMins = parseTime(schedule.startTime);
  const endMins = parseTime(schedule.endTime);
  const dayStartMins = 9 * 60;
  const topOffset = startMins - dayStartMins;
  const height = Math.max(endMins - startMins, 20);

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="absolute rounded-xl p-2 text-white overflow-hidden shadow-sm cursor-pointer hover:brightness-110 hover:shadow-md transition-all z-10"
        style={{
          top: `${topOffset}px`,
          height: `${height}px`,
          left: `calc(56px + ${schedule.dayOfWeek} * ((100% - 56px) / 5))`,
          width: `calc((100% - 56px) / 5 - 4px)`,
          backgroundColor: schedule.color,
          marginLeft: "2px",
        }}
      >
        <div className="text-xs font-bold leading-tight line-clamp-2">{schedule.subjectName}</div>
        <div className="text-[10px] opacity-90 mt-0.5 truncate">{schedule.location}</div>
      </div>

      {showDetail && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowDetail(false)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
              <X className="w-6 h-6" />
            </button>
            <div className="w-12 h-12 rounded-2xl mb-4" style={{ backgroundColor: schedule.color }} />
            <h3 className="text-2xl font-bold text-foreground mb-1">{schedule.subjectName}</h3>
            <div className="space-y-3 mt-6">
              <div className="flex items-center text-muted-foreground">
                <Clock className="w-5 h-5 mr-3 text-primary" />
                <span>{DAYS[schedule.dayOfWeek]}요일 {schedule.startTime} ~ {schedule.endTime}</span>
              </div>
              {schedule.location && (
                <div className="flex items-center text-muted-foreground">
                  <MapPin className="w-5 h-5 mr-3 text-primary" />
                  <span>{schedule.location}</span>
                </div>
              )}
              {schedule.professor && (
                <div className="flex items-center text-muted-foreground">
                  <User className="w-5 h-5 mr-3 text-primary" />
                  <span>{schedule.professor} 교수님</span>
                </div>
              )}
            </div>
            <button
              onClick={() => deleteMutation.mutate({ id: schedule.id })}
              disabled={deleteMutation.isPending}
              className="mt-8 w-full py-4 rounded-xl font-bold bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-colors"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              {deleteMutation.isPending ? "삭제 중..." : "이 수업 삭제하기"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function CourseBrowserDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedYear, setSelectedYear] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [courses, setCourses] = useState<ApiCourse[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isLoadingDepts, setIsLoadingDepts] = useState(true);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [error, setError] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [deptSearch, setDeptSearch] = useState("");

  const createMutation = useCreateSchedule();

  useEffect(() => {
    fetchDepartments()
      .then(setDepartments)
      .catch(() => setError("학과 목록을 불러오지 못했습니다."))
      .finally(() => setIsLoadingDepts(false));
  }, []);

  const loadCourses = useCallback(async (dept: string, year: string, search: string) => {
    if (!dept && !search) {
      setCourses([]);
      return;
    }
    setIsLoadingCourses(true);
    setError("");
    try {
      const data = await fetchCourses(dept, year, search);
      setCourses(data);
      setSelected(new Set());
    } catch {
      setError("강의 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCourses(selectedDept, selectedYear, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedDept, selectedYear, searchQuery, loadCourses]);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === courses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(courses.map(c => c.id)));
    }
  };

  const handleImport = async () => {
    const toImport = courses.filter(c => selected.has(c.id));
    if (toImport.length === 0) return;
    setIsImporting(true);
    let ci = colorIndex;

    for (const course of toImport) {
      if (!course.timeRoom) {
        try {
          await createMutation.mutateAsync({
            data: {
              subjectName: course.subjectName,
              professor: course.professor || undefined,
              location: "온라인",
              dayOfWeek: 0,
              startTime: "09:00",
              endTime: "10:00",
              color: COLORS[ci % COLORS.length],
            },
          });
          ci++;
        } catch {}
        continue;
      }

      const slots = parseTimeSlots(course.timeRoom, course.subjectName, course.professor || "");
      if (slots.length === 0) continue;
      const color = COLORS[ci % COLORS.length];
      for (const slot of slots) {
        try {
          await createMutation.mutateAsync({
            data: {
              subjectName: slot.subjectName,
              professor: slot.professor || undefined,
              location: slot.location || undefined,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              color,
            },
          });
        } catch {}
      }
      ci++;
    }

    setColorIndex(ci);
    queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
    setIsImporting(false);
    setImportDone(true);
    setTimeout(() => onClose(), 1500);
  };

  const filteredDepts = deptSearch
    ? departments.filter(d => d.includes(deptSearch))
    : departments;

  const selectedCount = selected.size;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full sm:fade-in sm:zoom-in-95 duration-300 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">수강편람 검색</h2>
              <p className="text-xs text-muted-foreground">부산대학교 2025학년도 수강편람</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-muted rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {importDone ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
              <CheckSquare className="w-8 h-8" />
            </div>
            <p className="text-lg font-bold text-foreground">불러오기 완료!</p>
            <p className="text-muted-foreground text-sm">{selectedCount}개 수업이 시간표에 추가됐습니다.</p>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="p-4 border-b border-border/50 space-y-3 shrink-0">
              {/* Department selector */}
              <div className="relative">
                <button
                  onClick={() => setShowDeptDropdown(!showDeptDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-secondary/60 rounded-xl text-sm font-medium hover:bg-secondary transition-colors"
                >
                  <span className={selectedDept ? "text-foreground" : "text-muted-foreground"}>
                    {isLoadingDepts ? "학과 목록 불러오는 중..." : (selectedDept || "학과/학부 선택")}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showDeptDropdown && "rotate-180")} />
                </button>

                {showDeptDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden max-h-60 flex flex-col">
                    <div className="p-2 border-b border-border shrink-0">
                      <input
                        autoFocus
                        value={deptSearch}
                        onChange={e => setDeptSearch(e.target.value)}
                        placeholder="학과 검색..."
                        className="w-full px-3 py-2 bg-secondary/60 rounded-lg text-sm outline-none"
                      />
                    </div>
                    <div className="overflow-y-auto">
                      <button
                        onClick={() => { setSelectedDept(""); setShowDeptDropdown(false); setDeptSearch(""); }}
                        className={cn("w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/60 transition-colors", !selectedDept && "text-primary font-semibold")}
                      >
                        전체 학과
                      </button>
                      {filteredDepts.map(dept => (
                        <button
                          key={dept}
                          onClick={() => { setSelectedDept(dept); setShowDeptDropdown(false); setDeptSearch(""); }}
                          className={cn("w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/60 transition-colors", selectedDept === dept && "text-primary font-semibold bg-primary/5")}
                        >
                          {dept}
                        </button>
                      ))}
                      {filteredDepts.length === 0 && (
                        <div className="px-4 py-3 text-sm text-muted-foreground">검색 결과 없음</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Year + Search */}
              <div className="flex gap-2">
                <div className="flex gap-1 shrink-0">
                  {["전체", "1", "2", "3", "4"].map(y => (
                    <button
                      key={y}
                      onClick={() => setSelectedYear(y)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        selectedYear === y
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {y === "전체" ? "전체" : `${y}학년`}
                    </button>
                  ))}
                </div>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="과목명, 교수명 검색"
                    className="w-full pl-9 pr-3 py-2 bg-secondary/60 rounded-lg text-sm outline-none focus:bg-white focus:ring-2 ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="mx-4 mt-3 flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-4 py-3 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Course List */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingCourses ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <BookOpen className="w-10 h-10 opacity-30" />
                  <p className="text-sm">{selectedDept || searchQuery ? "검색 결과가 없습니다." : "학과를 선택하거나 과목명으로 검색하세요."}</p>
                </div>
              ) : (
                <>
                  <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/40 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">{courses.length}개 강의</span>
                    <button onClick={toggleAll} className="text-xs font-semibold text-primary hover:underline">
                      {selected.size === courses.length ? "전체 해제" : "전체 선택"}
                    </button>
                  </div>
                  <div className="divide-y divide-border/40">
                    {courses.map((course) => {
                      const isChecked = selected.has(course.id);
                      return (
                        <button
                          key={course.id}
                          onClick={() => toggleSelect(course.id)}
                          className={cn(
                            "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                            isChecked ? "bg-primary/5" : "hover:bg-secondary/50"
                          )}
                        >
                          <div className={cn(
                            "mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                            isChecked ? "bg-primary border-primary" : "border-border"
                          )}>
                            {isChecked && <CheckSquare className="w-3 h-3 text-white fill-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-semibold text-sm text-foreground leading-tight">{course.subjectName}</span>
                              {course.credits && (
                                <span className="shrink-0 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{course.credits}학점</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                              <div className="flex flex-wrap gap-x-2">
                                {course.professor && <span>{course.professor} 교수</span>}
                                {course.year && <span>{course.year}학년</span>}
                                {course.category && <span className="text-muted-foreground/70">{course.category}</span>}
                              </div>
                              {course.timeRoom && (
                                <div className="text-primary/80 font-medium truncate">{course.timeRoom.replace(/<br\s*\/?>/gi, " / ")}</div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border/50 shrink-0">
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || isImporting}
                className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting
                  ? "불러오는 중..."
                  : selectedCount > 0
                    ? `선택한 수업 ${selectedCount}개 시간표에 추가`
                    : "수업을 선택하세요"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddScheduleDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    subjectName: "",
    professor: "",
    location: "",
    dayOfWeek: 0,
    startTime: "09:00",
    endTime: "10:30",
    color: COLORS[0],
  });

  const createMutation = useCreateSchedule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
        onClose();
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ data: formData });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">직접 추가</h2>
          <button onClick={onClose} className="p-2 bg-muted rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-1">과목명 *</label>
            <input
              required
              value={formData.subjectName}
              onChange={e => setFormData({ ...formData, subjectName: e.target.value })}
              className="w-full bg-secondary/50 border border-transparent focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none"
              placeholder="예: 기초프로그래밍"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">교수명</label>
              <input
                value={formData.professor}
                onChange={e => setFormData({ ...formData, professor: e.target.value })}
                className="w-full bg-secondary/50 border border-transparent focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">강의실</label>
              <input
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-secondary/50 border border-transparent focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none"
                placeholder="308호"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-1">요일</label>
            <div className="flex gap-2">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setFormData({ ...formData, dayOfWeek: i })}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors",
                    formData.dayOfWeek === i ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">시작 시간</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full bg-secondary/50 border border-transparent focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">종료 시간</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full bg-secondary/50 border border-transparent focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-2">색상</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    formData.color === color ? "scale-125 ring-2 ring-offset-2 ring-foreground/30" : "hover:scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60"
          >
            {createMutation.isPending ? "추가 중..." : "시간표 추가"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ────────────────────── Grade Management Components ──────────────────────
const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "A0": "bg-green-100 text-green-700 border-green-200",
  "B+": "bg-blue-100 text-blue-700 border-blue-200",
  "B0": "bg-sky-100 text-sky-700 border-sky-200",
  "C+": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "C0": "bg-orange-100 text-orange-700 border-orange-200",
  "D+": "bg-red-100 text-red-600 border-red-200",
  "D0": "bg-rose-100 text-rose-600 border-rose-200",
  "F":  "bg-gray-100 text-gray-500 border-gray-200",
};

function GradeSection() {
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedSemesters, setExpandedSemesters] = useState<Set<string>>(new Set());

  const loadGrades = useCallback(async () => {
    try {
      const data = await fetchGrades();
      setGrades(data);
      const semesters = Array.from(new Set(data.map(g => `${g.year}-${g.semester}`)));
      setExpandedSemesters(new Set(semesters.slice(-2)));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadGrades(); }, [loadGrades]);

  const handleDelete = async (id: number) => {
    await deleteGrade(id);
    setGrades(prev => prev.filter(g => g.id !== id));
  };

  const handleAdd = (entry: GradeEntry) => {
    setGrades(prev => [...prev, entry]);
    const key = `${entry.year}-${entry.semester}`;
    setExpandedSemesters(prev => new Set([...prev, key]));
  };

  const toggleSemester = (key: string) => {
    setExpandedSemesters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const { gpa: overallGPA, totalCredits, earnedCredits } = calcGPA(grades);

  const semesterGroups = grades.reduce<Record<string, GradeEntry[]>>((acc, g) => {
    const key = `${g.year}-${g.semester}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});
  const sortedKeys = Object.keys(semesterGroups).sort((a, b) => {
    const [ay, as_] = a.split("-");
    const [by, bs] = b.split("-");
    const semOrder = ["1학기", "여름계절", "2학기", "겨울계절"];
    return Number(ay) !== Number(by) ? Number(ay) - Number(by) : semOrder.indexOf(as_) - semOrder.indexOf(bs);
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-10 overflow-y-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-primary/10 rounded-2xl p-4 text-center">
          <Award className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-black text-primary">{grades.length > 0 ? overallGPA.toFixed(2) : "-"}</p>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">전체 평점</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4 text-center">
          <GraduationCap className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <p className="text-2xl font-black text-blue-600">{earnedCredits}</p>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">이수학점</p>
        </div>
        <div className="bg-violet-50 rounded-2xl p-4 text-center">
          <TrendingUp className="w-5 h-5 text-violet-600 mx-auto mb-1" />
          <p className="text-2xl font-black text-violet-600">{totalCredits}</p>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">총 신청학점</p>
        </div>
      </div>

      {/* Add Button */}
      <button
        onClick={() => setIsAddOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all mb-5"
      >
        <Plus className="w-5 h-5" />성적 추가
      </button>

      {/* Semester Groups */}
      {sortedKeys.length === 0 ? (
        <div className="bg-card rounded-3xl p-10 text-center border border-border/50 shadow-sm">
          <GraduationCap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">아직 성적이 없어요</p>
          <p className="text-sm text-muted-foreground/60 mt-1">+ 성적 추가 버튼으로 입력하세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedKeys.map(key => {
            const [yr, sem] = key.split(/-(.+)/);
            const semGrades = semesterGroups[key];
            const { gpa: semGPA, earnedCredits: semEarned } = calcGPA(semGrades);
            const isOpen = expandedSemesters.has(key);
            return (
              <div key={key} className="bg-card rounded-3xl border border-border/50 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSemester(key)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">{yr}년 {sem}</p>
                      <p className="text-xs text-muted-foreground">{semGrades.length}과목 · {semEarned}학점 · 평점 {semGPA.toFixed(2)}</p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                </button>
                {isOpen && (
                  <div className="border-t border-border/50">
                    {semGrades.map(g => (
                      <div key={g.id} className="flex items-center justify-between px-5 py-3 border-b border-border/30 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{g.subjectName}</p>
                          <p className="text-xs text-muted-foreground">{g.credits}학점</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("px-3 py-1 rounded-full text-sm font-bold border", GRADE_COLORS[g.grade] ?? "bg-gray-100 text-gray-500 border-gray-200")}>
                            {g.grade}
                          </span>
                          <span className="text-sm text-muted-foreground w-8 text-right">{(GRADE_POINTS[g.grade] ?? 0).toFixed(1)}</span>
                          <button onClick={() => handleDelete(g.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAddOpen && <AddGradeDialog onClose={() => setIsAddOpen(false)} onAdd={handleAdd} />}
    </div>
  );
}

function AddGradeDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (g: GradeEntry) => void }) {
  const [form, setForm] = useState({
    year: CURRENT_YEAR.toString(),
    semester: "1학기",
    subjectName: "",
    credits: "3",
    grade: "A+",
  });
  const [saving, setSaving] = useState(false);

  const yearOptions = Array.from({ length: 6 }, (_, i) => (CURRENT_YEAR - i).toString());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subjectName.trim()) return;
    setSaving(true);
    try {
      const created = await createGrade({
        year: parseInt(form.year),
        semester: form.semester,
        subjectName: form.subjectName.trim(),
        credits: parseInt(form.credits),
        grade: form.grade,
      });
      onAdd(created);
      onClose();
    } catch {}
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card w-full rounded-t-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-black text-foreground">성적 추가</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">연도</label>
              <select value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30">
                {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">학기</label>
              <select value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30">
                {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">과목명</label>
            <input value={form.subjectName} onChange={e => setForm({ ...form, subjectName: e.target.value })}
              placeholder="예) 데이터베이스"
              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm font-semibold placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">학점</label>
              <select value={form.credits} onChange={e => setForm({ ...form, credits: e.target.value })}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30">
                {["1", "2", "3", "4"].map(c => <option key={c} value={c}>{c}학점</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">성적</label>
              <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30">
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g} ({GRADE_POINTS[g].toFixed(1)})</option>)}
              </select>
            </div>
          </div>

          <div className={cn("rounded-xl px-4 py-3 border text-center font-bold", GRADE_COLORS[form.grade] ?? "bg-gray-100 text-gray-500 border-gray-200")}>
            {form.grade} · {GRADE_POINTS[form.grade]?.toFixed(1)} · {form.credits}학점
          </div>

          <button type="submit" disabled={saving || !form.subjectName.trim()}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60">
            {saving ? "저장 중..." : "성적 저장"}
          </button>
        </form>
      </div>
    </div>
  );
}
