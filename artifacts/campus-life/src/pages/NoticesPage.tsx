import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Bell, School, BookOpen, Briefcase, AlertCircle, ExternalLink, Search, X,
         ChevronLeft, ChevronRight, List, Check, Construction } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEPT_BY_COLLEGE, SUPPORTED_DEPTS } from "@/lib/departments";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const PAGE_SIZE = 10;
const DEPT_PREF_KEY = "campus_life_notice_dept";
const DEFAULT_DEPT = "산업공학과";

/* ── Types ── */
interface Notice {
  id: string;
  title: string;
  date: string;
  writer: string;
  views: number;
  isPinned?: boolean;
  isNew?: boolean;
  url: string;
}
interface NoticesResponse {
  notices: Notice[];
  total: number;
  fetchedAt: string;
  cached: boolean;
  stale?: boolean;
  noJobsBoard?: boolean;
}

/* ── localStorage helpers ── */
function loadDept(): string {
  try { return localStorage.getItem(DEPT_PREF_KEY) || DEFAULT_DEPT; } catch { return DEFAULT_DEPT; }
}
function saveDept(d: string) {
  try { localStorage.setItem(DEPT_PREF_KEY, d); } catch { /* ignore */ }
}

/* ── Highlight helper ── */
function highlight(text: string, keyword: string) {
  if (!keyword) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-foreground rounded px-0.5">{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </>
  );
}

/* ── Notice card ── */
function NoticeCard({ notice, keyword }: { notice: Notice; keyword: string }) {
  const isRecent = (() => {
    if (!notice.date) return false;
    return Date.now() - new Date(notice.date).getTime() < 7 * 24 * 60 * 60 * 1000;
  })();
  return (
    <a href={notice.url} target="_blank" rel="noopener noreferrer"
      className="block bg-card rounded-2xl border border-border/50 px-4 py-3.5 hover:bg-slate-50 transition-colors shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {notice.isPinned && <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0">공지</span>}
            {(notice.isNew || (isRecent && !notice.isPinned)) && <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full shrink-0">NEW</span>}
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{highlight(notice.title, keyword)}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground">{notice.date}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">조회 {notice.views.toLocaleString()}</span>
          </div>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-1" />
      </div>
    </a>
  );
}

/* ── Pagination ── */
function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  const WINDOW = 5;
  let start = Math.max(1, current - Math.floor(WINDOW / 2));
  let end = start + WINDOW - 1;
  if (end > total) { end = total; start = Math.max(1, end - WINDOW + 1); }
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const btnBase = "h-9 rounded-xl text-sm font-bold transition-colors disabled:opacity-30";
  const numBtn = (p: number) => cn(btnBase, "w-9", current === p ? "bg-primary text-white shadow-sm" : "bg-slate-100 text-foreground hover:bg-slate-200");
  const navBtn = "p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-colors";
  return (
    <div className="flex items-center justify-center gap-1 pt-4 pb-2">
      <button onClick={() => onChange(1)} disabled={current === 1} className={navBtn} title="첫 페이지">
        <ChevronLeft className="w-3 h-3 text-foreground inline" /><ChevronLeft className="w-3 h-3 text-foreground inline -ml-1.5" />
      </button>
      <button onClick={() => onChange(current - 1)} disabled={current === 1} className={navBtn}><ChevronLeft className="w-4 h-4 text-foreground" /></button>
      {start > 1 && <span className="text-muted-foreground text-xs px-0.5">…</span>}
      {pages.map((p) => <button key={p} onClick={() => onChange(p)} className={numBtn(p)}>{p}</button>)}
      {end < total && <span className="text-muted-foreground text-xs px-0.5">…</span>}
      <button onClick={() => onChange(current + 1)} disabled={current === total} className={navBtn}><ChevronRight className="w-4 h-4 text-foreground" /></button>
      <button onClick={() => onChange(total)} disabled={current === total} className={navBtn} title="마지막 페이지">
        <ChevronRight className="w-3 h-3 text-foreground inline" /><ChevronRight className="w-3 h-3 text-foreground inline -ml-1.5" />
      </button>
    </div>
  );
}

