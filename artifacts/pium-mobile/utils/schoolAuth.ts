/**
 * schoolAuth.ts
 *
 * 학교 포털(Pyxis 도서관 시스템) 인증 유틸리티.
 *
 * ┌─ 아키텍처 (하이브리드 프록시) ─────────────────────────────┐
 * │ 1. 기기에서 Pyxis에 직접 로그인 (한국 IP 필요)            │
 * │    → 쿠키(JSESSIONID, AT, SS)를 SecureStore에 저장        │
 * │    → 쿠키를 API 서버 DB에 등록 → Bearer 토큰 발급         │
 * │ 2. 이후 인증 API: Bearer 토큰으로 API 서버 호출            │
 * │    → API 서버가 저장된 쿠키로 Pyxis 프록시                 │
 * │ → iOS Cookie 헤더 무시 문제 완벽 우회                      │
 * └───────────────────────────────────────────────────────────┘
 *
 * ┌─ 보안 원칙 ────────────────────────────────────────────────┐
 * │ • 학번·비밀번호는 절대 저장하지 않습니다.                  │
 * │ • JSESSIONID는 SecureStore(하드웨어 암호화)에만 보관       │
 * │ • 세션 유효기간: 8시간 (Pyxis 서버 정책)                  │
 * └───────────────────────────────────────────────────────────┘
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY_SCHOOL_SESSION = "pium_school_session";
const KEY_PYXIS_JSID     = "pium_pyxis_jsid";
const KEY_PYXIS_AT       = "pium_pyxis_at";
const KEY_PYXIS_SS       = "pium_pyxis_ss";
const KEY_LIB_TOKEN      = "pium_lib_token"; // API 서버 세션 토큰

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

const PYXIS_BASE = "https://lib.pusan.ac.kr/pyxis-api";
const PYXIS_HOMEPAGE_ID = 1;

// API 서버 기본 URL (동일 Replit 도메인)
const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

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

/** Set-Cookie 헤더 문자열에서 특정 쿠키 값 추출 */
function extractCookie(setCookieHeader: string | null, name: string): string | null {
  if (!setCookieHeader) return null;
  // Set-Cookie 헤더는 여러 개가 콤마 또는 줄바꿈으로 합쳐질 수 있음
  const pattern = new RegExp(`(?:^|,)\\s*${name}=([^;,]+)`, "i");
  return setCookieHeader.match(pattern)?.[1]?.trim() ?? null;
}

// ── 로그인 ──────────────────────────────────────────────────
async function performLogin(loginId: string, password: string): Promise<SchoolSession> {
  // 세션 UUID 생성 (PUSAN_PYXIS3_SS 역할)
  const sessionUuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });

  let loginRes: Response;
  try {
    loginRes = await fetch(`${PYXIS_BASE}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Cookie": `PUSAN_PYXIS3_SS=${sessionUuid}`,
        "User-Agent": "PiumApp/1.0 (Expo React Native)",
        "Origin": "https://lib.pusan.ac.kr",
        "Referer": "https://lib.pusan.ac.kr/facility/seat",
      },
      body: JSON.stringify({ loginId, password, homepageId: PYXIS_HOMEPAGE_ID }),
    });
  } catch (e: any) {
    throw new SchoolAuthError(
      "network.error",
      `도서관 서버에 연결할 수 없습니다. 네트워크를 확인해 주세요. (${e?.message ?? "unknown"})`
    );
  }

  let json: { success: boolean; code?: string; message?: string; data?: any };
  try {
    json = await loginRes.json();
  } catch {
    throw new SchoolAuthError("parse.error", "서버 응답을 처리할 수 없습니다.");
  }

  if (!json.success) {
    const code = json.code ?? "unknown";
    throw new SchoolAuthError(code, friendlyMessage(code, json.message ?? ""));
  }

  // JSESSIONID 추출 (Set-Cookie 헤더에서)
  const setCookie = loginRes.headers.get("set-cookie");
  const jsid = extractCookie(setCookie, "JSESSIONID");

  const accessToken: string | null = json.data?.accessToken ?? null;
  const userName: string | null = json.data?.name ?? null;
  const userId: string = json.data?.memberNo ?? loginId;

  // SecureStore에 Pyxis 세션 쿠키 저장
  // (JSESSIONID가 없어도 accessToken만으로 동작하는 경우를 위해 저장)
  if (jsid) {
    await SecureStore.setItemAsync(KEY_PYXIS_JSID, jsid, STORE_OPTIONS);
  }
  if (accessToken) {
    await SecureStore.setItemAsync(KEY_PYXIS_AT, accessToken, STORE_OPTIONS);
  }
  await SecureStore.setItemAsync(KEY_PYXIS_SS, sessionUuid, STORE_OPTIONS);

  // 사용자 세션 정보 저장
  const session: SchoolSession = { userId, userName, savedAt: Date.now() };
  await SecureStore.setItemAsync(KEY_SCHOOL_SESSION, JSON.stringify(session), STORE_OPTIONS);

  // API 서버에 Pyxis 세션 등록 (백그라운드 — 실패해도 로그인 성공)
  const cookieString = [
    jsid   ? `JSESSIONID=${jsid}` : null,
    accessToken ? `PUSAN_PYXIS3=${accessToken}` : null,
    `PUSAN_PYXIS3_SS=${sessionUuid}`,
  ].filter(Boolean).join("; ");

  try {
    const regRes = await fetch(`${API_BASE}/library/register-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ cookieString, userId, userName }),
    });
    const regJson: any = await regRes.json();
    if (regJson.success && regJson.data?.token) {
      await SecureStore.setItemAsync(KEY_LIB_TOKEN, regJson.data.token, STORE_OPTIONS);
    }
  } catch {
    // 네트워크 오류 시 무시 (로그인 자체는 성공)
  }

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

