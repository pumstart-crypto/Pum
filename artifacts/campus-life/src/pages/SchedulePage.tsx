import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Clock, MapPin, User, Trash2, Upload, Search, CheckSquare, Square, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { 
  useGetSchedules, 
  useCreateSchedule, 
  useDeleteSchedule, 
  type Schedule 
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

const DAYS = ["월", "화", "수", "목", "금", "토"];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 9);
const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", 
  "#D4A5A5", "#9B59B6", "#1ABC9C", "#F1C40F", "#E67E22"
];

const DAY_MAP: Record<string, number> = {
  월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6,
};

interface ParsedCourse {
  subjectName: string;
  professor: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string;
  rawTime: string;
}

function parseTimeSlots(timeRoom: string, subject: string, professor: string): ParsedCourse[] {
  if (!timeRoom) return [];

  const parts = timeRoom.split(/,?\s*<br\s*\/?>\s*/i);
  const result: ParsedCourse[] = [];

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
      location = afterStart.slice(endTimeMatch[0].length).replace(/^\(외부\)[^\s]*/g, "온라인").trim();
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

    if (location.match(/^knu10|^(외부)/)) {
      location = "온라인";
    }

    result.push({ subjectName: subject, professor, dayOfWeek, startTime, endTime, location, rawTime: trimmed });
  }

  return result;
}

function parseExcelFile(file: File): Promise<ParsedCourse[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

        const courses: ParsedCourse[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[4]) continue;

          const subject = String(row[4] || "").trim();
          const professor = String(row[10] || "").trim();
          const timeRoom = String(row[11] || "").trim();

          if (!subject || !timeRoom) continue;

          const slots = parseTimeSlots(timeRoom, subject, professor);
          courses.push(...slots);
        }
        resolve(courses);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsArrayBuffer(file);
  });
}