/* ══════════════════════════════
   Dept Select Panel (bottom sheet)
══════════════════════════════ */
function DeptSelectPanel({ selected, onSelect, onClose }: {
  selected: string;
  onSelect: (dept: string) => void;
  onClose: () => void;
}) {
  const [searchQ, setSearchQ] = useState("");
  const kw = searchQ.trim().toLowerCase();

  const filtered = kw
    ? DEPT_BY_COLLEGE.map((c) => ({ ...c, depts: c.depts.filter((d) => d.toLowerCase().includes(kw)) })).filter((c) => c.depts.length > 0)
    : DEPT_BY_COLLEGE;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card rounded-t-3xl z-[61] shadow-2xl flex flex-col" style={{ maxHeight: "82vh" }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">학과 공지 설정</h2>
            <p className="text-xs text-muted-foreground mt-0.5">공지를 받을 학과를 선택하세요</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-3 py-2.5">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="학과 검색..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {searchQ && <button onClick={() => setSearchQ("")}><X className="w-4 h-4 text-muted-foreground" /></button>}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-4 pb-8">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
            </div>
          ) : (
            filtered.map(({ college, depts }) => (
              <div key={college} className="mb-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">{college}</p>
                <div className="bg-white rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/30 shadow-sm">
                  {depts.map((dept) => {
                    const isSelected = dept === selected;
                    const isSupported = SUPPORTED_DEPTS.has(dept);
                    return (
                      <button
                        key={dept}
                        onClick={() => { onSelect(dept); onClose(); }}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 text-left transition-colors text-sm",
                          isSelected ? "bg-primary/5" : "hover:bg-slate-50"
                        )}
                      >
                        <span className={cn("font-medium", isSelected ? "text-primary font-bold" : "text-foreground")}>
                          {dept}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {!isSupported && (
                            <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">준비중</span>
                          )}
                          {isSelected && <Check className="w-4 h-4 text-primary" strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════
   School Notices List
══════════════════════════════ */
function SchoolNoticesList({ query }: { query: string }) {
  const [data, setData] = useState<NoticesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchNotices = async () => {
    setIsLoading(true); setError("");
    try {
      const res = await fetch(`${BASE}/api/notices`);
      if (!res.ok) throw new Error("서버 오류");
      setData(await res.json());
    } catch { setError("공지사항을 불러오지 못했습니다."); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchNotices(); }, []);
  useEffect(() => { setCurrentPage(1); }, [query]);

  const all = data?.notices ?? [];
  const pinned = all.filter((n) => n.isPinned);
  const regular = all.filter((n) => !n.isPinned);
  const kw = query.trim().toLowerCase();
  const isSearching = kw.length > 0;
  const filteredPinned = isSearching ? pinned.filter((n) => n.title.toLowerCase().includes(kw)) : pinned;
  const filteredRegular = isSearching ? regular.filter((n) => n.title.toLowerCase().includes(kw)) : regular;
  const totalPages = Math.ceil(filteredRegular.length / PAGE_SIZE);
  const pagedRegular = isSearching ? filteredRegular : filteredRegular.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-4"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-sm text-muted-foreground">불러오는 중...</p></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-3 text-center"><AlertCircle className="w-10 h-10 text-destructive/50" /><p className="text-sm text-muted-foreground">{error}</p><button onClick={fetchNotices} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold">다시 시도</button></div>;
  if ((filteredPinned.length + filteredRegular.length) === 0 && isSearching) return <div className="flex flex-col items-center justify-center h-48 gap-3"><Search className="w-10 h-10 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p></div>;

  return (
    <div className="space-y-2">
      {filteredPinned.length > 0 && (<>
        <div className="flex items-center gap-2 px-1 pt-2 pb-1"><Bell className="w-3.5 h-3.5 text-primary" /><span className="text-xs font-bold text-primary tracking-wide">고정 공지</span></div>
        {filteredPinned.map((n) => <NoticeCard key={n.id} notice={n} keyword={kw} />)}
      </>)}
      {pagedRegular.length > 0 && (
        <div className="flex items-center gap-2 px-1 pt-3 pb-1">
          <School className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-muted-foreground tracking-wide">
            일반 공지 {isSearching ? `(${filteredRegular.length}건)` : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredRegular.length)} / ${filteredRegular.length}건`}
          </span>
        </div>
      )}
      {pagedRegular.map((n) => <NoticeCard key={n.id} notice={n} keyword={kw} />)}
      {!isSearching && <Pagination current={currentPage} total={totalPages} onChange={setCurrentPage} />}
    </div>
  );
}

/* ══════════════════════════════
   Dept Notices List
══════════════════════════════ */
function DeptNoticesList({ subTab, query, dept }: { subTab: "notice" | "jobs"; query: string; dept: string }) {
  const [dataMap, setDataMap] = useState<Record<string, NoticesResponse>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  const cacheKey = `${dept}__${subTab}`;

  const fetchDept = async (type: "notice" | "jobs", deptName: string) => {
    const key = `${deptName}__${type}`;
    if (dataMap[key]) return;
    setLoadingMap((p) => ({ ...p, [key]: true }));
    setErrorMap((p) => ({ ...p, [key]: "" }));
    try {
      const res = await fetch(`${BASE}/api/dept-notices?type=${type}&dept=${encodeURIComponent(deptName)}`);
      if (!res.ok) throw new Error("서버 오류");
      const json = await res.json();
      setDataMap((p) => ({ ...p, [key]: json }));
    } catch { setErrorMap((p) => ({ ...p, [key]: "학과 공지를 불러오지 못했습니다." })); }
    finally { setLoadingMap((p) => ({ ...p, [key]: false })); }
  };

  useEffect(() => { fetchDept(subTab, dept); }, [subTab, dept]);
  useEffect(() => { setCurrentPage(1); }, [subTab, dept, query]);

  const data = dataMap[cacheKey];
  const isLoading = loadingMap[cacheKey] ?? false;
  const error = errorMap[cacheKey] ?? "";
  const isSupported = SUPPORTED_DEPTS.has(dept);

  if (!isSupported) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
      <Construction className="w-12 h-12 text-muted-foreground/30" />
      <p className="text-base font-bold text-foreground">{dept}</p>
      <p className="text-sm text-muted-foreground">해당 학과 공지는 아직 준비 중입니다.<br/>더 많은 학과가 순차적으로 추가됩니다.</p>
    </div>
  );

  if (data?.noJobsBoard) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-4">
      <Briefcase className="w-10 h-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{dept}는 별도 취업정보 게시판이 없습니다.</p>
    </div>
  );

  const all = data?.notices ?? [];
  const kw = query.trim().toLowerCase();
  const isSearching = kw.length > 0;
  const filtered = isSearching ? all.filter((n) => n.title.toLowerCase().includes(kw)) : all;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = isSearching ? filtered : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const subLabel = subTab === "notice" ? "공지사항" : "취업정보";

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-4"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-sm text-muted-foreground">불러오는 중...</p></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-3 text-center"><AlertCircle className="w-10 h-10 text-destructive/50" /><p className="text-sm text-muted-foreground">{error}</p></div>;
  if (filtered.length === 0 && isSearching) return <div className="flex flex-col items-center justify-center h-48 gap-3"><Search className="w-10 h-10 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p></div>;
  if (all.length === 0) return <div className="flex flex-col items-center justify-center h-48 gap-3"><BookOpen className="w-10 h-10 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">게시물이 없습니다.</p></div>;

  return (
    <div className="space-y-2">
      {paged.length > 0 && (
        <div className="flex items-center gap-2 px-1 pt-2 pb-1">
          <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-muted-foreground tracking-wide">
            {dept} {subLabel} {isSearching ? `(${filtered.length}건)` : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} / ${filtered.length}건`}
          </span>
        </div>
      )}
      {paged.map((n) => <NoticeCard key={n.id} notice={n} keyword={kw} />)}
      {!isSearching && <Pagination current={currentPage} total={totalPages} onChange={setCurrentPage} />}
    </div>
  );
}

/* ══════════════════════════════
   Main Page
══════════════════════════════ */
const TOP_TABS = [
  { key: "school", label: "학교 공지" },
  { key: "dept",   label: "학과 공지" },
] as const;

const DEPT_SUB_TABS = [
  { key: "notice", label: "공지사항", icon: BookOpen },
  { key: "jobs",   label: "취업정보",  icon: Briefcase },
] as const;

export function NoticesPage() {
  const [tab, setTab] = useState<"school" | "dept">("school");
  const [subTab, setSubTab] = useState<"notice" | "jobs">("notice");
  const [query, setQuery] = useState("");
  const [showDeptPanel, setShowDeptPanel] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>(loadDept);

  const handleTabChange = (t: "school" | "dept") => { setTab(t); setQuery(""); };
  const handleSubTabChange = (t: "notice" | "jobs") => { setSubTab(t); setQuery(""); };
  const handleDeptSelect = (dept: string) => { setSelectedDept(dept); saveDept(dept); };

  return (
    <Layout hideTopBar hideBottomNav={showDeptPanel}>
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border/30">
        {/* Title row */}
        <div className="px-5 pt-5 pb-3 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-0.5 tracking-wide">부산대학교</p>
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              공지 <span className="text-primary font-extrabold">사항</span>
            </h1>
          </div>
          <button
            onClick={() => setShowDeptPanel(true)}
            className="w-11 h-11 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all shadow-sm"
            title="학과 선택"
          >
            <List className="w-5 h-5" />
          </button>
        </div>

        {/* Top tabs */}
        <div className="px-4 pb-2">
          <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
            {TOP_TABS.map(({ key, label }) => (
              <button key={key} onClick={() => handleTabChange(key)}
                className={cn("flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                  tab === key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Dept sub-tabs + selected dept indicator */}
        {tab === "dept" && (
          <>
            <div className="px-4 pb-2">
              <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
                {DEPT_SUB_TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => handleSubTabChange(key)}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all",
                      subTab === key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 pb-2 flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full shrink-0", SUPPORTED_DEPTS.has(selectedDept) ? "bg-green-500" : "bg-amber-400")} />
              <span className="text-xs font-semibold text-muted-foreground">{selectedDept}</span>
              <button onClick={() => setShowDeptPanel(true)} className="text-xs text-primary font-semibold hover:underline ml-1">변경</button>
            </div>
          </>
        )}

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-3 py-2.5">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="공지 제목 검색..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            {query && <button onClick={() => setQuery("")}><X className="w-4 h-4 text-muted-foreground" /></button>}
          </div>
          {query.trim() && <p className="text-xs text-muted-foreground mt-2 px-1">"{query.trim()}" 검색 중</p>}
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="px-4 pt-3 pb-28">
        {tab === "school"
          ? <SchoolNoticesList query={query} />
          : <DeptNoticesList subTab={subTab} query={query} dept={selectedDept} />
        }
      </div>

      {/* ── Dept Select Panel ── */}
      {showDeptPanel && (
        <DeptSelectPanel
          selected={selectedDept}
          onSelect={handleDeptSelect}
          onClose={() => setShowDeptPanel(false)}
        />
      )}
    </Layout>
  );
}
