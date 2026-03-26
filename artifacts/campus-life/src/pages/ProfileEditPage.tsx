import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile, UserProfile } from "@/hooks/useProfile";
import { Layout } from "@/components/Layout";

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

const DEPT_OPTIONS = [
  "산업공학과",
  "컴퓨터공학과",
  "전기공학과",
  "기계공학과",
  "화학공학과",
  "재료공학과",
  "건축공학과",
  "경영학과",
  "경제학과",
  "수학과",
  "물리학과",
  "화학과",
  "생명과학과",
  "기타",
];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function ProfileEditPage() {
  const [, navigate] = useLocation();
  const { profile, updateProfile } = useProfile();

  const [form, setForm] = useState<UserProfile>({ ...profile });
  const [saved, setSaved] = useState(false);

  const set = (k: keyof UserProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    updateProfile(form);
    setSaved(true);
    setTimeout(() => {
      navigate("/settings");
    }, 600);
  };

  const displayName = form.name.trim() || "학생";
  const initial = displayName[0];

  const inputCls = "w-full bg-slate-50 border border-border/60 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";
  const selectCls = inputCls + " appearance-none cursor-pointer";

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
            {saved ? <Check className="w-4 h-4" /> : null}
            {saved ? "저장됨" : "저장"}
          </button>
        </div>
      </div>

      <div className="px-4 pb-28 space-y-6">
        {/* ── Avatar Section ── */}
        <div className="flex flex-col items-center py-6 gap-4">
          <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition-all"
            style={{ backgroundColor: form.avatarColor }}>
            {form.name.trim() ? (
              <span className="text-4xl font-bold text-white">{initial}</span>
            ) : (
              <User className="w-10 h-10 text-white" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-center mb-2">아바타 색상</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {AVATAR_COLORS.map((color) => (
                <button key={color} onClick={() => setForm((f) => ({ ...f, avatarColor: color }))}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110 active:scale-95 flex items-center justify-center"
                  style={{ backgroundColor: color }}>
                  {form.avatarColor === color && (
                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Form Fields ── */}
        <Field label="이름" required>
          <input
            type="text"
            value={form.name}
            onChange={set("name")}
            placeholder="이름을 입력하세요"
            maxLength={20}
            className={inputCls}
          />
        </Field>

        <Field label="학과">
          <select value={form.department} onChange={set("department")} className={selectCls}>
            {DEPT_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>

        <Field label="전공">
          <input
            type="text"
            value={form.major}
            onChange={set("major")}
            placeholder="전공을 입력하세요"
            maxLength={30}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="학번">
            <input
              type="text"
              value={form.studentId}
              onChange={set("studentId")}
              placeholder="202312345"
              maxLength={10}
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
          <Field label="학년">
            <select value={form.grade} onChange={set("grade")} className={selectCls}>
              {GRADE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="한줄 소개">
          <textarea
            value={form.bio}
            onChange={set("bio")}
            placeholder="자신을 한 문장으로 소개해 보세요"
            maxLength={60}
            rows={3}
            className={inputCls + " resize-none"}
          />
          <p className="text-xs text-muted-foreground text-right px-1">{form.bio.length}/60</p>
        </Field>

        {/* ── Save Button (bottom) ── */}
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
