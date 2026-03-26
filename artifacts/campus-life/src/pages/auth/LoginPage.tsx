import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

export function LoginPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top branding area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="w-24 h-24 rounded-[28px] overflow-hidden mb-5 shadow-xl shadow-[#04346E]/25 bg-[#eef0f3]">
          <img src="/logo.png" alt="P:um 로고" className="w-full h-full object-cover scale-[1.35]" />
        </div>
        <h1 className="text-[26px] font-black text-gray-900 tracking-tight">P:um</h1>
        <p className="text-sm text-gray-500 mt-0.5 font-medium">피움 · 부산대학교 학생 생활 앱</p>
      </div>

      {/* Form area */}
      <div className="px-5 pb-10 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3.5 text-sm text-red-500 text-center">
            {error}
          </div>
        )}

        <div className="space-y-2.5">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="아이디"
            autoComplete="username"
            className="w-full px-5 py-4 bg-gray-50 rounded-2xl text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:bg-gray-100 transition-colors"
          />
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              className="w-full px-5 py-4 bg-gray-50 rounded-2xl text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:bg-gray-100 transition-colors pr-14"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400"
            >
              {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit as any}
          disabled={loading || !username || !password}
          className={cn(
            "w-full py-4 rounded-2xl font-bold text-[15px] transition-all",
            loading || !username || !password
              ? "bg-gray-100 text-gray-400"
              : "bg-[#04346E] text-white active:scale-[0.98] shadow-lg shadow-[#04346E]/20"
          )}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <div className="pt-2 text-center">
          <span className="text-sm text-gray-400">계정이 없으신가요? </span>
          <button
            onClick={() => navigate("/register")}
            className="text-sm font-bold text-[#04346E]"
          >
            회원가입
          </button>
        </div>
      </div>
    </div>
  );
}
