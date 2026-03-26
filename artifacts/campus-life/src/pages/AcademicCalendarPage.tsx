import { useState } from "react";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import { CalendarDays, Clock } from "lucide-react";

interface CalendarEvent {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  title: string;
}

const EVENTS: CalendarEvent[] = [
  { startDate: "2025-10-31", startTime: "09:00", endDate: "2025-11-06", endTime: "18:00", title: "겨울계절 및 도약수업 복학신청기간" },
  { startDate: "2025-11-14", startTime: "09:00", endDate: "2025-11-18", endTime: "18:00", title: "겨울계절 및 도약수업 복학신청기간" },
  { startDate: "2025-11-25", startTime: "09:00", endDate: "2025-11-26", endTime: "18:00", title: "겨울계절 및 도약수업 복학신청기간" },
  { startDate: "2025-12-03", startTime: "09:00", endDate: "2025-12-04", endTime: "18:00", title: "겨울계절 및 도약수업 복학신청기간" },
  { startDate: "2025-12-22", startTime: "09:00", endDate: "2025-12-29", endTime: "18:00", title: "1학기 휴·복학 신청기간" },
  { startDate: "2026-01-09", startTime: "09:00", endDate: "2026-02-03", endTime: "17:00", title: "1학기 학사학위취득유예신청기간" },
  { startDate: "2026-01-12", startTime: "09:00", endDate: "2026-01-14", endTime: "18:00", title: "1학기 부전공 신청" },
  { startDate: "2026-01-12", startTime: "09:00", endDate: "2026-01-14", endTime: "18:00", title: "1학기 복수전공 신청" },
  { startDate: "2026-01-12", startTime: "09:00", endDate: "2026-01-23", endTime: "23:59", title: "1학기 국문·영문 교수계획표 입력" },
  { startDate: "2026-01-23", startTime: "09:00", endDate: "2026-01-29", endTime: "18:00", title: "1학기 휴·복학 신청기간" },
  { startDate: "2026-01-29", startTime: "00:00", endDate: "2026-02-05", endTime: "18:00", title: "1학기 수료후연구생 신청기간" },
  { startDate: "2026-02-02", startTime: "10:00", endDate: "2026-02-03", endTime: "17:00", title: "1학기 희망과목담기" },
  { startDate: "2026-02-04", startTime: "09:00", endDate: "2026-02-04", endTime: "18:00", title: "1학기 자동신청결과확인" },
  { startDate: "2026-02-04", startTime: "10:00", endDate: "2026-02-09", endTime: "18:00", title: "1학기 분할납부신청기간" },
  { startDate: "2026-02-05", startTime: "09:00", endDate: "2026-02-13", endTime: "18:00", title: "1학기 WEB 근로/학업지원" },
  { startDate: "2026-02-05", startTime: "09:00", endDate: "2026-02-13", endTime: "18:00", title: "1학기 ONE(교육정보) 웹신청관리" },
  { startDate: "2026-02-09", startTime: "08:00", endDate: "2026-02-11", endTime: "17:00", title: "1학기 수강신청(학부)" },
  { startDate: "2026-02-09", startTime: "08:00", endDate: "2026-02-11", endTime: "17:00", title: "1학기 수강신청(대학원)" },
  { startDate: "2026-02-09", startTime: "08:00", endDate: "2026-02-11", endTime: "17:00", title: "1학기 수강신청(타대생)" },
  { startDate: "2026-02-12", startTime: "10:00", endDate: "2026-02-13", endTime: "17:00", title: "1학기 수강신청(신입생)" },
  { startDate: "2026-02-19", startTime: "00:00", endDate: "2026-03-20", endTime: "00:00", title: "1학기 학위청구자격시험 WEB 신청_조회(치의학전문대학원)" },
  { startDate: "2026-02-19", startTime: "09:00", endDate: "2026-02-24", endTime: "18:00", title: "1학기 휴·복학 신청기간" },
  { startDate: "2026-02-19", startTime: "10:00", endDate: "2026-02-20", endTime: "17:00", title: "1학기 수강신청(학부)" },
  { startDate: "2026-02-19", startTime: "10:00", endDate: "2026-02-20", endTime: "17:00", title: "1학기 수강신청(대학원)" },
  { startDate: "2026-02-19", startTime: "10:00", endDate: "2026-02-20", endTime: "17:00", title: "1학기 수강신청(타대생)" },
  { startDate: "2026-02-19", startTime: "10:00", endDate: "2026-02-24", endTime: "23:59", title: "1학기 수료후연구생 등록금납부" },
  { startDate: "2026-02-19", startTime: "10:00", endDate: "2026-02-24", endTime: "23:59", title: "1학기 재학생 등록금납부" },
  { startDate: "2026-02-19", startTime: "10:00", endDate: "2026-03-10", endTime: "18:00", title: "1학기 학위청구자격시험 WEB 신청(대학원)" },
  { startDate: "2026-02-19", startTime: "10:00", endDate: "2026-03-10", endTime: "18:00", title: "1학기 학위청구자격시험 WEB 신청(한의학전문대학원)" },
  { startDate: "2026-02-19", startTime: "10:00", endDate: "2026-03-20", endTime: "18:00", title: "1학기 학위청구자격시험(외국어시험) WEB 신청(한의학전문대학원)" },
  { startDate: "2026-02-19", startTime: "10:00", endDate: "2026-03-20", endTime: "18:00", title: "1학기 학위청구자격시험(외국어시험) WEB 신청(대학원)" },
  { startDate: "2026-02-19", startTime: "10:00", endDate: "2026-03-31", endTime: "23:59", title: "1학기 학위청구자격시험 WEB 신청_조회(법학전문대학원)" },
  { startDate: "2026-02-24", startTime: "10:00", endDate: "2026-03-13", endTime: "18:00", title: "1학기 학위청구자격시험 WEB 신청(기술창업대학원)" },
  { startDate: "2026-02-26", startTime: "00:00", endDate: "2026-02-26", endTime: "00:00", title: "1학기 1차 폐강강좌 공고" },
  { startDate: "2026-03-03", startTime: "00:00", endDate: "2026-03-03", endTime: "00:00", title: "1학기 개강" },
  { startDate: "2026-03-03", startTime: "08:00", endDate: "2026-03-09", endTime: "17:00", title: "1학기 수강정정(학부,타대생)" },
  { startDate: "2026-03-03", startTime: "08:00", endDate: "2026-03-09", endTime: "23:59", title: "1학기 수강정정(대학원)" },
  { startDate: "2026-03-03", startTime: "09:00", endDate: "2026-03-05", endTime: "18:00", title: "1학기 휴·복학 신청기간" },
  { startDate: "2026-03-03", startTime: "10:00", endDate: "2026-03-05", endTime: "23:59", title: "1학기 재학생 등록금납부" },
  { startDate: "2026-03-03", startTime: "14:00", endDate: "2026-03-06", endTime: "18:00", title: "1학기 WEB 근로/학업지원" },
  { startDate: "2026-03-03", startTime: "14:00", endDate: "2026-03-06", endTime: "18:00", title: "1학기 ONE(교육정보) 웹신청관리" },
  { startDate: "2026-03-04", startTime: "00:00", endDate: "2026-03-11", endTime: "18:00", title: "1학기 수료후연구생 신청기간" },
  { startDate: "2026-03-10", startTime: "09:00", endDate: "2026-03-13", endTime: "18:00", title: "1학기 학위청구자격시험 WEB 신청(융합의생명과학대학원)" },
  { startDate: "2026-03-16", startTime: "00:00", endDate: "2026-03-16", endTime: "00:00", title: "1학기 2차 폐강강좌 공고" },
  { startDate: "2026-03-17", startTime: "10:00", endDate: "2026-03-18", endTime: "17:00", title: "1학기 수강정정(대학원)" },
  { startDate: "2026-03-17", startTime: "10:00", endDate: "2026-03-18", endTime: "17:00", title: "1학기 수강정정(학부,타대생)" },
  { startDate: "2026-03-21", startTime: "14:00", endDate: "2026-03-23", endTime: "09:00", title: "1학기 도서관서버점검" },
  { startDate: "2026-03-24", startTime: "09:00", endDate: "2026-03-26", endTime: "18:00", title: "1학기 휴·복학 신청기간" },
  { startDate: "2026-03-24", startTime: "10:00", endDate: "2026-03-26", endTime: "23:59", title: "1학기 재학생 등록금납부" },
  { startDate: "2026-03-24", startTime: "10:00", endDate: "2026-03-26", endTime: "23:59", title: "1학기 재학생 차등납부등록" },
  { startDate: "2026-03-24", startTime: "10:00", endDate: "2026-03-26", endTime: "23:59", title: "1학기 수료후연구생 등록금납부" },
  { startDate: "2026-03-28", startTime: "14:00", endDate: "2026-03-31", endTime: "00:00", title: "1학기 도서관서버점검" },
  { startDate: "2026-03-30", startTime: "09:00", endDate: "2026-04-02", endTime: "17:00", title: "1학기 예비군 훈련 신청기간" },
  { startDate: "2026-03-31", startTime: "09:00", endDate: "2026-04-06", endTime: "18:00", title: "1학기 수강취소" },
  { startDate: "2026-04-06", startTime: "00:00", endDate: "2026-04-06", endTime: "00:00", title: "1학기 수업일수 1/3선" },
  { startDate: "2026-04-20", startTime: "09:00", endDate: "2026-04-25", endTime: "23:59", title: "1학기 중간고사" },
  { startDate: "2026-04-23", startTime: "00:00", endDate: "2026-11-23", endTime: "00:00", title: "1학기 수업일수 1/2선" },
  { startDate: "2026-05-06", startTime: "10:00", endDate: "2026-05-07", endTime: "12:00", title: "여름계절/도약수업 희망과목담기" },
  { startDate: "2026-05-08", startTime: "09:00", endDate: "2026-05-08", endTime: "18:00", title: "여름계절/도약수업 자동신청결과확인" },
  { startDate: "2026-05-12", startTime: "08:00", endDate: "2026-05-14", endTime: "17:00", title: "여름계절/도약수업 재학생 수강신청(학부)" },
  { startDate: "2026-05-12", startTime: "08:00", endDate: "2026-05-14", endTime: "17:00", title: "여름계절/도약수업 재학생 수강신청(대학원)" },
  { startDate: "2026-05-12", startTime: "08:00", endDate: "2026-05-14", endTime: "17:00", title: "여름계절/도약수업 수강신청(타대생)" },
  { startDate: "2026-05-13", startTime: "00:00", endDate: "2026-05-13", endTime: "00:00", title: "1학기 수업일수 2/3선" },
  { startDate: "2026-05-21", startTime: "00:00", endDate: "2026-05-21", endTime: "00:00", title: "여름계절수업 1차 폐강강좌 공고" },
  { startDate: "2026-05-22", startTime: "10:00", endDate: "2026-05-26", endTime: "17:00", title: "여름계절/도약수업 수강정정(학부,타대생)" },
  { startDate: "2026-05-22", startTime: "10:00", endDate: "2026-05-26", endTime: "17:00", title: "여름계절/도약수업 수강정정(대학원)" },
  { startDate: "2026-06-02", startTime: "00:00", endDate: "2026-06-02", endTime: "00:00", title: "여름계절수업 2차 폐강강좌 공고" },
  { startDate: "2026-06-04", startTime: "10:00", endDate: "2026-06-05", endTime: "17:00", title: "여름계절/도약수업 수강정정(학부,타대생)" },
  { startDate: "2026-06-04", startTime: "10:00", endDate: "2026-06-05", endTime: "17:00", title: "여름계절/도약수업 수강정정(대학원)" },
  { startDate: "2026-06-12", startTime: "10:00", endDate: "2026-06-16", endTime: "17:00", title: "여름계절수업 등록금납부" },
  { startDate: "2026-06-12", startTime: "10:00", endDate: "2026-06-16", endTime: "17:00", title: "여름도약수업 등록금납부" },
  { startDate: "2026-06-16", startTime: "09:00", endDate: "2026-06-22", endTime: "23:59", title: "1학기 기말고사" },
  { startDate: "2026-06-23", startTime: "00:00", endDate: "2026-06-23", endTime: "00:00", title: "1학기 여름휴가 시작" },
  { startDate: "2026-06-25", startTime: "00:00", endDate: "2026-07-21", endTime: "23:59", title: "여름계절수업 강의시작종료일" },
  { startDate: "2026-07-22", startTime: "00:00", endDate: "2026-08-18", endTime: "23:59", title: "여름도약수업 강의시작종료일" },
  { startDate: "2026-08-21", startTime: "00:00", endDate: "2026-08-21", endTime: "00:00", title: "1학기 후기 학위수여식" },
];

