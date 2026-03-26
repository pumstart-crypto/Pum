import { createContext, useContext, useState, useEffect } from "react";

type Theme = "light" | "dark";
interface ThemeCtx { theme: Theme; isDark: boolean; toggle: () => void; }

const ThemeContext = createContext<ThemeCtx>({ theme: "light", isDark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem("campus_life_theme") as Theme) || "light"; } catch { return "light"; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("campus_life_theme", theme); } catch {}
  }, [theme]);

  const toggle = () => setTheme(t => t === "light" ? "dark" : "light");

  return <ThemeContext.Provider value={{ theme, isDark: theme === "dark", toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
