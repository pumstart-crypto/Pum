import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function Layout({ children, hideTopBar, hideBottomNav }: { children: ReactNode; hideTopBar?: boolean; hideBottomNav?: boolean }) {
  const [location] = useLocation();

  const navItems = [
    { name: "홈",     path: "/",         icon: "home" },
    { name: "공지",   path: "/notices",   icon: "notifications" },
    { name: "시간표", path: "/schedule",  icon: "calendar_view_week" },
    { name: "커뮤니티", path: "/board",     icon: "group" },
    { name: "설정",   path: "/settings",  icon: "settings" },
  ];

  return (
    <div className="h-screen bg-background flex justify-center overflow-hidden">
      <div className="w-full max-w-md bg-card h-full shadow-2xl relative flex flex-col overflow-hidden">

        {/* ── Sticky Top App Bar ── */}
        {!hideTopBar && (
          <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-4 bg-card/90 backdrop-blur-xl border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#eef0f3]">
                <img src="/logo.png" alt="P:um 로고" className="w-full h-full object-cover scale-[1.35]" />
              </div>
              <h1 className="text-base font-extrabold text-primary" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}>
                P:um
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
        <nav className={`absolute bottom-0 left-0 right-0 flex items-center justify-around px-3 pt-3 pb-5 bg-card/95 backdrop-blur-2xl border-t border-border z-50 transition-transform duration-300 bottom-nav-shadow rounded-t-3xl ${hideBottomNav ? "translate-y-full" : "translate-y-0"}`}>
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
