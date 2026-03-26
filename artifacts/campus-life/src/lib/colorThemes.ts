export type ColorTheme = "A" | "B" | "C";

/**
 * 팔레트는 인접 인덱스끼리 밝기·색조가 최대한 다르도록 배열합니다.
 * (어둠↔밝음, 블루↔틸 교차)
 *
 * 테마 A (기본) — 두 이미지 색상 조합
 *   이미지1: #080D1E(최어두운 네이비) · #1A2D6B(로열블루) · #6B93C5(스틸블루)
 *   이미지2: #1D2854(다크 인디고) · #1B3D5C(다크 틸네이비) · #2E6B80(틸)
 */
export const COLOR_THEMES: Record<ColorTheme, { name: string; desc: string; palette: string[] }> = {
  A: {
    name: "PNU 네이비",
    desc: "#021526 · #04346E · #6EABDA 기반",
    // 인접 인덱스 대비 최대화: 어두운↔밝은 교차
    palette: [
      "#021526", // 0  최어두운 네이비  (이미지 원본)
      "#6EABDA", // 1  라이트 스틸블루  (이미지 원본) ← 0과 밝기 최대 대비
      "#04346E", // 2  딥 네이비       (이미지 원본) ← 1과 대비
      "#1A6CAE", // 3  미디엄 로열블루  (파생) ← 2보다 밝음
      "#0A2848", // 4  다크 네이비슬레이트 (파생) ← 3보다 어두움
      "#4A8BBE", // 5  미디엄 스틸블루  (파생) ← 4보다 밝음
      "#0D4480", // 6  미디엄다크 네이비 (파생) ← 5보다 어두움
      "#2B62A0", // 7  미디엄 블루     (파생) ← 6보다 밝음
    ],
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
