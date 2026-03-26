import { createContext, useContext, useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

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
    const stored = localStorage.getItem("campus_life_token");
    if (!stored) { setIsLoading(false); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${stored}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) { setToken(stored); setUser(data.user); }
        else { localStorage.removeItem("campus_life_token"); }
      })
      .catch(() => localStorage.removeItem("campus_life_token"))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "로그인 실패");
    localStorage.setItem("campus_life_token", data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      await fetch(`${API}/auth/logout`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("campus_life_token");
    setToken(null);
    setUser(null);
  }, [token]);

  const setAuth = useCallback((t: string, u: AuthUser) => {
    localStorage.setItem("campus_life_token", t);
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
