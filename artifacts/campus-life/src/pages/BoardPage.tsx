import { Layout } from "@/components/Layout";
import { MessageSquare, Megaphone, Users, Flame, Clock } from "lucide-react";

const SAMPLE_POSTS = [
  { id: 1, category: "공지", title: "2025-1학기 수강정정 안내", author: "학사팀", time: "1시간 전", views: 234, hot: true },
  { id: 2, category: "자유", title: "효원 벚꽃 사진 공유해요 🌸", author: "익명", time: "3시간 전", views: 89, hot: true },
  { id: 3, category: "질문", title: "알고리즘 과제 2번 힌트 있나요?", author: "익명", time: "5시간 전", views: 43, hot: false },
  { id: 4, category: "거래", title: "[나눔] 전공 서적 드립니다", author: "익명", time: "8시간 전", views: 67, hot: false },
  { id: 5, category: "공지", title: "도서관 임시 휴관 안내 (3/25)", author: "도서관", time: "1일 전", views: 512, hot: false },
  { id: 6, category: "자유", title: "금정회관 오늘 점심 레전드였음", author: "익명", time: "1일 전", views: 178, hot: false },
];

const CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  공지: { bg: "bg-blue-100", text: "text-blue-600" },
  자유: { bg: "bg-green-100", text: "text-green-600" },
  질문: { bg: "bg-orange-100", text: "text-orange-600" },
  거래: { bg: "bg-purple-100", text: "text-purple-600" },
};

const BOARD_TABS = ["전체", "공지", "자유", "질문", "거래"];

export function BoardPage() {
  return (
    <Layout hideTopBar>
      <div className="p-6 pt-5 pb-4">
        <p className="text-muted-foreground font-medium mb-1">커뮤니티</p>
        <h1 className="text-3xl text-foreground">학과 <span className="text-primary">게시판</span></h1>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {BOARD_TABS.map((tab, i) => (
            <button
              key={tab}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                i === 0
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="px-4 space-y-2 pb-28">
        {SAMPLE_POSTS.map((post) => {
          const cat = CATEGORY_STYLE[post.category] || { bg: "bg-gray-100", text: "text-gray-500" };
          return (
            <div
              key={post.id}
              className="bg-white rounded-2xl border border-border/50 shadow-sm p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cat.bg} ${cat.text}`}>{post.category}</span>
                    {post.hot && (
                      <div className="flex items-center gap-0.5 text-orange-500">
                        <Flame className="w-3 h-3" />
                        <span className="text-[10px] font-bold">HOT</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug truncate">{post.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-muted-foreground">
                    <span className="text-xs">{post.author}</span>
                    <span className="text-xs">·</span>
                    <span className="text-xs flex items-center gap-0.5"><Clock className="w-3 h-3" />{post.time}</span>
                    <span className="text-xs">·</span>
                    <span className="text-xs">조회 {post.views}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Coming soon notice */}
        <div className="mt-4 bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center">
          <MessageSquare className="w-8 h-8 text-primary/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-primary/60">게시판 기능 준비 중</p>
          <p className="text-xs text-muted-foreground mt-1">실제 글 작성 및 댓글 기능이 곧 추가될 예정입니다.</p>
        </div>
      </div>
    </Layout>
  );
}
