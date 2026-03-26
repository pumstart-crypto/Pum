import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function Layout({ children, hideTopBar }: { children: ReactNode; hideTopBar?: boolean }) {
  const [location] = useLocation();

  const navItems = [
    { name: "홈",     path: "/",         icon: "home" },
    { name: "공지",   path: "/notices",   icon: "notifications" },
    { name: "시간표", path: "/schedule",  icon: "calendar_view_week" },
    { name: "게시판", path: "/board",     icon: "group" },
    { name: "설정",   path: "/settings",  icon: "settings" },
  ];

  return (
    <div className="h-screen bg-background flex justify-center overflow-hidden">
      <div className="w-full max-w-md bg-card h-full shadow-2xl relative flex flex-col overflow-hidden">

        {/* ── Sticky Top App Bar ── */}
        {!hideTopBar && (
          <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-4 bg-card/90 backdrop-blur-xl border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-white" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>school</span>
              </div>
              <h1 className="text-base font-extrabold text-primary" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}>
                캠퍼스라이프
              </h1>
            </div>
            <button className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>notifications</span>
            </button>
          </header>
        )}

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          {children}
        </main>

        {/* ── Bottom Navigation ── */}
        <nav className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-3 pt-3 pb-5 bg-white/90 backdrop-blur-2xl border-t border-border/40 rounded-t-3xl shadow-[0_-12px_32px_rgba(0,66,125,0.06)] z-50">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path} className="flex-1">
                <div className="flex flex-col items-center justify-center gap-1 cursor-pointer">
                  {isActive ? (
                    <div className="flex flex-col items-center bg-primary rounded-2xl px-4 py-2 gap-0.5 shadow-[0_4px_12px_rgba(0,66,125,0.25)] active:scale-95 transition-transform">
                      <span className="material-symbols-outlined text-white" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">{item.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center px-4 py-2 gap-0.5 hover:text-primary transition-colors active:scale-95">
                      <span className="material-symbols-outlined text-muted-foreground" style={{ fontSize: 22 }}>{item.icon}</span>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{item.name}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

      </div>
    </div>
  );
}
