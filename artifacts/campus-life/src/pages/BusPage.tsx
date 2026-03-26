import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { RefreshCw, AlertCircle, Bus, MapPin, Clock, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface StopInfo {
  idx: number;
  name: string;
  arsno: string;
  nodeId: string;
  lat: number | null;
  lng: number | null;
  isEndPoint: boolean;
}

interface BusOnRoute {
  idx: number;
  stopName: string;
  carNo: string;
  lat: number;
  lng: number;
  lowFloor: boolean;
}

interface RouteData {
  lineId: string;
  lineName: string;
  stops: StopInfo[];
  buses: BusOnRoute[];
  fetchedAt: string;
  outboundCount: number;
  inboundCount: number;
  cached?: boolean;
}

// Notable stops to highlight
const KEY_STOPS = new Set([
  "부곡4동행정복지센터.온천장역", "온천입구", "동래우체국", "동래경찰서",
  "연산역.연산교차로", "부산시청", "하마정", "부암고가교", "당감사거리",
  "백양터널", "상수도사업본부", "부산시민공원",
  "동래경찰서.수안역", "회동동", "금사시장",
]);

const MIDPOINT = 47; // stops 1-47 = outbound, 48-94 = inbound

export function BusPage() {
  const [data, setData] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoute = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/bus/route`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: RouteData = await res.json();
      if ((json as any).error) throw new Error((json as any).error);
      setData(json);
      setLastUpdated(new Date());
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRoute();
    intervalRef.current = setInterval(() => fetchRoute(true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchRoute]);

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) fetchRoute(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchRoute]);

  const outboundStops = data?.stops.filter(s => s.idx <= MIDPOINT) ?? [];
  const inboundStops = data?.stops.filter(s => s.idx > MIDPOINT) ?? [];
  const displayStops = direction === "out" ? outboundStops : inboundStops;

  const outboundBuses = data?.buses.filter(b => b.idx <= MIDPOINT) ?? [];
  const inboundBuses = data?.buses.filter(b => b.idx > MIDPOINT) ?? [];
  const displayBuses = direction === "out" ? outboundBuses : inboundBuses;

  const busAtStop = (idx: number) => displayBuses.filter(b => b.idx === idx);
  const nearStop = (idx: number) => displayBuses.filter(b => b.idx === idx - 1);

  function formatTime(date: Date) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  const totalBuses = data?.buses.length ?? 0;

  return (
    <Layout hideTopBar>
      <div className="pb-32">

        {/* Header */}
        <div className="px-5 pt-14 pb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-1.5">부산광역시 마을버스</p>
          <div className="flex items-end justify-between">
            <div>
              <h2
                className="text-4xl font-extrabold text-foreground leading-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}
              >
                금정구 7
              </h2>
              <p className="text-xs text-muted-foreground mt-1 font-medium">회동동 ↔ 백양터널</p>
            </div>
            <button
              onClick={() => fetchRoute(true)}
              className="p-2.5 bg-slate-100 rounded-full text-muted-foreground hover:text-primary active:scale-95 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Status Bar */}
        {data && (
          <div className="mx-5 mb-4 bg-white rounded-2xl border border-border/20 shadow-sm px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-sm font-bold text-foreground">현재 {totalBuses}대 운행중</span>
            </div>
            {lastUpdated && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60 font-medium">
                <Clock className="w-3 h-3" />
                {formatTime(lastUpdated)} 업데이트
              </div>
            )}
          </div>
        )}

        {/* Direction Tabs */}
        <div className="flex mx-5 mb-4 bg-slate-100 rounded-2xl p-1 gap-1">
          <button
            onClick={() => setDirection("out")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5",
              direction === "out" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
            )}
          >
            <Bus className="w-3.5 h-3.5" />
            회동동 → 백양터널
            {data && (
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5",
                direction === "out" ? "bg-primary/10 text-primary" : "bg-slate-200 text-muted-foreground"
              )}>
                {outboundBuses.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setDirection("in")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5",
              direction === "in" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
            )}
          >
            <Bus className="w-3.5 h-3.5 rotate-180" />
            백양터널 → 회동동
            {data && (
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5",
                direction === "in" ? "bg-primary/10 text-primary" : "bg-slate-200 text-muted-foreground"
              )}>
                {inboundBuses.length}
              </span>
            )}
          </button>
        </div>

        {/* Route List */}
        <div className="px-5">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-border/30 shadow-sm">
              <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground/50 mt-1">BUS_API_KEY가 설정되었는지 확인해주세요</p>
              <button onClick={() => fetchRoute()} className="mt-4 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl">
                다시 시도
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-border/20 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden">
              {displayStops.map((stop, i) => {
                const buses = busAtStop(stop.idx);
                const approaching = nearStop(stop.idx);
                const hasBus = buses.length > 0;
                const isApproaching = approaching.length > 0 && !hasBus;
                const isKey = KEY_STOPS.has(stop.name);
                const isLast = i === displayStops.length - 1;

                return (
                  <div
                    key={stop.idx}
                    className={cn(
                      "flex items-start gap-3 px-4 py-2.5 relative",
                      hasBus && "bg-primary/5",
                      isApproaching && "bg-amber-50/60",
                      !isLast && "border-b border-border/10"
                    )}
                  >
                    {/* Route line + dot */}
                    <div className="flex flex-col items-center pt-1 shrink-0 w-5">
                      <div className={cn(
                        "w-3 h-3 rounded-full border-2 z-10 shrink-0",
                        hasBus
                          ? "bg-primary border-primary shadow-[0_0_0_3px_rgba(0,66,125,0.15)]"
                          : isApproaching
                          ? "bg-amber-400 border-amber-400"
                          : stop.isEndPoint
                          ? "bg-slate-500 border-slate-500"
                          : isKey
                          ? "bg-slate-300 border-slate-400"
                          : "bg-slate-200 border-slate-300"
                      )} />
                      {!isLast && (
                        <div className={cn(
                          "w-0.5 flex-1 mt-0.5",
                          hasBus ? "bg-primary/30" : "bg-slate-200"
                        )}
                          style={{ minHeight: 12 }}
                        />
                      )}
                    </div>

                    {/* Stop info */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "text-[13px] leading-snug",
                          hasBus ? "font-bold text-primary" : isKey ? "font-semibold text-foreground" : "font-medium text-foreground/70",
                          stop.isEndPoint && "font-bold text-foreground"
                        )}>
                          {stop.name}
                          {stop.isEndPoint && (
                            <span className="ml-1.5 text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">종점</span>
                          )}
                        </span>
                        <span className="text-[10px] text-muted-foreground/30 shrink-0 font-medium">{stop.arsno}</span>
                      </div>

                      {/* Buses at this stop */}
                      {buses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {buses.map(bus => (
                            <div key={bus.carNo} className="flex items-center gap-1 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              <Bus className="w-2.5 h-2.5" />
                              {bus.carNo}
                              {bus.lowFloor && <span className="text-[8px] opacity-75">저상</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Approaching buses */}
                      {isApproaching && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                            <Radio className="w-2.5 h-2.5" />
                            곧 도착 ({approaching.length}대)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        {data && (
          <div className="mx-5 mt-4 flex items-center gap-4 text-[10px] text-muted-foreground/50 font-medium">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              버스 위치
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              곧 도착
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              종점
            </div>
            <div className="ml-auto text-[10px]">30초마다 자동 갱신</div>
          </div>
        )}
      </div>
    </Layout>
  );
}
