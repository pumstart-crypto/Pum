/**
 * schoolAuth.ts
 *
 * 학교 포털(Pyxis 도서관 시스템) 인증 유틸리티.
 *
 * ┌─ 아키텍처 ─────────────────────────────────────────────────┐
 * │ • 로그인: 앱 → API 서버 → Pyxis                           │
 * │   API 서버가 로그인을 대행하여 JSESSIONID를 DB에 저장      │
 * │   앱에는 세션 토큰(lib_token)만 반환                       │
 * │ • 이후 요청: 앱 → API 서버 (Authorization: Bearer <token>) │
 * │   API 서버가 DB에서 JSESSIONID를 조회하여 Pyxis에 전달     │
 * │ • Pyxis 세션은 접속 IP에 바인딩 → 모든 요청을 API 서버가  │
 * │   동일 IP로 처리하여 세션 유지 보장                        │
 * └───────────────────────────────────────────────────────────┘
 *
 * ┌─ 보안 원칙 ────────────────────────────────────────────────┐
 * │ • 학번·비밀번호는 절대 저장하지 않습니다.                  │
 * │ • JSESSIONID는 API 서버 DB에만 보관, 앱에 절대 노출 안 함  │
 * │ • 앱에는 세션 토큰(64자 hex)만 SecureStore에 저장          │
 * └───────────────────────────────────────────────────────────┘
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY_SCHOOL_SESSION = "pium_school_session";
const KEY_LIB_TOKEN     = "pium_lib_token";

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

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : "";
}

// ── 로그인 ──────────────────────────────────────────────────
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

  // 서버에서 반환한 세션 토큰을 SecureStore에 저장
  if (body.data?.token) {
    await SecureStore.setItemAsync(KEY_LIB_TOKEN, body.data.token, STORE_OPTIONS);
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
// 세션 조회
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

/** 저장된 라이브러리 세션 토큰 조회 */
export async function getLibToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  return await SecureStore.getItemAsync(KEY_LIB_TOKEN, STORE_OPTIONS);
}

/** 인증 헤더 빌드 (Bearer 토큰) */
export async function buildLibAuthHeaders(): Promise<HeadersInit> {
  const token = await getLibToken();
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };
}

export async function clearSchoolSession(): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(KEY_SCHOOL_SESSION, STORE_OPTIONS);
  await SecureStore.deleteItemAsync(KEY_LIB_TOKEN, STORE_OPTIONS);
}

// ── 로그아웃 (서버에도 세션 삭제 요청) ────────────────────────
export async function logoutFromLibrary(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const token = await getLibToken();
    if (token) {
      const apiBase = getApiBase();
      if (apiBase) {
        await fetch(`${apiBase}/library/logout`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        });
      }
    }
  } catch {}
  await clearSchoolSession();
}

// ── 하위 호환성 유지 ─────────────────────────────────────────
/** @deprecated getLibToken() 사용 */
export async function getJsessionid(): Promise<string | null> {
  return getLibToken();
}

/** @deprecated buildLibAuthHeaders() 사용 */
export async function buildAuthHeaders(): Promise<HeadersInit> {
  return buildLibAuthHeaders();
}
