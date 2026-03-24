import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { UtensilsCrossed, Clock, ChevronLeft, ChevronRight, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface Menu {
  name: string;
  price: string;
  items: string[];
}

interface MealType {
  type: string;
  menus: Menu[];
}

interface Cafeteria {
  name: string;
  hours: string[];
  isFaculty: boolean;
  meals: MealType[];
}

interface MealsData {
  date: string;
  cafeterias: Cafeteria[];
  fetchedAt: string;
}

const MEAL_TYPES = ["조식", "중식", "석식"];
const MEAL_COLORS: Record<string, string> = {
  조식: "bg-orange-50 border-orange-200 text-orange-700",
  중식: "bg-blue-50 border-blue-200 text-blue-700",
  석식: "bg-purple-50 border-purple-200 text-purple-700",
};
const MEAL_BG: Record<string, string> = {
  조식: "bg-orange-100 text-orange-600",
  중식: "bg-blue-100 text-blue-600",
  석식: "bg-purple-100 text-purple-600",
};

function getCurrentMealType(): string {
  const hour = new Date().getHours();
  if (hour < 10) return "조식";
  if (hour < 16) return "중식";
  return "석식";
}

export function MealsPage() {
  const [data, setData] = useState<MealsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMeal, setActiveMeal] = useState<string>(getCurrentMealType());
  const [showFaculty, setShowFaculty] = useState(false);

  const fetchMeals = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/meals`);
      if (!res.ok) throw new Error("서버 오류");
      const json: MealsData = await res.json();
      setData(json);
    } catch {
      setError("식단 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeals();
  }, []);

  const filteredCafeterias = data?.cafeterias.filter(
    (c) => showFaculty || !c.isFaculty
  ) ?? [];

  const mealTypeIdx = MEAL_TYPES.indexOf(activeMeal);

  return (
    <Layout>
      {/* Header */}
      <div className="p-6 pt-12 pb-4">
        <p className="text-muted-foreground font-medium mb-1">부산대학교</p>
        <div className="flex items-end justify-between">
          <h1 className="text-3xl text-foreground">
            오늘의 <span className="text-primary">식단표</span>
          </h1>
          <button
            onClick={fetchMeals}
            disabled={isLoading}
            className="p-2 rounded-full bg-muted hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isLoading && "animate-spin")} />
          </button>
        </div>
        {data && (
          <p className="text-xs text-muted-foreground mt-1">{data.date}</p>
        )}
      </div>

      {/* Meal Type Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 bg-muted p-1 rounded-2xl">
          {MEAL_TYPES.map((type, i) => (
            <button
              key={type}
              onClick={() => setActiveMeal(type)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                activeMeal === type
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Faculty toggle */}
      <div className="px-4 mb-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          {filteredCafeterias.length}개 식당
        </span>
        <button
          onClick={() => setShowFaculty(!showFaculty)}
          className={cn(
            "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors",
            showFaculty
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-border"
          )}
        >
          교직원 식당 {showFaculty ? "숨기기" : "포함"}
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-28 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">식단 정보 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
            <div className="w-14 h-14 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={fetchMeals}
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold"
            >
              다시 시도
            </button>
          </div>
        ) : filteredCafeterias.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">식단 정보가 없습니다.</p>
          </div>
        ) : (
          filteredCafeterias.map((cafeteria) => {
            const meal = cafeteria.meals.find((m) => m.type === activeMeal);
            const hasMenu = meal && meal.menus.length > 0;

            return (
              <CafeteriaCard
                key={cafeteria.name}
                cafeteria={cafeteria}
                activeMeal={activeMeal}
                meal={meal}
                hasMenu={!!hasMenu}
              />
            );
          })
        )}
      </div>
    </Layout>
  );
}

function CafeteriaCard({
  cafeteria,
  activeMeal,
  meal,
  hasMenu,
}: {
  cafeteria: Cafeteria;
  activeMeal: string;
  meal: MealType | undefined;
  hasMenu: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  if (!hasMenu) {
    return (
      <div className="bg-white rounded-2xl border border-border/50 p-4 opacity-60">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground">{cafeteria.name}</h3>
            {cafeteria.hours.length > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{cafeteria.hours.join(" · ")}</span>
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">식단 없음</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      {/* Cafeteria Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-foreground">{cafeteria.name}</h3>
            {cafeteria.isFaculty && (
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">교직원</span>
            )}
          </div>
          {cafeteria.hours.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{cafeteria.hours.join(" · ")}</span>
            </div>
          )}
        </div>
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", expanded && "rotate-90")} />
      </button>

      {/* Meal Content */}
      {expanded && meal && (
        <div className="border-t border-border/40 px-4 pt-3 pb-4 space-y-3">
          {meal.menus.map((menu, idx) => (
            <div key={idx} className="space-y-1.5">
              {/* Menu header */}
              <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border", MEAL_COLORS[activeMeal])}>
                <span>{menu.name}</span>
                {menu.price && <span className="opacity-70">· {menu.price}</span>}
              </div>
              {/* Menu items */}
              <div className="flex flex-wrap gap-1.5">
                {menu.items.map((item, i) => (
                  <span
                    key={i}
                    className="text-xs bg-muted text-foreground/80 px-2 py-0.5 rounded-full"
                  >
                    {item}
                  </span>
                ))}
              </div>
              {idx < meal.menus.length - 1 && (
                <div className="border-t border-border/30 pt-1.5" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
