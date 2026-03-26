import { useState, useMemo, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Search, Map, Building2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Building {
  code: string;
  name: string;
  alias?: string;
  group: number; // zone (부산) or group (다른 캠퍼스)
}

interface CampusInfo {
  id: string;
  label: string;
  mapImage: string | null;
  buildings: Building[];
  groups: { id: number; label: string; color: string }[];
}

// ─── 부산 캠퍼스 ──────────────────────────────────────────────────────────────
const PUSAN_BUILDINGS: Building[] = [
  { code: "101", name: "MEMS/NANO 클린룸동", group: 1 },
  { code: "102", name: "IT관", group: 1 },
  { code: "103", name: "제12공학관", group: 1 },
  { code: "105", name: "제3공학관", alias: "융합기계관", group: 1 },
  { code: "106", name: "효원문화회관", group: 1 },
  { code: "107", name: "제8공학관", alias: "항공관", group: 1 },
  { code: "108", name: "제9공학관", alias: "기전관", group: 1 },
  { code: "109", name: "공과대학 공동실험관", group: 1 },
  { code: "110", name: "에너지분야실험실", group: 1 },
  { code: "111", name: "실험폐기물처리장", group: 1 },
  { code: "K08", name: "공과대학 제2별관", group: 1 },
  { code: "201", name: "제6공학관", alias: "컴퓨터공학관 컴공관", group: 2 },
  { code: "202", name: "운죽정", group: 2 },
  { code: "203", name: "넉넉한터", alias: "학생회관", group: 2 },
  { code: "204", name: "넉넉한터 지하주차장", group: 2 },
  { code: "205", name: "대학본부", alias: "본관", group: 2 },
  { code: "206", name: "제11공학관", alias: "조선해양공학관", group: 2 },
  { code: "207", name: "제10공학관", alias: "특성화공학관", group: 2 },
  { code: "208", name: "기계기술연구동", group: 2 },
  { code: "301", name: "구조실험동", group: 3 },
  { code: "303", name: "기계관", group: 3 },
  { code: "306", name: "인문관", group: 3 },
  { code: "307", name: "인문대 교수연구동", group: 3 },
  { code: "308", name: "제1물리관", group: 3 },
  { code: "309", name: "제2물리관", group: 3 },
  { code: "311", name: "공동연구기기동", group: 3 },
  { code: "312", name: "공동실험실습관", group: 3 },
  { code: "313", name: "자연대 연구실험동", group: 3 },
  { code: "314", name: "정보화교육관", alias: "전산실", group: 3 },
  { code: "315", name: "자유관 A동", alias: "기숙사", group: 3 },
  { code: "316", name: "자유관 B동", alias: "기숙사", group: 3 },
  { code: "318", name: "자유주차장", group: 3 },
  { code: "401", name: "건설관", group: 4 },
  { code: "402", name: "정학관", group: 4 },
  { code: "405", name: "제2공학관", alias: "재료관", group: 4 },
  { code: "408", name: "제5공학관", alias: "유기소재관", group: 4 },
  { code: "409", name: "교수회관", group: 4 },
  { code: "416", name: "생물관", group: 4 },
  { code: "417", name: "제1사범관", group: 4 },
  { code: "418", name: "제2교수연구동", group: 4 },
  { code: "419", name: "금정회관", group: 4 },
  { code: "420", name: "새벽벌도서관", alias: "상남국제회관", group: 4 },
  { code: "421", name: "사회관", group: 4 },
  { code: "422", name: "성학관", group: 4 },
  { code: "501", name: "첨단과학관", group: 5 },
  { code: "503", name: "약학관", group: 5 },
  { code: "505", name: "인덕관 철골주차장", group: 5 },
  { code: "506", name: "효원산학협동관", group: 5 },
  { code: "507", name: "인덕관", group: 5 },
  { code: "508", name: "산학협동관", group: 5 },
  { code: "509", name: "박물관 별관", group: 5 },
  { code: "510", name: "중앙도서관", alias: "도서관", group: 5 },
  { code: "511", name: "간이체육관", group: 5 },
  { code: "512", name: "테니스장", group: 5 },
  { code: "513", name: "철골주차장", group: 5 },
  { code: "514", name: "경영관", group: 5 },
  { code: "516", name: "경제통상관", group: 5 },
  { code: "601", name: "법학관", group: 6 },
  { code: "602", name: "제1행정관", group: 6 },
  { code: "603", name: "제2행정관", group: 6 },
  { code: "605", name: "학생생활관", group: 6 },
  { code: "606", name: "학생회관", group: 6 },
  { code: "607", name: "대운동장", group: 6 },
  { code: "608", name: "제2법학관", group: 6 },
  { code: "609", name: "야외음악당", group: 6 },
  { code: "701", name: "제2사범관", group: 7 },
  { code: "705", name: "경암체육관 교수연구동", group: 7 },
  { code: "706", name: "경암체육관", group: 7 },
  { code: "707", name: "음악관", group: 7 },
  { code: "709", name: "과학기술연구동", group: 7 },
  { code: "710", name: "제1연구동", group: 7 },
  { code: "711", name: "제2연구동", group: 7 },
  { code: "712", name: "제3연구동", group: 7 },
  { code: "713", name: "제4연구동", group: 7 },
  { code: "714", name: "제5연구동", group: 7 },
  { code: "715", name: "제6연구동", group: 7 },
  { code: "716", name: "제7연구동", group: 7 },
  { code: "717", name: "제8연구동", group: 7 },
];

// ─── 양산 캠퍼스 ──────────────────────────────────────────────────────────────
const YANGSAN_BUILDINGS: Building[] = [
  { code: "Y01", name: "경암의학관", group: 1 },
  { code: "Y02", name: "치의학전문대학원", group: 1 },
  { code: "Y03", name: "한의학전문대학원", group: 1 },
  { code: "Y04", name: "간호대학", group: 1 },
  { code: "Y05", name: "행림관", alias: "기숙사", group: 1 },
  { code: "Y06", name: "지진방재연구센터", group: 1 },
  { code: "Y07", name: "파워플랜트", group: 1 },
  { code: "Y08", name: "쓰레기집하장", group: 1 },
  { code: "Y09", name: "나래관", group: 1 },
  { code: "Y10", name: "의생명과학도서관", group: 1 },
  { code: "Y11", name: "충격공학연구센터 시험연구동", group: 1 },
  { code: "Y12", name: "운동장", group: 1 },
  { code: "Y13", name: "테니스장", group: 1 },
  { code: "Y14", name: "한국그린인프라·저영향개발센터", group: 1 },
  { code: "Y15", name: "첨단의생명융합센터", group: 1 },
  { code: "Y16", name: "지행관", alias: "기숙사", group: 1 },
  { code: "Y17", name: "경암공학관", group: 1 },
  { code: "YH01", name: "양산부산대학교병원", group: 2 },
  { code: "YH02", name: "어린이병원", group: 2 },
  { code: "YH03", name: "치과병원", group: 2 },
  { code: "YH04", name: "한방병원", group: 2 },
  { code: "YH05", name: "재활병원", group: 2 },
  { code: "YH06", name: "전문질환센터", group: 2 },
  { code: "YH07", name: "한의약임상연구센터", group: 2 },
  { code: "YH08", name: "편의시설동", group: 2 },
  { code: "YH09", name: "교수연구동·행정동", group: 2 },
  { code: "YH11", name: "의생명창의연구동", group: 2 },
  { code: "YH12", name: "직장어린이집", group: 2 },
  { code: "YH13", name: "로날드맥도날드하우스", group: 2 },
  { code: "YH14", name: "직원기숙사", group: 2 },
  { code: "YH15", name: "한방병원 원외탕전실", group: 2 },
];

// ─── 밀양 캠퍼스 ──────────────────────────────────────────────────────────────
const MIRYANG_BUILDINGS: Building[] = [
  { code: "M01", name: "행정지원본부동", group: 1 },
  { code: "M01-1", name: "나노생명과학도서관", group: 1 },
  { code: "M02", name: "나노과학기술관", group: 1 },
  { code: "M03", name: "생명자원과학관", group: 1 },
  { code: "M04", name: "학생회관", group: 1 },
  { code: "M05", name: "비마관 및 매화관", alias: "기숙사", group: 1 },
  { code: "M05-1", name: "청학관", alias: "기숙사", group: 1 },
  { code: "M06", name: "종합실험실습관", group: 1 },
  { code: "M07", name: "정문수위실", group: 1 },
  { code: "M08", name: "운동장", group: 1 },
  { code: "M09", name: "공동실험실습관", group: 1 },
  { code: "M10", name: "테니스장", group: 1 },
  { code: "M11", name: "첨단온실", group: 1 },
];

// ─── 아미 캠퍼스 ──────────────────────────────────────────────────────────────
const AMI_BUILDINGS: Building[] = [
  { code: "AH01", name: "A동", alias: "본관", group: 1 },
  { code: "AH04", name: "B동", alias: "외래센터", group: 1 },
  { code: "AH05", name: "E동", alias: "부산권응급의료센터", group: 1 },
  { code: "AH06", name: "C동", alias: "부산지역암센터", group: 1 },
  { code: "AH07", name: "CE동", alias: "부산지역암센터 별관", group: 1 },
  { code: "AH08", name: "주차타워", group: 1 },
  { code: "AH09", name: "H동", alias: "복지동", group: 1 },
  { code: "AH10", name: "J동", alias: "장기려관", group: 1 },
  { code: "AH20", name: "의생명연구원", group: 1 },
];

// ─── 캠퍼스 설정 ─────────────────────────────────────────────────────────────
const CAMPUSES: CampusInfo[] = [
  {
    id: "pusan",
    label: "부산",
    mapImage: null,
    buildings: PUSAN_BUILDINGS,
    groups: [
      { id: 1, label: "1존 공학서쪽", color: "bg-blue-100 text-blue-700" },
      { id: 2, label: "2존 대학본부", color: "bg-violet-100 text-violet-700" },
      { id: 3, label: "3존 인문·자연", color: "bg-emerald-100 text-emerald-700" },
      { id: 4, label: "4존 사회·사범", color: "bg-amber-100 text-amber-700" },
      { id: 5, label: "5존 도서관", color: "bg-rose-100 text-rose-700" },
      { id: 6, label: "6존 법학·행정", color: "bg-cyan-100 text-cyan-700" },
      { id: 7, label: "7존 체육·연구", color: "bg-orange-100 text-orange-700" },
    ],
  },
  {
    id: "yangsan",
    label: "양산",
    mapImage: null,
    buildings: YANGSAN_BUILDINGS,
    groups: [
      { id: 1, label: "캠퍼스", color: "bg-blue-100 text-blue-700" },
      { id: 2, label: "병원", color: "bg-rose-100 text-rose-700" },
    ],
  },
  {
    id: "miryang",
    label: "밀양",
    mapImage: null,
    buildings: MIRYANG_BUILDINGS,
    groups: [
      { id: 1, label: "전체", color: "bg-emerald-100 text-emerald-700" },
    ],
  },
  {
    id: "ami",
    label: "아미",
    mapImage: null,
    buildings: AMI_BUILDINGS,
    groups: [
      { id: 1, label: "병원", color: "bg-violet-100 text-violet-700" },
    ],
  },
];

export function CampusMapPage() {
  const [campusId, setCampusId] = useState("pusan");
  const [tab, setTab] = useState<"map" | "search">("map");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const campus = CAMPUSES.find(c => c.id === campusId)!;

  function handleCampusChange(id: string) {
    setCampusId(id);
    setQuery("");
    setGroupFilter(null);
  }

  function handleMapImageLoad() {
    const el = mapContainerRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = 0;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campus.buildings.filter(b => {
      const matchGroup = groupFilter === null || b.group === groupFilter;
      if (!matchGroup) return false;
      if (!q) return true;
      return (
        b.code.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        (b.alias?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [query, groupFilter, campus]);

  const groupColor = (id: number) =>
    campus.groups.find(g => g.id === id)?.color ?? "bg-slate-100 text-slate-600";

  const groupLabel = (id: number) =>
    campus.groups.find(g => g.id === id)?.label ?? "";

  return (
    <Layout hideTopBar>
      <div className="flex flex-col pb-20">

        {/* Header */}
        <div className="px-5 pt-14 pb-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-1">부산대학교</p>
          <h2
            className="text-4xl font-extrabold text-foreground leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}
          >
            캠퍼스 맵
          </h2>
        </div>

        {/* Campus selector */}
        <div className="flex gap-2 px-5 mb-3 overflow-x-auto no-scrollbar">
          {CAMPUSES.map(c => (
            <button
              key={c.id}
              onClick={() => handleCampusChange(c.id)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-2xl text-[13px] font-bold transition-all",
                campusId === c.id
                  ? "bg-primary text-white shadow-[0_4px_12px_rgba(0,66,125,0.22)]"
                  : "bg-white text-muted-foreground border border-border/40"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Map / 건물찾기 tabs */}
        <div className="flex mx-5 mb-3 bg-slate-100 rounded-2xl p-1 gap-1">
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

        {/* ── 지도 탭 ── */}
        {tab === "map" && (
          campus.mapImage ? (
            <div
              ref={mapContainerRef}
              className="mx-5 mb-3 rounded-3xl overflow-auto border border-border/20 shadow-sm bg-white"
              style={{ height: "calc(100dvh - 310px)", touchAction: "pan-x pan-y pinch-zoom" }}
            >
              <img
                src={campus.mapImage}
                alt={`${campus.label}캠퍼스 지도`}
                style={{ width: "780px", height: "auto", display: "block" }}
                draggable={false}
                onLoad={handleMapImageLoad}
              />
            </div>
          ) : (
            <div
              className="mx-5 mb-3 rounded-3xl border border-border/20 shadow-sm bg-white flex flex-col items-center justify-center gap-3"
              style={{ height: "calc(100dvh - 310px)" }}
            >
              <Map className="w-12 h-12 text-muted-foreground/15" />
              <p className="text-sm font-bold text-muted-foreground/40">{campus.label}캠퍼스 지도</p>
              <p className="text-xs text-muted-foreground/30 font-medium">추후 추가 예정</p>
            </div>
          )
        )}

        {/* ── 건물 찾기 탭 ── */}
        {tab === "search" && (
          <div className="flex flex-col">

            {/* Search input */}
            <div className="px-5 mb-3">
              <div className="flex items-center gap-2.5 bg-white border border-border/30 rounded-2xl px-4 py-3 shadow-sm">
                <Search className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                <input
                  type="text"
                  placeholder="건물명 또는 코드 검색"
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

            {/* Group filter — only show if campus has multiple groups */}
            {campus.groups.length > 1 && (
              <div className="px-5 mb-3 flex gap-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setGroupFilter(null)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-all shrink-0",
                    groupFilter === null ? "bg-foreground text-white" : "bg-slate-100 text-muted-foreground"
                  )}
                >
                  전체
                </button>
                {campus.groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGroupFilter(groupFilter === g.id ? null : g.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-all shrink-0",
                      groupFilter === g.id ? "bg-foreground text-white" : "bg-slate-100 text-muted-foreground"
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}

            {/* Result count */}
            <div className="px-5 mb-2">
              <p className="text-[11px] text-muted-foreground/40 font-medium">
                {filtered.length}개 건물
              </p>
            </div>

            {/* Building list */}
            <div className="px-5 pb-4">
              {campus.buildings.length === 0 ? (
                <div className="bg-white rounded-3xl border border-border/20 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
                  <Building2 className="w-10 h-10 text-muted-foreground/15" />
                  <p className="text-sm font-bold text-muted-foreground/40">{campus.label}캠퍼스</p>
                  <p className="text-xs text-muted-foreground/30 font-medium">건물 정보 추후 추가 예정</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-3xl border border-border/20 shadow-sm flex flex-col items-center justify-center py-12 gap-2">
                  <Search className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-sm font-medium text-muted-foreground/40">검색 결과가 없습니다</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-border/20 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden">
                  {filtered.map((b, i) => (
                    <div
                      key={b.code}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3",
                        i !== filtered.length - 1 && "border-b border-border/10"
                      )}
                    >
                      <span className="text-[11px] font-black text-muted-foreground/40 w-12 shrink-0 text-right tabular-nums">
                        {b.code}
                      </span>
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
                      {campus.groups.length > 1 && (
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", groupColor(b.group))}>
                          {groupLabel(b.group).split(" ")[0]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