/** API 서버 인증 토큰 조회. 없으면 저장된 쿠키로 자동 재등록 시도 */
export async function getLibApiToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const existing = await SecureStore.getItemAsync(KEY_LIB_TOKEN, STORE_OPTIONS);
  if (existing) return existing;

  // 토큰 없음 → 저장된 Pyxis 쿠키로 자동 재등록
  const cookieString = await getPyxisCookieHeader();
  if (!cookieString) return null;
  try {
    const session = await getSchoolSession();
    const regRes = await fetch(`${API_BASE}/library/register-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        cookieString,
        userId: session?.userId,
        userName: session?.userName,
      }),
    });
    const regJson: any = await regRes.json();
    if (regJson.success && regJson.data?.token) {
      await SecureStore.setItemAsync(KEY_LIB_TOKEN, regJson.data.token, STORE_OPTIONS);
      return regJson.data.token;
    }
  } catch {}
  return null;
}

/** Pyxis 요청용 Cookie 헤더 문자열 조회 */
export async function getPyxisCookieHeader(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const [jsid, at, ss] = await Promise.all([
    SecureStore.getItemAsync(KEY_PYXIS_JSID, STORE_OPTIONS),
    SecureStore.getItemAsync(KEY_PYXIS_AT, STORE_OPTIONS),
    SecureStore.getItemAsync(KEY_PYXIS_SS, STORE_OPTIONS),
  ]);
  if (!at && !jsid) return null;

  const parts: string[] = [];
  if (jsid) parts.push(`JSESSIONID=${jsid}`);
  if (at)   parts.push(`PUSAN_PYXIS3=${at}`);
  if (ss)   parts.push(`PUSAN_PYXIS3_SS=${ss}`);
  return parts.join("; ");
}

/** @deprecated getPyxisCookieHeader() 사용 */
export async function getLibToken(): Promise<string | null> {
  return getPyxisCookieHeader();
}

/** 인증 헤더 빌드 (Pyxis 직접 요청용) */
export async function buildLibAuthHeaders(): Promise<HeadersInit> {
  const cookie = await getPyxisCookieHeader();
  const base: HeadersInit = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Origin": "https://lib.pusan.ac.kr",
    "Referer": "https://lib.pusan.ac.kr/facility/seat",
    "User-Agent": "PiumApp/1.0 (Expo React Native)",
  };
  return cookie ? { ...base, "Cookie": cookie } : base;
}

/** 로그인 상태 여부 (세션 정보 존재 여부) */
export async function isLoggedIn(): Promise<boolean> {
  const session = await getSchoolSession();
  if (!session) return false;
  const at = await SecureStore.getItemAsync(KEY_PYXIS_AT, STORE_OPTIONS);
  return !!at;
}

export async function clearSchoolSession(): Promise<void> {
  if (Platform.OS === "web") return;
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_SCHOOL_SESSION, STORE_OPTIONS),
    SecureStore.deleteItemAsync(KEY_PYXIS_JSID, STORE_OPTIONS),
    SecureStore.deleteItemAsync(KEY_PYXIS_AT, STORE_OPTIONS),
    SecureStore.deleteItemAsync(KEY_PYXIS_SS, STORE_OPTIONS),
    SecureStore.deleteItemAsync(KEY_LIB_TOKEN, STORE_OPTIONS),
  ]);
}

// ── 로그아웃 ──────────────────────────────────────────────────
export async function logoutFromLibrary(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const token = await SecureStore.getItemAsync(KEY_LIB_TOKEN, STORE_OPTIONS);
    if (token) {
      await fetch(`${API_BASE}/library/logout`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" },
      });
    }
  } catch {}
  await clearSchoolSession();
}

// ── 하위 호환성 ─────────────────────────────────────────────
/** @deprecated buildLibAuthHeaders() 사용 */
export async function buildAuthHeaders(): Promise<HeadersInit> {
  return buildLibAuthHeaders();
}

/** @deprecated clearSchoolSession() 사용 */
export async function getJsessionid(): Promise<string | null> {
  return getPyxisCookieHeader();
}
