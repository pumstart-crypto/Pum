import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Search, Map, Building2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// ─── Building Directory ───────────────────────────────────────────────────────
interface Building {
  code: string;
  name: string;
  alias?: string; // 별칭 (검색용)
  zone: number;
}

const BUILDINGS: Building[] = [
  // Zone 1 — 공과대학 서쪽
  { code: "101", name: "MEMS/NANO 클린룸동", zone: 1 },
  { code: "102", name: "IT관", zone: 1 },
  { code: "103", name: "제12공학관", zone: 1 },
  { code: "105", name: "제3공학관", alias: "융합기계관", zone: 1 },
  { code: "106", name: "효원문화회관", zone: 1 },
  { code: "107", name: "제8공학관", alias: "항공관", zone: 1 },
  { code: "108", name: "제9공학관", alias: "기전관", zone: 1 },
  { code: "109", name: "공과대학 공동실험관", zone: 1 },
  { code: "110", name: "에너지분야실험실", zone: 1 },
  { code: "111", name: "실험폐기물처리장", zone: 1 },
  { code: "K08", name: "공과대학 제2별관", zone: 1 },
  // Zone 2 — 대학본부·공학
  { code: "201", name: "제6공학관", alias: "컴퓨터공학관 컴공관", zone: 2 },
  { code: "202", name: "운죽정", zone: 2 },
  { code: "203", name: "넉넉한터", alias: "학생회관", zone: 2 },
  { code: "204", name: "넉넉한터 지하주차장", zone: 2 },
  { code: "205", name: "대학본부", alias: "본관", zone: 2 },
  { code: "206", name: "제11공학관", alias: "조선해양공학관", zone: 2 },
  { code: "207", name: "제10공학관", alias: "특성화공학관", zone: 2 },
  { code: "208", name: "기계기술연구동", zone: 2 },
  // Zone 3 — 인문·자연
  { code: "301", name: "구조실험동", zone: 3 },
  { code: "303", name: "기계관", zone: 3 },
  { code: "306", name: "인문관", zone: 3 },
  { code: "307", name: "인문대 교수연구동", zone: 3 },
  { code: "308", name: "제1물리관", zone: 3 },
  { code: "309", name: "제2물리관", zone: 3 },
  { code: "311", name: "공동연구기기동", zone: 3 },
  { code: "312", name: "공동실험실습관", zone: 3 },
  { code: "313", name: "자연대 연구실험동", zone: 3 },
  { code: "314", name: "정보화교육관", alias: "전산실", zone: 3 },
  { code: "315", name: "자유관 A동", alias: "기숙사", zone: 3 },
  { code: "316", name: "자유관 B동", alias: "기숙사", zone: 3 },
  { code: "318", name: "자유주차장", zone: 3 },
  // Zone 4 — 사회·사범·도서관
  { code: "401", name: "건설관", zone: 4 },
  { code: "402", name: "정학관", zone: 4 },
  { code: "405", name: "제2공학관", alias: "재료관", zone: 4 },
  { code: "408", name: "제5공학관", alias: "유기소재관", zone: 4 },
  { code: "409", name: "교수회관", zone: 4 },
  { code: "416", name: "생물관", zone: 4 },
  { code: "417", name: "제1사범관", zone: 4 },
  { code: "418", name: "제2교수연구동", zone: 4 },
  { code: "419", name: "금정회관", zone: 4 },
  { code: "420", name: "새벽벌도서관", alias: "상남국제회관", zone: 4 },
  { code: "421", name: "사회관", zone: 4 },
  { code: "422", name: "성학관", zone: 4 },
  // Zone 5 — 도서관·경영·약학
  { code: "501", name: "첨단과학관", zone: 5 },
  { code: "503", name: "약학관", zone: 5 },
  { code: "505", name: "인덕관 철골주차장", zone: 5 },
  { code: "506", name: "효원산학협동관", zone: 5 },
  { code: "507", name: "인덕관", zone: 5 },
  { code: "508", name: "산학협동관", zone: 5 },
  { code: "509", name: "박물관 별관", zone: 5 },
  { code: "510", name: "중앙도서관", alias: "도서관", zone: 5 },
  { code: "511", name: "간이체육관", zone: 5 },
  { code: "512", name: "테니스장", zone: 5 },
  { code: "513", name: "철골주차장", zone: 5 },
  { code: "514", name: "경영관", zone: 5 },
  { code: "516", name: "경제통상관", zone: 5 },
  // Zone 6 — 법학·행정
  { code: "601", name: "법학관", zone: 6 },
  { code: "602", name: "제1행정관", zone: 6 },
  { code: "603", name: "제2행정관", zone: 6 },
  { code: "605", name: "학생생활관", zone: 6 },
  { code: "606", name: "학생회관", zone: 6 },
  { code: "607", name: "대운동장", zone: 6 },
  { code: "608", name: "제2법학관", zone: 6 },
  { code: "609", name: "야외음악당", zone: 6 },
  // Zone 7 — 체육·음악·연구
  { code: "701", name: "제2사범관", zone: 7 },
  { code: "705", name: "경암체육관 교수연구동", zone: 7 },
  { code: "706", name: "경암체육관", zone: 7 },
  { code: "707", name: "음악관", zone: 7 },
  { code: "709", name: "과학기술연구동", zone: 7 },
  { code: "710", name: "제1연구동", zone: 7 },
  { code: "711", name: "제2연구동", zone: 7 },
  { code: "712", name: "제3연구동", zone: 7 },
  { code: "713", name: "제4연구동", zone: 7 },
  { code: "714", name: "제5연구동", zone: 7 },
  { code: "715", name: "제6연구동", zone: 7 },
  { code: "716", name: "제7연구동", zone: 7 },
  { code: "717", name: "제8연구동", zone: 7 },
];

