import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Bell, School, BookOpen, Briefcase, RefreshCw, AlertCircle, ExternalLink, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const PAGE_SIZE = 10;

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
    const diff = Date.now() - new Date(notice.date).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  })();
  return (
    <a href={notice.url} target="_blank" rel="noopener noreferrer"
      className="block bg-card rounded-2xl border border-border/50 px-4 py-3.5 hover:bg-slate-50 transition-colors shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {notice.isPinned && (
              <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0">공지</span>
            )}
            {(notice.isNew || (isRecent && !notice.isPinned)) && (
              <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full shrink-0">NEW</span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {highlight(notice.title, keyword)}
          </p>
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
  return (
    <div className="flex items-center justify-center gap-1 pt-4 pb-2">
      <button onClick={() => onChange(current - 1)} disabled={current === 1}
        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-colors">
        <ChevronLeft className="w-4 h-4 text-foreground" />
      </button>
      {Array.from({ length: total }, (_, i) => i + 1).map((page) => {
        const show = page === 1 || page === total || Math.abs(page - current) <= 1;
        const showDot = page === current - 2 || page === current + 2;
        if (!show && !showDot) return null;
        if (showDot) return <span key={page} className="text-muted-foreground text-xs px-1">…</span>;
        return (
          <button key={page} onClick={() => onChange(page)}
            className={cn("w-9 h-9 rounded-xl text-sm font-bold transition-colors",
              current === page ? "bg-primary text-white shadow-sm" : "bg-slate-100 text-foreground hover:bg-slate-200")}>
            {page}
          </button>
        );
      })}
      <button onClick={() => onChange(current + 1)} disabled={current === total}
        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-colors">
        <ChevronRight className="w-4 h-4 text-foreground" />
      </button>
    </div>
  );
}

/* ── Search bar ── */
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="px-4 mb-3">
      <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-3 py-2.5">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="공지 제목 검색..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        {value && (
          <button onClick={() => onChange("")}><X className="w-4 h-4 text-muted-foreground" /></button>
        )}
      </div>
      {value.trim() && (
        <p className="text-xs text-muted-foreground mt-2 px-1">"{value.trim()}" 검색 중</p>
      )}
    </div>
  );
}

/* ══════════════════════════════
   School Notices Tab
══════════════════════════════ */
function SchoolNoticesTab() {
  const [data, setData] = useState<NoticesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
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

  const all = data?.notices ?? [];
  const pinned = all.filter((n) => n.isPinned);
  const regular = all.filter((n) => !n.isPinned);
  const kw = query.trim().toLowerCase();
  const isSearching = kw.length > 0;

  const filteredPinned = isSearching ? pinned.filter((n) => n.title.toLowerCase().includes(kw)) : pinned;
  const filteredRegular = isSearching ? regular.filter((n) => n.title.toLowerCase().includes(kw)) : regular;
  const totalPages = Math.ceil(filteredRegular.length / PAGE_SIZE);
  const pagedRegular = isSearching ? filteredRegular : filteredRegular.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearch = (v: string) => { setQuery(v); setCurrentPage(1); };

  return (
    <>
      <SearchBar value={query} onChange={handleSearch} />
      <div className="px-4 pb-28 space-y-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-destructive/50" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={fetchNotices} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold">다시 시도</button>
          </div>
        ) : (filteredPinned.length + filteredRegular.length) === 0 && isSearching ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Search className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <>
            {filteredPinned.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-primary tracking-wide">고정 공지</span>
                </div>
                {filteredPinned.map((n) => <NoticeCard key={n.id} notice={n} keyword={kw} />)}
              </>
            )}
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
          </>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════
   Dept Notices Tab
══════════════════════════════ */
const DEPT_SUB_TABS = [
  { key: "notice", label: "공지사항", icon: BookOpen },
  { key: "jobs",   label: "취업정보",  icon: Briefcase },
] as const;

function DeptNoticesTab() {
  const [subTab, setSubTab] = useState<"notice" | "jobs">("notice");
  const [dataMap, setDataMap] = useState<Record<string, NoticesResponse>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchDept = async (type: "notice" | "jobs") => {
    if (dataMap[type]) return;
    setLoadingMap((p) => ({ ...p, [type]: true }));
    setErrorMap((p) => ({ ...p, [type]: "" }));
    try {
      const res = await fetch(`${BASE}/api/dept-notices?type=${type}`);
      if (!res.ok) throw new Error("서버 오류");
      const json = await res.json();
      setDataMap((p) => ({ ...p, [type]: json }));
    } catch { setErrorMap((p) => ({ ...p, [type]: "학과 공지를 불러오지 못했습니다." })); }
    finally { setLoadingMap((p) => ({ ...p, [type]: false })); }
  };

  const refetch = async (type: "notice" | "jobs") => {
    setDataMap((p) => { const n = { ...p }; delete n[type]; return n; });
    await fetchDept(type);
  };

  useEffect(() => { fetchDept(subTab); }, [subTab]);

  const handleSubTab = (t: "notice" | "jobs") => {
    setSubTab(t);
    setQuery("");
    setCurrentPage(1);
    fetchDept(t);
  };

  const data = dataMap[subTab];
  const isLoading = loadingMap[subTab] ?? false;
  const error = errorMap[subTab] ?? "";

  const all = data?.notices ?? [];
  const kw = query.trim().toLowerCase();
  const isSearching = kw.length > 0;
  const filtered = isSearching ? all.filter((n) => n.title.toLowerCase().includes(kw)) : all;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = isSearching ? filtered : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearch = (v: string) => { setQuery(v); setCurrentPage(1); };

  return (
    <>
      {/* Sub-tabs */}
      <div className="px-4 mb-3">
        <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
          {DEPT_SUB_TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => handleSubTab(key)}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all",
                subTab === key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      <SearchBar value={query} onChange={handleSearch} />

      <div className="px-4 pb-28 space-y-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-destructive/50" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={() => refetch(subTab)} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold">다시 시도</button>
          </div>
        ) : filtered.length === 0 && isSearching ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Search className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <>
            {paged.length > 0 && (
              <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground tracking-wide">
                  산업공학과 {DEPT_SUB_TABS.find((t) => t.key === subTab)?.label}
                  {isSearching ? ` (${filtered.length}건)` : ` ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} / ${filtered.length}건`}
                </span>
              </div>
            )}
            {paged.map((n) => <NoticeCard key={n.id} notice={n} keyword={kw} />)}
            {!isSearching && <Pagination current={currentPage} total={totalPages} onChange={setCurrentPage} />}
            {all.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <BookOpen className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">게시물이 없습니다.</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════
   Main Page
══════════════════════════════ */
const TOP_TABS = [
  { key: "school", label: "학교 공지" },
  { key: "dept",   label: "학과 공지" },
] as const;

export function NoticesPage() {
  const [tab, setTab] = useState<"school" | "dept">("school");

  return (
    <Layout>
      <div className="p-6 pt-12 pb-4">
        <p className="text-muted-foreground font-medium mb-1">부산대학교</p>
        <h1 className="text-3xl text-foreground">
          공지 <span className="text-primary">사항</span>
        </h1>
      </div>

      {/* Top tab switcher */}
      <div className="px-4 mb-3">
        <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
          {TOP_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn("flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                tab === key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "school" ? <SchoolNoticesTab /> : <DeptNoticesTab />}
    </Layout>
  );
}
