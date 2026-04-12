/**
 * schoolAuth.ts
 *
 * 학교 포털(Pyxis 도서관 시스템) 인증 유틸리티.
 *
 * ┌─ 보안 원칙 ────────────────────────────────────────────────┐
 * │ • 학번·비밀번호는 절대 저장하지 않습니다.                  │
 * │ • 인증 성공 시 userId/userName만 SecureStore에 저장        │
 * │ • JSESSIONID 쿠키는 네이티브 HTTP 스택이 자동으로 관리     │
 * │ • 모든 HTTP 요청은 기기 → 학교 서버 직접 전송            │
 * └───────────────────────────────────────────────────────────┘
 *
 * [쿠키 처리 원칙]
 * React Native의 fetch는 set-cookie 헤더를 JS에 노출하지 않습니다.
 * 대신 iOS NSURLSession / Android OkHttp가 쿠키 저장소를 자동 관리하며,
 * 같은 도메인 요청 시 Cookie 헤더를 자동으로 포함합니다.
 * 따라서 JSESSIONID를 직접 추출/저장/세팅하지 않습니다.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const PYXIS_LOGIN_URL = "https://lib.pusan.ac.kr/pyxis-api/api/login";

export const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
  "Version/18.0 Mobile/15E148 Safari/604.1";

const KEY_SCHOOL_SESSION = "pium_school_session";

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

const ERROR_MSG: Record<string, string> = {
  "warning.authentication.invalidCredential":
    "학번 또는 비밀번호가 올바르지 않습니다.",
  "warning.authentication.invalidCredential.expansion":
    "학번 또는 비밀번호가 올바르지 않습니다. 비밀번호를 확인해 주세요.",
  "warning.authentication.locked":
    "로그인 시도 횟수를 초과하여 계정이 잠겼습니다. 잠시 후 다시 시도해 주세요.",
  "error.authentication.disabled":
    "사용이 중지된 계정입니다. 도서관 담당자에게 문의하세요.",
  "input.empty": "학번과 비밀번호를 모두 입력해 주세요.",
};

export interface SchoolSession {
  userId: string;
  userName: string | null;
  savedAt: number;
}

export class SchoolAuthError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "SchoolAuthError";
  }
}

function friendlyMessage(code: string, raw: string): string {
  return ERROR_MSG[code] ?? raw ?? "알 수 없는 오류가 발생했습니다.";
}

// ── 내부 공통 로그인 실행기 ──────────────────────────────────
async function performLogin(loginId: string, password: string): Promise<SchoolSession> {
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
      body: JSON.stringify({ loginId, password, homepageId: 1 }),
    });
  } catch (e: any) {
    throw new SchoolAuthError(
      "network.error",
      `학교 서버에 연결할 수 없습니다. 네트워크를 확인해 주세요. (${e?.message ?? "unknown"})`
    );
  }

  let body: { success: boolean; code?: string; message?: string; data?: any };
  try {
    body = await response.json();
  } catch {
    throw new SchoolAuthError("parse.error", "학교 서버 응답을 처리할 수 없습니다.");
  }

  if (!body.success) {
    const code = body.code ?? "unknown";
    throw new SchoolAuthError(code, friendlyMessage(code, body.message ?? ""));
  }

  // JSESSIONID 쿠키는 네이티브 HTTP 스택이 자동 저장합니다.
  // userId/userName만 추출하여 UI 상태 복원에 사용합니다.
  const session: SchoolSession = {
    userId:   body.data?.userId ?? body.data?.loginId ?? loginId,
    userName: body.data?.name   ?? body.data?.userName ?? null,
    savedAt:  Date.now(),
  };

  await SecureStore.setItemAsync(KEY_SCHOOL_SESSION, JSON.stringify(session), STORE_OPTIONS);
  return session;
}

// ─────────────────────────────────────────────────────────────
// loginWithCredentials  ← UI에서 직접 호출
//
// 학번·비밀번호를 받아 학교 서버에 로그인합니다.
// ⚠️  ID·비밀번호는 저장하지 않습니다.
//      JSESSIONID는 네이티브 쿠키 저장소에 자동 저장됩니다.
// ─────────────────────────────────────────────────────────────
export async function loginWithCredentials(id: string, password: string): Promise<SchoolSession> {
  if (Platform.OS === "web") {
    throw new SchoolAuthError("platform.unsupported", "웹 환경에서는 지원하지 않습니다.");
  }
  if (!id.trim() || !password) {
    throw new SchoolAuthError("input.empty", friendlyMessage("input.empty", ""));
  }
  return performLogin(id.trim(), password);
}

// ─────────────────────────────────────────────────────────────
// getSchoolSession / clearSchoolSession / buildAuthHeaders
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

export async function clearSchoolSession(): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(KEY_SCHOOL_SESSION, STORE_OPTIONS);
}

/**
 * buildAuthHeaders
 *
 * JSESSIONID 쿠키는 네이티브 HTTP 스택이 자동으로 포함시킵니다.
 * 여기서는 User-Agent 등 공통 헤더만 반환합니다.
 */
export async function buildAuthHeaders(): Promise<HeadersInit> {
  return {
    "User-Agent": MOBILE_UA,
    "Origin": "https://lib.pusan.ac.kr",
    "Referer": "https://lib.pusan.ac.kr/",
    "Accept": "application/json",
  };
}