type FilterTab = "전체" | "진행중" | "예정" | "지난";

function getStatus(event: CalendarEvent, now: Date): "진행중" | "예정" | "지난" {
  const start = new Date(`${event.startDate}T${event.startTime === "00:00" ? "00:00:00" : event.startTime}`);
  const end = new Date(`${event.endDate}T${event.endTime === "00:00" ? "23:59:59" : event.endTime}`);
  if (now < start) return "예정";
  if (now > end) return "지난";
  return "진행중";
}

function formatDateRange(event: CalendarEvent): string {
  const isSameDay = event.startDate === event.endDate;
  const startParts = event.startDate.split("-");
  const endParts = event.endDate.split("-");
  const sm = parseInt(startParts[1]);
  const sd = parseInt(startParts[2]);
  const em = parseInt(endParts[1]);
  const ed = parseInt(endParts[2]);

  if (isSameDay) {
    return `${sm}/${sd}`;
  }
  return `${sm}/${sd} ~ ${em}/${ed}`;
}

function formatMonth(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parts[0]}년 ${parseInt(parts[1])}월`;
}

export function AcademicCalendarPage() {
  const [filter, setFilter] = useState<FilterTab>("전체");
  const now = new Date();

  const TABS: FilterTab[] = ["전체", "진행중", "예정", "지난"];

  const filtered = EVENTS.filter(ev => {
    if (filter === "전체") return true;
    return getStatus(ev, now) === filter;
  });

  const grouped: Record<string, CalendarEvent[]> = {};
  for (const ev of filtered) {
    const key = formatMonth(ev.startDate);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  }

  const TAB_STYLES: Record<FilterTab, string> = {
    "전체": "bg-slate-700 text-white",
    "진행중": "bg-green-500 text-white",
    "예정": "bg-primary text-white",
    "지난": "bg-slate-300 text-slate-600",
  };

  const STATUS_BADGE: Record<string, string> = {
    "진행중": "bg-green-100 text-green-700 border border-green-200",
    "예정": "bg-blue-50 text-primary border border-blue-200",
    "지난": "bg-slate-100 text-slate-400 border border-slate-200",
  };

  return (
    <Layout hideTopBar>
      <div className="pb-32">
        {/* Header */}
        <div className="px-5 pt-14 pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-1.5">부산대학교</p>
          <h2
            className="text-4xl font-extrabold text-foreground leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}
          >
            학사일정
          </h2>
          <p className="text-sm text-muted-foreground mt-1">2025~2026학년도 1학기</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 px-5 mb-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all",
                filter === tab ? TAB_STYLES[tab] : "bg-slate-100 text-muted-foreground"
              )}
            >
              {tab}
              {tab !== "전체" && (
                <span className="ml-1.5 text-[10px] opacity-80">
                  {EVENTS.filter(e => getStatus(e, now) === tab).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Event list grouped by month */}
        <div className="px-5 space-y-8">
          {Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <CalendarDays className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">해당하는 일정이 없습니다.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([month, events]) => (
              <div key={month}>
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground/60 mb-3 pl-1">
                  {month}
                </h3>
                <div className="space-y-2.5">
                  {events.map((ev, i) => {
                    const status = getStatus(ev, now);
                    const isSameDay = ev.startDate === ev.endDate;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "bg-white rounded-2xl px-4 py-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border",
                          status === "진행중" ? "border-green-200 bg-green-50/40" : "border-border/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-semibold leading-snug",
                              status === "지난" ? "text-muted-foreground" : "text-foreground"
                            )}>
                              {ev.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3 shrink-0" />
                              {isSameDay ? (
                                <span>{ev.startDate.replace(/-/g, ".")} {ev.startTime !== "00:00" && ev.startTime}</span>
                              ) : (
                                <span>
                                  {ev.startDate.replace(/-/g, ".")} {ev.startTime !== "00:00" && ev.startTime}
                                  {" "}~{" "}
                                  {ev.endDate.replace(/-/g, ".")} {ev.endTime !== "00:00" && ev.endTime}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={cn(
                            "shrink-0 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap",
                            STATUS_BADGE[status]
                          )}>
                            {status}
                          </span>
                        </div>
                        {/* Date range visual bar for ongoing events */}
                        {status === "진행중" && !isSameDay && (() => {
                          const start = new Date(ev.startDate).getTime();
                          const end = new Date(ev.endDate).getTime();
                          const pct = Math.min(100, Math.max(0, ((now.getTime() - start) / (end - start)) * 100));
                          return (
                            <div className="mt-2.5 h-1 bg-green-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-400 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
