import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Clock, MapPin, User, Trash2, Search, CheckSquare, BookOpen, ChevronDown, AlertCircle, GraduationCap, TrendingUp, Award, ChevronRight, ChevronUp, List, ChevronLeft, Calendar, Pencil, Check, Settings2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import {
  useGetSchedules,
  useCreateSchedule,
  useDeleteSchedule,
  createSchedule,
  type Schedule,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  getCurriculum, loadAdmissionYear, saveAdmissionYear, catLabel, catBg, catColor,
  type Curriculum,
} from "@/lib/curriculum";

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
  semester: string | null;
  category: string | null;
  offeringDept: string | null;
  credits: number | null;
  isOnline: boolean | null;
  isForeign: boolean | null;
  enrollmentLimit: number | null;
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
  // Split on comma followed by a day character OR <br> tag
  const parts = timeRoom.split(/,\s*(?=[월화수목금토일])|,?\s*<br\s*\/?>\s*/gi);
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

async function fetchDepartments(catalogYear: number, catalogSemester: string): Promise<string[]> {
  const params = new URLSearchParams({ catalogYear: String(catalogYear), catalogSemester });
  const res = await fetch(`${BASE}/api/courses/departments?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json();
}

async function fetchCourses(dept: string, catalogYear: number, catalogSemester: string, gradeYear: string, category: string, search: string): Promise<ApiCourse[]> {
  const params = new URLSearchParams();
  if (dept) params.set("dept", dept);
  params.set("catalogYear", String(catalogYear));
  params.set("catalogSemester", catalogSemester);
  if (gradeYear && gradeYear !== "전체") params.set("gradeYear", gradeYear);
  if (category) params.set("category", category);
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
  category: string;
}

const GRADE_POINTS: Record<string, number> = {
  "A+": 4.5, "A0": 4.0, "B+": 3.5, "B0": 3.0,
  "C+": 2.5, "C0": 2.0, "D+": 1.5, "D0": 1.0, "F": 0.0,
};
const GRADE_OPTIONS = Object.keys(GRADE_POINTS);
const ALL_GRADE_OPTIONS = [...GRADE_OPTIONS, "S", "U"];
const SEMESTER_OPTIONS = ["1학기", "2학기", "여름계절", "겨울계절"];
const CURRENT_YEAR = new Date().getFullYear();

const GRAD_CATEGORIES = ["전공필수", "전공기초", "전공선택", "교양필수", "교양선택", "일반선택"] as const;
const GRAD_CAT_COLORS: Record<string, string> = {
  "전공필수": "bg-blue-500",
  "전공기초": "bg-indigo-500",
  "전공선택": "bg-sky-400",
  "교양필수": "bg-violet-500",
  "교양선택": "bg-purple-400",
  "일반선택": "bg-slate-400",
};
const GRAD_CAT_BG: Record<string, string> = {
  "전공필수":    "bg-blue-50 text-blue-700",
  "전공기초":    "bg-indigo-50 text-indigo-700",
  "전공선택":    "bg-sky-50 text-sky-700",
  "교양필수":    "bg-violet-50 text-violet-700",
  "교양선택":    "bg-purple-50 text-purple-700",
  "효원핵심교양": "bg-violet-50 text-violet-700",
  "효원균형교양": "bg-purple-50 text-purple-700",
  "효원창의교양": "bg-fuchsia-50 text-fuchsia-700",
  "일반선택":    "bg-slate-100 text-slate-600",
  "교직과목":    "bg-amber-50 text-amber-700",
};
const GRAD_REQS_KEY = "campus-grad-reqs";

function loadGradReqs(defaultReqs: Record<string, number>): Record<string, number> {
  try { return { ...defaultReqs, ...JSON.parse(localStorage.getItem(GRAD_REQS_KEY) || "{}") }; }
  catch { return { ...defaultReqs }; }
}
function saveGradReqs(r: Record<string, number>) {
  localStorage.setItem(GRAD_REQS_KEY, JSON.stringify(r));
}

function calcGPA(grades: GradeEntry[]) {
  // S/U are pass/fail — excluded from GPA calculation
  const counted = grades.filter(g => GRADE_POINTS[g.grade] !== undefined);
  const totalCredits = counted.reduce((s, g) => s + g.credits, 0);
  const totalPoints = counted.reduce((s, g) => s + (GRADE_POINTS[g.grade] ?? 0) * g.credits, 0);
  // Earned credits: exclude F and U (S counts as earned)
  const earnedCredits = grades.filter(g => g.grade !== "F" && g.grade !== "U").reduce((s, g) => s + g.credits, 0);
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
async function updateGrade(id: number, data: Partial<Omit<GradeEntry, "id">>): Promise<GradeEntry> {
  const res = await fetch(`${BASE}/api/grades/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function deleteGrade(id: number): Promise<void> {
  await fetch(`${BASE}/api/grades/${id}`, { method: "DELETE" });
}

// ─── Semester helpers ────────────────────────────────────────────────────────
type SemesterEntry = { year: number; semester: string };
const SEMESTERS_KEY = "campus-semesters";
const ACTIVE_SEM_KEY = "campus-active-semester";

function getCurrentSemester(): SemesterEntry {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let semester = "1학기";
  if (month <= 2) semester = "겨울계절";
  else if (month <= 6) semester = "1학기";
  else if (month <= 8) semester = "여름계절";
  else semester = "2학기";
  return { year, semester };
}

function loadStoredSemesters(): SemesterEntry[] {
  try { return JSON.parse(localStorage.getItem(SEMESTERS_KEY) || "[]"); } catch { return []; }
}
function saveStoredSemesters(list: SemesterEntry[]) {
  localStorage.setItem(SEMESTERS_KEY, JSON.stringify(list));
}
function loadActiveSemester(): SemesterEntry | null {
  try { return JSON.parse(localStorage.getItem(ACTIVE_SEM_KEY) || "null"); } catch { return null; }
}
function saveActiveSemester(s: SemesterEntry) {
  localStorage.setItem(ACTIVE_SEM_KEY, JSON.stringify(s));
}
function semKey(s: SemesterEntry) { return `${s.year}-${s.semester}`; }

export function SchedulePage() {
  const { data: schedules = [], isLoading } = useGetSchedules();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [isAddOptionOpen, setIsAddOptionOpen] = useState(false);
  const [isSemesterOpen, setIsSemesterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"timetable" | "grades">("timetable");
  const [isGradeSettingsOpen, setIsGradeSettingsOpen] = useState(false);
  const [admissionYear, setAdmissionYear] = useState<number>(() => loadAdmissionYear());
  const curriculum = getCurriculum(admissionYear);

  useEffect(() => {
    const handler = () => setAdmissionYear(loadAdmissionYear());
    window.addEventListener("campus-admission-year-change", handler);
    return () => window.removeEventListener("campus-admission-year-change", handler);
  }, []);

  const defaultSem = getCurrentSemester();
  const [activeSemester, setActiveSemesterState] = useState<SemesterEntry>(
    () => loadActiveSemester() ?? defaultSem
  );
  const [semesters, setSemesters] = useState<SemesterEntry[]>(() => {
    const stored = loadStoredSemesters();
    if (!stored.some(s => semKey(s) === semKey(defaultSem))) {
      const merged = [defaultSem, ...stored];
      saveStoredSemesters(merged);
      return merged;
    }
    return stored;
  });

  const setActiveSemester = (s: SemesterEntry) => {
    setActiveSemesterState(s);
    saveActiveSemester(s);
  };

  const addSemester = (s: SemesterEntry) => {
    setSemesters(prev => {
      if (prev.some(p => semKey(p) === semKey(s))) return prev;
      const next = [...prev, s].sort((a, b) => a.year !== b.year ? a.year - b.year : SEMESTER_OPTIONS.indexOf(a.semester) - SEMESTER_OPTIONS.indexOf(b.semester));
      saveStoredSemesters(next);
      return next;
    });
    setActiveSemester(s);
  };

  const filteredSchedules = schedules.filter(s =>
    s.year === activeSemester.year && s.semester === activeSemester.semester
  );

  return (
    <Layout hideTopBar>
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between">
        <div>
          {activeTab === "timetable" ? (
            <button
              onClick={() => setIsSemesterOpen(true)}
              className="flex items-center gap-1.5 text-left group"
            >
              <h1 className="text-2xl font-bold text-foreground">
                {activeSemester.year}년 {activeSemester.semester} <span className="text-primary">시간표</span>
              </h1>
              <ChevronDown className="w-4 h-4 text-primary mt-0.5 group-hover:opacity-70 transition-opacity" />
            </button>
          ) : (
            <h1 className="text-3xl text-foreground">
              학기별 <span className="text-primary">성적 관리</span>
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "timetable" ? (
            <>
              <button onClick={() => setIsSemesterOpen(true)}
                className="w-11 h-11 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all shadow-sm">
                <List className="w-5 h-5" />
              </button>
              <button onClick={() => setIsAddOptionOpen(true)}
                className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
                <Plus className="w-6 h-6" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsGradeSettingsOpen(p => !p)}
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-sm",
                isGradeSettingsOpen
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <Settings2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="px-4 mb-4">
        <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
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
                  {filteredSchedules.map((schedule) => (<ScheduleBlock key={schedule.id} schedule={schedule} allSchedules={schedules} />))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grades Tab */}
      {activeTab === "grades" && (
        <GradeSection
          activeSemester={activeSemester}
          schedules={schedules}
          curriculum={curriculum}
          admissionYear={admissionYear}
          onAdmissionYearChange={(y) => {
            setAdmissionYear(y);
            saveAdmissionYear(y);
            window.dispatchEvent(new Event("campus-admission-year-change"));
          }}
          isSettingsOpen={isGradeSettingsOpen}
          onSettingsClose={() => setIsGradeSettingsOpen(false)}
        />
      )}

      {isAddOptionOpen && (
        <AddOptionDialog
          onBrowse={() => { setIsAddOptionOpen(false); setIsBrowseOpen(true); }}
          onManual={() => { setIsAddOptionOpen(false); setIsAddOpen(true); }}
          onClose={() => setIsAddOptionOpen(false)}
        />
      )}
      {isSemesterOpen && (
        <SemesterManagerDialog
          semesters={semesters}
          active={activeSemester}
          onSelect={(s) => { setActiveSemester(s); setIsSemesterOpen(false); }}
          onAdd={addSemester}
          onClose={() => setIsSemesterOpen(false)}
        />
      )}
      {isAddOpen && (
        <AddScheduleDialog
          year={activeSemester.year}
          semester={activeSemester.semester}
          curriculum={curriculum}
          onClose={() => setIsAddOpen(false)}
        />
      )}
      {isBrowseOpen && (
        <CourseBrowserDialog
          year={activeSemester.year}
          semester={activeSemester.semester}
          curriculum={curriculum}
          onClose={() => setIsBrowseOpen(false)}
        />
      )}
    </Layout>
  );
}

// ─── AddOptionDialog ─────────────────────────────────────────────────────────
function AddOptionDialog({ onBrowse, onManual, onClose }: { onBrowse: () => void; onManual: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-card w-full max-w-lg rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-6" />
        <h2 className="text-lg font-bold mb-4">수업 추가</h2>
        <div className="space-y-3">
          <button
            onClick={onBrowse}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-foreground">수강편람에서 추가</div>
              <div className="text-xs text-muted-foreground mt-0.5">부산대 수강편람에서 수업을 검색해 추가</div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
          </button>
          <button
            onClick={onManual}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Pencil className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-foreground">직접 추가</div>
              <div className="text-xs text-muted-foreground mt-0.5">과목명, 시간, 장소를 직접 입력해 추가</div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
          </button>
        </div>
        <button onClick={onClose} className="mt-4 w-full py-3 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-slate-100 transition-colors">
          취소
        </button>
      </div>
    </div>
  );
}

// ─── SemesterManagerDialog ───────────────────────────────────────────────────
function SemesterManagerDialog({
  semesters, active, onSelect, onAdd, onClose,
}: {
  semesters: SemesterEntry[];
  active: SemesterEntry;
  onSelect: (s: SemesterEntry) => void;
  onAdd: (s: SemesterEntry) => void;
  onClose: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newSem, setNewSem] = useState("1학기");

  const handleAdd = () => {
    const y = parseInt(newYear);
    if (!y || y < 2000 || y > 2100) return;
    onAdd({ year: y, semester: newSem });
    setIsAdding(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-card w-full max-w-lg rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-300 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">학기 관리</h2>
          <button onClick={onClose} className="p-2 bg-muted rounded-full hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-2 mb-4">
          {semesters.map(s => {
            const isActive = semKey(s) === semKey(active);
            return (
              <button
                key={semKey(s)}
                onClick={() => onSelect(s)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all text-left",
                  isActive ? "bg-primary text-primary-foreground" : "bg-secondary/60 hover:bg-secondary"
                )}
              >
                <div className="flex items-center gap-3">
                  <Calendar className={cn("w-4 h-4", isActive ? "text-primary-foreground/80" : "text-muted-foreground")} />
                  <span className="font-semibold">{s.year}년 {s.semester}</span>
                </div>
                {isActive && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>

        {isAdding ? (
          <div className="border border-border rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-muted-foreground">새 학기 추가</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={newYear}
                onChange={e => setNewYear(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="연도"
                min="2020" max="2100"
              />
              <select
                value={newSem}
                onChange={e => setNewSem(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              >
                {SEMESTER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsAdding(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-secondary hover:bg-secondary/80 transition-colors">취소</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">추가</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors font-semibold text-sm"
          >
            <Plus className="w-4 h-4" /> 새 학기 추가
          </button>
        )}
      </div>
    </div>
  );
}

function ScheduleBlock({ schedule, allSchedules }: { schedule: Schedule; allSchedules: Schedule[] }) {
  const queryClient = useQueryClient();
  const [showDetail, setShowDetail] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteMutation = useDeleteSchedule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      },
    },
  });

  // All slots for the same course (same name + year + semester)
  const siblings = allSchedules.filter(s =>
    s.subjectName === schedule.subjectName &&
    s.year === schedule.year &&
    s.semester === schedule.semester
  );
  const siblingDays = siblings
    .map(s => DAYS[s.dayOfWeek])
    .sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b))
    .join("·");

  const handleDelete = async () => {
    setIsDeleting(true);
    for (const s of siblings) {
      await deleteMutation.mutateAsync({ id: s.id }).catch(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
    setIsDeleting(false);
    setShowDetail(false);
  };

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
              onClick={handleDelete}
              disabled={isDeleting}
              className="mt-8 w-full py-4 rounded-xl font-bold bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-colors"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              {isDeleting
                ? "삭제 중..."
                : siblings.length > 1
                  ? `수업 전체 삭제 (${siblingDays})`
                  : "이 수업 삭제하기"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// The catalog year for a given timetable year/semester
// 2026-1학기 → catalog year 2026, etc.
function catalogYearFor(timetableYear: number, _semester: string): number {
  return timetableYear;
}

const CATALOG_CATEGORY_FILTERS = ["전체", "전공필수", "전공기초", "전공선택", "효원핵심교양", "효원균형교양", "효원창의교양", "일반선택", "교직과목"] as const;

function CourseBrowserDialog({ year, semester, curriculum, onClose }: { year: number; semester: string; curriculum: Curriculum; onClose: () => void }) {
  const queryClient = useQueryClient();
  const catalogYear = catalogYearFor(year, semester);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedYear, setSelectedYear] = useState("전체");
  const [selectedCategory, setSelectedCategory] = useState("전체");
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
    fetchDepartments(catalogYear, semester)
      .then(setDepartments)
      .catch(() => setError("학과 목록을 불러오지 못했습니다."))
      .finally(() => setIsLoadingDepts(false));
  }, [catalogYear, semester]);

  const loadCourses = useCallback(async (dept: string, gradeYear: string, category: string, search: string) => {
    if (!dept && !search && category === "전체" && gradeYear === "전체") {
      setCourses([]);
      return;
    }
    setIsLoadingCourses(true);
    setError("");
    try {
      const data = await fetchCourses(dept, catalogYear, semester, gradeYear, category === "전체" ? "" : category, search);
      setCourses(data);
      setSelected(new Set());
    } catch {
      setError("강의 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoadingCourses(false);
    }
  }, [catalogYear, semester]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCourses(selectedDept, selectedYear, selectedCategory, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedDept, selectedYear, selectedCategory, searchQuery, loadCourses]);

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
              year,
              semester,
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
              year,
              semester,
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
              <p className="text-xs text-muted-foreground">부산대학교 {catalogYear}학년도 {semester} 수강편람</p>
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
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors"
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
                        className="w-full px-3 py-2 bg-slate-100 rounded-lg text-sm outline-none"
                      />
                    </div>
                    <div className="overflow-y-auto">
                      <button
                        onClick={() => { setSelectedDept(""); setShowDeptDropdown(false); setDeptSearch(""); }}
                        className={cn("w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors", !selectedDept && "text-primary font-semibold")}
                      >
                        전체 학과
                      </button>
                      {filteredDepts.map(dept => (
                        <button
                          key={dept}
                          onClick={() => { setSelectedDept(dept); setShowDeptDropdown(false); setDeptSearch(""); }}
                          className={cn("w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors", selectedDept === dept && "text-primary font-semibold bg-primary/5")}
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
                        "px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                        selectedYear === y
                          ? "bg-primary text-primary-foreground"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:bg-white focus:border-primary focus:ring-2 ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* Category filter */}
              <div className="flex gap-1.5 flex-wrap">
                {CATALOG_CATEGORY_FILTERS.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                      selectedCategory === cat
                        ? cat === "전체"
                          ? "bg-primary text-primary-foreground border-transparent"
                          : cn("border-transparent", GRAD_CAT_BG[cat] ?? "bg-primary text-primary-foreground")
                        : "bg-muted border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    {cat === "전체" ? "전체" : catLabel(curriculum, cat)}
                  </button>
                ))}
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
                  <p className="text-sm">{selectedDept || searchQuery || selectedCategory !== "전체" || selectedYear !== "전체" ? "검색 결과가 없습니다." : "학과 선택, 학년/이수구분 필터 또는 과목명으로 검색하세요."}</p>
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
                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                <span className="font-semibold text-sm text-foreground leading-tight">{course.subjectName}</span>
                                {course.section && (
                                  <span className="shrink-0 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{course.section}분반</span>
                                )}
                                {course.isForeign && (
                                  <span className="shrink-0 text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-bold">원어</span>
                                )}
                                {course.isOnline && (
                                  <span className="shrink-0 text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded font-bold">원격</span>
                                )}
                              </div>
                              {course.credits && (
                                <span className="shrink-0 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{course.credits}학점</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {course.category && (
                                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", GRAD_CAT_BG[course.category] ?? "bg-muted text-muted-foreground")}>{catLabel(curriculum, course.category)}</span>
                                )}
                                {course.professor && <span>{course.professor} 교수</span>}
                                {course.offeringDept && <span className="text-muted-foreground/60 truncate max-w-[120px]">{course.offeringDept}</span>}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {course.subjectCode && (
                                  <span className="text-[10px] text-muted-foreground/50 font-mono">{course.subjectCode}</span>
                                )}
                                {course.enrollmentLimit && (
                                  <span className="text-[10px] text-muted-foreground/70">정원 {course.enrollmentLimit}명</span>
                                )}
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

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function AddScheduleDialog({
  year, semester, curriculum, onClose,
}: {
  year: number;
  semester: string;
  curriculum: Curriculum;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    subjectName: "",
    professor: "",
    location: "",
    selectedDays: [0] as number[],
    startTime: "09:00",
    endTime: addMinutesToTime("09:00", 75),
    color: COLORS[0],
    category: curriculum.categories[0]?.code ?? "전공필수",
    credits: 3,
  });

  const toggleDay = (i: number) => {
    setFormData(prev => {
      const has = prev.selectedDays.includes(i);
      const next = has
        ? prev.selectedDays.filter(d => d !== i)
        : [...prev.selectedDays, i];
      return { ...prev, selectedDays: next.length === 0 ? [i] : next };
    });
  };

  const handleStartTimeChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      startTime: val,
      endTime: addMinutesToTime(val, 75),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.selectedDays.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        formData.selectedDays.map(dayOfWeek =>
          createSchedule({
            subjectName: formData.subjectName,
            professor: formData.professor,
            location: formData.location,
            dayOfWeek,
            startTime: formData.startTime,
            endTime: formData.endTime,
            color: formData.color,
            category: formData.category,
            credits: formData.credits,
            year,
            semester,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      onClose();
    } catch {}
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold">직접 추가</h2>
          <button onClick={onClose} className="p-2 bg-muted rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-8 space-y-4">
          {/* 과목명 */}
          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-1">과목명 *</label>
            <input
              required
              value={formData.subjectName}
              onChange={e => setFormData({ ...formData, subjectName: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none"
              placeholder="예: 기초프로그래밍"
            />
          </div>

          {/* 교수명 + 강의실 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">교수명</label>
              <input
                value={formData.professor}
                onChange={e => setFormData({ ...formData, professor: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">강의실</label>
              <input
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none"
                placeholder="308호"
              />
            </div>
          </div>

          {/* 이수구분 + 학점 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">이수구분</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary px-3 py-3 rounded-xl transition-all outline-none text-sm font-semibold"
              >
                {GRAD_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{catLabel(curriculum, cat)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">학점</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, credits: c })}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-bold border transition-all",
                      formData.credits === c
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 요일 (다중 선택) */}
          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-1">
              요일 <span className="font-normal text-xs text-muted-foreground">(복수 선택 가능)</span>
            </label>
            <div className="flex gap-1.5">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors",
                    formData.selectedDays.includes(i)
                      ? "bg-primary text-primary-foreground"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* 시작/종료 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">시작 시간</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={e => handleStartTimeChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">
                종료 시간 <span className="text-[10px] text-primary font-normal">+75분 자동</span>
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none"
              />
            </div>
          </div>

          {/* 색상 */}
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
            disabled={saving}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60"
          >
            {saving
              ? "추가 중..."
              : formData.selectedDays.length > 1
                ? `시간표 추가 (${formData.selectedDays.length}일)`
                : "시간표 추가"}
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
  "S":  "bg-teal-100 text-teal-700 border-teal-200",
  "U":  "bg-rose-100 text-rose-500 border-rose-200",
};
// end marker - grade colors

function GradeSection({
  activeSemester, schedules, curriculum,
  admissionYear, onAdmissionYearChange,
  isSettingsOpen,
}: {
  activeSemester: SemesterEntry;
  schedules: Schedule[];
  curriculum: Curriculum;
  admissionYear: number;
  onAdmissionYearChange: (y: number) => void;
  isSettingsOpen: boolean;
  onSettingsClose: () => void;
}) {
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGrade, setEditingGrade] = useState<GradeEntry | null>(null);
  const [quickTarget, setQuickTarget] = useState<{ course: Schedule; year: number; semester: string } | null>(null);
  const [expandedSemesters, setExpandedSemesters] = useState<Set<string>>(new Set());
  const [gradReqs, setGradReqs] = useState<Record<string, number>>(() => loadGradReqs(curriculum.defaultGradReqs));
  const [reqDraft, setReqDraft] = useState<Record<string, number>>(() => loadGradReqs(curriculum.defaultGradReqs));
  const [showGradSection, setShowGradSection] = useState(true);
  const [settingsDraft, setSettingsDraft] = useState({ admissionYear, reqDraft: loadGradReqs(curriculum.defaultGradReqs) });

  // Sync settingsDraft when settings panel opens
  useEffect(() => {
    if (isSettingsOpen) {
      setSettingsDraft({ admissionYear, reqDraft: { ...gradReqs } });
    }
  }, [isSettingsOpen]);

  const loadGrades = useCallback(async () => {
    try {
      const data = await fetchGrades();
      setGrades(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadGrades(); }, [loadGrades]);

  const handleAdd = (entry: GradeEntry) => {
    setGrades(prev => [...prev, entry]);
    setExpandedSemesters(prev => new Set([...prev, `${entry.year}-${entry.semester}`]));
  };

  const handleUpdate = (updated: GradeEntry) => {
    setGrades(prev => prev.map(g => g.id === updated.id ? updated : g));
  };

  const handleDelete = async (id: number) => {
    await deleteGrade(id);
    setGrades(prev => prev.filter(g => g.id !== id));
  };

  const toggleSemester = (key: string) => {
    setExpandedSemesters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const applySettings = () => {
    // Apply curriculum change
    onAdmissionYearChange(settingsDraft.admissionYear);
    // Apply grad reqs change
    setGradReqs({ ...settingsDraft.reqDraft });
    setReqDraft({ ...settingsDraft.reqDraft });
    saveGradReqs(settingsDraft.reqDraft);
  };

  const { gpa: overallGPA, earnedCredits: totalEarned } = calcGPA(grades);

  const SEM_ORDER = ["1학기", "여름계절", "2학기", "겨울계절"];

  // Normalize schedules: null year/semester → activeSemester (legacy data)
  const normalizedSchedules = schedules.map(s =>
    s.year == null || s.semester == null
      ? { ...s, year: activeSemester.year, semester: activeSemester.semester }
      : s
  );

  // Semester list comes from SCHEDULES (timetable) — every semester with courses
  const scheduleKeys = Array.from(new Set(normalizedSchedules.map(s => `${s.year}-${s.semester}`)));
  const gradeOnlyKeys = grades
    .map(g => `${g.year}-${g.semester}`)
    .filter(k => !scheduleKeys.includes(k));
  const sortedKeys = Array.from(new Set([...scheduleKeys, ...gradeOnlyKeys])).sort((a, b) => {
    const [ay, as_] = a.split(/-(.+)/);
    const [by, bs] = b.split(/-(.+)/);
    return Number(ay) !== Number(by) ? Number(ay) - Number(by) : SEM_ORDER.indexOf(as_) - SEM_ORDER.indexOf(bs);
  });

  // Grade lookup maps
  const gradeBySubject = grades.reduce<Record<string, GradeEntry>>((acc, g) => {
    acc[`${g.year}-${g.semester}-${g.subjectName}`] = g;
    return acc;
  }, {});
  const gradesBySemKey = grades.reduce<Record<string, GradeEntry[]>>((acc, g) => {
    const key = `${g.year}-${g.semester}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const creditsByCat = GRAD_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = grades.filter(g => g.category === cat && g.grade !== "F").reduce((s, g) => s + g.credits, 0);
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-10 space-y-4">

      {/* ── 설정 패널 ── */}
      {isSettingsOpen && (
        <div className="bg-card rounded-3xl border border-primary/20 shadow-sm overflow-hidden">
          <div className="px-5 py-4 space-y-5">
            {/* 교육과정 선택 */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">교양교육체계</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSettingsDraft(d => ({ ...d, admissionYear: 2025 }))}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all",
                    settingsDraft.admissionYear < 2026
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  2026 개편 전
                </button>
                <button
                  onClick={() => setSettingsDraft(d => ({ ...d, admissionYear: 2026 }))}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all",
                    settingsDraft.admissionYear >= 2026
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  2026 개편 후
                </button>
              </div>
            </div>

            {/* 이수구분별 목표학점 */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">이수구분별 목표학점</p>
              <div className="space-y-2">
                {GRAD_CATEGORIES.map(cat => {
                  const draftCurriculum = getCurriculum(settingsDraft.admissionYear);
                  return (
                    <div key={cat} className="flex items-center justify-between">
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", GRAD_CAT_BG[cat])}>
                        {catLabel(draftCurriculum, cat)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={settingsDraft.reqDraft[cat] ?? 0}
                          onChange={e => setSettingsDraft(d => ({
                            ...d,
                            reqDraft: { ...d.reqDraft, [cat]: parseInt(e.target.value) || 0 }
                          }))}
                          className="w-14 text-xs text-right bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                        />
                        <span className="text-xs text-muted-foreground">학점</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 적용 버튼 */}
            <button
              onClick={applySettings}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
            >
              적용하기
            </button>
          </div>
        </div>
      )}

      {/* ── Overall Summary ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-primary/10 rounded-2xl p-4 text-center">
          <Award className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-3xl font-black text-primary">{grades.length > 0 ? overallGPA.toFixed(2) : "-"}</p>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">전체 평점 / 4.5</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4 text-center">
          <GraduationCap className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <p className="text-3xl font-black text-blue-600">{totalEarned}</p>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">총 이수학점</p>
        </div>
      </div>

      {/* ── 졸업요건 트래커 ── */}
      <div className="bg-card rounded-3xl border border-border/50 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowGradSection(p => !p)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">졸업요건 이수현황</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{totalEarned}/{Object.values(gradReqs).reduce((a, b) => a + b, 0)}학점</span>
          </div>
          {showGradSection ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showGradSection && (
          <div className="border-t border-border/50 px-5 py-4 space-y-3">
            {GRAD_CATEGORIES.map(cat => {
              const earned = creditsByCat[cat] ?? 0;
              const req = gradReqs[cat] ?? 0;
              const pct = req > 0 ? Math.min(earned / req, 1) : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", GRAD_CAT_BG[cat])}>{catLabel(curriculum, cat)}</span>
                    <span className="text-xs font-semibold text-foreground">{earned}<span className="text-muted-foreground">/{req}학점</span></span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", GRAD_CAT_COLORS[cat])}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Semester Groups (derived from timetable) ── */}
      {sortedKeys.length === 0 ? (
        <div className="bg-card rounded-3xl p-10 text-center border border-border/50 shadow-sm">
          <GraduationCap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">시간표에 등록된 학기가 없어요</p>
          <p className="text-sm text-muted-foreground/60 mt-1">시간표 탭에서 과목을 추가하세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedKeys.map(key => {
            const [yr, sem] = key.split(/-(.+)/);
            const semGrades = gradesBySemKey[key] ?? [];
            const { gpa: semGPA, earnedCredits: semEarned } = calcGPA(semGrades);
            const isOpen = expandedSemesters.has(key);

            // All unique courses for this semester from the timetable (using normalized schedules)
            const semCourses = Array.from(
              new Map(
                normalizedSchedules
                  .filter(s => s.year === parseInt(yr) && s.semester === sem)
                  .map(s => [s.subjectName, s])
              ).values()
            );
            const totalCourses = semCourses.length;
            const gradedCount = semGrades.length;

            return (
              <div key={key} className="bg-card rounded-3xl border border-border/50 shadow-sm overflow-hidden">
                {/* Semester header row */}
                <button
                  onClick={() => toggleSemester(key)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">{yr}년 {sem}</p>
                      <p className="text-xs text-muted-foreground">
                        {totalCourses > 0 ? `${totalCourses}과목` : `${gradedCount}과목`}
                        {semEarned > 0 && ` · ${semEarned}학점 입력완료`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {semGrades.length > 0 && (
                      <div className="text-right">
                        <p className="text-lg font-black text-primary">{semGPA.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">학기 평점</p>
                      </div>
                    )}
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-1" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />}
                  </div>
                </button>

                {/* Expanded: timetable courses with grade status */}
                {isOpen && (
                  <div className="border-t border-border/50">
                    {semCourses.map(course => {
                      const gradeKey = `${yr}-${sem}-${course.subjectName}`;
                      const g = gradeBySubject[gradeKey];
                      return (
                        <div key={course.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-border/20 last:border-0">
                          {/* Course color dot */}
                          <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: course.color }} />
                          {/* Name + category */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{course.subjectName}</p>
                            {g ? (
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", GRAD_CAT_BG[g.category] ?? "bg-slate-100 text-slate-600")}>{catLabel(curriculum, g.category)}</span>
                                <span className="text-[10px] text-muted-foreground">{g.credits}학점</span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground mt-0.5">성적 미입력</p>
                            )}
                          </div>
                          {/* Grade badge or add button */}
                          {g ? (
                            <>
                              <span className={cn("px-2.5 py-1 rounded-full text-sm font-bold border shrink-0", GRADE_COLORS[g.grade] ?? "bg-gray-100 text-gray-500 border-gray-200")}>{g.grade}</span>
                              <button onClick={() => setEditingGrade(g)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(g.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setQuickTarget({ course, year: parseInt(yr), semester: sem })}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
                            >
                              <Plus className="w-3 h-3" />성적 입력
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {/* If there are grade-only entries (no timetable course) */}
                    {semGrades
                      .filter(g => !semCourses.some(c => c.subjectName === g.subjectName))
                      .map(g => (
                        <div key={g.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-border/20 last:border-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-muted-foreground/30" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{g.subjectName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", GRAD_CAT_BG[g.category] ?? "bg-slate-100 text-slate-600")}>{catLabel(curriculum, g.category)}</span>
                              <span className="text-[10px] text-muted-foreground">{g.credits}학점</span>
                            </div>
                          </div>
                          <span className={cn("px-2.5 py-1 rounded-full text-sm font-bold border shrink-0", GRADE_COLORS[g.grade] ?? "bg-gray-100 text-gray-500 border-gray-200")}>{g.grade}</span>
                          <button onClick={() => setEditingGrade(g)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(g.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingGrade && (
        <EditGradeDialog
          grade={editingGrade}
          curriculum={curriculum}
          onClose={() => setEditingGrade(null)}
          onSave={handleUpdate}
        />
      )}
      {quickTarget && (
        <QuickGradeDialog
          course={quickTarget.course}
          year={quickTarget.year}
          semester={quickTarget.semester}
          curriculum={curriculum}
          onClose={() => setQuickTarget(null)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}

// ────────────────────── QuickGradeDialog ──────────────────────
const QUICK_GRADE_ROWS = [
  ["A+", "A0", "B+", "B0"],
  ["C+", "C0", "D+", "D0"],
  ["F", "", "S", "U"],
] as const;

function QuickGradeDialog({
  course, year, semester, curriculum, onClose, onAdd,
}: {
  course: Schedule;
  year: number;
  semester: string;
  curriculum: Curriculum;
  onClose: () => void;
  onAdd: (g: GradeEntry) => void;
}) {
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const category = "전공선택";
  const credits = 3;

  const handleSave = async () => {
    if (!selectedGrade) return;
    setSaving(true);
    try {
      const created = await createGrade({
        year,
        semester,
        subjectName: course.subjectName,
        credits,
        grade: selectedGrade,
        category,
      });
      onAdd(created);
      onClose();
    } catch {}
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card w-full rounded-t-3xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: course.color }} />
            <div className="min-w-0">
              <p className="font-black text-foreground text-base truncate">{course.subjectName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-lg", GRAD_CAT_BG[category] ?? "bg-muted text-muted-foreground")}>{category}</span>
                <span className="text-xs text-muted-foreground">{credits}학점</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{year}년 {semester}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-secondary shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-8 space-y-4">
          {/* Grade grid */}
          <div className="space-y-2">
            {QUICK_GRADE_ROWS.map((row, ri) => (
              <div key={ri} className="grid grid-cols-4 gap-2">
                {row.map((g, ci) =>
                  g === "" ? (
                    <div key={ci} />
                  ) : (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrade(g)}
                      className={cn(
                        "py-3 rounded-2xl text-sm font-black border transition-all",
                        selectedGrade === g
                          ? cn("shadow-md scale-105", GRADE_COLORS[g] ?? "bg-gray-100 text-gray-500 border-gray-200")
                          : "bg-muted border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                      )}
                    >
                      {g}
                      {GRADE_POINTS[g] !== undefined && (
                        <span className="block text-[10px] font-normal opacity-70 mt-0.5">{GRADE_POINTS[g].toFixed(1)}</span>
                      )}
                      {(g === "S" || g === "U") && <span className="block text-[10px] font-normal opacity-70 mt-0.5">P/F</span>}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!selectedGrade || saving}
            className="w-full bg-primary text-primary-foreground font-black py-4 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-40"
          >
            {saving ? "저장 중..." : selectedGrade ? `${selectedGrade} 저장` : "성적을 선택하세요"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────── EditGradeDialog ──────────────────────
function EditGradeDialog({ grade, curriculum, onClose, onSave }: { grade: GradeEntry; curriculum: Curriculum; onClose: () => void; onSave: (g: GradeEntry) => void }) {
  const [form, setForm] = useState({
    subjectName: grade.subjectName,
    credits: grade.credits.toString(),
    grade: grade.grade,
    category: grade.category,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateGrade(grade.id, {
        subjectName: form.subjectName.trim(),
        credits: parseInt(form.credits),
        grade: form.grade,
        category: form.category,
      });
      onSave(updated);
      onClose();
    } catch {}
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card w-full rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-foreground">성적 수정</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">과목명</label>
            <input value={form.subjectName} onChange={e => setForm({ ...form, subjectName: e.target.value })}
              className="w-full bg-muted border border-border/50 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">이수구분</label>
            <div className="flex flex-wrap gap-2">
              {GRAD_CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => setForm({ ...form, category: cat })}
                  className={cn("px-3 py-2 rounded-xl text-xs font-bold border transition-all", form.category === cat ? cn("border-transparent", GRAD_CAT_BG[cat]) : "border-border bg-muted text-muted-foreground hover:bg-muted/70")}>
                  {catLabel(curriculum, cat)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">학점</label>
              <select value={form.credits} onChange={e => setForm({ ...form, credits: e.target.value })}
                className="w-full bg-muted border border-border/50 rounded-xl px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30">
                {["1", "2", "3", "4"].map(c => <option key={c} value={c}>{c}학점</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">성적</label>
              <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}
                className="w-full bg-muted border border-border/50 rounded-xl px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30">
                {ALL_GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}{GRADE_POINTS[g] !== undefined ? ` (${GRADE_POINTS[g].toFixed(1)})` : " (P/F)"}</option>)}
              </select>
            </div>
          </div>
          <div className={cn("rounded-xl px-4 py-3 border text-center font-bold", GRADE_COLORS[form.grade] ?? "bg-gray-100 text-gray-500 border-gray-200")}>
            {form.grade} · {GRADE_POINTS[form.grade]?.toFixed(1)} · {form.credits}학점
          </div>
          <button type="submit" disabled={saving || !form.subjectName.trim()}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60">
            {saving ? "저장 중..." : "수정 완료"}
          </button>
        </form>
      </div>
    </div>
  );
}

