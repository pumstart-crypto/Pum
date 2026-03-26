import { Layout } from "@/components/Layout";
import { MessageSquare } from "lucide-react";

const BOARD_TABS = ["전체", "공지", "질문", "모집", "거래"];

export function BoardPage() {
  return (
    <Layout hideTopBar>
      <div className="p-6 pt-5 pb-4">
        <p className="text-muted-foreground font-medium mb-1">부산대학교</p>
        <h1 className="text-3xl text-foreground">학생 <span className="text-primary">커뮤니티</span></h1>
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

      {/* Empty state */}
      <div className="px-4 pb-28 flex flex-col items-center justify-center pt-16 gap-4">
        <div className="w-16 h-16 bg-primary/8 rounded-3xl flex items-center justify-center">
          <MessageSquare className="w-8 h-8 text-primary/40" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground/60">커뮤니티 기능 준비 중</p>
          <p className="text-sm text-muted-foreground mt-1">글 작성 및 댓글 기능이 곧 추가될 예정입니다.</p>
        </div>
      </div>
    </Layout>
  );
}
