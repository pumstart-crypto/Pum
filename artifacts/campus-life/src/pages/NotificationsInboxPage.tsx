import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import {
  Megaphone, BookOpen, MessageCircle, Bell,
  CalendarDays, Utensils, Settings, ChevronLeft, CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NOTIF_SETTINGS_KEY = "campus_life_notifications";
const NOTIF_READ_KEY = "campus_life_notif_read";

interface NotifSettings {
  schoolNotice: boolean;
  deptNotice: boolean;
  communityComment: boolean;
  communityHot: boolean;
  academicDDay: boolean;
  mealOpen: boolean;
}

const DEFAULT_SETTINGS: NotifSettings = {
  schoolNotice: true,
  deptNotice: true,
  communityComment: true,
  communityHot: false,
  academicDDay: true,
  mealOpen: false,
};

function loadSettings(): NotifSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(NOTIF_SETTINGS_KEY) || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadReadSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveReadSet(s: Set<string>) {
  try {
    localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...s]));
  } catch { /* ignore */ }
}

interface Notification {
  id: string;
  category: keyof NotifSettings;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  time: string;
  relTime: string;
  link: string;
}

const ALL_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    category: "academicDDay",
    icon: CalendarDays,
    iconColor: "#0891B2",
    iconBg: "#0891B218",
    title: "D-7 · 수강신청 시작",
    body: "2026학년도 1학기 수강신청이 7일 후 시작됩니다.",
    time: "오늘 07:00",
    relTime: "방금 전",
    link: "/academic-calendar",
  },
  {
    id: "n2",
    category: "mealOpen",
    icon: Utensils,
    iconColor: "#DC2626",
    iconBg: "#DC262618",
    title: "오늘의 학식 메뉴가 공개됐습니다",
    body: "제1학생회관 중식: 된장찌개 외 4종",
    time: "오늘 08:00",
    relTime: "2시간 전",
    link: "/meals",
  },
  {
    id: "n3",
    category: "schoolNotice",
    icon: Megaphone,
    iconColor: "#2563EB",
    iconBg: "#2563EB18",
    title: "[학사] 2026-1 수강신청 안내",
    body: "수강신청 일정 및 방법 안내. 포털 → 학사 → 수강신청 메뉴를 이용하세요.",
    time: "오늘 09:15",
    relTime: "1시간 전",
    link: "/notices",
  },
  {
    id: "n4",
    category: "communityComment",
    icon: MessageCircle,
    iconColor: "#059669",
    iconBg: "#05966918",
    title: "내 게시글에 댓글이 달렸습니다",
    body: "익명: '저도 같은 문제 겪었는데 교학처에 문의하니 바로 해결됐어요!'",
    time: "오늘 10:30",
    relTime: "30분 전",
    link: "/board",
  },
  {
    id: "n5",
    category: "deptNotice",
    icon: BookOpen,
    iconColor: "#7C3AED",
    iconBg: "#7C3AED18",
    title: "[학과] 종합설계 발표 일정 공지",
    body: "2026-1 종합설계 중간 발표 일정이 안내되었습니다. 첨부파일을 확인하세요.",
    time: "어제 16:40",
    relTime: "어제",
    link: "/notices",
  },
  {
    id: "n6",
    category: "communityHot",
    icon: Bell,
    iconColor: "#D97706",
    iconBg: "#D9770618",
    title: "인기 게시글이 있습니다",
    body: "'기말 대비 스터디원 모집합니다' 게시글이 100회 이상 조회됐습니다.",
    time: "어제 14:20",
    relTime: "어제",
    link: "/board",
  },
  {
    id: "n7",
    category: "schoolNotice",
    icon: Megaphone,
    iconColor: "#2563EB",
    iconBg: "#2563EB18",
    title: "[장학] 2026-1 국가장학금 신청 안내",
    body: "한국장학재단 국가장학금 신청 기간이 공지되었습니다. 기한 내 신청하세요.",
    time: "2일 전",
    relTime: "2일 전",
    link: "/notices",
  },
  {
    id: "n8",
    category: "academicDDay",
    icon: CalendarDays,
    iconColor: "#0891B2",
    iconBg: "#0891B218",
    title: "D-1 · 과제 제출 마감",
    body: "데이터구조 과목 과제 제출 마감이 내일입니다.",
    time: "3일 전",
    relTime: "3일 전",
    link: "/academic-calendar",
  },
  {
    id: "n9",
    category: "deptNotice",
    icon: BookOpen,
    iconColor: "#7C3AED",
    iconBg: "#7C3AED18",
    title: "[학과] 전공 상담 주간 안내",
    body: "3월 마지막 주 전공 교수 상담 주간입니다. 교학처에서 신청하세요.",
    time: "4일 전",
    relTime: "4일 전",
    link: "/notices",
  },
];

