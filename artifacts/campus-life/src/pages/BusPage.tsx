import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { RefreshCw, AlertCircle, Bus, Clock, ArrowRight, ArrowLeft, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface BusNext {
  carNo: string;
  min: number;
  stations: number;
  lowFloor: boolean;
  seat: number;
}

interface BusArrival {
  lineNo: string;
  lineId: string;
  busType: string;
  next: BusNext | null;
  next2: BusNext | null;
}

interface StopArrivals {
  arsno: string;
  stopName: string;
  arrivals: BusArrival[];
  fetchedAt: string;
  cached?: boolean;
  stale?: boolean;
}

interface Stop {
  id: string;
  name: string;
  dir: string;
  arsno: string;
}

// Stop groups for the tab UI
const STOP_GROUPS = [
  {
    id: "jangjeonyeok",
    label: "장전역",
    stops: [
      { id: "jangjeonyeok-down", name: "장전역", dir: "시내 방향", arsno: "11071" },
      { id: "jangjeonyeok-up", name: "장전역", dir: "부산대 방향", arsno: "11281" },
    ],
  },
  {
    id: "jeonmun",
    label: "정문",
    stops: [
      { id: "jeonmun-down", name: "부산대학교 정문", dir: "시내 방향", arsno: "11085" },
      { id: "jeonmun-up", name: "부산대학교 정문", dir: "캠퍼스 방향", arsno: "11081" },
    ],
  },
  {
    id: "humun",
    label: "후문",
    stops: [
      { id: "pumun-down", name: "부산대학교 후문", dir: "시내 방향", arsno: "11088" },
      { id: "pumun-up", name: "부산대학교 후문", dir: "캠퍼스 방향", arsno: "11089" },
    ],
  },
  {
    id: "pnustation",
    label: "부산대역",
    stops: [
      { id: "pnustation", name: "부산대역", dir: "전체", arsno: "11082" },
    ],
  },
] as const;

// Route colors (by route category)
function getRouteColor(lineNo: string) {
  if (lineNo.startsWith("금정")) return "bg-emerald-500 text-white";
  if (lineNo === "29") return "bg-blue-500 text-white";
  if (lineNo === "49") return "bg-violet-500 text-white";
  if (lineNo.startsWith("77")) return "bg-orange-500 text-white";
  if (lineNo.startsWith("80")) return "bg-rose-500 text-white";
  if (lineNo.startsWith("100")) return "bg-sky-500 text-white";
  if (lineNo.startsWith("11")) return "bg-teal-500 text-white";
  if (lineNo.startsWith("12")) return "bg-indigo-500 text-white";
  if (lineNo.startsWith("13")) return "bg-amber-500 text-white";
  if (lineNo.startsWith("14")) return "bg-pink-500 text-white";
  if (lineNo.startsWith("3")) return "bg-slate-600 text-white";
  return "bg-slate-400 text-white";
}

function MinBadge({ min }: { min: number }) {
  const color =
    min <= 2 ? "text-red-600 bg-red-50" :
    min <= 5 ? "text-orange-600 bg-orange-50" :
    min <= 10 ? "text-amber-600 bg-amber-50" :
    "text-slate-600 bg-slate-100";

  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[13px] font-black px-2 py-0.5 rounded-lg tabular-nums",
      color
    )}>
      {min}
      <span className="text-[10px] font-semibold">분</span>
    </span>
  );
}

