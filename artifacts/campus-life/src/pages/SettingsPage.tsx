import { Layout } from "@/components/Layout";
import {
  User, Bell, Shield, HelpCircle, ChevronRight, LogOut,
  Moon, Globe, Smartphone, Info
} from "lucide-react";

const SETTINGS_SECTIONS = [
  {
    title: "계정",
    items: [
      { icon: User, label: "마이페이지", desc: "프로필 및 개인 정보 관리", color: "#159A54" },
      { icon: Bell, label: "알림 설정", desc: "푸시 알림 및 리마인더", color: "#2563EB" },
      { icon: Shield, label: "개인정보 보호", desc: "데이터 및 보안 설정", color: "#7C3AED" },
    ],
  },
  {
    title: "앱 설정",
    items: [
      { icon: Moon, label: "다크 모드", desc: "화면 테마 설정", color: "#374151" },
      { icon: Globe, label: "언어", desc: "한국어", color: "#059669" },
      { icon: Smartphone, label: "앱 버전", desc: "v1.0.0 (최신)", color: "#D97706" },
    ],
  },
  {
    title: "지원",
    items: [
      { icon: HelpCircle, label: "도움말 & FAQ", desc: "자주 묻는 질문", color: "#06B6D4" },
      { icon: Info, label: "앱 정보", desc: "캠퍼스라이프 by PNU", color: "#8B5CF6" },
    ],
  },
];

export function SettingsPage() {
  return (
    <Layout>
      <div className="p-6 pt-12 pb-4">
        <p className="text-muted-foreground font-medium mb-1">환경설정</p>
        <h1 className="text-3xl text-foreground">마이페이지 <span className="text-primary">설정</span></h1>
      </div>

      {/* Profile Card */}
      <div className="px-4 mb-5">
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-5 flex items-center gap-4">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="font-bold text-lg text-foreground">부산대학교 학생</p>
            <p className="text-sm text-muted-foreground">컴퓨터공학전공 · 3학년</p>
            <button className="mt-1.5 text-xs font-semibold text-primary hover:underline">
              프로필 편집
            </button>
          </div>
        </div>
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
        <div className="bg-secondary/60 rounded-2xl p-4 text-center">
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
