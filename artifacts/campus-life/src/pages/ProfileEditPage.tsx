import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, User, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile, UserProfile } from "@/hooks/useProfile";
import { Layout } from "@/components/Layout";
import { DEPT_BY_COLLEGE } from "@/lib/departments";

const AVATAR_COLORS = [
  "#00427D", "#1D4ED8", "#0891B2", "#059669",
  "#7C3AED", "#DB2777", "#D97706", "#DC2626",
  "#374151", "#0F766E",
];

const GRADE_OPTIONS = [
  { value: "1", label: "1학년" },
  { value: "2", label: "2학년" },
  { value: "3", label: "3학년" },
  { value: "4", label: "4학년" },
  { value: "5", label: "5학년 이상" },
  { value: "grad", label: "대학원생" },
];

/* ── 잠금 필드 (읽기 전용) ── */
function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">{label}</label>
      <div className="flex items-center gap-2 bg-slate-100 border border-border/40 rounded-2xl px-4 py-3">
        <span className="flex-1 text-sm text-muted-foreground">{value}</span>
        <Lock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
      </div>
    </div>
  );
}

/* ── 편집 가능 필드 ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-slate-50 border border-border/60 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";
const selectCls = inputCls + " appearance-none cursor-pointer";

export function ProfileEditPage() {
  const [, navigate] = useLocation();
  const { profile, updateProfile } = useProfile();

  const [form, setForm] = useState<UserProfile>({ ...profile });
  const [saved, setSaved] = useState(false);

  const set = (k: keyof UserProfile) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    updateProfile({
      grade: form.grade,
      doubleMajor: form.doubleMajor,
      minor: form.minor,
      avatarColor: form.avatarColor,
    });
    setSaved(true);
    setTimeout(() => navigate("/settings"), 600);
  };

  const initial = profile.name.trim() ? profile.name[0] : "학";

  return (
    <Layout hideTopBar>
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => navigate("/settings")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-semibold">뒤로</span>
          </button>
          <h1 className="text-base font-bold text-foreground">프로필 편집</h1>
          <button onClick={handleSave}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              saved
                ? "bg-green-500 text-white"
                : "bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/30"
            )}>
            {saved && <Check className="w-4 h-4" />}
            {saved ? "저장됨" : "저장"}
          </button>
        </div>
      </div>

      <div className="px-4 pb-28 space-y-6">
        {/* ── Avatar ── */}
        <div className="flex flex-col items-center py-6 gap-4">
          <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg"
            style={{ backgroundColor: form.avatarColor }}>
            <span className="text-4xl font-bold text-white">{initial}</span>
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-center mb-2">아바타 색상</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {AVATAR_COLORS.map((color) => (
                <button key={color} onClick={() => setForm((f) => ({ ...f, avatarColor: color }))}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110 active:scale-95 flex items-center justify-center"
                  style={{ backgroundColor: color }}>
                  {form.avatarColor === color && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 학생증 인증 안내 ── */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
          <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            이름, 학과, 전공, 학번은 회원가입 시 <span className="font-bold">학생증 인증</span>으로 확인된 정보입니다. 변경이 필요하면 학교 포털에 문의하세요.
          </p>
        </div>

        {/* ── 잠긴 필드들 ── */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">인증된 정보</p>
          <LockedField label="이름" value={profile.name} />
          <div className="grid grid-cols-2 gap-3">
            <LockedField label="학과" value={profile.department} />
            <LockedField label="학번" value={profile.studentId} />
          </div>
          <LockedField label="전공" value={profile.major} />
        </div>

        {/* ── 편집 가능 필드들 ── */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">수정 가능한 정보</p>

          <Field label="학년">
            <select value={form.grade} onChange={set("grade")} className={selectCls}>
              {GRADE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>

          <Field label="복수전공">
            <select value={form.doubleMajor} onChange={set("doubleMajor")} className={selectCls}>
              <option value="">없음</option>
              {DEPT_BY_COLLEGE.map(({ college, depts }) => (
                <optgroup key={college} label={college}>
                  {depts.map((d) => <option key={d} value={d}>{d}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>

          <Field label="부전공">
            <select value={form.minor} onChange={set("minor")} className={selectCls}>
              <option value="">없음</option>
              {DEPT_BY_COLLEGE.map(({ college, depts }) => (
                <optgroup key={college} label={college}>
                  {depts.map((d) => <option key={d} value={d}>{d}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>

        {/* ── 저장 버튼 ── */}
        <button onClick={handleSave}
          className={cn(
            "w-full py-4 rounded-2xl text-sm font-bold transition-all shadow-sm",
            saved
              ? "bg-green-500 text-white"
              : "bg-primary text-white hover:bg-primary/90 shadow-primary/30"
          )}>
          {saved ? "✓  저장 완료" : "변경사항 저장"}
        </button>
      </div>
    </Layout>
  );
}
