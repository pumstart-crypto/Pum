export interface StudentIdInfo {
  name: string;
  studentId: string;
  major: string;
  college: string;
  university: string;
  isValid: boolean;
  reason?: string;
}

// ── Google Cloud Vision으로 이미지에서 텍스트 추출 ─────────────
async function extractTextWithVision(base64Image: string): Promise<string> {
  const apiKey = process.env["GOOGLE_CLOUD_VISION_API_KEY"];
  if (!apiKey) throw new Error("GOOGLE_CLOUD_VISION_API_KEY 환경변수가 없습니다.");

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
        }],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloud Vision API 오류: ${res.status} ${err}`);
  }

  const data = await res.json() as any;
  return data.responses?.[0]?.fullTextAnnotation?.text ?? "";
}

// ── 정규식으로 학생증 정보 파싱 (무료, AI 없음) ─────────────────
function parseStudentIdText(text: string): StudentIdInfo {
  const normalized = text.replace(/\s+/g, " ").trim();

  // 1. 부산대학교 확인
  const isPNU =
    /부산대학교/.test(normalized) ||
    /Pusan\s*National\s*University/i.test(normalized) ||
    /PNU/i.test(normalized);

  if (!isPNU) {
    return {
      name: "", studentId: "", major: "", college: "", university: "",
      isValid: false,
      reason: "부산대학교 학생증이 아닙니다.",
    };
  }

  // 2. 학번 추출 (20로 시작하는 9자리 숫자)
  const studentIdMatch = normalized.match(/\b(20\d{7})\b/);
  const studentId = studentIdMatch ? studentIdMatch[1] : "";

  // 3. 이름 추출
  //    - "이름 홍길동", "성명 홍길동", "홍길동 님" 패턴
  //    - 또는 단독 2~4자 한글 (학과명이 아닌 것)
  let name = "";
  const namePatterns = [
    /(?:이름|성명)[:\s]*([가-힣]{2,4})/,
    /([가-힣]{2,4})\s*(?:님|학생)/,
  ];
  for (const pat of namePatterns) {
    const m = normalized.match(pat);
    if (m) { name = m[1]; break; }
  }
  // 패턴 매칭 실패 시 학번 근처 한글 추출
  if (!name) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/부산대|학과|학번|전공|대학/.test(line)) continue;
      const m = line.match(/^([가-힣]{2,4})$/);
      if (m) { name = m[1]; break; }
    }
  }

  // 4. 단과대학 추출
  let college = "";
  const collegePatterns = [
    /([가-힣]{2,10}대학)\s+[가-힣]/,
    /(?:소속|단과대)[:\s]*([가-힣]{2,15}대학)/,
    /([가-힣]{2,10}대학)(?=학|원|과|\s)/,
  ];
  for (const pat of collegePatterns) {
    const m = normalized.match(pat);
    if (m) { college = m[1].trim(); break; }
  }

  // 5. 학과/전공 추출
  let major = "";
  const majorPatterns = [
    /(?:학과|전공|학부)[:\s]*([가-힣A-Za-z\s]+?)(?:\s|$)/,
    /([가-힣]{2,15}(?:학과|전공|학부|대학원|계열))/,
    /([가-힣]{2,15}(?:공학|과학|교육|경영|경제|법학|의학|간호|약학|사학|철학|문학|심리|사회|행정|체육|음악|미술|디자인))/,
  ];
  for (const pat of majorPatterns) {
    const m = normalized.match(pat);
    if (m) { major = m[1].trim(); break; }
  }

  // 6. 유효성 판단
  if (!studentId) {
    return {
      name, studentId: "", major, college, university: "부산대학교",
      isValid: false,
      reason: "학번을 인식할 수 없습니다. 선명한 사진을 사용해주세요.",
    };
  }

  return {
    name: name || "",
    studentId,
    major: major || "",
    college: college || "",
    university: "부산대학교",
    isValid: true,
  };
}

// ── 메인 함수 ─────────────────────────────────────────────────
export async function extractStudentIdInfo(
  base64Image: string,
  _mimeType: string = "image/jpeg"
): Promise<StudentIdInfo> {
  const rawText = await extractTextWithVision(base64Image);

  if (!rawText.trim()) {
    return {
      name: "", studentId: "", major: "", university: "",
      isValid: false,
      reason: "이미지에서 텍스트를 읽을 수 없습니다. 선명한 사진을 사용해주세요.",
    };
  }

  return parseStudentIdText(rawText);
}
