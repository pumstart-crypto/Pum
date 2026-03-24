import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Calendar, Wallet, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { name: "시간표", path: "/", icon: Calendar },
    { name: "가계부", path: "/finance", icon: Wallet },
    { name: "맛집", path: "/restaurants", icon: UtensilsCrossed },
  ];

  return (
    <div className="min-h-screen bg-background flex justify-center">
      {/* Mobile container - looks like an app even on desktop */}
      <div className="w-full max-w-md bg-card min-h-screen shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-24 scroll-smooth">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 left-0 right-0 h-20 bg-card/80 backdrop-blur-xl border-t border-border flex items-center justify-around px-2 z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path} className="w-full">
                <div className="flex flex-col items-center justify-center space-y-1 py-2 cursor-pointer group">
                  <div
                    className={cn(
                      "p-2 rounded-2xl transition-all duration-300",
                      isActive 
                        ? "bg-primary/10 text-primary scale-110 shadow-sm" 
                        : "text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-6 h-6 stroke-[2.5px]" />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold transition-colors duration-300",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {item.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
