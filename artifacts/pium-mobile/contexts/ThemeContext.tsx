import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import C from '@/constants/colors';

const THEME_KEY = 'pium_theme_mode';
export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeCtx {
  isDark: boolean;
  mode: ThemeMode;
  colors: typeof C.light;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  isDark: false,
  mode: 'system',
  colors: C.light,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v as ThemeMode);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(THEME_KEY, m);
  };

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const colors = isDark ? C.dark : C.light;

  return (
    <ThemeContext.Provider value={{ isDark, mode, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
