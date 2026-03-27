import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
    const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] || process.env["OPENAI_API_KEY"] || "";
    client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }
  return client;
}

export interface StudentIdInfo {
  name: string;
  studentId: string;
  major: string;
  university: string;
  isValid: boolean;
  reason?: string;
}

export async function extractStudentIdInfo(base64Image: string, mimeType: string = "image/jpeg"): Promise<StudentIdInfo> {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "high",
            },
          },
          {
            type: "text",
            text: `이 이미지가 부산대학교(Pusan National University) 모바일 학생증인지 확인하고, 아래 정보를 JSON으로 추출해주세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "isValid": true/false,
  "reason": "유효하지 않은 경우 이유",
  "name": "이름",
  "studentId": "학번",
  "major": "학과/전공명",
  "university": "대학교명"
}

주의사항:
- 반드시 부산대학교 학생증이어야 합니다.
- 이름, 학번, 학과 정보가 명확히 보여야 합니다.
- 학생증이 아니거나 다른 학교의 학생증이면 isValid: false
- 정보가 불명확하거나 가려진 경우 isValid: false`,
          },
        ],
      },
    ],
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      name: parsed.name || "",
      studentId: parsed.studentId || "",
      major: parsed.major || "",
      university: parsed.university || "",
      isValid: parsed.isValid === true,
      reason: parsed.reason,
    };
  } catch {
    return { name: "", studentId: "", major: "", university: "", isValid: false, reason: "이미지 분석에 실패했습니다." };
  }
}
