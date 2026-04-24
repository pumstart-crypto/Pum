import React, { createContext, useContext } from 'react';
import C from '@/constants/colors';

interface ThemeCtx {
  isDark: boolean;
  colors: typeof C.light;
}

const ThemeContext = createContext<ThemeCtx>({
  isDark: false,
  colors: C.light,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ isDark: false, colors: C.light }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
