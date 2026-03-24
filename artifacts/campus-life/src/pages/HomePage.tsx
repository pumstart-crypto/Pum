import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, X, Clock, MapPin, User, Trash2, Search, CheckSquare,
  BookOpen, ChevronDown, CheckCircle2,
  Circle, UtensilsCrossed, GraduationCap, Library,
  Monitor, Calendar, Laptop
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { useLocation } from "wouter";
import {
  useGetSchedules,
  useCreateSchedule,
  useDeleteSchedule,
  type Schedule,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DAYS = ["월", "화", "수", "목", "금", "토"];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 9);
const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD",
  "#D4A5A5", "#9B59B6", "#1ABC9C", "#F1C40F", "#E67E22",
];
const DAY_MAP: Record<string, number> = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 };

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// ────────────────────── Quick Links ──────────────────────
const QUICK_LINKS = [
  { label: "홈페이지", icon: GraduationCap, color: "#159A54", href: "https://www.pusan.ac.kr", external: true },
  { label: "PLATO", icon: Monitor, color: "#2563EB", href: "https://plato.pusan.ac.kr", external: true },
  { label: "도서관", icon: Library, color: "#7C3AED", href: "https://lib.pusan.ac.kr", external: true },
  { label: "식단", icon: UtensilsCrossed, color: "#EA580C", href: "/meals", external: false },
  { label: "수강신청", icon: Laptop, color: "#0891B2", href: "https://sugang.pusan.ac.kr", external: true },
];

// ────────────────────── Todo Types ──────────────────────
interface Todo {
  id: number;
  title: string;
  category: string;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
}

const TODO_CATEGORIES = ["과제", "팀플", "동영상시청", "기타"];
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "과제":    { bg: "bg-red-100",    text: "text-red-600" },
  "팀플":    { bg: "bg-blue-100",   text: "text-blue-600" },
  "동영상시청": { bg: "bg-purple-100", text: "text-purple-600" },
  "기타":    { bg: "bg-gray-100",   text: "text-gray-500" },
};