export function SchedulePage() {
  const { data: schedules = [], isLoading } = useGetSchedules();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  return (
    <Layout>
      <div className="p-6 pt-12 pb-6 flex items-center justify-between">
        <div>
          <p className="text-muted-foreground font-medium mb-1">
            {format(new Date(), "MM월 dd일")}
          </p>
          <h1 className="text-3xl text-foreground">이번 주 <span className="text-primary">시간표</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 bg-secondary text-secondary-foreground rounded-full px-4 py-2.5 text-sm font-semibold hover:bg-secondary/80 active:scale-95 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4" />
            엑셀
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-10">
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-border/50 relative overflow-x-auto">
          {isLoading ? (
            <div className="h-[600px] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="min-w-[400px]">
              <div className="flex mb-2">
                <div className="w-12" />
                {DAYS.map((day) => (
                  <div key={day} className="flex-1 text-center font-bold text-muted-foreground text-sm py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="relative">
                {HOURS.map((hour) => (
                  <div key={hour} className="flex border-t border-border/40 h-[60px]">
                    <div className="w-12 text-xs text-muted-foreground font-medium relative -top-2.5 pr-2 text-right">
                      {hour}
                    </div>
                    {DAYS.map((_, i) => (
                      <div key={i} className="flex-1 border-l border-border/40" />
                    ))}
                  </div>
                ))}

                {schedules.map((schedule) => (
                  <ScheduleBlock key={schedule.id} schedule={schedule} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {isAddOpen && <AddScheduleDialog onClose={() => setIsAddOpen(false)} />}
      {isImportOpen && <ExcelImportDialog onClose={() => setIsImportOpen(false)} />}
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
          left: `calc(48px + ${schedule.dayOfWeek} * ((100% - 48px) / 6))`,
          width: `calc((100% - 48px) / 6 - 4px)`,
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

function ExcelImportDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [courses, setCourses] = useState<ParsedCourse[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);

  const createMutation = useCreateSchedule();

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setError("");
    setCourses([]);
    setSelected(new Set());
    try {
      const parsed = await parseExcelFile(file);
      setCourses(parsed);
      if (parsed.length === 0) {
        setError("파싱 가능한 수업 데이터가 없습니다. 부산대 수강편람 파일인지 확인하세요.");
      }
    } catch {
      setError("파일을 읽는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filtered = courses.filter(c =>
    c.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.professor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((_, i) => courses.indexOf(_))));
    }
  };

  const handleImport = async () => {
    const toImport = courses.filter((_, i) => selected.has(i));
    if (toImport.length === 0) return;
    setIsImporting(true);
    let ci = colorIndex;
    for (const course of toImport) {
      try {
        await createMutation.mutateAsync({
          data: {
            subjectName: course.subjectName,
            professor: course.professor || undefined,
            location: course.location || undefined,
            dayOfWeek: course.dayOfWeek,
            startTime: course.startTime,
            endTime: course.endTime,
            color: COLORS[ci % COLORS.length],
          },
        });
        ci++;
      } catch {
        // continue
      }
    }
    setColorIndex(ci);
    queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
    setIsImporting(false);
    setImportDone(true);
    setTimeout(() => onClose(), 1500);
  };

  const selectedCount = selected.size;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full sm:fade-in sm:zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">수강편람 불러오기</h2>
              <p className="text-xs text-muted-foreground">부산대학교 수강편람 엑셀 파일</p>
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
            {/* File Upload Area */}
            <div className="p-4 border-b border-border/50">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-primary/30 rounded-2xl p-4 flex items-center gap-3 hover:border-primary/60 hover:bg-primary/5 transition-all"
              >
                <Upload className="w-5 h-5 text-primary shrink-0" />
                <div className="text-left">
                  <div className="font-semibold text-sm text-foreground">
                    {courses.length > 0 ? `✅ ${courses.length}개 수업 파싱 완료 — 다른 파일 선택` : "수강편람 xlsx 파일 선택"}
                  </div>
                  <div className="text-xs text-muted-foreground">부산대 학생지원시스템 → 학사정보 → 수업/수강편람</div>
                </div>
              </button>

              {error && (
                <div className="mt-3 flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {isLoading && (
                <div className="mt-3 flex items-center gap-2 text-primary text-sm px-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>파일 분석 중...</span>
                </div>
              )}
            </div>

            {/* Course List */}
            {courses.length > 0 && (
              <>
                <div className="p-4 border-b border-border/50 flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="과목명, 교수명으로 검색..."
                      className="w-full pl-9 pr-4 py-2.5 bg-secondary/60 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 ring-primary/20 transition-all"
                    />
                  </div>
                  <button
                    onClick={toggleAll}
                    className="shrink-0 text-sm font-semibold text-primary hover:underline"
                  >
                    {selected.size === filtered.length ? "전체 해제" : "전체 선택"}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-border/40">
                  {filtered.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">검색 결과가 없습니다.</div>
                  ) : (
                    filtered.map((course) => {
                      const realIdx = courses.indexOf(course);
                      const isChecked = selected.has(realIdx);
                      return (
                        <button
                          key={realIdx}
                          onClick={() => toggleSelect(realIdx)}
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
                            <div className="font-semibold text-sm text-foreground leading-tight truncate">{course.subjectName}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                              <span className="text-primary font-medium">{DAYS[course.dayOfWeek]}요일 {course.startTime}~{course.endTime}</span>
                              {course.professor && <span>{course.professor} 교수</span>}
                              {course.location && <span className="truncate">{course.location}</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border/50">
                  <button
                    onClick={handleImport}
                    disabled={selectedCount === 0 || isImporting}
                    className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting
                      ? "불러오는 중..."
                      : selectedCount > 0
                        ? `선택한 수업 ${selectedCount}개 불러오기`
                        : "수업을 선택하세요"}
                  </button>
                </div>
              </>
            )}
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
          <h2 className="text-xl font-bold">새 시간표 추가</h2>
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
                className="w-full bg-secondary/50 focus:bg-white focus:border-primary border border-transparent px-4 py-3 rounded-xl transition-all outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">강의실</label>
              <input
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-secondary/50 focus:bg-white focus:border-primary border border-transparent px-4 py-3 rounded-xl transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-1">요일 *</label>
            <div className="flex gap-2">
              {DAYS.map((day, idx) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setFormData({ ...formData, dayOfWeek: idx })}
                  className={cn(
                    "flex-1 py-2 rounded-xl font-bold text-sm transition-all",
                    formData.dayOfWeek === idx
                      ? "bg-primary text-white shadow-md"
                      : "bg-secondary text-muted-foreground hover:bg-secondary-foreground/10"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">시작 시간 *</label>
              <input
                type="time"
                required
                value={formData.startTime}
                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full bg-secondary/50 focus:bg-white focus:border-primary border border-transparent px-4 py-3 rounded-xl transition-all outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">종료 시간 *</label>
              <input
                type="time"
                required
                value={formData.endTime}
                onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full bg-secondary/50 focus:bg-white focus:border-primary border border-transparent px-4 py-3 rounded-xl transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-2">색상 *</label>
            <div className="flex flex-wrap gap-3">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    formData.color === color ? "scale-125 ring-4 ring-offset-2 ring-primary/30" : "hover:scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full mt-4 bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
          >
            {createMutation.isPending ? "추가 중..." : "시간표에 추가하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
