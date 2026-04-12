/**
 * schoolAuth.ts
 *
 * 학교 포털(Pyxis 도서관 시스템)에 백그라운드로 로그인하고
 * 세션(JSESSIONID)을 기기 보안 저장소에 유지합니다.
 *
 * ┌─ 중요한 보안 원칙 ─────────────────────────────────────────┐
 * │ • 학번·비밀번호는 절대 Replit 서버나 외부 DB로 전송 X     │
 * │ • 모든 HTTP 요청은 사용자 기기 → 학교 서버 직접 전송      │
 * │ • 세션 토큰은 기기 Keychain/Keystore에만 저장            │
 * └───────────────────────────────────────────────────────────┘
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getSchoolCredentials } from "./secureCredentials";

// ── 상수 ──────────────────────────────────────────────────────
const PYXIS_LOGIN_URL = "https://lib.pusan.ac.kr/pyxis-api/api/login";

/** 일반 iOS Safari 모바일 브라우저와 동일한 UA — 봇 차단 우회 */
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
  "Version/18.0 Mobile/15E148 Safari/604.1";

const KEY_SCHOOL_SESSION = "pium_school_session";

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

// ── 에러 코드 → 한국어 메시지 매핑 ───────────────────────────
const ERROR_MSG: Record<string, string> = {
  "warning.authentication.invalidCredential":
    "학번 또는 비밀번호가 올바르지 않습니다.",
  "warning.authentication.invalidCredential.expansion":
    "학번 또는 비밀번호가 올바르지 않습니다. 비밀번호를 확인해 주세요.",
  "warning.authentication.locked":
    "로그인 시도 횟수를 초과하여 계정이 잠겼습니다. 잠시 후 다시 시도해 주세요.",
  "error.authentication.disabled":
    "사용이 중지된 계정입니다. 도서관 담당자에게 문의하세요.",
};

// ── 타입 ──────────────────────────────────────────────────────
export interface SchoolSession {
  /** 학교 서버의 JSESSIONID 쿠키 값 */
  jsessionId: string;
  /** 로그인한 학번 (학교 서버 응답 기준) */
  userId: string;
  /** 이름 (학교 서버가 반환한 경우) */
  userName: string | null;
  /** 저장 시각 (epoch ms) */
  savedAt: number;
}

export class SchoolAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "SchoolAuthError";
  }
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────
function extractJsessionId(setCookieHeader: string | null): string {
  if (!setCookieHeader) return "";
  const match = setCookieHeader.match(/JSESSIONID=([^;]+)/);
  return match ? match[1] : "";
}

function friendlyMessage(code: string, rawMessage: string): string {
  return ERROR_MSG[code] ?? rawMessage ?? "알 수 없는 오류가 발생했습니다.";
}

// ─────────────────────────────────────────────────────────────
// loginToSchoolAPI
//
// 1. SecureStore에서 학번·비밀번호를 불러옴
// 2. 학교 서버에 직접 POST (기기 → 학교, Replit 서버 미경유)
// 3. Set-Cookie에서 JSESSIONID 추출
// 4. 세션을 SecureStore(pium_school_session)에 저장
// 5. 실패 시 SchoolAuthError throw
// ─────────────────────────────────────────────────────────────
export async function loginToSchoolAPI(): Promise<SchoolSession> {
  if (Platform.OS === "web") {
    throw new SchoolAuthError(
      "platform.unsupported",
      "웹 환경에서는 학교 로그인을 사용할 수 없습니다."
    );
  }

  // ① 저장된 자격 증명 로드
  const creds = await getSchoolCredentials();
  if (!creds) {
    throw new SchoolAuthError(
      "credentials.missing",
      "저장된 학번·비밀번호가 없습니다. 먼저 학교 계정 정보를 등록해 주세요."
    );
  }

  // ② 학교 서버에 직접 POST (기기 → lib.pusan.ac.kr)
  let response: Response;
  try {
    response = await fetch(PYXIS_LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "User-Agent": MOBILE_UA,
        "Origin": "https://lib.pusan.ac.kr",
        "Referer": "https://lib.pusan.ac.kr/",
      },
      body: JSON.stringify({
        loginId: creds.id,
        password: creds.password,
        homepageId: 1,
      }),
    });
  } catch (networkErr: any) {
    throw new SchoolAuthError(
      "network.error",
      `학교 서버에 연결할 수 없습니다. 네트워크를 확인해 주세요. (${networkErr?.message ?? "unknown"})`
    );
  }

  // ③ 응답 파싱
  let body: { success: boolean; code?: string; message?: string; data?: any };
  try {
    body = await response.json();
  } catch {
    throw new SchoolAuthError(
      "parse.error",
      "학교 서버 응답을 처리할 수 없습니다."
    );
  }

  // ④ 실패 처리
  if (!body.success) {
    const code = body.code ?? "unknown";
    throw new SchoolAuthError(code, friendlyMessage(code, body.message ?? ""));
  }

  // ⑤ JSESSIONID 추출 (Set-Cookie 헤더)
  //    React Native 네이티브 환경에서는 Set-Cookie 헤더에 접근 가능
  const setCookieHeader = response.headers.get("set-cookie");
  const jsessionId = extractJsessionId(setCookieHeader);

  // ⑥ 세션 객체 구성
  const session: SchoolSession = {
    jsessionId,
    userId:   body.data?.userId ?? body.data?.loginId ?? creds.id,
    userName: body.data?.name   ?? body.data?.userName ?? null,
    savedAt:  Date.now(),
  };

  // ⑦ 기기 보안 저장소에 영구 저장
  await SecureStore.setItemAsync(
    KEY_SCHOOL_SESSION,
    JSON.stringify(session),
    STORE_OPTIONS
  );

  return session;
}

// ─────────────────────────────────────────────────────────────
// getSchoolSession
// 저장된 세션을 불러옵니다. 없으면 null 반환.
// ─────────────────────────────────────────────────────────────
export async function getSchoolSession(): Promise<SchoolSession | null> {
  if (Platform.OS === "web") return null;
  const raw = await SecureStore.getItemAsync(KEY_SCHOOL_SESSION, STORE_OPTIONS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SchoolSession;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// clearSchoolSession
// 저장된 세션을 삭제합니다 (로그아웃 시 호출).
// ─────────────────────────────────────────────────────────────
export async function clearSchoolSession(): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(KEY_SCHOOL_SESSION, STORE_OPTIONS);
}

// ─────────────────────────────────────────────────────────────
// buildAuthHeaders
// 저장된 세션으로 인증 헤더를 만들어 반환합니다.
// 학교 API를 추가 호출할 때 이 헤더를 fetch 옵션에 포함하세요.
//
// 사용 예:
//   const headers = await buildAuthHeaders();
//   await fetch('https://lib.pusan.ac.kr/pyxis-api/...', { headers });
// ─────────────────────────────────────────────────────────────
export async function buildAuthHeaders(): Promise<HeadersInit> {
  const session = await getSchoolSession();
  const base: HeadersInit = {
    "User-Agent": MOBILE_UA,
    "Origin": "https://lib.pusan.ac.kr",
    "Referer": "https://lib.pusan.ac.kr/",
    "Accept": "application/json",
  };
  if (session?.jsessionId) {
    (base as Record<string, string>)["Cookie"] =
      `JSESSIONID=${session.jsessionId}`;
  }
  return base;
}
