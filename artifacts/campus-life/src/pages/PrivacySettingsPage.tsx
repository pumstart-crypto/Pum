import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import {
  ChevronLeft, FileText, MessageSquare, Camera, MapPin, Bell,
  Lock, UserX, Trash2, ChevronRight, AlertTriangle, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

// ── helpers ──────────────────────────────────────────────────────────────────
interface PostSummary { id: number; title: string; category: string; subCategory?: string; createdAt: string; }
interface CommentSummary { id: number; postId: number; content: string; createdAt: string; }

function loadMyPosts(): PostSummary[] {
  try { return JSON.parse(localStorage.getItem("campus_life_my_posts") || "[]"); } catch { return []; }
}
function loadMyComments(): CommentSummary[] {
  try { return JSON.parse(localStorage.getItem("campus_life_my_comments") || "[]"); } catch { return []; }
}
function relativeTime(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// ── Permission helpers ────────────────────────────────────────────────────────
type PermState = "granted" | "denied" | "prompt" | "unsupported";

async function queryPerm(name: PermissionName | string): Promise<PermState> {
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName });
    return status.state as PermState;
  } catch {
    return "unsupported";
  }
}

function PermBadge({ state }: { state: PermState }) {
  const map: Record<PermState, { label: string; cls: string }> = {
    granted: { label: "허용됨", cls: "bg-green-100 text-green-700" },
    denied: { label: "차단됨", cls: "bg-red-100 text-red-700" },
    prompt: { label: "미설정", cls: "bg-slate-100 text-slate-500" },
    unsupported: { label: "미지원", cls: "bg-slate-100 text-slate-400" },
  };
  const { label, cls } = map[state];
  return <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", cls)}>{label}</span>;
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">{title}</p>
      <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden divide-y divide-border/40">
        {children}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function PrivacySettingsPage() {
  const [, navigate] = useLocation();

  const [myPosts, setMyPosts] = useState<PostSummary[]>(loadMyPosts);
  const [myComments, setMyComments] = useState<CommentSummary[]>(loadMyComments);
  const [showPosts, setShowPosts] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [deletingPost, setDeletingPost] = useState<number | null>(null);
  const [deletingComment, setDeletingComment] = useState<number | null>(null);

  const [perms, setPerms] = useState<Record<string, PermState>>({});
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

  // Load permissions
  useEffect(() => {
    (async () => {
      const [notif, cam, mic, geo] = await Promise.all([
        queryPerm("notifications"),
        queryPerm("camera"),
        queryPerm("microphone"),
        queryPerm("geolocation"),
      ]);
      setPerms({ notif, cam, mic, geo });
    })();
  }, []);

  // ── Post delete ───────────────────────────────────────────────────────────
  const handleDeletePost = async (id: number) => {
    if (!confirm("이 게시글을 삭제하시겠습니까?")) return;
    setDeletingPost(id);
    try {
      await fetch(`${API}/community/${id}`, { method: "DELETE" });
      const ids: number[] = JSON.parse(localStorage.getItem("campus_life_authored_posts") || "[]");
      localStorage.setItem("campus_life_authored_posts", JSON.stringify(ids.filter(i => i !== id)));
      const next = myPosts.filter(p => p.id !== id);
      localStorage.setItem("campus_life_my_posts", JSON.stringify(next));
      setMyPosts(next);
    } catch { alert("삭제에 실패했습니다."); }
    finally { setDeletingPost(null); }
  };

  // ── Comment delete ────────────────────────────────────────────────────────
  const handleDeleteComment = async (c: CommentSummary) => {
    if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
    setDeletingComment(c.id);
    try {
      await fetch(`${API}/community/${c.postId}/comments/${c.id}`, { method: "DELETE" });
      const ids: number[] = JSON.parse(localStorage.getItem("campus_life_authored_comments") || "[]");
      localStorage.setItem("campus_life_authored_comments", JSON.stringify(ids.filter(i => i !== c.id)));
      const next = myComments.filter(x => x.id !== c.id);
      localStorage.setItem("campus_life_my_comments", JSON.stringify(next));
      setMyComments(next);
    } catch { alert("삭제에 실패했습니다."); }
    finally { setDeletingComment(null); }
  };

  // ── Account withdraw ──────────────────────────────────────────────────────
  const handleWithdraw = () => {
    if (!confirm("모든 데이터가 삭제되고 계정이 초기화됩니다. 계속하시겠습니까?")) return;
    const keys = [
      "campus_life_profile", "campus_life_authored_posts", "campus_life_authored_comments",
      "campus_life_my_posts", "campus_life_my_comments", "campus_life_notice_dept",
      "campus_life_notifications",
    ];
    keys.forEach(k => localStorage.removeItem(k));
    navigate("/settings");
  };

  return (
    <Layout hideTopBar>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border/60 flex items-center gap-2 px-4 py-3">
        <button onClick={() => navigate("/settings")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-base flex-1">개인정보 보호</span>
      </div>

      <div className="px-4 py-5 space-y-5 pb-28">

        {/* ── 내 게시글 ── */}
        <Section title="커뮤니티 활동">
          {/* 내 게시글 */}
          <div>
            <button
              onClick={() => setShowPosts(p => !p)}
              className="w-full flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">내 게시글</p>
                <p className="text-xs text-muted-foreground">{myPosts.length}개의 게시글</p>
              </div>
              <ChevronRight className={cn("w-4 h-4 text-muted-foreground/50 transition-transform", showPosts && "rotate-90")} />
            </button>
            {showPosts && (
              <div className="border-t border-border/40 divide-y divide-border/40">
                {myPosts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-5">작성한 게시글이 없습니다</p>
                ) : (
                  myPosts.map(post => (
                    <div key={post.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50/60">
                      <button
                        onClick={() => navigate(`/board/${post.id}`)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-bold text-primary">{post.category}</span>
                          {post.subCategory && <span className="text-[11px] text-muted-foreground">{post.subCategory}</span>}
                        </div>
                        <p className="text-sm font-medium text-foreground line-clamp-1">{post.title}</p>
                        <p className="text-[11px] text-muted-foreground">{relativeTime(post.createdAt)}</p>
                      </button>
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletingPost === post.id}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 내 댓글 */}
          <div>
            <button
              onClick={() => setShowComments(p => !p)}
              className="w-full flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">내 댓글</p>
                <p className="text-xs text-muted-foreground">{myComments.length}개의 댓글</p>
              </div>
              <ChevronRight className={cn("w-4 h-4 text-muted-foreground/50 transition-transform", showComments && "rotate-90")} />
            </button>
            {showComments && (
              <div className="border-t border-border/40 divide-y divide-border/40">
                {myComments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-5">작성한 댓글이 없습니다</p>
                ) : (
                  myComments.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50/60">
                      <button
                        onClick={() => navigate(`/board/${c.postId}`)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-sm text-foreground line-clamp-2">{c.content}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          게시글 #{c.postId} · {relativeTime(c.createdAt)}
                        </p>
                      </button>
                      <button
                        onClick={() => handleDeleteComment(c)}
                        disabled={deletingComment === c.id}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </Section>

        {/* ── 앱 권한 ── */}
        <Section title="앱 권한">
          {[
            { key: "notif", icon: Bell, label: "알림", desc: "공지·댓글 푸시 알림", color: "#2563EB", req: () => Notification.requestPermission() },
            { key: "cam", icon: Camera, label: "카메라 / 갤러리", desc: "게시글 이미지 첨부", color: "#7C3AED", req: () => navigator.mediaDevices?.getUserMedia({ video: true }) },
            { key: "mic", icon: Camera, label: "마이크", desc: "음성 기록 (추후 지원)", color: "#059669", req: null },
            { key: "geo", icon: MapPin, label: "위치", desc: "버스·캠퍼스 지도", color: "#D97706", req: () => new Promise(res => navigator.geolocation.getCurrentPosition(res, res)) },
          ].map(({ key, icon: Icon, label, desc, color, req }) => (
            <div key={key} className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <PermBadge state={(perms[key] ?? "prompt") as PermState} />
                {req && perms[key] === "prompt" && (
                  <button
                    onClick={async () => {
                      try { await req(); const s = await queryPerm(key === "notif" ? "notifications" : key === "cam" ? "camera" : key === "mic" ? "microphone" : "geolocation"); setPerms(p => ({ ...p, [key]: s })); } catch {}
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    허용
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="px-4 py-3 bg-slate-50/60">
            <p className="text-[11px] text-muted-foreground">권한 변경은 브라우저 주소창 좌측 자물쇠 아이콘 → 사이트 설정에서 가능합니다.</p>
          </div>
        </Section>

        {/* ── 계정 보안 ── */}
        <Section title="계정 보안">
          <button
            onClick={() => setShowChangePw(p => !p)}
            className="w-full flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">비밀번호 변경</p>
              <p className="text-xs text-muted-foreground">로그인 비밀번호 재설정</p>
            </div>
            <ChevronRight className={cn("w-4 h-4 text-muted-foreground/50 transition-transform", showChangePw && "rotate-90")} />
          </button>
          {showChangePw && (
            <div className="border-t border-border/40 px-4 py-5 bg-slate-50/60">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  비밀번호 변경은 <strong>로그인 기능 도입 후</strong> 사용할 수 있습니다. 현재 버전에서는 학생증 인증 기반 임시 운영 중입니다.
                </p>
              </div>
            </div>
          )}
        </Section>

        {/* ── 법적 고지 ── */}
        <Section title="법적 고지">
          {[
            { label: "개인정보 처리방침", href: "https://www.pusan.ac.kr/kor/CMS/Privacy/main.do" },
            { label: "서비스 이용약관", href: null },
          ].map(({ label, href }) => (
            <button
              key={label}
              onClick={() => href && window.open(href, "_blank")}
              className={cn("w-full flex items-center gap-3 p-4 text-left", href ? "hover:bg-secondary/30" : "opacity-50 cursor-default")}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                {!href && <p className="text-xs text-muted-foreground">준비 중</p>}
              </div>
              {href && <ExternalLink className="w-4 h-4 text-muted-foreground/50" />}
            </button>
          ))}
        </Section>

        {/* ── 계정 탈퇴 ── */}
        <button
          onClick={() => setShowWithdraw(p => !p)}
          className="w-full bg-white rounded-2xl border border-border/50 shadow-sm p-4 flex items-center gap-3 hover:bg-secondary/20 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <UserX className="w-4 h-4 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">계정 탈퇴</p>
            <p className="text-xs text-muted-foreground">모든 데이터가 삭제됩니다</p>
          </div>
          <ChevronRight className={cn("w-4 h-4 text-muted-foreground/50 transition-transform", showWithdraw && "rotate-90")} />
        </button>
        {showWithdraw && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-red-800 leading-relaxed">
                탈퇴 시 <strong>프로필, 시간표, 성적, 가계부, 커뮤니티 기록</strong> 등 모든 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <button
              onClick={handleWithdraw}
              className="w-full py-2.5 bg-destructive text-white text-sm font-bold rounded-xl hover:bg-destructive/90 transition-colors"
            >
              탈퇴하기
            </button>
          </div>
        )}

      </div>
    </Layout>
  );
}