async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch(`${BASE}/api/todos`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function createTodo(data: { title: string; category: string; dueDate?: string }): Promise<Todo> {
  const res = await fetch(`${BASE}/api/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function toggleTodo(id: number, completed: boolean): Promise<Todo> {
  const res = await fetch(`${BASE}/api/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function deleteTodo(id: number): Promise<void> {
  await fetch(`${BASE}/api/todos/${id}`, { method: "DELETE" });
}

// ────────────────────── Course Browser (수강편람) ──────────────────────
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
}

function parseTimeSlots(timeRoom: string, subject: string, professor: string) {
  if (!timeRoom) return [];
  const parts = timeRoom.split(/,?\s*<br\s*\/?>\s*/i);
  const result: { subjectName: string; professor: string; dayOfWeek: number; startTime: string; endTime: string; location: string }[] = [];
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

async function fetchDepartments(): Promise<string[]> {
  const res = await fetch(`${BASE}/api/courses/departments`);
  if (!res.ok) throw new Error("");
  return res.json();
}
async function fetchCourses(dept: string, year: string, search: string): Promise<ApiCourse[]> {
  const params = new URLSearchParams();
  if (dept) params.set("dept", dept);
  if (year && year !== "전체") params.set("year", year);
  if (search) params.set("search", search);
  const res = await fetch(`${BASE}/api/courses?${params}`);
  if (!res.ok) throw new Error("");
  return res.json();
}

// ────────────────────── Main Page ──────────────────────
export function HomePage() {
  const { data: schedules = [], isLoading: schedLoading } = useGetSchedules();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [isAddTodoOpen, setIsAddTodoOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetchTodos().then(setTodos).finally(() => setTodosLoading(false));
  }, []);

  const handleToggleTodo = async (id: number, completed: boolean) => {
    const updated = await toggleTodo(id, completed);
    setTodos(prev => prev.map(t => t.id === id ? updated : t));
  };

  const handleDeleteTodo = async (id: number) => {
    await deleteTodo(id);
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const handleAddTodo = async (data: { title: string; category: string; dueDate?: string }) => {
    const newTodo = await createTodo(data);
    setTodos(prev => [newTodo, ...prev]);
  };

  const incompleteTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  return (
    <Layout>
      {/* ── Top: Date + Quick Links ── */}
      <div className="px-5 pt-12 pb-4">
        <p className="text-xs text-muted-foreground font-medium mb-0.5">부산대학교</p>
        <h1 className="text-2xl font-bold text-foreground">
          {format(new Date(), "M월 d일 EEEE", { locale: ko })}
        </h1>
        <div className="flex gap-3 mt-4 overflow-x-auto pb-1 scrollbar-none">
          {QUICK_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.external ? link.href : undefined}
              onClick={!link.external ? (e) => { e.preventDefault(); navigate(link.href); } : undefined}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="flex flex-col items-center gap-1.5 shrink-0 group"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-sm group-hover:scale-105 group-active:scale-95 transition-transform"
                style={{ backgroundColor: link.color + "18", border: `2px solid ${link.color}22` }}
              >
                <link.icon className="w-6 h-6" style={{ color: link.color }} />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight">{link.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* ── Timetable Section ── */}
      <div className="px-4 mt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            시간표
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBrowseOpen(true)}
              className="flex items-center gap-1 bg-secondary text-secondary-foreground rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-secondary/80 active:scale-95 transition-all"
            >
              <BookOpen className="w-3.5 h-3.5" />
              수강편람
            </button>
            <button
              onClick={() => setIsAddOpen(true)}
              className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-x-auto">
          {schedLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="min-w-[360px] p-3">
              <div className="flex mb-1">
                <div className="w-10" />
                {DAYS.map(day => (
                  <div key={day} className="flex-1 text-center font-bold text-muted-foreground text-xs py-1">{day}</div>
                ))}
              </div>
              <div className="relative">
                {HOURS.map(hour => (
                  <div key={hour} className="flex border-t border-border/30 h-[52px]">
                    <div className="w-10 text-[10px] text-muted-foreground font-medium relative -top-2 pr-1 text-right">{hour}</div>
                    {DAYS.map((_, i) => (
                      <div key={i} className="flex-1 border-l border-border/30" />
                    ))}
                  </div>
                ))}
                {schedules.map(schedule => (
                  <ScheduleBlock key={schedule.id} schedule={schedule} pixelsPerHour={52} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Todo Section ── */}
      <div className="px-4 mt-5 pb-28">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            To-do List
          </h2>
          <button
            onClick={() => setIsAddTodoOpen(true)}
            className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {todosLoading ? (
            <div className="h-20 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : todos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border/50 p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">할 일을 추가해보세요!</p>
            </div>
          ) : (
            <>
              {incompleteTodos.map(todo => (
                <TodoItem key={todo.id} todo={todo} onToggle={handleToggleTodo} onDelete={handleDeleteTodo} />
              ))}
              {completedTodos.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground font-medium mb-2 px-1">완료됨 ({completedTodos.length})</p>
                  {completedTodos.map(todo => (
                    <TodoItem key={todo.id} todo={todo} onToggle={handleToggleTodo} onDelete={handleDeleteTodo} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isAddOpen && <AddScheduleDialog onClose={() => setIsAddOpen(false)} />}
      {isBrowseOpen && <CourseBrowserDialog onClose={() => setIsBrowseOpen(false)} />}
      {isAddTodoOpen && <AddTodoDialog onClose={() => setIsAddTodoOpen(false)} onAdd={handleAddTodo} />}
    </Layout>
  );
}

// ────────────────────── Schedule Block ──────────────────────
function ScheduleBlock({ schedule, pixelsPerHour = 60 }: { schedule: Schedule; pixelsPerHour?: number }) {
  const queryClient = useQueryClient();
  const [showDetail, setShowDetail] = useState(false);
  const deleteMutation = useDeleteSchedule({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/schedule"] }); setShowDetail(false); } },
  });
  const parseTime = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const startMins = parseTime(schedule.startTime);
  const endMins = parseTime(schedule.endTime);
  const dayStartMins = 9 * 60;
  const topOffset = (startMins - dayStartMins) * pixelsPerHour / 60;
  const height = Math.max((endMins - startMins) * pixelsPerHour / 60, 18);
  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="absolute rounded-lg p-1 text-white overflow-hidden shadow-sm cursor-pointer hover:brightness-110 transition-all z-10"
        style={{ top: `${topOffset}px`, height: `${height}px`, left: `calc(40px + ${schedule.dayOfWeek} * ((100% - 40px) / 6))`, width: `calc((100% - 40px) / 6 - 3px)`, backgroundColor: schedule.color, marginLeft: "1px" }}
      >
        <div className="text-[10px] font-bold leading-tight line-clamp-2">{schedule.subjectName}</div>
        <div className="text-[9px] opacity-80 truncate">{schedule.location}</div>
      </div>
      {showDetail && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowDetail(false)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="w-6 h-6" /></button>
            <div className="w-12 h-12 rounded-2xl mb-4" style={{ backgroundColor: schedule.color }} />
            <h3 className="text-2xl font-bold mb-1">{schedule.subjectName}</h3>
            <div className="space-y-3 mt-6">
              <div className="flex items-center text-muted-foreground"><Clock className="w-5 h-5 mr-3 text-primary" /><span>{DAYS[schedule.dayOfWeek]}요일 {schedule.startTime} ~ {schedule.endTime}</span></div>
              {schedule.location && <div className="flex items-center text-muted-foreground"><MapPin className="w-5 h-5 mr-3 text-primary" /><span>{schedule.location}</span></div>}
              {schedule.professor && <div className="flex items-center text-muted-foreground"><User className="w-5 h-5 mr-3 text-primary" /><span>{schedule.professor} 교수님</span></div>}
            </div>
            <button onClick={() => deleteMutation.mutate({ id: schedule.id })} disabled={deleteMutation.isPending} className="mt-8 w-full py-4 rounded-xl font-bold bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-colors">
              <Trash2 className="w-5 h-5 mr-2" />{deleteMutation.isPending ? "삭제 중..." : "이 수업 삭제하기"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ────────────────────── Todo Item ──────────────────────
function TodoItem({ todo, onToggle, onDelete }: { todo: Todo; onToggle: (id: number, v: boolean) => void; onDelete: (id: number) => void }) {
  const cat = CATEGORY_COLORS[todo.category] || CATEGORY_COLORS["기타"];
  const [swiped, setSwiped] = useState(false);

  const daysLeft = todo.dueDate ? Math.ceil((new Date(todo.dueDate).getTime() - Date.now()) / 86400000) : null;

  return (
    <div className={cn("bg-white rounded-2xl border border-border/50 shadow-sm p-3 flex items-center gap-3 transition-opacity", todo.completed && "opacity-60")}>
      <button onClick={() => onToggle(todo.id, !todo.completed)} className="shrink-0 text-primary hover:scale-110 transition-transform">
        {todo.completed ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-muted-foreground/40" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold text-foreground truncate", todo.completed && "line-through text-muted-foreground")}>{todo.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", cat.bg, cat.text)}>{todo.category}</span>
          {daysLeft !== null && (
            <span className={cn("text-[10px] font-medium", daysLeft < 0 ? "text-destructive" : daysLeft <= 2 ? "text-orange-500" : "text-muted-foreground")}>
              {daysLeft < 0 ? `D+${Math.abs(daysLeft)}` : daysLeft === 0 ? "오늘까지" : `D-${daysLeft}`}
            </span>
          )}
        </div>
      </div>
      <button onClick={() => onDelete(todo.id)} className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ────────────────────── Add Todo Dialog ──────────────────────
function AddTodoDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (d: { title: string; category: string; dueDate?: string }) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("과제");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    await onAdd({ title: title.trim(), category, dueDate: dueDate || undefined });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center">
      <div className="bg-card w-full max-w-md rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">할 일 추가</h2>
          <button onClick={onClose} className="p-2 bg-muted rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required value={title} onChange={e => setTitle(e.target.value)}
            placeholder="할 일을 입력하세요..."
            className="w-full bg-secondary/50 px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 ring-primary/20 border border-transparent focus:border-primary transition-all"
          />
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2">카테고리</p>
            <div className="flex gap-2 flex-wrap">
              {TODO_CATEGORIES.map(cat => {
                const c = CATEGORY_COLORS[cat];
                return (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors", category === cat ? `${c.bg} ${c.text} border-current` : "bg-secondary text-muted-foreground border-transparent hover:bg-secondary/80")}>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">마감일 (선택)</p>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full bg-secondary/50 px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 ring-primary/20 border border-transparent focus:border-primary transition-all"
            />
          </div>
          <button type="submit" disabled={loading || !title.trim()}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50">
            {loading ? "추가 중..." : "추가하기"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ────────────────────── Add Schedule Dialog ──────────────────────
function AddScheduleDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ subjectName: "", professor: "", location: "", dayOfWeek: 0, startTime: "09:00", endTime: "10:30", color: COLORS[0] });
  const createMutation = useCreateSchedule({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/schedule"] }); onClose(); } } });
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); createMutation.mutate({ data: formData }); };
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center">
      <div className="bg-card w-full max-w-md rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold">시간표 추가</h2>
          <button onClick={onClose} className="p-2 bg-muted rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required value={formData.subjectName} onChange={e => setFormData({ ...formData, subjectName: e.target.value })}
            className="w-full bg-secondary/50 border border-transparent focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none text-sm" placeholder="과목명 *" />
          <div className="grid grid-cols-2 gap-3">
            <input value={formData.professor} onChange={e => setFormData({ ...formData, professor: e.target.value })}
              className="w-full bg-secondary/50 border border-transparent focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none text-sm" placeholder="교수명" />
            <input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}
              className="w-full bg-secondary/50 border border-transparent focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none text-sm" placeholder="강의실" />
          </div>
          <div className="flex gap-1.5">
            {DAYS.map((day, i) => (
              <button key={day} type="button" onClick={() => setFormData({ ...formData, dayOfWeek: i })}
                className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-colors", formData.dayOfWeek === i ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                {day}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="time" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })}
              className="w-full bg-secondary/50 border border-transparent focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none text-sm" />
            <input type="time" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })}
              className="w-full bg-secondary/50 border border-transparent focus:bg-white focus:border-primary px-4 py-3 rounded-xl transition-all outline-none text-sm" />
          </div>
          <div className="flex gap-2">
            {COLORS.map(color => (
              <button key={color} type="button" onClick={() => setFormData({ ...formData, color })}
                className={cn("w-7 h-7 rounded-full transition-transform", formData.color === color ? "scale-125 ring-2 ring-offset-1 ring-foreground/30" : "hover:scale-110")}
                style={{ backgroundColor: color }} />
            ))}
          </div>
          <button type="submit" disabled={createMutation.isPending}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-60 text-sm">
            {createMutation.isPending ? "추가 중..." : "시간표 추가"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ────────────────────── Course Browser ──────────────────────
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
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [deptSearch, setDeptSearch] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const createMutation = useCreateSchedule();

  useEffect(() => {
    fetchDepartments().then(setDepartments).finally(() => setIsLoadingDepts(false));
  }, []);

  const loadCourses = useCallback(async (dept: string, year: string, search: string) => {
    if (!dept && !search) { setCourses([]); return; }
    setIsLoadingCourses(true);
    try { const data = await fetchCourses(dept, year, search); setCourses(data); setSelected(new Set()); }
    catch {}
    finally { setIsLoadingCourses(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadCourses(selectedDept, selectedYear, searchQuery), 300);
    return () => clearTimeout(t);
  }, [selectedDept, selectedYear, searchQuery, loadCourses]);

  const toggleSelect = (id: number) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleImport = async () => {
    const toImport = courses.filter(c => selected.has(c.id));
    if (!toImport.length) return;
    setIsImporting(true);
    let ci = colorIndex;
    for (const course of toImport) {
      if (!course.timeRoom) continue;
      const slots = parseTimeSlots(course.timeRoom, course.subjectName, course.professor || "");
      if (!slots.length) continue;
      const color = COLORS[ci % COLORS.length];
      for (const slot of slots) {
        try { await createMutation.mutateAsync({ data: { subjectName: slot.subjectName, professor: slot.professor || undefined, location: slot.location || undefined, dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, color } }); } catch {}
      }
      ci++;
    }
    setColorIndex(ci);
    queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
    setIsImporting(false);
    setImportDone(true);
    setTimeout(() => onClose(), 1200);
  };

  const filteredDepts = deptSearch ? departments.filter(d => d.includes(deptSearch)) : departments;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center">
      <div className="bg-card w-full max-w-lg rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-full duration-300 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center"><BookOpen className="w-4 h-4" /></div>
            <div><h2 className="text-base font-bold">수강편람 검색</h2><p className="text-xs text-muted-foreground">부산대학교 2025학년도</p></div>
          </div>
          <button onClick={onClose} className="p-2 bg-muted rounded-full"><X className="w-5 h-5" /></button>
        </div>
        {importDone ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><CheckSquare className="w-8 h-8" /></div>
            <p className="text-lg font-bold">불러오기 완료!</p>
            <p className="text-sm text-muted-foreground">{selected.size}개 수업이 시간표에 추가됐습니다.</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-border/50 space-y-3 shrink-0">
              <div className="relative">
                <button onClick={() => setShowDeptDropdown(!showDeptDropdown)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-secondary/60 rounded-xl text-sm font-medium hover:bg-secondary transition-colors">
                  <span className={selectedDept ? "text-foreground" : "text-muted-foreground"}>{isLoadingDepts ? "불러오는 중..." : (selectedDept || "학과/학부 선택")}</span>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showDeptDropdown && "rotate-180")} />
                </button>
                {showDeptDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden max-h-56 flex flex-col">
                    <div className="p-2 border-b border-border shrink-0">
                      <input autoFocus value={deptSearch} onChange={e => setDeptSearch(e.target.value)} placeholder="학과 검색..." className="w-full px-3 py-2 bg-secondary/60 rounded-lg text-sm outline-none" />
                    </div>
                    <div className="overflow-y-auto">
                      <button onClick={() => { setSelectedDept(""); setShowDeptDropdown(false); setDeptSearch(""); }} className={cn("w-full text-left px-4 py-2 text-sm hover:bg-secondary/60 transition-colors", !selectedDept && "text-primary font-semibold")}>전체 학과</button>
                      {filteredDepts.map(dept => (
                        <button key={dept} onClick={() => { setSelectedDept(dept); setShowDeptDropdown(false); setDeptSearch(""); }} className={cn("w-full text-left px-4 py-2 text-sm hover:bg-secondary/60 transition-colors", selectedDept === dept && "text-primary font-semibold bg-primary/5")}>{dept}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex gap-1 shrink-0">
                  {["전체", "1", "2", "3", "4"].map(y => (
                    <button key={y} onClick={() => setSelectedYear(y)} className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors", selectedYear === y ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary")}>
                      {y === "전체" ? "전체" : `${y}학년`}
                    </button>
                  ))}
                </div>
                <div className="flex-1 relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="과목명, 교수명" className="w-full pl-8 pr-3 py-2 bg-secondary/60 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 ring-primary/20 transition-all" />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingCourses ? (
                <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground"><BookOpen className="w-8 h-8 opacity-30" /><p className="text-sm">{selectedDept || searchQuery ? "검색 결과 없음" : "학과를 선택하거나 검색하세요"}</p></div>
              ) : (
                <>
                  <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/40 px-4 py-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{courses.length}개</span>
                    <button onClick={() => selected.size === courses.length ? setSelected(new Set()) : setSelected(new Set(courses.map(c => c.id)))} className="text-xs font-semibold text-primary hover:underline">
                      {selected.size === courses.length ? "전체 해제" : "전체 선택"}
                    </button>
                  </div>
                  <div className="divide-y divide-border/40">
                    {courses.map(course => {
                      const isChecked = selected.has(course.id);
                      return (
                        <button key={course.id} onClick={() => toggleSelect(course.id)} className={cn("w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors", isChecked ? "bg-primary/5" : "hover:bg-secondary/50")}>
                          <div className={cn("mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors", isChecked ? "bg-primary border-primary" : "border-border")}>
                            {isChecked && <CheckSquare className="w-2.5 h-2.5 text-white fill-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-semibold text-xs text-foreground">{course.subjectName}</span>
                              {course.credits && <span className="shrink-0 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{course.credits}학점</span>}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {course.professor && <span>{course.professor} · </span>}
                              {course.year && <span>{course.year}학년 · </span>}
                              {course.timeRoom && <span className="text-primary/70">{course.timeRoom.replace(/<br\s*\/?>/gi, " / ").substring(0, 30)}</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t border-border/50 shrink-0">
              <button onClick={handleImport} disabled={selected.size === 0 || isImporting} className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 text-sm">
                {isImporting ? "불러오는 중..." : selected.size > 0 ? `선택한 수업 ${selected.size}개 추가` : "수업을 선택하세요"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
