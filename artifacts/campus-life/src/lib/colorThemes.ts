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
    name: "네이비 틸 블루",
    desc: "두 팔레트 조합 · 네이비 · 로열블루 · 틸",
    // 인접 인덱스 대비 최대화: 어두운↔밝은, 블루↔틸 교차
    palette: [
      "#080D1E", // 0  최어두운 네이비 (이미지1)
      "#2E6B80", // 1  틸             (이미지2) ← 0과 색조+밝기 대비
      "#1A2D6B", // 2  로열블루       (이미지1) ← 1과 대비
      "#1B3D5C", // 3  다크 틸네이비  (이미지2) ← 2와 색조 다름
      "#6B93C5", // 4  스틸블루       (이미지1) ← 3보다 훨씬 밝음
      "#1D2854", // 5  다크 인디고    (이미지2) ← 4와 밝기 대비
      "#255C78", // 6  미디엄 틸      (이미지2 파생) ← 5와 색조 다름
      "#1C4080", // 7  딥 블루        (이미지1 파생) ← 6과 색조 다름
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
