import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Bell, ChevronRight, School, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

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

  useEffect(() => {
    fetchNotices();
  }, []);

  const pinned = data?.notices.filter((n) => n.isPinned) ?? [];
  const regular = data?.notices.filter((n) => !n.isPinned) ?? [];

  const fetchedTime = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : null;

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
        {fetchedTime && (
          <p className="text-xs text-muted-foreground mt-1">
            총 {data?.total ?? 0}건
            {data?.stale ? " · 임시 캐시" : data?.cached ? " · 캐시됨" : " · 방금 업데이트"}
            {" · "}{fetchedTime} 기준
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
            <button
              onClick={fetchNotices}
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wide">고정 공지</span>
                </div>
                {pinned.map((notice) => (
                  <NoticeCard key={notice.id} notice={notice} />
                ))}
                <div className="pt-2 pb-1 px-1">
                  <div className="flex items-center gap-2">
                    <School className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">일반 공지</span>
                  </div>
                </div>
              </>
            )}
            {regular.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} />
            ))}
            {data?.notices.length === 0 && (
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

function NoticeCard({ notice }: { notice: Notice }) {
  const isRecent = (() => {
    if (!notice.date) return false;
    const d = new Date(notice.date);
    const diff = Date.now() - d.getTime();
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
              <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0">
                공지
              </span>
            )}
            {isRecent && !notice.isPinned && (
              <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full shrink-0">
                NEW
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{notice.title}</p>
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
