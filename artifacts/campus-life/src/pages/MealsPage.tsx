import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { ChevronLeft, ChevronRight, RefreshCw, UtensilsCrossed, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface SubMenu {
  name: string;
  price: string;
  items: string[];
  isCheapBreakfast: boolean;
}

interface DayMenu {
  date: string;
  day: string;
  subMenus: SubMenu[];
}

interface MealRow {
  type: string;
  hours: string;
  days: DayMenu[];
}

interface WeekMeals {
  restaurantCode: string;
  restaurantName: string;
  campus: string;
  campusLabel: string;
  weekLabel: string;
  dates: string[];
  days: string[];
  mealRows: MealRow[];
  prevDate: string;
  nextDate: string;
  fetchedAt: string;
}

const CAMPUSES = [
  { id: "PUSAN",   label: "부산" },
  { id: "MIRYANG", label: "밀양" },
  { id: "YANGSAN", label: "양산" },
];

const CAMPUS_RESTAURANTS: Record<string, { code: string; name: string }[]> = {
  PUSAN:   [
    { code: "PG002", name: "금정회관\n학생식당" },
    { code: "PH002", name: "학생회관\n식당" },
    { code: "PG001", name: "금정회관\n교직원식당" },
  ],
  MIRYANG: [
    { code: "M001", name: "학생회관\n학생식당" },
    { code: "M002", name: "학생회관\n교직원식당" },
  ],
  YANGSAN: [
    { code: "Y001", name: "편의동\n식당" },
  ],
};

const SUBMENU_STYLES: Record<string, { border: string; badge: string; text: string; dot: string }> = {
  "천원의아침":  { border: "border-l-amber-400",  badge: "bg-amber-50 text-amber-700",   text: "text-amber-700",   dot: "bg-amber-400" },
  "천원의아침&정식": { border: "border-l-amber-400", badge: "bg-amber-50 text-amber-700", text: "text-amber-700", dot: "bg-amber-400" },
  "정식":        { border: "border-l-blue-400",   badge: "bg-blue-50 text-blue-700",    text: "text-blue-700",    dot: "bg-blue-400" },
  "특정식":      { border: "border-l-blue-400",   badge: "bg-blue-50 text-blue-700",    text: "text-blue-700",    dot: "bg-blue-400" },
  "일품":        { border: "border-l-violet-400", badge: "bg-violet-50 text-violet-700", text: "text-violet-700", dot: "bg-violet-400" },
};

function getSubMenuStyle(name: string) {
  return SUBMENU_STYLES[name] ?? { border: "border-l-slate-300", badge: "bg-slate-50 text-slate-600", text: "text-slate-600", dot: "bg-slate-400" };
}

const MEAL_COLORS: Record<string, { accent: string; label: string }> = {
  "조식": { accent: "text-orange-500", label: "조식" },
  "중식": { accent: "text-blue-500",   label: "중식" },
  "석식": { accent: "text-purple-500", label: "석식" },
};

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function MealsPage() {
  const [campus, setCampus] = useState("PUSAN");
  const [restaurant, setRestaurant] = useState("PG002");
  const [queryDate, setQueryDate] = useState(getTodayStr());
  const [data, setData] = useState<WeekMeals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [error, setError] = useState("");

  const fetchMeals = useCallback(async (rest: string, date: string) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/meals?restaurant=${rest}&date=${date}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: WeekMeals = await res.json();
      if ((json as any).error) throw new Error((json as any).error);
      setData(json);
      const today = getTodayStr();
      const todayIdx = json.dates.findIndex(d => d === today);
      setSelectedDayIdx(todayIdx >= 0 ? todayIdx : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMeals(restaurant, queryDate); }, [restaurant, queryDate, fetchMeals]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = getTodayStr();
      if (now !== queryDate) setQueryDate(now);
    }, 60_000);
    return () => clearInterval(interval);
  }, [queryDate]);

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) fetchMeals(restaurant, queryDate); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [restaurant, queryDate, fetchMeals]);

  function handleCampusChange(campusId: string) {
    setCampus(campusId);
    const firstRest = CAMPUS_RESTAURANTS[campusId]?.[0]?.code ?? "PG002";
    setRestaurant(firstRest);
  }

  const today = getTodayStr();
  const effDayIdx = selectedDayIdx ?? 0;
  const selectedDate = data?.dates[effDayIdx] ?? "";

  return (
    <Layout hideTopBar>
      <div className="pb-32">

        {/* Header */}
        <div className="px-5 pt-14 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-1.5">부산대학교</p>
          <div className="flex items-end justify-between">
            <h2
              className="text-4xl font-extrabold text-foreground leading-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}
            >
              오늘의 식단
            </h2>
            <button
              onClick={() => fetchMeals(restaurant, queryDate)}
              className="p-2.5 bg-slate-100 rounded-full text-muted-foreground hover:text-primary active:scale-95 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Campus Tabs */}
        <div className="flex px-5 mb-4 bg-slate-100 mx-5 rounded-2xl p-1 gap-1">
          {CAMPUSES.map(c => (
            <button
              key={c.id}
              onClick={() => handleCampusChange(c.id)}
              className={cn(
                "flex-1 py-2 text-[13px] font-bold rounded-xl transition-all",
                campus === c.id
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Restaurant Tabs */}
        <div className="flex gap-2 px-5 mb-5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {(CAMPUS_RESTAURANTS[campus] ?? []).map(r => (
            <button
              key={r.code}
              onClick={() => setRestaurant(r.code)}
              className={cn(
                "shrink-0 px-4 py-2.5 rounded-2xl text-[11px] font-bold leading-tight whitespace-pre-line text-center transition-all",
                restaurant === r.code
                  ? "bg-primary text-white shadow-[0_4px_12px_rgba(0,66,125,0.22)]"
                  : "bg-white text-muted-foreground border border-border/40"
              )}
            >
              {r.name}
            </button>
          ))}
        </div>

        {/* Week Navigation */}
        {data && (
          <div className="flex items-center justify-between px-5 mb-4">
            <button
              onClick={() => data.prevDate && setQueryDate(data.prevDate)}
              disabled={!data.prevDate}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-muted-foreground hover:bg-primary hover:text-white active:scale-95 transition-all disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-foreground">{data.weekLabel}</span>
            <button
              onClick={() => data.nextDate && setQueryDate(data.nextDate)}
              disabled={!data.nextDate}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-muted-foreground hover:bg-primary hover:text-white active:scale-95 transition-all disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Day Tabs */}
        {data && data.dates.length > 0 && (
          <div className="flex gap-2 px-5 mb-5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {data.dates.map((date, idx) => {
              const isToday = date === today;
              const isSelected = idx === effDayIdx;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDayIdx(idx)}
                  className={cn(
                    "shrink-0 flex flex-col items-center px-3 py-2 rounded-2xl min-w-[48px] transition-all",
                    isSelected
                      ? "bg-primary text-white shadow-[0_4px_12px_rgba(0,66,125,0.25)]"
                      : isToday
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-white text-muted-foreground border border-border/40"
                  )}
                >
                  <span className="text-[10px] font-bold">{data.days[idx]}</span>
                  <span className="text-[14px] font-extrabold mt-0.5">{date.slice(8)}</span>
                  {isToday && !isSelected && <span className="w-1 h-1 rounded-full bg-primary mt-1" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="px-5 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-border/30 shadow-sm">
              <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{error}</p>
              <button onClick={() => fetchMeals(restaurant, queryDate)} className="mt-4 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl">
                다시 시도
              </button>
            </div>
          ) : !data || data.mealRows.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-border/30 shadow-sm">
              <UtensilsCrossed className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">식단 정보가 없습니다.</p>
            </div>
          ) : (
            <>
              {data.mealRows.map((row, ri) => {
                const dayMenu = row.days[effDayIdx];
                const hasMenus = dayMenu && dayMenu.subMenus.length > 0;
                const mealColor = MEAL_COLORS[row.type] ?? MEAL_COLORS["중식"];

                return (
                  <div
                    key={ri}
                    className="bg-white rounded-3xl overflow-hidden border border-border/20 shadow-[0_2px_16px_rgba(0,0,0,0.04)]"
                  >
                    {/* Meal type header */}
                    <div className="flex items-center justify-between px-5 pt-4 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-extrabold", hasMenus ? mealColor.accent : "text-muted-foreground/30")}>
                          {row.type}
                        </span>
                        {row.hours && (
                          <span className="text-[10px] font-medium text-muted-foreground/50">{row.hours}</span>
                        )}
                      </div>
                      {!hasMenus && (
                        <span className="text-[11px] text-muted-foreground/30 font-medium">미운영</span>
                      )}
                    </div>

                    {hasMenus ? (
                      <div className="px-5 pb-4 space-y-3">
                        {dayMenu.subMenus.map((sub, si) => {
                          const style = getSubMenuStyle(sub.name);
                          return (
                            <div
                              key={si}
                              className={cn(
                                "border-l-2 pl-3",
                                style.border
                              )}
                            >
                              {/* Sub-menu name + price */}
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", style.badge)}>
                                  {sub.isCheapBreakfast ? "천원의아침" : sub.name}
                                </span>
                                {sub.price && (
                                  <span className="text-[11px] text-muted-foreground font-medium">{sub.price}</span>
                                )}
                              </div>
                              {/* Items */}
                              <div className="flex flex-wrap gap-x-2 gap-y-1">
                                {sub.items.map((item, ii) => (
                                  <span key={ii} className="text-[13px] text-foreground font-medium leading-snug">
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-2" />
                    )}
                  </div>
                );
              })}

              {data.restaurantName && (
                <p className="text-center text-[11px] text-muted-foreground/40 font-medium pt-0.5 pb-2">
                  {data.restaurantName} · {selectedDate.replace(/-/g, ".")}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
