export interface CurriculumCategory {
  code: string;
  label: string;
  color: string;
  bg: string;
}

export interface Curriculum {
  version: "v1" | "v2";
  admissionYearLabel: string;
  categories: CurriculumCategory[];
  defaultGradReqs: Record<string, number>;
}

export const CURRICULUM_V1: Curriculum = {
  version: "v1",
  admissionYearLabel: "~2025년 이전 입학",
  categories: [
    { code: "전공필수", label: "전공필수",  color: "bg-blue-500",   bg: "bg-blue-50 text-blue-700" },
    { code: "전공기초", label: "전공기초",  color: "bg-indigo-500", bg: "bg-indigo-50 text-indigo-700" },
    { code: "전공선택", label: "전공선택",  color: "bg-sky-400",    bg: "bg-sky-50 text-sky-700" },
    { code: "교양필수", label: "교양필수",  color: "bg-violet-500", bg: "bg-violet-50 text-violet-700" },
    { code: "교양선택", label: "교양선택",  color: "bg-purple-400", bg: "bg-purple-50 text-purple-700" },
    { code: "일반선택", label: "일반선택",  color: "bg-slate-400",  bg: "bg-slate-100 text-slate-600" },
  ],
  defaultGradReqs: {
    "전공필수": 39, "전공기초": 15, "전공선택": 21,
    "교양필수": 21, "교양선택": 9, "일반선택": 30,
  },
};

export const CURRICULUM_V2: Curriculum = {
  version: "v2",
  admissionYearLabel: "2026년 이후 입학",
  categories: [
    { code: "전공필수", label: "전공일반",       color: "bg-blue-500",   bg: "bg-blue-50 text-blue-700" },
    { code: "전공기초", label: "전공기초",        color: "bg-indigo-500", bg: "bg-indigo-50 text-indigo-700" },
    { code: "전공선택", label: "심화전공",        color: "bg-sky-400",    bg: "bg-sky-50 text-sky-700" },
    { code: "교양필수", label: "효원핵심교양",    color: "bg-violet-500", bg: "bg-violet-50 text-violet-700" },
    { code: "교양선택", label: "효원균형·창의교양", color: "bg-purple-400", bg: "bg-purple-50 text-purple-700" },
    { code: "일반선택", label: "일반선택",        color: "bg-slate-400",  bg: "bg-slate-100 text-slate-600" },
  ],
  defaultGradReqs: {
    "전공필수": 39, "전공기초": 15, "전공선택": 21,
    "교양필수": 21, "교양선택": 9, "일반선택": 30,
  },
};

export const CURRICULA = [CURRICULUM_V1, CURRICULUM_V2];

export function getCurriculum(admissionYear: number): Curriculum {
  return admissionYear >= 2026 ? CURRICULUM_V2 : CURRICULUM_V1;
}

const ADMISSION_YEAR_KEY = "campus-admission-year";

export function loadAdmissionYear(): number {
  try {
    const v = localStorage.getItem(ADMISSION_YEAR_KEY);
    if (v) return parseInt(v);
  } catch {}
  return 2026;
}

export function saveAdmissionYear(year: number) {
  localStorage.setItem(ADMISSION_YEAR_KEY, String(year));
}

export function catLabel(curriculum: Curriculum, code: string): string {
  return curriculum.categories.find(c => c.code === code)?.label ?? code;
}

export function catBg(curriculum: Curriculum, code: string): string {
  return curriculum.categories.find(c => c.code === code)?.bg ?? "bg-muted text-muted-foreground";
}

export function catColor(curriculum: Curriculum, code: string): string {
  return curriculum.categories.find(c => c.code === code)?.color ?? "bg-slate-400";
}
