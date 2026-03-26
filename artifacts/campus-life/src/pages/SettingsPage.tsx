import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { COLOR_THEMES, type ColorTheme } from "@/lib/colorThemes";
import {
  User, Bell, Shield, HelpCircle, ChevronRight, LogOut,
  Moon, Globe, Smartphone, Info, Edit3, Palette, Check
} from "lucide-react";

const SETTINGS_SECTIONS = [
  {
    title: "계정",
    items: [
      { icon: Bell, label: "알림 설정", desc: "푸시 알림 및 리마인더", color: "#2563EB", route: "/settings/notifications" },
      { icon: Shield, label: "개인정보 보호", desc: "데이터 및 보안 설정", color: "#7C3AED", route: "/settings/privacy" },
    ],
  },
  {
    title: "앱 설정",
    items: [
      { icon: Moon, label: "다크 모드", desc: "화면 테마 설정", color: "#374151", route: null, isToggle: true },
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

/** 색상 테마 선택 UI 표시 여부 — true로 바꾸면 즉시 활성화 */
const SHOW_COLOR_THEME_PICKER = false;

const GRADE_LABEL: Record<string, string> = {
  "1": "1학년", "2": "2학년", "3": "3학년", "4": "4학년",
  "5": "5학년 이상", "grad": "대학원생",
};

const COLOR_THEME_KEYS: ColorTheme[] = ["A", "B", "C"];

export function SettingsPage() {
  const [, navigate] = useLocation();
  const { profile } = useProfile();
  const { isDark, toggle, colorTheme, setColorTheme } = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

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
                  onClick={() => item.isToggle ? toggle() : item.route && navigate(item.route)}
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
                    <p className="text-xs text-muted-foreground">{item.isToggle ? (isDark ? "다크 모드 켜짐" : "라이트 모드 켜짐") : item.desc}</p>
                  </div>
                  {item.isToggle ? (
                    <div className={cn("relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0", isDark ? "bg-primary" : "bg-slate-200")}>
                      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200", isDark ? "translate-x-5" : "translate-x-0")} />
                    </div>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* ── 시간표 색상 테마 (SHOW_COLOR_THEME_PICKER = true 로 바꾸면 활성화) ── */}
        {SHOW_COLOR_THEME_PICKER && <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            시간표 색상 테마
          </p>
          <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 p-4 border-b border-border/40">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Palette className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">시간표 팔레트</p>
                <p className="text-xs text-muted-foreground">시간표 과목 색상 조합을 선택하세요</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {COLOR_THEME_KEYS.map((key) => {
                const theme = COLOR_THEMES[key];
                const isSelected = colorTheme === key;
                return (
                  <button
                    key={key}
                    onClick={() => setColorTheme(key)}
                    className={cn(
                      "w-full flex items-center gap-4 p-3.5 rounded-2xl border-2 transition-all text-left",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-primary/40 hover:bg-muted/30"
                    )}
                  >
                    {/* Palette swatches */}
                    <div className="flex gap-1.5 shrink-0">
                      {theme.palette.slice(0, 4).map((color, i) => (
                        <div
                          key={i}
                          className="w-7 h-7 rounded-lg shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    {/* Name + desc */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{theme.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{theme.desc}</p>
                    </div>
                    {/* Check */}
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors",
                      isSelected ? "bg-primary" : "border-2 border-border"
                    )}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>}

        {/* Login status notice */}
        {user && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center">
            <p className="text-xs text-primary font-medium">부산대학교 인증 학생으로 로그인 중</p>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-destructive/10 text-destructive font-semibold text-sm hover:bg-destructive hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>

        {user && (
          <p className="text-center text-xs text-muted-foreground/50 pb-2">
            {user.username} · {user.studentId}
          </p>
        )}
      </div>
    </Layout>
  );
}
