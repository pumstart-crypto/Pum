import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { useProfile } from "@/hooks/useProfile";
import {
  User, Bell, Shield, HelpCircle, ChevronRight, LogOut,
  Moon, Globe, Smartphone, Info, Edit3
} from "lucide-react";

const SETTINGS_SECTIONS = [
  {
    title: "계정",
    items: [
      { icon: Bell, label: "알림 설정", desc: "푸시 알림 및 리마인더", color: "#2563EB", route: "/settings/notifications" },
      { icon: Shield, label: "개인정보 보호", desc: "데이터 및 보안 설정", color: "#7C3AED", route: null },
    ],
  },
  {
    title: "앱 설정",
    items: [
      { icon: Moon, label: "다크 모드", desc: "화면 테마 설정", color: "#374151", route: null },
      { icon: Globe, label: "언어", desc: "한국어", color: "#059669", route: null },
      { icon: Smartphone, label: "앱 버전", desc: "v1.0.0 (최신)", color: "#D97706", route: null },
    ],
  },
  {
    title: "지원",
    items: [
      { icon: HelpCircle, label: "도움말 & FAQ", desc: "자주 묻는 질문", color: "#06B6D4", route: null },
      { icon: Info, label: "앱 정보", desc: "캠퍼스라이프 by PNU", color: "#8B5CF6", route: null },
    ],
  },
];

const GRADE_LABEL: Record<string, string> = {
  "1": "1학년", "2": "2학년", "3": "3학년", "4": "4학년",
  "5": "5학년 이상", "grad": "대학원생",
};

export function SettingsPage() {
  const [, navigate] = useLocation();
  const { profile } = useProfile();

  const displayName = profile.name.trim() || "부산대학교 학생";
  const displaySub = [profile.department, GRADE_LABEL[profile.grade] ?? ""].filter(Boolean).join(" · ");
  const initial = displayName[0];

  return (
    <Layout hideTopBar>
      <div className="p-6 pt-5 pb-4">
        <p className="text-muted-foreground font-medium mb-1">환경설정</p>
        <h1 className="text-3xl text-foreground">마이페이지 <span className="text-primary">설정</span></h1>
      </div>

      {/* Profile Card */}
      <div className="px-4 mb-5">
        <button
          onClick={() => navigate("/settings/profile")}
          className="w-full bg-primary/5 border border-primary/20 rounded-3xl p-5 flex items-center gap-4 hover:bg-primary/10 transition-colors text-left">
          <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: profile.avatarColor }}>
            {profile.name.trim() ? (
              <span className="text-2xl font-bold text-white">{initial}</span>
            ) : (
              <User className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg text-foreground truncate">{displayName}</p>
            {displaySub && <p className="text-sm text-muted-foreground truncate">{displaySub}</p>}
            {(profile.doubleMajor || profile.minor) && (
              <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                {[profile.doubleMajor && `복수전공 ${profile.doubleMajor}`, profile.minor && `부전공 ${profile.minor}`].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
              <Edit3 className="w-3 h-3" />
              프로필 편집
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
        </button>
      </div>

      {/* Settings Sections */}
      <div className="px-4 space-y-5 pb-28">
        {SETTINGS_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {section.title}
            </p>
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden divide-y divide-border/40">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => item.route && navigate(item.route)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors text-left"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: item.color + "18" }}
                  >
                    <item.icon className="w-4.5 h-4.5" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Coming Soon Notice */}
        <div className="bg-muted rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground">회원가입 및 로그인 기능이 곧 추가됩니다</p>
        </div>

        {/* Logout placeholder */}
        <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-destructive/10 text-destructive font-semibold text-sm hover:bg-destructive hover:text-white transition-colors">
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </Layout>
  );
}
