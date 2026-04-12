/**
 * seatManagement.ts
 *
 * 학교 도서관(Pyxis) 좌석 예약 · 연장 · 반납 API 통신 유틸리티.
 *
 * ── 인증 흐름 ──────────────────────────────────────────────────
 *  1. SecureStore에서 JSESSIONID를 불러와 Cookie 헤더에 포함
 *  2. 서버가 세션 만료(error.authentication.needLogin 등)를 반환하면
 *     loginToSchoolAPI()를 즉시 호출해 세션 갱신 후 1회 자동 재시도
 *  3. 재시도도 실패하면 SeatActionResult{ success:false } 반환
 *
 * ── 네트워크 경로 ───────────────────────────────────────────────
 *  기기 → lib.pusan.ac.kr  (Replit 서버 미경유, 직접 통신)
 */

import { Platform } from "react-native";
import { buildAuthHeaders, loginToSchoolAPI, SchoolAuthError } from "./schoolAuth";

// ── 상수 ─────────────────────────────────────────────────────
const PYXIS_BASE = "https://lib.pusan.ac.kr/pyxis-api";

/** 이 코드들이 응답에 포함되면 세션 만료로 간주해 재로그인 */
const SESSION_EXPIRED_CODES = new Set([
  "error.authentication.needLogin",
  "error.authentication.sessionExpired",
  "error.authentication.tokenExpired",
  "error.authentication.unauthorized",
]);

// ── 타입 ──────────────────────────────────────────────────────

/** 모든 좌석 API 함수의 반환 타입. UI Toast에 바로 사용 가능 */
export interface SeatActionResult<T = unknown> {
  success: boolean;
  /** Toast에 표시할 메시지 */
  message: string;
  /** 성공 시 서버 응답 data 필드 */
  data?: T;
}

/** GET /api/my-seat 응답 data 필드 형태 */
export interface MySeatData {
  id: number | null;
  seatId: number | null;
  seatName: string | null;
  roomName: string | null;
  branchName: string | null;
  startTime: string | null;
  endTime: string | null;
  state: { code: string; name: string } | null;
}