function StopPanel({ stop, lastUpdated, onUpdate }: {
  stop: Stop;
  lastUpdated: Record<string, Date>;
  onUpdate: (arsno: string, data: StopArrivals) => void;
}) {
  const [data, setData] = useState<StopArrivals | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await window.fetch(`${BASE}/api/bus/arrivals?arsno=${stop.arsno}`);
      const json: StopArrivals = await res.json();
      if ((json as any).error) throw new Error((json as any).error);
      setData(json);
      onUpdate(stop.arsno, json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setIsLoading(false);
    }
  }, [stop.arsno, onUpdate]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 20_000);
    return () => clearInterval(interval);
  }, [fetch]);

  const liveArrivals = data?.arrivals.filter(a => a.next !== null) ?? [];
  const noDataArrivals = data?.arrivals.filter(a => a.next === null) ?? [];

  return (
    <div>
      {isLoading && !data && (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <AlertCircle className="w-6 h-6 mx-auto mb-1 opacity-30" />
          {error}
          <button onClick={fetch} className="block mx-auto mt-2 text-primary underline text-xs">다시 시도</button>
        </div>
      )}
      {data && (
        <div>
          {/* Live arrivals */}
          {liveArrivals.length > 0 ? (
            <div className="space-y-2">
              {liveArrivals.map(a => (
                <div key={a.lineNo} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[0_1px_8px_rgba(0,0,0,0.04)] border border-border/20">
                  <span className={cn("text-[13px] font-bold px-2.5 py-1 rounded-xl min-w-[52px] text-center shrink-0", getRouteColor(a.lineNo))}>
                    {a.lineNo}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.next && (
                        <div className="flex items-center gap-1.5">
                          <MinBadge min={a.next.min} />
                          <span className="text-[11px] text-muted-foreground/50 font-medium">
                            {a.next.stations > 0 ? `${a.next.stations}정류장` : ""}
                            {a.next.lowFloor ? " · 저상" : ""}
                          </span>
                        </div>
                      )}
                      {a.next2 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground/30 font-medium">다음</span>
                          <MinBadge min={a.next2.min} />
                          {a.next2.lowFloor && <span className="text-[10px] text-muted-foreground/30">저상</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground/30 font-medium shrink-0">
                    {a.busType === "마을버스" ? "마을" : a.busType === "급행버스" ? "급행" : "일반"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl px-4 py-6 text-center text-sm text-muted-foreground border border-border/10">
              <Radio className="w-5 h-5 mx-auto mb-2 opacity-30" />
              현재 운행 중인 버스가 없습니다
              <p className="text-xs mt-1 opacity-60">운행 시간이 되면 실시간 정보가 표시됩니다</p>
            </div>
          )}

          {/* Route list (no live data) */}
          {noDataArrivals.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider mb-2">경유 노선 (비운행)</p>
              <div className="flex flex-wrap gap-1.5">
                {noDataArrivals.map(a => (
                  <span key={a.lineNo} className={cn(
                    "text-[11px] font-bold px-2 py-0.5 rounded-lg opacity-40",
                    getRouteColor(a.lineNo)
                  )}>
                    {a.lineNo}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Update time */}
          {lastUpdated[stop.arsno] && (
            <p className="text-[10px] text-muted-foreground/30 mt-3 text-right font-medium">
              {lastUpdated[stop.arsno].toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} 업데이트
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function BusPage() {
  const [activeGroup, setActiveGroup] = useState(STOP_GROUPS[0].id);
  const [lastUpdated, setLastUpdated] = useState<Record<string, Date>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshKeyRef = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUpdate = useCallback((arsno: string, _data: StopArrivals) => {
    setLastUpdated(prev => ({ ...prev, [arsno]: new Date() }));
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshKeyRef.current++;
    setRefreshKey(refreshKeyRef.current);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const currentGroup = STOP_GROUPS.find(g => g.id === activeGroup) ?? STOP_GROUPS[0];

  return (
    <Layout hideTopBar>
      <div className="pb-32">

        {/* Header */}
        <div className="px-5 pt-14 pb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-1.5">실시간 도착 정보</p>
          <div className="flex items-end justify-between">
            <div>
              <h2
                className="text-4xl font-extrabold text-foreground leading-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}
              >
                버스
              </h2>
              <p className="text-xs text-muted-foreground mt-1 font-medium">부산대학교 주변 주요 정류소</p>
            </div>
            <button
              onClick={handleRefresh}
              className="p-2.5 bg-slate-100 rounded-full text-muted-foreground hover:text-primary active:scale-95 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Stop Group Tabs */}
        <div className="flex mx-5 mb-5 bg-slate-100 rounded-2xl p-1 gap-1">
          {STOP_GROUPS.map(group => (
            <button
              key={group.id}
              onClick={() => setActiveGroup(group.id)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all",
                activeGroup === group.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {group.label}
            </button>
          ))}
        </div>

        {/* Directional stops */}
        <div className="px-5 space-y-5">
          {currentGroup.stops.map(stop => (
            <div key={stop.id}>
              {/* Direction label */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className={cn(
                  "p-1 rounded-lg",
                  stop.dir.includes("시내") ? "bg-primary/10" : stop.dir.includes("전체") ? "bg-slate-100" : "bg-emerald-50"
                )}>
                  {stop.dir.includes("시내") ? (
                    <ArrowRight className="w-3 h-3 text-primary" />
                  ) : stop.dir.includes("전체") ? (
                    <Bus className="w-3 h-3 text-slate-500" />
                  ) : (
                    <ArrowLeft className="w-3 h-3 text-emerald-600" />
                  )}
                </div>
                <div>
                  <span className="text-[13px] font-bold text-foreground">{stop.dir}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground/40 font-medium">정류소 {stop.arsno}</span>
                </div>
              </div>

              <StopPanel
                key={`${stop.arsno}-${refreshKey}`}
                stop={stop}
                lastUpdated={lastUpdated}
                onUpdate={handleUpdate}
              />
            </div>
          ))}
        </div>

        {/* Auto-refresh notice */}
        <div className="mx-5 mt-6 flex items-center justify-center gap-1.5">
          <Clock className="w-3 h-3 text-muted-foreground/30" />
          <span className="text-[11px] text-muted-foreground/30 font-medium">20초마다 자동 갱신</span>
        </div>
      </div>
    </Layout>
  );
}
