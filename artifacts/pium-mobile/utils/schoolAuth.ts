/**
 * schoolAuth.ts
 *
 * 학교 포털(Pyxis 도서관 시스템) 인증 유틸리티.
 *
 * ┌─ 아키텍처 (서버 프록시 로그인) ───────────────────────────────┐
 * │ 1. 앱 → API 서버 /library/login 요청                          │
 * │    → API 서버가 Pyxis에 직접 로그인 (API 서버 IP로 JSESSIONID │
 * │       발급 — 이후 모든 Pyxis 프록시 요청과 동일 IP 보장)      │
 * │    → API 서버가 쿠키를 DB에 저장 + Bearer 토큰 반환           │
 * │ 2. 이후 인증 API: Bearer 토큰으로 API 서버 호출               │
 * │    → API 서버가 저장된 쿠키(API서버 IP 발급)로 Pyxis 프록시  │
 * └───────────────────────────────────────────────────────────────┘
 *
 * ┌─ 보안 원칙 ────────────────────────────────────────────────────┐
 * │ • 학번·비밀번호는 절대 저장하지 않습니다.                      │
 * │ • API 서버 Bearer 토큰만 SecureStore에 보관                    │
 * │ │   (하드웨어 암호화, 잠금해제 시에만 접근 가능)               │
 * │ • 세션 유효기간: 8시간 (API 서버 정책, Pyxis 정책 동일)       │
 * └───────────────────────────────────────────────────────────────┘
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY_SCHOOL_SESSION  = "pium_school_session";
const KEY_LIB_TOKEN       = "pium_lib_token";       // API 서버 세션 토큰
const KEY_LIB_PYXIS_TOKEN = "pium_lib_pyxis_token"; // Pyxis Bearer 토큰 (기기 직접 호출용)

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

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

// ─────────────────────────────────────────────────────────────
// loginWithCredentials  ← UI에서 직접 호출
//
// [아키텍처 v2] 기기에서 Pyxis에 직접 로그인 (한국 IP 보장)
//
// 1. 기기 → Pyxis /api/login 직접 POST (Korean IP)
//    → iOS NSURLSession이 JSESSIONID 쿠키를 HTTPCookieStorage에 자동 저장
//    → 이후 lib.pusan.ac.kr 요청에 JSESSIONID 자동 첨부
//    → accessToken (Bearer) 응답 바디에서 추출 → SecureStore 저장
// 2. 이후 모든 Pyxis API: 기기에서 직접 호출
//    → iOS 자동 쿠키(JSESSIONID) + Authorization: Bearer 헤더
//    → Cookie를 수동으로 설정할 필요 없음
// ─────────────────────────────────────────────────────────────
export async function loginWithCredentials(id: string, password: string): Promise<SchoolSession> {
  if (Platform.OS === "web") {
    throw new SchoolAuthError("platform.unsupported", "웹 환경에서는 지원하지 않습니다.");
  }
  if (!id.trim() || !password) {
    throw new SchoolAuthError("input.empty", friendlyMessage("input.empty", ""));
  }

  let res: Response;
  try {
    // 기기에서 직접 Pyxis 로그인 — iOS가 JSESSIONID 쿠키를 자동 처리
    res = await fetch("https://lib.pusan.ac.kr/pyxis-api/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://lib.pusan.ac.kr",
        "Referer": "https://lib.pusan.ac.kr/facility/seat",
      },
      body: JSON.stringify({ loginId: id.trim(), password, homepageId: 1 }),
    });
  } catch (e: any) {
    throw new SchoolAuthError(
      "network.error",
      `도서관 서버에 연결할 수 없습니다. 네트워크를 확인해 주세요. (${e?.message ?? "unknown"})`
    );
  }

  let json: { success: boolean; code?: string; message?: string; data?: any };
  try {
    json = await res.json();
  } catch {
    throw new SchoolAuthError("parse.error", "서버 응답을 처리할 수 없습니다.");
  }

  if (!json.success) {
    const code = json.code ?? "unknown";
    throw new SchoolAuthError(code, friendlyMessage(code, json.message ?? ""));
  }

  const data = json.data ?? {};
  const accessToken = data.accessToken ?? null;
  const uid = data.userId ?? data.loginId ?? id.trim();
  const uname = data.name ?? data.userName ?? null;

  if (accessToken) {
    await SecureStore.setItemAsync(KEY_LIB_PYXIS_TOKEN, accessToken, STORE_OPTIONS);
  }

  const session: SchoolSession = {
    userId: uid,
    userName: uname,
    savedAt: Date.now(),
  };
  await SecureStore.setItemAsync(KEY_SCHOOL_SESSION, JSON.stringify(session), STORE_OPTIONS);

  return session;
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

/** API 서버 인증 토큰 조회 */
export async function getLibApiToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  return SecureStore.getItemAsync(KEY_LIB_TOKEN, STORE_OPTIONS);
}

/** Pyxis Bearer 토큰 조회 (기기 직접 호출용, 한국 IP 보장) */
export async function getLibPyxisToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  return SecureStore.getItemAsync(KEY_LIB_PYXIS_TOKEN, STORE_OPTIONS);
}

/** 세션 전체 삭제 (로그아웃 시 호출) */
export async function clearSchoolSession(): Promise<void> {
  if (Platform.OS === "web") return;
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_SCHOOL_SESSION, STORE_OPTIONS),
    SecureStore.deleteItemAsync(KEY_LIB_TOKEN, STORE_OPTIONS),
    SecureStore.deleteItemAsync(KEY_LIB_PYXIS_TOKEN, STORE_OPTIONS),
    // 구버전 호환: 이전에 기기에 저장했던 Pyxis 쿠키 키들도 삭제
    SecureStore.deleteItemAsync("pium_pyxis_jsid", STORE_OPTIONS).catch(() => {}),
    SecureStore.deleteItemAsync("pium_pyxis_at", STORE_OPTIONS).catch(() => {}),
    SecureStore.deleteItemAsync("pium_pyxis_ss", STORE_OPTIONS).catch(() => {}),
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

// ─────────────────────────────────────────────────────────────
// 하위 호환성 — deprecated
// ─────────────────────────────────────────────────────────────

/** @deprecated getLibApiToken() 사용 */
export async function getPyxisCookieHeader(): Promise<string | null> {
  return null;
}

/** @deprecated getLibApiToken() 사용 */
export async function getLibToken(): Promise<string | null> {
  return getLibApiToken();
}

/** @deprecated */
export async function buildLibAuthHeaders(): Promise<HeadersInit> {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Origin": "https://lib.pusan.ac.kr",
    "Referer": "https://lib.pusan.ac.kr/facility/seat",
  };
}

/** @deprecated */
export async function isLoggedIn(): Promise<boolean> {
  const session = await getSchoolSession();
  if (!session) return false;
  const token = await getLibApiToken();
  return !!token;
}

/** @deprecated buildLibAuthHeaders() 사용 */
export async function buildAuthHeaders(): Promise<HeadersInit> {
  return buildLibAuthHeaders();
}

/** @deprecated */
export async function getJsessionid(): Promise<string | null> {
  return null;
}
