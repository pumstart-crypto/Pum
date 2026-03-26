import { Layout } from "@/components/Layout";
import { MessageSquare, Plus, Image as ImageIcon, X, Clock, Eye } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const BOARD_TABS = ["전체", "공지", "질문", "모집", "거래"];
const MOZIP_SUBS = ["공모전", "대외활동", "기타"];

interface Post {
  id: number;
  category: string;
  subCategory: string | null;
  title: string;
  content: string;
  images: string[] | null;
  author: string;
  views: number;
  createdAt: string;
}

const CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  공지: { bg: "bg-blue-100", text: "text-blue-600" },
  질문: { bg: "bg-orange-100", text: "text-orange-600" },
  모집: { bg: "bg-green-100", text: "text-green-600" },
  거래: { bg: "bg-purple-100", text: "text-purple-600" },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function getAuthorName(): string {
  try {
    const p = JSON.parse(localStorage.getItem("campus_life_profile") || "{}");
    const parts = ["익명"];
    if (p.department) parts.push(p.department);
    if (p.studentId) parts.push(`${String(p.studentId).substring(2, 4)}학번`);
    return parts.join(".");
  } catch { return "익명"; }
}

function getProfileDepts(): string[] {
  try {
    const raw = localStorage.getItem("campus_life_profile");
    if (!raw) return [];
    const p = JSON.parse(raw);
    const result: string[] = [];
    if (p.department) result.push(p.department);
    if (p.doubleMajor) result.push(p.doubleMajor);
    if (p.minor) result.push(p.minor);
    return result;
  } catch { return []; }
}

