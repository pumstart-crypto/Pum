import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useLocation } from "wouter";
import { useGetSchedules, type Schedule } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Plus, X, Circle, CheckCircle2 } from "lucide-react";

const DAY_MAP: Record<string, number> = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 };
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// ── Quick Links ──────────────────────────────────────────────────────
const QUICK_LINKS = [
  { label: "홈페이지",  icon: "language",       href: "https://www.pusan.ac.kr", external: true },
  { label: "PLATO",    icon: "school",          href: "https://plato.pusan.ac.kr", external: true },
  { label: "도서관",   icon: "local_library",   href: "https://lib.pusan.ac.kr", external: true },
  { label: "식단",     icon: "restaurant",      href: "/meals", external: false },
  { label: "학사일정", icon: "event_note",      href: "https://www.pusan.ac.kr/kor/CMS/UnivSchedule/listPage.do", external: true },
  { label: "학생지원", icon: "help_center",     href: "https://student.pusan.ac.kr", external: true },
];

// ── Todo Types ────────────────────────────────────────────────────────
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

async function fetchTodos() {
  const res = await fetch(`${BASE}/api/todos`);
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<Todo[]>;
}
async function createTodo(data: { title: string; category: string; dueDate?: string }) {
  const res = await fetch(`${BASE}/api/todos`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<Todo>;
}
async function toggleTodo(id: number, completed: boolean) {
  const res = await fetch(`${BASE}/api/todos/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<Todo>;
}
async function deleteTodo(id: number) {
  await fetch(`${BASE}/api/todos/${id}`, { method: "DELETE" });
}

// ── Today's schedule helper ───────────────────────────────────────────
function getTodaySchedules(schedules: Schedule[]): Schedule[] {
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0 … Fri=4
  return schedules
    .filter(s => s.dayOfWeek === todayIdx)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// ── Main Page ─────────────────────────────────────────────────────────
export function HomePage() {
  const { data: schedules = [] } = useGetSchedules();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [isAddTodoOpen, setIsAddTodoOpen] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [, navigate] = useLocation();

  useEffect(() => {
    fetchTodos().then(setTodos).finally(() => setTodosLoading(false));
  }, []);

  const handleToggle = async (id: number, completed: boolean) => {
    const updated = await toggleTodo(id, completed);
    setTodos(prev => prev.map(t => t.id === id ? updated : t));
  };
  const handleDelete = async (id: number) => {
    await deleteTodo(id);
    setTodos(prev => prev.filter(t => t.id !== id));
  };
  const handleAddTodo = async (data: { title: string; category: string; dueDate?: string }) => {
    const created = await createTodo(data);
    setTodos(prev => [created, ...prev]);
  };

  const quickAdd = async () => {
    if (!newTask.trim()) return;
    const t = newTask.trim();
    setNewTask("");
    await handleAddTodo({ title: t, category: "기타" });
  };

  const todaySchedules = getTodaySchedules(schedules);
  const incompleteTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const weekdayKo = ["일", "월", "화", "수", "목", "금", "토"][dayOfWeek];
  const monthDay = format(now, "M월 d일");

  return (
    <Layout>
      <div className="px-5 pt-5 pb-32">

        {/* ── Hero Date ─────────────────────────────── */}
        <section className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-1.5">
            부산대학교
          </p>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}
            className="text-4xl font-extrabold text-foreground leading-tight">
            {monthDay}
            <span className="text-muted-foreground/35 ml-2">{weekdayKo}요일</span>
          </h2>
        </section>

        {/* ── Quick Links horizontal scroll ─────────────────── */}
        <section className="mb-8 -mx-5">
          <div className="flex gap-4 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: "none" }}>
            {QUICK_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.external ? link.href : undefined}
                onClick={!link.external ? (e) => { e.preventDefault(); navigate(link.href); } : undefined}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="flex flex-col items-center shrink-0 group"
              >
                <div className="w-16 h-16 bg-white shadow-[0_8px_24px_rgba(0,66,125,0.07)] rounded-3xl flex items-center justify-center text-primary group-hover:scale-105 group-active:scale-95 transition-transform duration-200">
                  <span className="material-symbols-outlined" style={{ fontSize: 28 }}>{link.icon}</span>
                </div>
                <span className="mt-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                  {link.label}
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* ── Today's Timetable ────────────────────── */}
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-4">
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              className="text-2xl font-bold text-foreground">오늘 시간표</h3>
            <button onClick={() => navigate("/schedule")}
              className="text-primary font-bold text-sm">
              전체 보기
            </button>
          </div>

          {todaySchedules.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-border/30">
              <span className="material-symbols-outlined text-muted-foreground/30 block mb-2" style={{ fontSize: 36 }}>event_busy</span>
              <p className="text-sm font-medium text-muted-foreground">오늘 수업이 없어요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaySchedules.map(s => (
                <TimetableItem key={s.id} schedule={s} />
              ))}
            </div>
          )}
        </section>

        {/* ── Tasks ────────────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              className="text-2xl font-bold text-foreground">Tasks</h3>
            <button onClick={() => setIsAddTodoOpen(true)}
              className="text-primary font-bold text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" />추가
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="divide-y divide-border/40">
              {todosLoading ? (
                <div className="p-6 flex justify-center">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : incompleteTodos.length === 0 && completedTodos.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-muted-foreground/25 block mb-2" style={{ fontSize: 36 }}>task_alt</span>
                  <p className="text-sm text-muted-foreground font-medium">할 일을 추가해보세요</p>
                </div>
              ) : (
                <>
                  {incompleteTodos.map(todo => (
                    <TaskRow key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
                  ))}
                  {completedTodos.map(todo => (
                    <TaskRow key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
                  ))}
                </>
              )}
            </div>

            {/* Inline quick-add */}
            <div className="flex items-center gap-3 bg-muted/40 mx-4 mb-4 mt-2 rounded-2xl px-4 py-3 border border-dashed border-border/60 focus-within:border-primary transition-colors">
              <span className="material-symbols-outlined text-muted-foreground" style={{ fontSize: 20 }}>add</span>
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === "Enter" && quickAdd()}
                placeholder="할 일 추가 (Enter)"
                className="bg-transparent border-none focus:ring-0 focus:outline-none w-full text-sm font-medium placeholder:text-muted-foreground/50 text-foreground"
              />
            </div>
          </div>
        </section>

      </div>

      {isAddTodoOpen && <AddTodoDialog onClose={() => setIsAddTodoOpen(false)} onAdd={handleAddTodo} />}
    </Layout>
  );
}

// ── Timetable List Item ───────────────────────────────────────────────
function TimetableItem({ schedule }: { schedule: Schedule }) {
  return (
    <div className="bg-white rounded-3xl px-5 py-4 flex items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-border/20">
      <div className="flex flex-col items-center border-r border-border/40 pr-4 shrink-0">
        <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">시작</span>
        <span className="text-base font-extrabold text-primary mt-0.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {schedule.startTime}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-foreground truncate">{schedule.subjectName}</h4>
        {schedule.location && (
          <p className="text-sm text-muted-foreground flex items-center gap-0.5 mt-0.5">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
            {schedule.location}
          </p>
        )}
      </div>
      <div className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: schedule.color }} />
    </div>
  );
}

// ── Task Row ──────────────────────────────────────────────────────────
function TaskRow({ todo, onToggle, onDelete }: { todo: Todo; onToggle: (id: number, v: boolean) => void; onDelete: (id: number) => void }) {
  const cat = CATEGORY_COLORS[todo.category] || CATEGORY_COLORS["기타"];
  const dueDateTime = todo.dueDate ? new Date(todo.dueDate) : null;
  const hasTime = todo.dueDate?.includes("T");
  const now = Date.now();
  const daysLeft = dueDateTime ? Math.ceil((dueDateTime.getTime() - now) / 86400000) : null;
  const isOverdue = dueDateTime ? dueDateTime.getTime() < now && !todo.completed : false;

  return (
    <label className="flex items-center gap-4 px-6 py-3.5 cursor-pointer group">
      <button onClick={() => onToggle(todo.id, !todo.completed)} className="shrink-0">
        {todo.completed
          ? <CheckCircle2 className="w-6 h-6 text-primary" />
          : <Circle className="w-6 h-6 text-border group-hover:text-primary/40 transition-colors" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm font-medium", todo.completed ? "line-through text-muted-foreground decoration-primary/40" : "text-foreground")}>
          {todo.title}
        </span>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", cat.bg, cat.text)}>{todo.category}</span>
          {dueDateTime && (
            <span className={cn("text-[10px] font-medium", isOverdue ? "text-destructive" : daysLeft !== null && daysLeft <= 1 ? "text-orange-500" : "text-muted-foreground")}>
              {daysLeft === null ? "" : daysLeft < 0 ? `D+${Math.abs(daysLeft)}` : daysLeft === 0 ? "오늘" : `D-${daysLeft}`}
              {hasTime && dueDateTime && ` · ${dueDateTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}`}
            </span>
          )}
        </div>
      </div>
      <button onClick={() => onDelete(todo.id)} className="shrink-0 opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all">
        <X className="w-4 h-4" />
      </button>
    </label>
  );
}

// ── Add Todo Dialog ───────────────────────────────────────────────────
function AddTodoDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (d: { title: string; category: string; dueDate?: string }) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("과제");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    let combined: string | undefined;
    if (dueDate && dueTime) combined = `${dueDate}T${dueTime}`;
    else if (dueDate) combined = dueDate;
    await onAdd({ title: title.trim(), category, dueDate: combined });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>할 일 추가</h2>
          <button onClick={onClose} className="p-2 bg-muted rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required value={title} onChange={e => setTitle(e.target.value)}
            placeholder="할 일을 입력하세요..."
            className="w-full bg-muted/50 px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 ring-primary/20 border border-transparent focus:border-primary transition-all" />
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">카테고리</p>
            <div className="flex gap-2 flex-wrap">
              {TODO_CATEGORIES.map(cat => {
                const c = CATEGORY_COLORS[cat];
                return (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors", category === cat ? `${c.bg} ${c.text} border-current` : "bg-muted text-muted-foreground border-transparent")}>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">마감일 · 시간 (선택)</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full bg-muted/50 px-3 py-3 rounded-xl text-sm outline-none focus:ring-2 ring-primary/20 border border-transparent focus:border-primary transition-all" />
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} disabled={!dueDate}
                className="w-full bg-muted/50 px-3 py-3 rounded-xl text-sm outline-none focus:ring-2 ring-primary/20 border border-transparent focus:border-primary transition-all disabled:opacity-40" />
            </div>
          </div>
          <button type="submit" disabled={loading || !title.trim()}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-[0_4px_16px_rgba(0,66,125,0.25)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {loading ? "추가 중..." : "추가하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