const ZONE_COLORS: Record<number, string> = {
  1: "bg-blue-100 text-blue-700",
  2: "bg-violet-100 text-violet-700",
  3: "bg-emerald-100 text-emerald-700",
  4: "bg-amber-100 text-amber-700",
  5: "bg-rose-100 text-rose-700",
  6: "bg-cyan-100 text-cyan-700",
  7: "bg-orange-100 text-orange-700",
};

const ZONE_LABELS: Record<number, string> = {
  1: "공학 서쪽", 2: "대학본부", 3: "인문·자연",
  4: "사회·사범", 5: "도서관", 6: "법학·행정", 7: "체육·연구",
};

export function CampusMapPage() {
  const [tab, setTab] = useState<"map" | "search">("map");
  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUILDINGS.filter(b => {
      const matchZone = zoneFilter === null || b.zone === zoneFilter;
      if (!matchZone) return false;
      if (!q) return true;
      return (
        b.code.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        (b.alias?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [query, zoneFilter]);

  return (
    <Layout hideTopBar>
      <div className="flex flex-col h-screen overflow-hidden pb-16">

        {/* Header */}
        <div className="px-5 pt-14 pb-3 shrink-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-1">부산대학교</p>
          <h2
            className="text-4xl font-extrabold text-foreground leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}
          >
            캠퍼스 맵
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex mx-5 mb-3 bg-slate-100 rounded-2xl p-1 gap-1 shrink-0">
          <button
            onClick={() => setTab("map")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5",
              tab === "map" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
            )}
          >
            <Map className="w-3.5 h-3.5" /> 지도
          </button>
          <button
            onClick={() => setTab("search")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5",
              tab === "search" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
            )}
          >
            <Building2 className="w-3.5 h-3.5" /> 건물 찾기
          </button>
        </div>

        {/* Map Tab */}
        {tab === "map" && (
          <div
            className="flex-1 mx-5 mb-3 rounded-3xl overflow-auto border border-border/20 shadow-sm bg-white"
            style={{ touchAction: "pan-x pan-y pinch-zoom" }}
          >
            <img
              src={`${BASE}/campus-map.png`}
              alt="부산대학교 캠퍼스 지도"
              className="w-full h-auto block"
              draggable={false}
            />
          </div>
        )}

        {/* Building Search Tab */}
        {tab === "search" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search input */}
            <div className="px-5 mb-3 shrink-0">
              <div className="flex items-center gap-2.5 bg-white border border-border/30 rounded-2xl px-4 py-3 shadow-sm">
                <Search className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                <input
                  type="text"
                  placeholder="건물명 또는 코드 검색 (예: 도서관, 201)"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/30 font-medium"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-muted-foreground/40">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Zone filter chips */}
            <div className="px-5 mb-3 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
              <button
                onClick={() => setZoneFilter(null)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-all",
                  zoneFilter === null ? "bg-foreground text-white" : "bg-slate-100 text-muted-foreground"
                )}
              >
                전체
              </button>
              {[1, 2, 3, 4, 5, 6, 7].map(z => (
                <button
                  key={z}
                  onClick={() => setZoneFilter(zoneFilter === z ? null : z)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-all",
                    zoneFilter === z ? "bg-foreground text-white" : "bg-slate-100 text-muted-foreground"
                  )}
                >
                  {z}존 <span className="opacity-60 font-normal">{ZONE_LABELS[z]}</span>
                </button>
              ))}
            </div>

            {/* Result count */}
            <div className="px-5 mb-2 shrink-0">
              <p className="text-[11px] text-muted-foreground/40 font-medium">{filtered.length}개 건물</p>
            </div>

            {/* Building list */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <div className="bg-white rounded-3xl border border-border/20 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden">
                {filtered.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground/40">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">검색 결과가 없습니다</p>
                  </div>
                ) : (
                  filtered.map((b, i) => (
                    <div
                      key={b.code}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3",
                        i !== filtered.length - 1 && "border-b border-border/10"
                      )}
                    >
                      {/* Code badge */}
                      <span className="text-[11px] font-black text-muted-foreground/40 w-10 shrink-0 text-right tabular-nums">
                        {b.code}
                      </span>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground leading-snug">
                          {b.name}
                        </p>
                        {b.alias && (
                          <p className="text-[11px] text-muted-foreground/50 font-medium mt-0.5">
                            {b.alias.split(" ")[0]}
                          </p>
                        )}
                      </div>

                      {/* Zone badge */}
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                        ZONE_COLORS[b.zone]
                      )}>
                        {b.zone}존
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
