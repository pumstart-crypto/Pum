import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { ChevronLeft, ChevronRight, RefreshCw, UtensilsCrossed, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const RESTAURANTS = [
  { code: "PG002", name: "금정회관\n학생식당" },
  { code: "PH002", name: "학생회관\n식당" },
  { code: "PM002", name: "문창회관\n식당" },
  { code: "PS001", name: "샛벌회관\n식당" },
  { code: "PG001", name: "금정회관\n교직원식당" },
];

interface DayMenu {
  date: string;
  day: string;
  items: string[];
  menuName: string;
  price: string;
}

interface MealRow {
  type: string;
  hours: string;
  days: DayMenu[];
}

interface WeekMeals {
  restaurantCode: string;
  restaurantName: string;
  weekLabel: string;
  dates: string[];
  days: string[];
  mealRows: MealRow[];
  prevDate: string;
  nextDate: string;
  fetchedAt: string;
  error?: string;
}

const MEAL_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  조식: { bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-400" },
  중식: { bg: "bg-blue-50",   text: "text-blue-600",   dot: "bg-blue-400" },
  석식: { bg: "bg-purple-50", text: "text-purple-600", dot: "bg-purple-400" },
};

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function MealsPage() {
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
      if (json.error) throw new Error(json.error);
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
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [queryDate]);

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) fetchMeals(restaurant, queryDate); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [restaurant, queryDate, fetchMeals]);

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

        {/* Restaurant Tabs */}
        <div className="flex gap-2.5 px-5 mb-5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {RESTAURANTS.map(r => (
            <button
              key={r.code}
              onClick={() => setRestaurant(r.code)}
              className={cn(
                "shrink-0 px-3.5 py-2.5 rounded-2xl text-[11px] font-bold leading-tight whitespace-pre-line text-center transition-all",
                restaurant === r.code
                  ? "bg-primary text-white shadow-[0_4px_12px_rgba(0,66,125,0.25)]"
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
                  <span className="text-[13px] font-extrabold mt-0.5">{date.slice(8)}</span>
                  {isToday && !isSelected && <span className="w-1 h-1 rounded-full bg-primary mt-1" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="px-5">
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
            <div className="space-y-3">
              {data.mealRows.map((row, ri) => {
                const dayMenu = row.days[effDayIdx];
                const hasItems = dayMenu && dayMenu.items.length > 0;
                const colors = MEAL_COLORS[row.type] ?? MEAL_COLORS["중식"];
                return (
                  <div
                    key={ri}
                    className={cn(
                      "rounded-3xl overflow-hidden border",
                      hasItems
                        ? "bg-white border-border/30 shadow-[0_2px_16px_rgba(0,0,0,0.04)]"
                        : "bg-slate-50 border-border/20"
                    )}
                  >
                    <div className={cn("flex items-center justify-between px-5 py-3.5", hasItems ? colors.bg : "")}>
                      <div className="flex items-center gap-2.5">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", hasItems ? colors.dot : "bg-slate-300")} />
                        <span className={cn("text-sm font-extrabold", hasItems ? colors.text : "text-muted-foreground/40")}>
                          {row.type}
                        </span>
                        {row.hours && (
                          <span className={cn("text-[10px] font-medium opacity-70", hasItems ? colors.text : "text-muted-foreground/40")}>
                            {row.hours}
                          </span>
                        )}
                      </div>
                      {hasItems && dayMenu.price && (
                        <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full", colors.bg, colors.text)}>
                          {dayMenu.menuName} {dayMenu.price && `· ${dayMenu.price}`}
                        </span>
                      )}
                    </div>
                    {hasItems ? (
                      <div className="px-5 py-4">
                        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                          {dayMenu.items.map((item, ii) => (
                            <span key={ii} className="text-sm text-foreground font-medium leading-snug">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-3 text-xs text-muted-foreground/40 font-medium">미운영</div>
                    )}
                  </div>
                );
              })}
              {data.restaurantName && (
                <p className="text-center text-[11px] text-muted-foreground/50 font-medium pt-1 pb-2">
                  {data.restaurantName} · {selectedDate.replace(/-/g, ".")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
