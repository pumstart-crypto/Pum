import { Layout } from "@/components/Layout";
import { MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const BOARD_TABS = ["전체", "공지", "질문", "모집", "거래"];

export function BoardPage() {
  const [activeTab, setActiveTab] = useState("전체");
  const [depts, setDepts] = useState<string[]>([]);
  const [activeDept, setActiveDept] = useState("전체");

  useEffect(() => {
    if (activeTab === "질문" && depts.length === 0) {
      fetch(`${BASE}/api/courses/departments`)
        .then(r => r.json())
        .then((data: string[]) => setDepts(data))
        .catch(() => {});
    }
    if (activeTab !== "질문") setActiveDept("전체");
  }, [activeTab]);

  const deptList = ["전체", ...depts];

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
              onClick={() => setActiveTab(tab)}
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

      {/* Department sub-filter — only visible on 질문 tab */}
      {activeTab === "질문" && (
        <div className="px-4 mb-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {depts.length === 0 ? (
              <div className="flex gap-1.5">
                {["전체", "로딩중..."].map((label, i) => (
                  <div key={i} className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold",
                    i === 0 ? "bg-primary/15 text-primary" : "bg-slate-100 text-slate-400 animate-pulse"
                  )}>{label}</div>
                ))}
              </div>
            ) : (
              deptList.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setActiveDept(dept)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                    activeDept === dept
                      ? "bg-primary/15 text-primary"
                      : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  )}
                >
                  {dept}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      <div className="px-4 pb-28 flex flex-col items-center justify-center pt-12 gap-4">
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
