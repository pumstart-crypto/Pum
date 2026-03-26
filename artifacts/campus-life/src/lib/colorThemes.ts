export type ColorTheme = "A" | "B" | "C";

export const COLOR_THEMES: Record<ColorTheme, { name: string; desc: string; palette: string[] }> = {
  A: {
    name: "블루 스틸",
    desc: "딥 네이비 · 로열블루 · 스카이블루",
    palette: ["#1A3280", "#2058A8", "#1E6EB5", "#0E2260", "#3870C0", "#5890CC", "#14407A", "#2848B8"],
  },
  B: {
    name: "네이비 틸",
    desc: "딥 네이비 · 오션블루 · 포레스트 틸",
    palette: ["#0D1D55", "#1C3D6E", "#1E5870", "#1E7060", "#2D8070", "#143060", "#256878", "#105060"],
  },
  C: {
    name: "인디고",
    desc: "딥 인디고 · 슬레이트블루 · 페리윙클",
    palette: ["#2A2465", "#3E4890", "#4E58A5", "#6070B5", "#2F3880", "#5058A0", "#3848A8", "#4870A0"],
  },
};

/** 과목명에서 일관된 팔레트 인덱스를 반환 (같은 이름 → 같은 색) */
export function subjectColorIndex(name: string, paletteLength: number): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) >>> 0;
  }
  return hash % paletteLength;
}

export function getSubjectColor(name: string, theme: ColorTheme): string {
  const { palette } = COLOR_THEMES[theme];
  return palette[subjectColorIndex(name, palette.length)];
}
