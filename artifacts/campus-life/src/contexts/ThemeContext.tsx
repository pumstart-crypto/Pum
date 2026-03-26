import { createContext, useContext, useState, useEffect } from "react";
import type { ColorTheme } from "@/lib/colorThemes";

type Theme = "light" | "dark";
interface ThemeCtx {
  theme: Theme;
  isDark: boolean;
  toggle: () => void;
  colorTheme: ColorTheme;
  setColorTheme: (t: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "light", isDark: false, toggle: () => {},
  colorTheme: "A", setColorTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem("campus_life_theme") as Theme) || "light"; } catch { return "light"; }
  });

  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    try { return (localStorage.getItem("campus_life_color_theme") as ColorTheme) || "A"; } catch { return "A"; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("campus_life_theme", theme); } catch {}
  }, [theme]);

  const toggle = () => setTheme(t => t === "light" ? "dark" : "light");

  const setColorTheme = (t: ColorTheme) => {
    setColorThemeState(t);
    try { localStorage.setItem("campus_life_color_theme", t); } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", toggle, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