interface PyxisBody {
  success: boolean;
  code?: string;
  message?: string;
  data?: any;
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────

async function pyxisRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: object
): Promise<PyxisBody> {
  const authHeaders = await buildAuthHeaders();
  const headers: Record<string, string> = {
    ...(authHeaders as Record<string, string>),
    "Content-Type": "application/json",
  };

  const res = await fetch(`${PYXIS_BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  return res.json() as Promise<PyxisBody>;
}

/**
 * 세션 만료 자동 갱신 래퍼.
 * fn()이 세션 만료 코드를 반환하면 재로그인 후 fn()을 1회 재시도한다.
 */
async function withSessionRefresh(fn: () => Promise<PyxisBody>): Promise<PyxisBody> {
  const result = await fn();

  if (!result.success && SESSION_EXPIRED_CODES.has(result.code ?? "")) {
    // ── 세션 만료 감지: 재로그인 후 1회 재시도 ──
    try {
      await loginToSchoolAPI();
    } catch (authErr) {
      const msg =
        authErr instanceof SchoolAuthError
          ? authErr.message
          : "자동 재로그인에 실패했습니다. 설정에서 학교 계정을 확인해 주세요.";
      return { success: false, code: "relogin.failed", message: msg };
    }
    return fn(); // 한 번만 재시도
  }

  return result;
}

/** Pyxis 서버의 한국어 메시지가 없을 경우 코드로 폴백 메시지 생성 */
function fallbackMessage(code: string | undefined, defaultMsg: string): string {
  const map: Record<string, string> = {
    "error.seat.alreadyReserved":      "이미 예약된 좌석입니다.",
    "error.seat.alreadyUsing":         "이미 사용 중인 좌석이 있습니다.",
    "error.seat.notFound":             "존재하지 않는 좌석입니다.",
    "error.seat.unavailable":          "현재 이용 불가능한 좌석입니다.",
    "error.mySeat.notFound":           "현재 사용 중인 좌석이 없습니다.",
    "error.mySeat.cannotExtend":       "연장 가능한 시간이 아닙니다.",
    "error.mySeat.alreadyExtended":    "이미 연장된 좌석입니다.",
    "relogin.failed":                  defaultMsg,
  };
  return map[code ?? ""] ?? defaultMsg;
}

// ─────────────────────────────────────────────────────────────
// reserveSeat
//
// 선택한 좌석(seatId)을 예약합니다.
// seatId: /pyxis-api/1/seat-room-seats API로 조회한 개별 좌석의 id 값
// ─────────────────────────────────────────────────────────────
export async function reserveSeat(seatId: number): Promise<SeatActionResult> {
  if (Platform.OS === "web") {
    return { success: false, message: "웹 환경에서는 좌석 예약을 지원하지 않습니다." };
  }

  let raw: PyxisBody;
  try {
    raw = await withSessionRefresh(() =>
      pyxisRequest("POST", "/api/my-seat", { seatId, homepageId: 1 })
    );
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }

  if (raw.success) {
    return {
      success: true,
      message: raw.message ?? "좌석 예약이 완료되었습니다.",
      data: raw.data,
    };
  }

  return {
    success: false,
    message: raw.message || fallbackMessage(raw.code, "좌석 예약에 실패했습니다."),
  };
}

// ─────────────────────────────────────────────────────────────
// extendSeat
//
// 현재 사용 중인 좌석의 이용 시간을 연장합니다.
// ─────────────────────────────────────────────────────────────
export async function extendSeat(): Promise<SeatActionResult> {
  if (Platform.OS === "web") {
    return { success: false, message: "웹 환경에서는 좌석 연장을 지원하지 않습니다." };
  }

  let raw: PyxisBody;
  try {
    raw = await withSessionRefresh(() =>
      pyxisRequest("POST", "/api/my-seat/extend", { homepageId: 1 })
    );
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }

  if (raw.success) {
    return {
      success: true,
      message: raw.message ?? "이용 시간이 연장되었습니다.",
      data: raw.data,
    };
  }

  return {
    success: false,
    message: raw.message || fallbackMessage(raw.code, "좌석 연장에 실패했습니다."),
  };
}

// ─────────────────────────────────────────────────────────────
// returnSeat
//
// 현재 사용 중인 좌석을 반납합니다.
// ─────────────────────────────────────────────────────────────
export async function returnSeat(): Promise<SeatActionResult> {
  if (Platform.OS === "web") {
    return { success: false, message: "웹 환경에서는 좌석 반납을 지원하지 않습니다." };
  }

  let raw: PyxisBody;
  try {
    raw = await withSessionRefresh(() =>
      pyxisRequest("POST", "/api/my-seat/return", { homepageId: 1 })
    );
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }

  if (raw.success) {
    return {
      success: true,
      message: raw.message ?? "좌석이 반납되었습니다.",
      data: raw.data,
    };
  }

  return {
    success: false,
    message: raw.message || fallbackMessage(raw.code, "좌석 반납에 실패했습니다."),
  };
}

// ─────────────────────────────────────────────────────────────
// getMySeat  (보너스)
//
// 현재 사용 중인 좌석 정보를 가져옵니다.
// 앱 진입 시 상태 표시 또는 연장/반납 버튼 활성화 여부 판단에 사용.
// ─────────────────────────────────────────────────────────────
export async function getMySeat(): Promise<SeatActionResult<MySeatData>> {
  if (Platform.OS === "web") {
    return { success: false, message: "웹 환경에서는 지원하지 않습니다." };
  }

  let raw: PyxisBody;
  try {
    raw = await withSessionRefresh(() => pyxisRequest("GET", "/api/my-seat"));
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }

  if (raw.success) {
    return {
      success: true,
      message: "좌석 정보를 불러왔습니다.",
      data: raw.data ?? null,
    };
  }

  return {
    success: false,
    message: raw.message || fallbackMessage(raw.code, "좌석 정보를 불러올 수 없습니다."),
  };
}