export function NotificationsInboxPage() {
  const [, navigate] = useLocation();
  const [settings, setSettings] = useState<NotifSettings>(loadSettings);
  const [readSet, setReadSet] = useState<Set<string>>(loadReadSet);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const visibleNotifs = ALL_NOTIFICATIONS.filter(n => settings[n.category]);
  const unreadCount = visibleNotifs.filter(n => !readSet.has(n.id)).length;

  const markRead = (id: string) => {
    setReadSet(prev => {
      const next = new Set(prev);
      next.add(id);
      saveReadSet(next);
      return next;
    });
  };

  const markAllRead = () => {
    const next = new Set(visibleNotifs.map(n => n.id));
    saveReadSet(next);
    setReadSet(next);
  };

  const handleNotifClick = (n: Notification) => {
    markRead(n.id);
    navigate(n.link);
  };

  return (
    <Layout hideTopBar>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60 flex items-center gap-2 px-4 py-3">
        <button onClick={() => navigate("/")} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-base flex-1">
          알림
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </span>
        <button
          onClick={() => navigate("/settings/notifications")}
          className="p-1.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
        >
          <Settings className="w-4.5 h-4.5" />
        </button>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-xs font-semibold text-primary px-2 py-1.5 rounded-xl hover:bg-primary/10 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            모두 읽음
          </button>
        )}
      </div>

      <div className="pb-28">
        {visibleNotifs.length === 0 ? (
          /* 알림 없음 */
          <div className="flex flex-col items-center justify-center py-24 gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Bell className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-bold text-gray-700">받은 알림이 없습니다</p>
              <p className="text-sm text-muted-foreground mt-1">알림 설정에서 받을 알림을 선택하세요</p>
            </div>
            <button
              onClick={() => navigate("/settings/notifications")}
              className="mt-2 px-5 py-2.5 rounded-2xl bg-primary/10 text-primary text-sm font-bold"
            >
              알림 설정으로 이동
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {visibleNotifs.map(n => {
              const isRead = readSet.has(n.id);
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-4 text-left transition-colors active:bg-muted/60",
                    isRead ? "bg-background" : "bg-primary/[0.03]"
                  )}
                >
                  {/* Icon */}
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: n.iconBg }}
                  >
                    <Icon className="w-5 h-5" style={{ color: n.iconColor }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-snug", isRead ? "font-medium text-foreground" : "font-bold text-foreground")}>
                        {n.title}
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">{n.relTime}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                  </div>

                  {/* Unread dot */}
                  {!isRead && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 비활성 알림 안내 */}
        {visibleNotifs.length > 0 && (
          <div className="mx-4 mt-4 p-4 bg-muted/50 rounded-2xl flex items-center gap-3">
            <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground flex-1">
              꺼진 알림은 표시되지 않습니다.
            </p>
            <button
              onClick={() => navigate("/settings/notifications")}
              className="text-xs font-bold text-primary whitespace-nowrap"
            >
              알림 설정
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
