import { Layout } from "@/components/Layout";
import { Bell, ChevronRight, School, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const CATEGORIES = [
  { key: "school", label: "학교 공지", icon: School, color: "text-blue-600 bg-blue-50" },
  { key: "dept", label: "학과 공지", icon: BookOpen, color: "text-violet-600 bg-violet-50" },
];

const MOCK_NOTICES = {
  school: [
    { id: 1, title: "2026학년도 1학기 수강신청 안내", date: "2026.03.10", isNew: true },
    { id: 2, title: "2026학년도 봄 학위수여식 일정 안내", date: "2026.02.28", isNew: false },
    { id: 3, title: "학생증 재발급 신청 안내", date: "2026.02.20", isNew: false },
    { id: 4, title: "도서관 이용 시간 변경 안내", date: "2026.02.15", isNew: false },
    { id: 5, title: "2026년 장학금 신청 일정 안내", date: "2026.02.10", isNew: false },
  ],
  dept: [
    { id: 1, title: "전공 필수 과목 수강 신청 안내", date: "2026.03.12", isNew: true },
    { id: 2, title: "졸업논문 제출 일정 안내", date: "2026.03.05", isNew: true },
    { id: 3, title: "산학협력 인턴십 모집 안내", date: "2026.02.25", isNew: false },
    { id: 4, title: "학과 세미나 일정 공지", date: "2026.02.18", isNew: false },
  ],
};

export function NoticesPage() {
  const [activeCategory, setActiveCategory] = useState<"school" | "dept">("school");

  const notices = MOCK_NOTICES[activeCategory];

  return (
    <Layout>
      <div className="p-6 pt-12 pb-4">
        <p className="text-muted-foreground font-medium mb-1">부산대학교</p>
        <h1 className="text-3xl text-foreground">
          공지 <span className="text-primary">사항</span>
        </h1>
      </div>

      <div className="px-4 mb-4">
        <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key as "school" | "dept")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all",
                activeCategory === cat.key
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <cat.icon className="w-4 h-4" />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-28 space-y-2">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
          <Bell className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            공지사항 연동 기능은 준비 중입니다. 현재는 예시 데이터가 표시됩니다.
          </p>
        </div>

        {notices.map((notice) => (
          <button
            key={notice.id}
            className="w-full bg-card rounded-2xl border border-border/50 px-4 py-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors shadow-sm"
          >
            <div className="flex-1 min-w-0 pr-3">
              <div className="flex items-center gap-2 mb-1">
                {notice.isNew && (
                  <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0">NEW</span>
                )}
                <p className="text-sm font-semibold text-foreground truncate">{notice.title}</p>
              </div>
              <p className="text-xs text-muted-foreground">{notice.date}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </Layout>
  );
}
