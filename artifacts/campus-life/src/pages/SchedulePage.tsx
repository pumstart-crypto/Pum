import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Clock, MapPin, User, Trash2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { 
  useGetSchedules, 
  useCreateSchedule, 
  useDeleteSchedule, 
  type Schedule 
} from "@workspace/api-client-react";
import { format } from "date-fns";

const DAYS = ["월", "화", "수", "목", "금", "토"];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 9); // 9:00 ~ 18:00
const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", 
  "#D4A5A5", "#9B59B6", "#1ABC9C", "#F1C40F", "#E67E22"
];

export function SchedulePage() {
  const { data: schedules = [], isLoading } = useGetSchedules();
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <Layout>
      <div className="p-6 pt-12 pb-6 flex items-center justify-between">
        <div>
          <p className="text-muted-foreground font-medium mb-1">
            {format(new Date(), "MM월 dd일")}
          </p>
          <h1 className="text-3xl text-foreground">이번 주 <span className="text-primary">시간표</span></h1>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="px-4 pb-10">
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-border/50 relative overflow-x-auto">
          {isLoading ? (
            <div className="h-[600px] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="min-w-[400px]">
              {/* Header */}
              <div className="flex mb-2">
                <div className="w-12" /> {/* Time column spacer */}
                {DAYS.map((day) => (
                  <div key={day} className="flex-1 text-center font-bold text-muted-foreground text-sm py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="relative">
                {/* Background grid lines */}
                {HOURS.map((hour) => (
                  <div key={hour} className="flex border-t border-border/40 h-[60px]">
                    <div className="w-12 text-xs text-muted-foreground font-medium relative -top-2.5 pr-2 text-right">
                      {hour}
                    </div>
                    <div className="flex-1 border-l border-border/40" />
                    <div className="flex-1 border-l border-border/40" />
                    <div className="flex-1 border-l border-border/40" />
                    <div className="flex-1 border-l border-border/40" />
                    <div className="flex-1 border-l border-border/40" />
                    <div className="flex-1 border-l border-border/40" />
                  </div>
                ))}

                {/* Schedule Blocks */}
                {schedules.map((schedule) => (
                  <ScheduleBlock key={schedule.id} schedule={schedule} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {isAddOpen && <AddScheduleDialog onClose={() => setIsAddOpen(false)} />}
    </Layout>
  );
}

function ScheduleBlock({ schedule }: { schedule: Schedule }) {
  const queryClient = useQueryClient();
  const [showDetail, setShowDetail] = useState(false);
  
  const deleteMutation = useDeleteSchedule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      }
    }
  });

  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const startMins = parseTime(schedule.startTime);
  const endMins = parseTime(schedule.endTime);
  const dayStartMins = 9 * 60; // 9:00 AM grid start
  
  // 1 hour = 60px height
  const topOffset = startMins - dayStartMins;
  const height = endMins - startMins;
  
  // Mon=0 to Sat=5, columns are shifted by 3rem (48px) for time labels
  const leftPercent = `calc(3rem + ${schedule.dayOfWeek * (100 / 6)}% - ${schedule.dayOfWeek * 0.5}rem)`;
  const widthPercent = `calc(${100 / 6}% - 1rem)`; // Approx spacing

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
          marginLeft: '2px'
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
              onClick={() => {
                deleteMutation.mutate({ id: schedule.id });
              }}
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

function AddScheduleDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    subjectName: "",
    professor: "",
    location: "",
    dayOfWeek: 0,
    startTime: "09:00",
    endTime: "10:30",
    color: COLORS[0]
  });

  const createMutation = useCreateSchedule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
        onClose();
      }
    }
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
                type="time" required
                value={formData.startTime}
                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full bg-secondary/50 focus:bg-white focus:border-primary border border-transparent px-4 py-3 rounded-xl transition-all outline-none" 
              />
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-1">종료 시간 *</label>
              <input 
                type="time" required
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
