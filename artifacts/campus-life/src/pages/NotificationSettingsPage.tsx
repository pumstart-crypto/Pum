import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { ChevronLeft, Bell, BookOpen, MessageCircle, CalendarDays, Utensils, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "campus_life_notifications";

interface NotifSettings {
  schoolNotice: boolean;
  deptNotice: boolean;
  communityComment: boolean;
  communityHot: boolean;
  academicDDay: boolean;
  mealOpen: boolean;
}

const DEFAULT: NotifSettings = {
  schoolNotice: true,
  deptNotice: true,
  communityComment: true,
  communityHot: false,
  academicDDay: true,
  mealOpen: false,
};

function load(): NotifSettings {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULT;
  }
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0",
        on ? "bg-primary" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200",
          on ? "translate-x-6" : "translate-x-0"
        )}
      />
    </button>
  );
}

interface SettingRowProps {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function SettingRow({ icon: Icon, iconColor, label, desc, value, onChange }: SettingRowProps) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconColor + "18" }}>
        <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Toggle on={value} onChange={onChange} />
    </div>
  );
}

export function NotificationSettingsPage() {
  const [, navigate] = useLocation();
  const [settings, setSettings] = useState<NotifSettings>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const set = (key: keyof NotifSettings) => (val: boolean) =>
    setSettings(prev => ({ ...prev, [key]: val }));

  const allOn = Object.values(settings).every(Boolean);
  const toggleAll = () => {
    const next = !allOn;
    setSettings({
      schoolNotice: next,
      deptNotice: next,
      communityComment: next,
      communityHot: next,
      academicDDay: next,
      mealOpen: next,
    });
  };

  return (
    <Layout hideTopBar>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border/60 flex items-center gap-2 px-4 py-3">
        <button onClick={() => navigate("/settings")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-base flex-1">알림 설정</span>
        <button onClick={toggleAll} className="text-xs font-semibold text-primary px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors">
          {allOn ? "전체 끄기" : "전체 켜기"}
        </button>
      </div>

      <div className="px-4 py-5 space-y-5 pb-28">
        {/* 공지 알림 */}
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">공지 알림</p>
          <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden divide-y divide-border/40">
            <SettingRow
              icon={Megaphone}
              iconColor="#2563EB"
              label="학교 공지"
              desc="부산대학교 전체 공지사항"
              value={settings.schoolNotice}
              onChange={set("schoolNotice")}
            />
            <SettingRow
              icon={BookOpen}
              iconColor="#7C3AED"
              label="학과 공지"
              desc="내 학과 공지사항 및 새 글"
              value={settings.deptNotice}
              onChange={set("deptNotice")}
            />
          </div>
        </div>

        {/* 커뮤니티 알림 */}
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">커뮤니티 알림</p>
          <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden divide-y divide-border/40">
            <SettingRow
              icon={MessageCircle}
              iconColor="#059669"
              label="댓글 알림"
              desc="내 게시글에 댓글이 달릴 때"
              value={settings.communityComment}
              onChange={set("communityComment")}
            />
            <SettingRow
              icon={Bell}
              iconColor="#D97706"
              label="인기 게시글"
              desc="조회수 높은 게시글 알림"
              value={settings.communityHot}
              onChange={set("communityHot")}
            />
          </div>
        </div>

        {/* 학사/생활 알림 */}
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">학사 · 생활 알림</p>
          <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden divide-y divide-border/40">
            <SettingRow
              icon={CalendarDays}
              iconColor="#0891B2"
              label="학사 일정 D-Day"
              desc="수강신청·시험 등 7일·1일 전 알림"
              value={settings.academicDDay}
              onChange={set("academicDDay")}
            />
            <SettingRow
              icon={Utensils}
              iconColor="#DC2626"
              label="오늘의 학식"
              desc="매일 아침 학식 메뉴 알림"
              value={settings.mealOpen}
              onChange={set("mealOpen")}
            />
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-muted/60 rounded-2xl p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            알림은 앱 설정에서 허용한 경우에만 작동합니다. 브라우저 또는 기기의 알림 권한도 함께 확인해 주세요.
          </p>
        </div>
      </div>
    </Layout>
  );
}