// ──────────────────────────────────────────────
// Write dialog
// ──────────────────────────────────────────────
function WritePostDialog({
  defaultCategory,
  profileDepts,
  onClose,
  onCreated,
}: {
  defaultCategory: string;
  profileDepts: string[];
  onClose: () => void;
  onCreated: (post: Post) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const cat = defaultCategory === "전체" ? "" : defaultCategory;
  const hasSub = cat === "질문" || cat === "모집";
  const subOptions = cat === "모집" ? MOZIP_SUBS : profileDepts;
  const subRequired = cat === "모집"; // 질문은 선택 사항

  const canSubmit = title.trim() && content.trim() && (!subRequired || subCategory);

  const handleImages = async (files: FileList | null) => {
    if (!files) return;
    const remaining = 3 - images.length;
    const toProcess = Array.from(files).slice(0, remaining);
    const compressed = await Promise.all(toProcess.map(compressImage));
    setImages(prev => [...prev, ...compressed].slice(0, 3));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/community`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: cat || "전체",
          subCategory: subCategory || null,
          title: title.trim(),
          content: content.trim(),
          images: images.length > 0 ? images : null,
          author: getAuthorName(),
        }),
      });
      if (!res.ok) throw new Error("서버 오류");
      const post: Post = await res.json();
      // 내가 쓴 글 저장
      try {
        const ids: number[] = JSON.parse(localStorage.getItem("campus_life_authored_posts") || "[]");
        localStorage.setItem("campus_life_authored_posts", JSON.stringify([...ids, post.id]));
        const summaries = JSON.parse(localStorage.getItem("campus_life_my_posts") || "[]");
        localStorage.setItem("campus_life_my_posts", JSON.stringify([
          { id: post.id, title: post.title, category: post.category, subCategory: post.subCategory, createdAt: post.createdAt },
          ...summaries,
        ]));
      } catch {}
      onCreated(post);
      onClose();
    } catch {
      setError("게시글 작성에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
          <div>
            <h2 className="text-lg font-bold">글 작성</h2>
            {cat && <p className="text-xs text-muted-foreground mt-0.5">{cat} 게시판</p>}
          </div>
          <button onClick={onClose} className="p-2 bg-muted rounded-full hover:bg-secondary/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Sub-category selector */}
          {hasSub && subOptions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                {cat === "질문" ? "학과 선택" : "분류 선택"}
                {subRequired && <span className="text-destructive ml-0.5">*</span>}
                {cat === "질문" && <span className="text-muted-foreground/60 font-normal ml-1">(선택 사항)</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {cat === "질문" && (
                  <button
                    onClick={() => setSubCategory("")}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                      subCategory === ""
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    전체 질문
                  </button>
                )}
                {subOptions.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSubCategory(opt)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                      subCategory === opt
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              maxLength={100}
              className="w-full text-base font-semibold bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground/40"
            />
            <div className="h-px bg-border/60 mt-2" />
          </div>

          {/* Content */}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="내용을 입력하세요..."
            rows={7}
            className="w-full text-sm bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground/40 resize-none leading-relaxed"
          />

          {/* Image previews */}
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 shrink-0 flex items-center gap-3">
          {/* Image pick */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= 3}
            className="p-2.5 rounded-xl bg-muted hover:bg-slate-200 transition-colors disabled:opacity-40"
          >
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleImages(e.target.files)}
          />
          {images.length > 0 && (
            <span className="text-xs text-muted-foreground">{images.length}/3</span>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="ml-auto px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            {submitting ? "등록 중..." : "등록하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────
export function BoardPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("전체");
  const [activeDept, setActiveDept] = useState("전체");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWriting, setIsWriting] = useState(false);

  const profileDepts = useMemo(() => getProfileDepts(), []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== "전체") params.set("category", activeTab);
      if (activeDept !== "전체" && activeDept !== "전체 질문") params.set("subCategory", activeDept);
      const res = await fetch(`${BASE}/api/community?${params}`);
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, [activeTab, activeDept]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setActiveDept("전체");
  };

  return (
    <Layout hideTopBar>
      <div className="p-6 pt-5 pb-4">
        <p className="text-muted-foreground font-medium mb-1">부산대학교</p>
        <h1 className="text-3xl text-foreground">학생 <span className="text-primary">커뮤니티</span></h1>
      </div>

      {/* Main tabs */}
      <div className="px-4 mb-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {BOARD_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors",
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 질문 sub-filter */}
      {activeTab === "질문" && (
        <div className="px-4 mb-3">
          <div className="flex gap-1.5 flex-wrap">
            {(["전체", ...profileDepts]).map((dept) => (
              <button key={dept} onClick={() => setActiveDept(dept)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                  activeDept === dept ? "bg-primary/15 text-primary" : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                )}>
                {dept === "전체" ? "전체 질문" : dept}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 모집 sub-filter */}
      {activeTab === "모집" && (
        <div className="px-4 mb-3">
          <div className="flex gap-1.5">
            {["전체", ...MOZIP_SUBS].map((cat) => (
              <button key={cat} onClick={() => setActiveDept(cat)}
                className={cn("shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                  activeDept === cat ? "bg-primary/15 text-primary" : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                )}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Posts list */}
      <div className="px-4 pb-32 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted/50 rounded-2xl h-20 animate-pulse" />
          ))
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 gap-4">
            <div className="w-14 h-14 bg-primary/8 rounded-3xl flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-primary/35" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground/50">아직 게시글이 없어요</p>
              <p className="text-xs text-muted-foreground mt-1">첫 글을 작성해 보세요!</p>
            </div>
          </div>
        ) : (
          posts.map((post) => {
            const cat = CATEGORY_STYLE[post.category] ?? { bg: "bg-slate-100", text: "text-slate-500" };
            return (
              <button
                key={post.id}
                onClick={() => navigate(`/board/${post.id}`)}
                className="w-full bg-card rounded-2xl border border-border/50 shadow-sm p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0", cat.bg, cat.text)}>{post.category}</span>
                      {post.subCategory && <span className="text-[11px] text-muted-foreground">{post.subCategory}</span>}
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug line-clamp-1">{post.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{post.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                      <span className="text-xs">{post.author}</span>
                      <span className="text-xs">·</span>
                      <span className="text-xs flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{relativeTime(post.createdAt)}</span>
                      <span className="text-xs">·</span>
                      <span className="text-xs flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{post.views}</span>
                    </div>
                  </div>
                  {post.images && post.images[0] && (
                    <img src={post.images[0]} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Floating write button */}
      {activeTab !== "공지" && (
        <button
          onClick={() => setIsWriting(true)}
          className="fixed bottom-24 right-5 z-50 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {isWriting && (
        <WritePostDialog
          defaultCategory={activeTab}
          profileDepts={profileDepts}
          onClose={() => setIsWriting(false)}
          onCreated={(post) => {
            setPosts(prev => [post, ...prev]);
          }}
        />
      )}

    </Layout>
  );
}
