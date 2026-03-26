import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'campus_life_token';
const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  studentId: string;
  major: string;
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuth: (token: string, user: AuthUser) => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null, token: null, isLoading: true,
  login: async () => {}, logout: async () => {}, setAuth: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (!stored) { setIsLoading(false); return; }
        const r = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${stored}` },
        });
        if (r.ok) {
          const data = await r.json();
          if (data?.user) { setToken(stored); setUser(data.user); }
          else { await AsyncStorage.removeItem(TOKEN_KEY); }
        } else {
          await AsyncStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || '로그인 실패');
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const setAuth = useCallback((t: string, u: AuthUser) => {
    AsyncStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
