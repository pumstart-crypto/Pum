import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Bell, School, RefreshCw, AlertCircle, ExternalLink, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const PAGE_SIZE = 10;

interface Notice {
  id: string;
  title: string;
  date: string;
  writer: string;
  views: number;
  isPinned: boolean;
  url: string;
}

interface NoticesResponse {
  notices: Notice[];
  total: number;
  fetchedAt: string;
  cached: boolean;
  stale?: boolean;
}

export function NoticesPage() {
  const [data, setData] = useState<NoticesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchNotices = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/notices`);
      if (!res.ok) throw new Error("서버 오류");
      const json: NoticesResponse = await res.json();
      setData(json);
    } catch {
      setError("공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchNotices(); }, []);

  const allNotices = data?.notices ?? [];
  const pinned = allNotices.filter((n) => n.isPinned);
  const regular = allNotices.filter((n) => !n.isPinned);

  const isSearching = query.trim().length > 0;
  const keyword = query.trim().toLowerCase();

  const filteredPinned = isSearching
    ? pinned.filter((n) => n.title.toLowerCase().includes(keyword))
    : pinned;

  const filteredRegular = isSearching
    ? regular.filter((n) => n.title.toLowerCase().includes(keyword))
    : regular;

  const totalPages = Math.ceil(filteredRegular.length / PAGE_SIZE);
  const pagedRegular = isSearching
    ? filteredRegular
    : filteredRegular.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const fetchedTime = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const handleSearch = (val: string) => {
    setQuery(val);
    setCurrentPage(1);
  };

  const handlePage = (page: number) => {
    setCurrentPage(page);
  };

  const totalResults = filteredPinned.length + filteredRegular.length;

  return (
    <Layout>
      <div className="p-6 pt-12 pb-4">
        <p className="text-muted-foreground font-medium mb-1">부산대학교</p>
        <div className="flex items-end justify-between">
          <h1 className="text-3xl text-foreground">
            학교 <span className="text-primary">공지사항</span>
          </h1>
          <button
            onClick={fetchNotices}
            disabled={isLoading}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* 검색창 */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-3 py-2.5">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="공지 제목 검색..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button onClick={() => handleSearch("")} className="shrink-0">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        {isSearching && (
          <p className="text-xs text-muted-foreground mt-2 px-1">
            "{query}" 검색 결과 {totalResults}건
          </p>
        )}
      </div>

      <div className="px-4 pb-28 space-y-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">공지사항 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
            <div className="w-14 h-14 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={fetchNotices} className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
              다시 시도
            </button>
          </div>
        ) : totalResults === 0 && isSearching ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Search className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 고정 공지 */}
            {filteredPinned.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wide">고정 공지</span>
                </div>
                {filteredPinned.map((n) => <NoticeCard key={n.id} notice={n} keyword={keyword} />)}
              </>
            )}

            {/* 일반 공지 구분선 */}
            {pagedRegular.length > 0 && (
              <div className="flex items-center gap-2 px-1 pt-3 pb-1">
                <School className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  일반 공지 {isSearching ? `(${filteredRegular.length}건)` : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredRegular.length)} / ${filteredRegular.length}건`}
                </span>
              </div>
            )}

            {pagedRegular.map((n) => <NoticeCard key={n.id} notice={n} keyword={keyword} />)}

            {/* 페이지네이션 (검색 중엔 숨김) */}
            {!isSearching && totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-4 pb-2">
                <button
                  onClick={() => handlePage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-foreground" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  const show = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                  const showDot = page === currentPage - 2 || page === currentPage + 2;
                  if (!show && !showDot) return null;
                  if (showDot) return <span key={page} className="text-muted-foreground text-xs px-1">…</span>;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePage(page)}
                      className={cn(
                        "w-9 h-9 rounded-xl text-sm font-bold transition-colors",
                        currentPage === page
                          ? "bg-primary text-white shadow-sm"
                          : "bg-slate-100 text-foreground hover:bg-slate-200"
                      )}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-foreground" />
                </button>
              </div>
            )}

            {allNotices.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <School className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">공지사항이 없습니다.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

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

function NoticeCard({ notice, keyword }: { notice: Notice; keyword: string }) {
  const isRecent = (() => {
    if (!notice.date) return false;
    const diff = Date.now() - new Date(notice.date).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  })();

  return (
    <a
      href={notice.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-card rounded-2xl border border-border/50 px-4 py-3.5 hover:bg-slate-50 transition-colors shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {notice.isPinned && (
              <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0">공지</span>
            )}
            {isRecent && !notice.isPinned && (
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
