import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { ChevronLeft, Eye, MessageCircle, Pencil, Trash2, Send, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

// ── helpers ──────────────────────────────────────────────────────────────────
function getProfile() {
  try {
    const p = JSON.parse(localStorage.getItem("campus_life_profile") || "{}");
    const parts = ["익명"];
    if (p.department) parts.push(p.department);
    if (p.studentId) parts.push(p.studentId);
    return parts.join(".");
  } catch {
    return "익명";
  }
}
function getAuthoredPosts(): number[] {
  try { return JSON.parse(localStorage.getItem("campus_life_authored_posts") || "[]"); } catch { return []; }
}
function getAuthoredComments(): number[] {
  try { return JSON.parse(localStorage.getItem("campus_life_authored_comments") || "[]"); } catch { return []; }
}

function relativeTime(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

const CATEGORY_LABEL: Record<string, { label: string; color: string }> = {
  공지: { label: "공지", color: "bg-red-100 text-red-700" },
  질문: { label: "질문", color: "bg-blue-100 text-blue-700" },
  모집: { label: "모집", color: "bg-green-100 text-green-700" },
  거래: { label: "거래", color: "bg-orange-100 text-orange-700" },
  전체: { label: "일반", color: "bg-slate-100 text-slate-600" },
};

// ── PostDetailPage ────────────────────────────────────────────────────────────
export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const postId = parseInt(id ?? "0");
  const authoredPosts = getAuthoredPosts();
  const authoredComments = getAuthoredComments();
  const isAuthor = authoredPosts.includes(postId);

  // ── Edit state ───────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // ── Comment state ────────────────────────────────────────────────────────
  const [commentText, setCommentText] = useState("");
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: post, isLoading: loadingPost } = useQuery<any>({
    queryKey: ["post", postId],
    queryFn: () => fetch(`${API}/community/${postId}`).then(r => r.json()),
    enabled: !!postId,
  });

  const { data: commentData, isLoading: loadingComments } = useQuery<{ comments: any[] }>({
    queryKey: ["comments", postId],
    queryFn: () => fetch(`${API}/community/${postId}/comments`).then(r => r.json()),
    enabled: !!postId,
  });

  const comments = commentData?.comments ?? [];

  useEffect(() => {
    if (post) {
      setEditTitle(post.title);
      setEditContent(post.content);
    }
  }, [post]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const editPost = useMutation({
    mutationFn: () =>
      fetch(`${API}/community/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setEditing(false);
    },
  });

  const deletePost = useMutation({
    mutationFn: () => fetch(`${API}/community/${postId}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      navigate("/board");
    },
  });

  const addComment = useMutation({
    mutationFn: (content: string) =>
      fetch(`${API}/community/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, author: getProfile() }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      const ids = getAuthoredComments();
      localStorage.setItem("campus_life_authored_comments", JSON.stringify([...ids, data.id]));
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      setCommentText("");
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: number) =>
      fetch(`${API}/community/${postId}/comments/${commentId}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comments", postId] }),
  });

  // ── Render helpers ────────────────────────────────────────────────────────
  const cat = post?.category ?? "전체";
  const catMeta = CATEGORY_LABEL[cat] ?? CATEGORY_LABEL["전체"];

  if (loadingPost) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">불러오는 중...</div>
      </Layout>
    );
  }

  if (!post || post.message) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
          <p>게시글을 찾을 수 없습니다.</p>
          <button onClick={() => navigate("/board")} className="text-primary text-sm font-semibold">
            커뮤니티로 돌아가기
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideNav={false}>
      <div className="max-w-2xl mx-auto pb-32">
        {/* Back bar */}
        <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border/60 flex items-center gap-2 px-4 py-3">
          <button onClick={() => navigate("/board")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-base flex-1 truncate">{post.title}</span>
          {isAuthor && !editing && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm("게시글을 삭제하시겠습니까?")) deletePost.mutate();
                }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          {editing && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => editPost.mutate()}
                disabled={!editTitle.trim() || !editContent.trim() || editPost.isPending}
                className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="px-4 py-5 space-y-5">
          {/* Post header */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", catMeta.color)}>
                {catMeta.label}
              </span>
              {post.subCategory && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {post.subCategory}
                </span>
              )}
            </div>

            {editing ? (
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full text-xl font-bold bg-muted/50 border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 ring-primary/30"
              />
            ) : (
              <h1 className="text-xl font-bold text-foreground leading-tight">{post.title}</h1>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/70">{post.author}</span>
              <span>·</span>
              <span>{relativeTime(post.createdAt)}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {post.views}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {comments.length}
              </span>
            </div>
          </div>

          <hr className="border-border/60" />

          {/* Post body */}
          {editing ? (
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={8}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30 resize-none"
            />
          ) : (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>
          )}

          {/* Images */}
          {!editing && post.images && post.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {post.images.map((img: string, i: number) => (
                <img
                  key={i}
                  src={img}
                  alt={`첨부 이미지 ${i + 1}`}
                  className="rounded-xl w-full object-cover border border-border/60"
                  style={{ maxHeight: 280 }}
                />
              ))}
            </div>
          )}

          {/* Comments section */}
          <div className="space-y-4 pt-2">
            <h2 className="font-bold text-sm text-foreground">
              댓글 <span className="text-primary">{comments.length}</span>
            </h2>

            {loadingComments ? (
              <p className="text-xs text-muted-foreground">불러오는 중...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">첫 댓글을 남겨보세요</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c: any) => {
                  const isMine = authoredComments.includes(c.id);
                  return (
                    <li key={c.id} className="flex gap-3 group">
                      <div className="w-7 h-7 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        {c.author.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-foreground">{c.author}</span>
                          <span className="text-[11px] text-muted-foreground">{relativeTime(c.createdAt)}</span>
                          {isMine && (
                            <button
                              onClick={() => deleteComment.mutate(c.id)}
                              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{c.content}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Comment input — fixed at bottom */}
        <div className="fixed bottom-16 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border/60 px-4 py-3">
          <div className="max-w-2xl mx-auto flex gap-2 items-end">
            <textarea
              ref={commentInputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (commentText.trim()) addComment.mutate(commentText.trim());
                }
              }}
              placeholder="댓글을 입력하세요..."
              rows={1}
              className="flex-1 bg-muted/60 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30 resize-none"
              style={{ maxHeight: 96 }}
            />
            <button
              onClick={() => { if (commentText.trim()) addComment.mutate(commentText.trim()); }}
              disabled={!commentText.trim() || addComment.isPending}
              className="p-2.5 bg-primary text-primary-foreground rounded-xl disabled:opacity-40 transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
