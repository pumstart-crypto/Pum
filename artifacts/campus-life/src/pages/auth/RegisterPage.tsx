import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Circle, Eye, EyeOff, ChevronRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

type Step = "account" | "phone" | "studentid" | "done";

const STEPS: Step[] = ["account", "phone", "studentid", "done"];
const STEP_LABELS = ["계정", "전화", "학생증", "완료"];

function ProgressBar({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                i < idx
                  ? "bg-[#04346E] text-white"
                  : i === idx
                  ? "bg-[#04346E] text-white ring-4 ring-[#04346E]/20"
                  : "bg-gray-100 text-gray-400"
              )}
            >
              {i < idx ? "✓" : i + 1}
            </div>
            <span
              className={cn(
                "text-[10px] mt-1 font-medium",
                i <= idx ? "text-[#04346E]" : "text-gray-400"
              )}
            >
              {STEP_LABELS[i]}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "flex-1 h-0.5 mx-1 mb-4 rounded-full",
                i < idx ? "bg-[#04346E]" : "bg-gray-100"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function PwCondition({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs", ok ? "text-green-500" : "text-gray-400")}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
      {label}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

export function RegisterPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>("account");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [usernameOk, setUsernameOk] = useState<boolean | null>(null);
  const [usernameMsg, setUsernameMsg] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPwC, setShowPwC] = useState(false);

  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{ name: string; studentId: string; major: string } | null>(null);
  const [ocrError, setOcrError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const pwHas8 = password.length >= 8;
  const pwHasEn = /[a-zA-Z]/.test(password);
  const pwHasNum = /[0-9]/.test(password);
  const pwOk = pwHas8 && pwHasEn && pwHasNum;
  const pwMatch = passwordConfirm.length > 0 && password === passwordConfirm;

  const checkUsername = async () => {
    const u = username.trim();
    if (!/^[a-zA-Z0-9]{4,20}$/.test(u)) {
      setUsernameOk(false);
      setUsernameMsg("영문+숫자 4-20자로 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/check-username?username=${u}`);
      const d = await r.json();
      if (d.available) { setUsernameOk(true); setUsernameMsg("사용 가능한 아이디입니다."); }
      else { setUsernameOk(false); setUsernameMsg("이미 사용 중인 아이디입니다."); }
    } catch { setUsernameOk(false); setUsernameMsg("확인에 실패했습니다."); }
    finally { setLoading(false); }
  };

  const sendOtp = async () => {
    setError(""); setLoading(true);
    try {
      const r = await fetch(`${API}/auth/send-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "OTP 전송 실패");
      setOtpSent(true); setOtpCooldown(60);
      const t = setInterval(() => setOtpCooldown(v => { if (v <= 1) { clearInterval(t); return 0; } return v - 1; }), 1000);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setError(""); setLoading(true);
    try {
      const r = await fetch(`${API}/auth/verify-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "인증 실패");
      setPhoneVerified(true);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImgFile(f);
    setImgPreview(URL.createObjectURL(f));
    setOcrResult(null); setOcrError("");
  };

  const runOcr = async () => {
    if (!imgFile) return;
    setLoading(true); setOcrError("");
    try {
      const fd = new FormData();
      fd.append("image", imgFile);
      const r = await fetch(`${API}/auth/verify-student-id`, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.isValid) throw new Error(d.message || "학생증 인식 실패");
      setOcrResult({ name: d.name, studentId: d.studentId, major: d.major });
    } catch (e: any) { setOcrError(e.message || "인식에 실패했습니다."); }
    finally { setLoading(false); }
  };

  const doRegister = async () => {
    if (!ocrResult) return;
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, phone, name: ocrResult.name, studentId: ocrResult.studentId, major: ocrResult.major })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "가입 실패");
      await login(username.trim(), password);
      setStep("done");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const back = () => {
    const i = STEPS.indexOf(step);
    if (i === 0) navigate("/login");
    else setStep(STEPS[i - 1]);
    setError("");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {step !== "done" && (
        <div className="flex items-center px-4 pt-14 pb-4">
          <button onClick={back} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="ml-2 font-bold text-gray-900 text-base">회원가입</span>
        </div>
      )}

      <div className="flex-1 flex flex-col px-5 pt-2 pb-10">
        {step !== "done" && <ProgressBar current={step} />}

        {/* ─── STEP 1: account ─── */}
        {step === "account" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <h2 className="text-[22px] font-black text-gray-900">계정 정보를</h2>
              <h2 className="text-[22px] font-black text-gray-900">입력해 주세요</h2>
            </div>

            <div className="space-y-3 flex-1">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5 ml-1">아이디</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setUsernameOk(null); setUsernameMsg(""); }}
                    placeholder="영문+숫자 4-20자"
                    className="flex-1 px-4 py-4 bg-gray-50 rounded-2xl text-[15px] outline-none focus:bg-gray-100 transition-colors"
                  />
                  <button
                    onClick={checkUsername}
                    disabled={loading || !username}
                    className="px-4 py-4 rounded-2xl bg-[#04346E] text-white text-sm font-bold disabled:bg-gray-100 disabled:text-gray-400 whitespace-nowrap"
                  >
                    중복확인
                  </button>
                </div>
                {usernameMsg && (
                  <p className={cn("text-xs mt-1.5 ml-1", usernameOk ? "text-green-500" : "text-red-400")}>{usernameMsg}</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5 ml-1">비밀번호</p>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="8자 이상, 영문+숫자 포함"
                    autoComplete="new-password"
                    className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-[15px] outline-none focus:bg-gray-100 transition-colors pr-12"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="flex gap-3 mt-2 ml-1">
                    <PwCondition ok={pwHas8} label="8자 이상" />
                    <PwCondition ok={pwHasEn} label="영문 포함" />
                    <PwCondition ok={pwHasNum} label="숫자 포함" />
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5 ml-1">비밀번호 확인</p>
                <div className="relative">
                  <input
                    type={showPwC ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 재입력"
                    autoComplete="new-password"
                    className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-[15px] outline-none focus:bg-gray-100 transition-colors pr-12"
                  />
                  <button type="button" onClick={() => setShowPwC(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPwC ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordConfirm.length > 0 && (
                  <p className={cn("text-xs mt-1.5 ml-1", pwMatch ? "text-green-500" : "text-red-400")}>
                    {pwMatch ? "비밀번호가 일치합니다." : "비밀번호가 일치하지 않습니다."}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setStep("phone")}
              disabled={!usernameOk || !pwOk || !pwMatch}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-[15px] mt-6 transition-all flex items-center justify-center gap-1",
                usernameOk && pwOk && pwMatch
                  ? "bg-[#04346E] text-white shadow-lg shadow-[#04346E]/20"
                  : "bg-gray-100 text-gray-400"
              )}
            >
              다음 <ChevronRight className="w-4 h-4" />
            </button>

            <div className="pt-4 text-center">
              <span className="text-sm text-gray-400">이미 계정이 있으신가요? </span>
              <button onClick={() => navigate("/login")} className="text-sm font-bold text-[#04346E]">로그인</button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: phone ─── */}
        {step === "phone" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <h2 className="text-[22px] font-black text-gray-900">전화번호로</h2>
              <h2 className="text-[22px] font-black text-gray-900">본인인증을 해주세요</h2>
              <p className="text-sm text-gray-400 mt-2">SMS 인증번호를 발송합니다</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-500 mb-3">{error}</div>
            )}

            <div className="space-y-3 flex-1">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5 ml-1">휴대폰 번호</p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="01012345678"
                    maxLength={11}
                    disabled={phoneVerified}
                    className="flex-1 px-4 py-4 bg-gray-50 rounded-2xl text-[15px] outline-none focus:bg-gray-100 transition-colors disabled:text-gray-400"
                  />
                  <button
                    onClick={sendOtp}
                    disabled={loading || phone.length < 10 || phoneVerified || otpCooldown > 0}
                    className="px-4 py-4 rounded-2xl bg-[#04346E] text-white text-sm font-bold disabled:bg-gray-100 disabled:text-gray-400 whitespace-nowrap min-w-[80px]"
                  >
                    {otpCooldown > 0 ? `${otpCooldown}s` : "인증번호"}
                  </button>
                </div>
              </div>

              {otpSent && !phoneVerified && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 ml-1">인증번호 6자리</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={otp}
                      onChange={e => setOtp(e.target.value.slice(0, 6))}
                      placeholder="000000"
                      className="flex-1 px-4 py-4 bg-gray-50 rounded-2xl text-[15px] tracking-widest outline-none focus:bg-gray-100 transition-colors"
                    />
                    <button
                      onClick={verifyOtp}
                      disabled={loading || otp.length !== 6}
                      className="px-4 py-4 rounded-2xl bg-[#04346E] text-white text-sm font-bold disabled:bg-gray-100 disabled:text-gray-400 whitespace-nowrap min-w-[80px]"
                    >
                      확인
                    </button>
                  </div>
                </div>
              )}

              {phoneVerified && (
                <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-700">인증 완료</p>
                    <p className="text-xs text-green-500 mt-0.5">{phone}</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setStep("studentid")}
              disabled={!phoneVerified}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-[15px] mt-6 transition-all flex items-center justify-center gap-1",
                phoneVerified
                  ? "bg-[#04346E] text-white shadow-lg shadow-[#04346E]/20"
                  : "bg-gray-100 text-gray-400"
              )}
            >
              다음 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ─── STEP 3: studentid ─── */}
        {step === "studentid" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <h2 className="text-[22px] font-black text-gray-900">부산대 학생증으로</h2>
              <h2 className="text-[22px] font-black text-gray-900">재학을 인증해 주세요</h2>
              <p className="text-sm text-gray-400 mt-2">모바일 학생증 화면을 촬영해 주세요</p>
            </div>

            {(error || ocrError) && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-500 mb-3">
                {error || ocrError}
              </div>
            )}

            <div className="flex-1 space-y-3">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImage} />
              <button
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "w-full rounded-3xl overflow-hidden border-2 border-dashed transition-colors",
                  imgPreview ? "border-transparent" : "border-gray-200 bg-gray-50"
                )}
                style={{ minHeight: 200 }}
              >
                {imgPreview ? (
                  <img src={imgPreview} alt="학생증" className="w-full object-cover" style={{ maxHeight: 260 }} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl">🪪</div>
                    <div>
                      <p className="text-sm font-bold text-gray-600">학생증 사진 업로드</p>
                      <p className="text-xs text-gray-400 mt-0.5">탭해서 카메라 또는 갤러리 선택</p>
                    </div>
                  </div>
                )}
              </button>

              {imgPreview && !ocrResult && (
                <button
                  onClick={runOcr}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-[#04346E] text-white font-bold text-[15px] disabled:opacity-60 shadow-lg shadow-[#04346E]/20"
                >
                  {loading ? "인식 중..." : "학생증 인식하기"}
                </button>
              )}

              {ocrResult && (
                <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-4 space-y-1.5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-bold text-green-700">인증 완료</span>
                  </div>
                  <InfoRow label="이름" value={ocrResult.name} />
                  <InfoRow label="학번" value={ocrResult.studentId} />
                  <InfoRow label="학과" value={ocrResult.major} />
                </div>
              )}
            </div>

            <button
              onClick={doRegister}
              disabled={!ocrResult || loading}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-[15px] mt-4 transition-all",
                ocrResult && !loading
                  ? "bg-[#04346E] text-white shadow-lg shadow-[#04346E]/20"
                  : "bg-gray-100 text-gray-400"
              )}
            >
              {loading ? "가입 중..." : "가입 완료하기"}
            </button>
          </div>
        )}

        {/* ─── STEP 4: done ─── */}
        {step === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center pb-10">
            <div className="w-24 h-24 rounded-full bg-[#04346E]/10 flex items-center justify-center mb-6">
              <span className="text-5xl">🎉</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">가입 완료!</h2>
            <p className="text-sm text-gray-500 mb-1">부산대학교 캠퍼스라이프에</p>
            <p className="text-sm text-gray-500 mb-8">오신 것을 환영합니다 👋</p>
            <button
              onClick={() => navigate("/")}
              className="w-full py-4 rounded-2xl bg-[#04346E] text-white font-bold text-[15px] shadow-lg shadow-[#04346E]/20"
            >
              시작하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
