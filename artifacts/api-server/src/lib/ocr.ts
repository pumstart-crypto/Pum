import OpenAI from "openai";

// ── Replit AI 클라이언트 (텍스트 파싱용) ──────────────────────
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
    const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] || "dummy";
    openaiClient = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }
  return openaiClient;
}

export interface StudentIdInfo {
  name: string;
  studentId: string;
  major: string;
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

// ── Replit AI로 추출 텍스트 파싱 (이미지 없이 텍스트만) ─────────
async function parseStudentIdText(rawText: string): Promise<StudentIdInfo> {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: `다음은 학생증 이미지 OCR로 추출한 텍스트입니다. 부산대학교 학생증인지 판단하고 정보를 추출해주세요.

[추출된 텍스트]
${rawText}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "isValid": true/false,
  "reason": "유효하지 않은 경우 이유",
  "name": "이름",
  "studentId": "학번(숫자)",
  "major": "학과/전공명",
  "university": "대학교명"
}

판단 기준:
- 부산대학교(Pusan National University) 관련 텍스트가 있어야 합니다
- 이름, 학번, 학과가 모두 식별 가능해야 합니다
- 위 조건 미충족 시 isValid: false`,
      },
    ],
    max_tokens: 300,
  });

  const content = response.choices[0]?.message?.content ?? "";

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("파싱 결과 없음");
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    name: parsed.name || "",
    studentId: parsed.studentId || "",
    major: parsed.major || "",
    university: parsed.university || "",
    isValid: parsed.isValid === true,
    reason: parsed.reason,
  };
}

// ── 메인 함수 ─────────────────────────────────────────────────
export async function extractStudentIdInfo(
  base64Image: string,
  _mimeType: string = "image/jpeg"
): Promise<StudentIdInfo> {
  // 1단계: Cloud Vision으로 텍스트 추출
  const rawText = await extractTextWithVision(base64Image);

  if (!rawText.trim()) {
    return {
      name: "", studentId: "", major: "", university: "",
      isValid: false, reason: "이미지에서 텍스트를 읽을 수 없습니다. 선명한 사진을 사용해주세요.",
    };
  }

  // 2단계: Replit AI로 텍스트 파싱 및 유효성 검사
  return await parseStudentIdText(rawText);
}
