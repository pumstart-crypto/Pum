/**
 * schoolAuth.ts
 *
 * 학교 포털(Pyxis 도서관 시스템) 인증 유틸리티.
 *
 * ┌─ 보안 원칙 ────────────────────────────────────────────────┐
 * │ • 학번·비밀번호는 절대 저장하지 않습니다.                  │
 * │ • 인증 성공 시 userId/userName만 SecureStore에 저장        │
 * │ • JSESSIONID는 API 서버가 추출 → 앱이 SecureStore에 보관  │
 * │   이후 모든 Pyxis 요청에 Cookie 헤더로 직접 포함          │
 * │   (Expo Go는 cross-origin 쿠키 자동전송 미지원이므로)     │
 * └───────────────────────────────────────────────────────────┘
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
  "Version/18.0 Mobile/15E148 Safari/604.1";

const KEY_SCHOOL_SESSION = "pium_school_session";
const KEY_JSESSIONID     = "pium_jsessionid";

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

// API 서버 base URL (Expo 환경변수)
function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : "";
}

// ── 로그인 ──────────────────────────────────────────────────
// API 서버(library.ts)에 로그인 요청 → JSESSIONID 추출 후 반환
async function performLogin(loginId: string, password: string): Promise<SchoolSession> {
  const apiBase = getApiBase();
  if (!apiBase) throw new SchoolAuthError("config.error", "서버 설정이 올바르지 않습니다.");

  let response: Response;
  try {
    response = await fetch(`${apiBase}/library/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ loginId, password }),
    });
  } catch (e: any) {
    throw new SchoolAuthError(
      "network.error",
      `서버에 연결할 수 없습니다. 네트워크를 확인해 주세요. (${e?.message ?? "unknown"})`
    );
  }

  let body: { success: boolean; code?: string; message?: string; data?: any };
  try {
    body = await response.json();
  } catch {
    throw new SchoolAuthError("parse.error", "서버 응답을 처리할 수 없습니다.");
  }

  if (!body.success) {
    const code = body.code ?? "unknown";
    throw new SchoolAuthError(code, friendlyMessage(code, body.message ?? ""));
  }

  // JSESSIONID를 SecureStore에 별도 저장 (Pyxis API 요청 시 Cookie 헤더에 직접 포함)
  if (body.data?.jsessionid) {
    await SecureStore.setItemAsync(KEY_JSESSIONID, body.data.jsessionid, STORE_OPTIONS);
  }

  const session: SchoolSession = {
    userId:   body.data?.userId   ?? loginId,
    userName: body.data?.userName ?? null,
    savedAt:  Date.now(),
  };

  await SecureStore.setItemAsync(KEY_SCHOOL_SESSION, JSON.stringify(session), STORE_OPTIONS);
  return session;
}

// ─────────────────────────────────────────────────────────────
// loginWithCredentials  ← UI에서 직접 호출
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

/** 저장된 JSESSIONID 조회 */
export async function getJsessionid(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  return await SecureStore.getItemAsync(KEY_JSESSIONID, STORE_OPTIONS);
}

export async function clearSchoolSession(): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(KEY_SCHOOL_SESSION, STORE_OPTIONS);
  await SecureStore.deleteItemAsync(KEY_JSESSIONID, STORE_OPTIONS);
}

/**
 * buildAuthHeaders
 *
 * JSESSIONID를 Cookie 헤더에 명시적으로 포함합니다.
 * Expo Go는 cross-origin 쿠키를 자동 전송하지 않으므로
 * SecureStore에서 꺼내 직접 설정합니다.
 */
export async function buildAuthHeaders(): Promise<HeadersInit> {
  const jsessionid = Platform.OS !== "web"
    ? await SecureStore.getItemAsync(KEY_JSESSIONID, STORE_OPTIONS)
    : null;

  return {
    "User-Agent": MOBILE_UA,
    "Origin": "https://lib.pusan.ac.kr",
    "Referer": "https://lib.pusan.ac.kr/",
    "Accept": "application/json",
    ...(jsessionid ? { "Cookie": `JSESSIONID=${jsessionid}` } : {}),
  };
}
