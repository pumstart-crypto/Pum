import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  User, Lock, Eye, EyeOff, Phone, ChevronLeft,
  CheckCircle2, Camera, AlertCircle, Loader2, Check, X
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

type Step = "account" | "phone" | "studentid" | "done";

interface RegisterData {
  username: string;
  password: string;
  phone: string;
  name: string;
  studentId: string;
  major: string;
  studentIdBase64?: string;
}

// ─── 비밀번호 유효성 검사 ────────────────────────────────────
function validatePassword(pw: string) {
  const hasLength = pw.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  return { hasLength, hasLetter, hasNumber, valid: hasLength && hasLetter && hasNumber };
}

// ─── Step 인디케이터 ─────────────────────────────────────────
function StepBar({ step }: { step: Step }) {
  const steps: Step[] = ["account", "phone", "studentid", "done"];
  const labels = ["계정 정보", "전화 인증", "학생증 인증", "완료"];
  const current = steps.indexOf(step);
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex-1 flex flex-col items-center">
          <div className="flex items-center w-full">
            {i > 0 && <div className={cn("flex-1 h-0.5", i <= current ? "bg-[#04346E]" : "bg-gray-200")} />}
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
              i < current ? "bg-[#04346E] text-white" :
              i === current ? "bg-[#04346E] text-white ring-4 ring-[#04346E]/20" :
              "bg-gray-100 text-gray-400"
            )}>
              {i < current ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className={cn("flex-1 h-0.5", i < current ? "bg-[#04346E]" : "bg-gray-200")} />}
          </div>
          <span className={cn("text-[10px] mt-1.5 font-semibold", i === current ? "text-[#04346E]" : "text-gray-400")}>
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: 계정 정보 ───────────────────────────────────────
function StepAccount({ onNext }: { onNext: (d: Partial<RegisterData>) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [checking, setChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "ok" | "taken" | "invalid">("idle");
  const pwCheck = validatePassword(password);

  const checkUsername = async () => {
    const trimmed = username.trim();
    if (!/^[a-zA-Z0-9]{4,20}$/.test(trimmed)) { setUsernameStatus("invalid"); return; }
    setChecking(true);
    try {
      const r = await fetch(`${API}/auth/check-username?username=${encodeURIComponent(trimmed)}`);
      const data = await r.json();
      setUsernameStatus(data.available ? "ok" : "taken");
    } catch { setUsernameStatus("invalid"); }
    setChecking(false);
  };

  const canNext = usernameStatus === "ok" && pwCheck.valid && confirm === password;

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">아이디</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={username}
              onChange={e => { setUsername(e.target.value); setUsernameStatus("idle"); }}
              placeholder="영문+숫자 4-20자"
              className={cn(
                "w-full pl-10 pr-4 py-3 border rounded-xl text-sm outline-none transition-all",
                usernameStatus === "ok" ? "border-green-400 focus:ring-2 focus:ring-green-200" :
                usernameStatus === "taken" || usernameStatus === "invalid" ? "border-red-400 focus:ring-2 focus:ring-red-100" :
                "border-gray-200 focus:border-[#04346E] focus:ring-2 focus:ring-[#04346E]/10"
              )}
            />
          </div>
          <button
            type="button"
            onClick={checkUsername}
            disabled={!username || checking}
            className="px-4 py-3 bg-[#04346E] text-white text-xs font-bold rounded-xl disabled:bg-gray-200 shrink-0"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "중복확인"}
          </button>
        </div>
        {usernameStatus === "ok" && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 사용 가능한 아이디입니다.</p>}
        {usernameStatus === "taken" && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><X className="w-3 h-3" /> 이미 사용 중인 아이디입니다.</p>}
        {usernameStatus === "invalid" && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><X className="w-3 h-3" /> 영문+숫자 4-20자리로 입력하세요.</p>}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">비밀번호</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="8자 이상, 영문+숫자 포함"
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#04346E] focus:ring-2 focus:ring-[#04346E]/10 transition-all"
          />
          <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {password && (
          <div className="mt-2 space-y-1">
            {[
              { ok: pwCheck.hasLength, label: "8자 이상" },
              { ok: pwCheck.hasLetter, label: "영문 포함" },
              { ok: pwCheck.hasNumber, label: "숫자 포함" },
            ].map(({ ok, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                {ok ? <Check className="w-3 h-3 text-green-500" /> : <X className="w-3 h-3 text-gray-300" />}
                <span className={cn("text-xs", ok ? "text-green-600" : "text-gray-400")}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">비밀번호 확인</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="비밀번호 재입력"
            className={cn(
              "w-full pl-10 pr-10 py-3 border rounded-xl text-sm outline-none transition-all",
              confirm && confirm !== password ? "border-red-400" :
              confirm && confirm === password ? "border-green-400" :
              "border-gray-200 focus:border-[#04346E] focus:ring-2 focus:ring-[#04346E]/10"
            )}
          />
          <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {confirm && confirm !== password && <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>}
      </div>

      <button
        onClick={() => canNext && onNext({ username: username.trim(), password })}
        disabled={!canNext}
        className={cn("w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all",
          canNext ? "bg-[#04346E] hover:bg-[#021526] active:scale-[0.98]" : "bg-gray-200 text-gray-400"
        )}
      >
        다음
      </button>
    </div>
  );
}

// ─── Step 2: 전화번호 인증 ───────────────────────────────────
function StepPhone({ onNext }: { onNext: (d: Partial<RegisterData>) => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const formatPhone = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 11);

  const sendOTP = async () => {
    if (!phone || phone.length < 10) { setError("올바른 번호를 입력하세요."); return; }
    setSending(true); setError("");
    try {
      const r = await fetch(`${API}/auth/send-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setSent(true);
      let t = 60;
      setCooldown(t);
      const iv = setInterval(() => { t--; setCooldown(t); if (t <= 0) clearInterval(iv); }, 1000);
    } catch (err: any) { setError(err.message); }
    setSending(false);
  };

  const verifyOTP = async () => {
    if (code.length !== 6) { setError("6자리 인증번호를 입력하세요."); return; }
    setVerifying(true); setError("");
    try {
      const r = await fetch(`${API}/auth/verify-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setVerified(true);
    } catch (err: any) { setError(err.message); }
    setVerifying(false);
  };

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 rounded-2xl p-4">
        <p className="text-sm text-blue-700 font-medium">📱 휴대폰 번호 인증</p>
        <p className="text-xs text-blue-600/80 mt-1">한 번호로 하나의 계정만 만들 수 있습니다.</p>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">휴대폰 번호</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={phone}
              onChange={e => { setPhone(formatPhone(e.target.value)); setSent(false); setVerified(false); }}
              placeholder="01012345678"
              disabled={verified}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#04346E] focus:ring-2 focus:ring-[#04346E]/10 disabled:bg-gray-50"
            />
          </div>
          <button
            type="button"
            onClick={sendOTP}
            disabled={!phone || sending || cooldown > 0 || verified}
            className="px-4 py-3 bg-[#04346E] text-white text-xs font-bold rounded-xl disabled:bg-gray-200 shrink-0 min-w-[72px]"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : cooldown > 0 ? `${cooldown}초` : sent ? "재발송" : "인증요청"}
          </button>
        </div>
      </div>

      {sent && !verified && (
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">인증번호 6자리</label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="000000"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm text-center tracking-[0.3em] font-bold outline-none focus:border-[#04346E] focus:ring-2 focus:ring-[#04346E]/10"
            />
            <button
              type="button"
              onClick={verifyOTP}
              disabled={code.length !== 6 || verifying}
              className="px-5 py-3 bg-green-600 text-white text-xs font-bold rounded-xl disabled:bg-gray-200"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "확인"}
            </button>
          </div>
        </div>
      )}

      {verified && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-700 font-medium">전화번호 인증이 완료되었습니다.</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <button
        onClick={() => verified && onNext({ phone })}
        disabled={!verified}
        className={cn("w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all",
          verified ? "bg-[#04346E] hover:bg-[#021526] active:scale-[0.98]" : "bg-gray-200 text-gray-400"
        )}
      >
        다음
      </button>
    </div>
  );
}

// ─── Step 3: 학생증 인증 ─────────────────────────────────────
function StepStudentId({ onNext }: { onNext: (d: Partial<RegisterData>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>("");
  const [base64, setBase64] = useState<string>("");
  const [mime, setMime] = useState("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ name: string; studentId: string; major: string } | null>(null);
  const [error, setError] = useState("");

  const handleFile = (file: File) => {
    setResult(null); setError("");
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      const b64 = dataUrl.split(",")[1] || "";
      setBase64(b64);
      setMime(file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!base64) return;
    setAnalyzing(true); setError("");
    try {
      const formData = new FormData();
      // Convert base64 back to blob for multipart upload
      const byteStr = atob(base64);
      const arr = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
      const blob = new Blob([arr], { type: mime });
      formData.append("image", blob, "student-id.jpg");

      const r = await fetch(`${API}/auth/verify-student-id`, { method: "POST", body: formData });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "인증 실패");
      setResult({ name: data.info.name, studentId: data.info.studentId, major: data.info.major });
    } catch (err: any) {
      setError(err.message);
    }
    setAnalyzing(false);
  };

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-sm text-amber-700 font-bold">📋 부산대학교 모바일 학생증 인증</p>
        <p className="text-xs text-amber-600/80 mt-1.5 leading-relaxed">
          부산대학교 앱의 모바일 학생증 화면을 캡처해서 업로드해주세요.<br />
          이름·학번·전공이 확인되어야 가입이 가능합니다.
        </p>
      </div>

      {/* Upload area */}
      <div
        onClick={() => fileRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all",
          preview ? "border-[#04346E]/30 bg-[#04346E]/5" : "border-gray-300 hover:border-[#04346E]/50 hover:bg-gray-50"
        )}
      >
        {preview ? (
          <img src={preview} alt="학생증" className="w-full max-h-48 object-contain rounded-xl" />
        ) : (
          <>
            <Camera className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-500 text-center">학생증 이미지를 업로드하세요<br /><span className="text-xs text-gray-400">JPG, PNG (최대 10MB)</span></p>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {preview && !result && (
        <button
          onClick={analyze}
          disabled={analyzing}
          className="w-full py-3.5 bg-[#04346E] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:bg-gray-300"
        >
          {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> 분석 중...</> : "학생증 인증하기"}
        </button>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <p className="text-sm font-bold text-green-700">학생증 인증 완료</p>
          </div>
          {[{ label: "이름", value: result.name }, { label: "학번", value: result.studentId }, { label: "전공", value: result.major }].map(({ label, value }) => (
            <div key={label} className="flex gap-3">
              <span className="text-xs text-gray-500 w-12 shrink-0 mt-0.5">{label}</span>
              <span className="text-sm font-bold text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => result && onNext({ name: result.name, studentId: result.studentId, major: result.major, studentIdBase64: base64 })}
        disabled={!result}
        className={cn("w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all",
          result ? "bg-[#04346E] hover:bg-[#021526] active:scale-[0.98]" : "bg-gray-200 text-gray-400"
        )}
      >
        가입 완료하기
      </button>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export function RegisterPage() {
  const [, navigate] = useLocation();
  const { setAuth } = useAuth();
  const [step, setStep] = useState<Step>("account");
  const [data, setData] = useState<Partial<RegisterData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const merge = (d: Partial<RegisterData>) => setData(prev => ({ ...prev, ...d }));

  const handleAccountNext = (d: Partial<RegisterData>) => { merge(d); setStep("phone"); };
  const handlePhoneNext = (d: Partial<RegisterData>) => { merge(d); setStep("studentid"); };

  const handleStudentIdNext = async (d: Partial<RegisterData>) => {
    const all = { ...data, ...d };
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: all.username,
          password: all.password,
          phone: all.phone,
          name: all.name,
          studentId: all.studentId,
          major: all.major,
          studentIdImageBase64: all.studentIdBase64,
        }),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.message);
      setAuth(res.token, res.user);
      merge(d);
      setStep("done");
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const steps: Step[] = ["account", "phone", "studentid", "done"];
  const currentIdx = steps.indexOf(step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#021526] via-[#04346E] to-[#1A6CAE] flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm bg-white rounded-3xl p-7 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {step !== "account" && step !== "done" && (
            <button onClick={() => setStep(steps[currentIdx - 1])} className="p-1.5 rounded-xl hover:bg-gray-100">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-black text-gray-900">
              {step === "account" && "계정 만들기"}
              {step === "phone" && "전화번호 인증"}
              {step === "studentid" && "학생증 인증"}
              {step === "done" && "가입 완료!"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">부산대학교 학생만 가입 가능합니다</p>
          </div>
        </div>

        {step !== "done" && <StepBar step={step} />}

        {step === "account" && <StepAccount onNext={handleAccountNext} />}
        {step === "phone" && <StepPhone onNext={handlePhoneNext} />}
        {step === "studentid" && (
          <div>
            <StepStudentId onNext={handleStudentIdNext} />
            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {loading && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> 가입 처리 중...
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">환영합니다!</h3>
            <p className="text-gray-500 text-sm mb-1">{data.name}님, 가입이 완료되었습니다.</p>
            <p className="text-xs text-gray-400 mb-8">{data.major} · {data.studentId}</p>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3.5 bg-[#04346E] text-white rounded-xl font-bold text-sm"
            >
              캠퍼스라이프 시작하기
            </button>
          </div>
        )}

        {step === "account" && (
          <div className="mt-4 text-center">
            <span className="text-sm text-gray-500">이미 계정이 있으신가요? </span>
            <button onClick={() => navigate("/login")} className="text-sm font-bold text-[#04346E] hover:underline">
              로그인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
