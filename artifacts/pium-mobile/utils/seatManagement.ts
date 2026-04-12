/**
 * seatManagement.ts
 *
 * 도서관 좌석 예약 · 연장 · 반납 · 개별 좌석 조회.
 * 기기 → lib.pusan.ac.kr 직접 통신 (Replit 서버 미경유).
 *
 * 세션 만료 시 needsLogin: true 를 반환합니다.
 * UI는 이 플래그를 보고 로그인 모달을 다시 띄워야 합니다.
 */

import { Platform } from "react-native";
import { buildAuthHeaders } from "./schoolAuth";

const PYXIS_BASE = "https://lib.pusan.ac.kr/pyxis-api";

const SESSION_EXPIRED_CODES = new Set([
  "error.authentication.needLogin",
  "error.authentication.sessionExpired",
  "error.authentication.tokenExpired",
  "error.authentication.unauthorized",
]);

// ── 타입 ──────────────────────────────────────────────────────

export interface SeatActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  /** true이면 세션 만료 → 로그인 모달을 다시 표시해야 함 */
  needsLogin?: boolean;
}

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

export interface IndividualSeat {
  id: number;
  name: string;
  code: string;
  status: { code: string; name: string };
  isMine: boolean;
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
  const authHeaders = await buildAuthHeaders() as Record<string, string>;
  const res = await fetch(`${PYXIS_BASE}${path}`, {
    method,
    headers: { ...authHeaders, "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

/**
 * 세션 만료 감지 래퍼.
 * 세션이 만료됐으면 재로그인 없이 needsLogin: true 를 반환합니다.
 * (자격 증명은 저장하지 않으므로 자동 재로그인 불가)
 */
async function withSessionCheck(
  fn: () => Promise<PyxisBody>,
  expiredMessage: string
): Promise<PyxisBody & { needsLogin?: boolean }> {
  const result = await fn();
  if (!result.success && SESSION_EXPIRED_CODES.has(result.code ?? "")) {
    return { success: false, code: result.code, message: expiredMessage, needsLogin: true };
  }
  return result;
}

const FALLBACK: Record<string, string> = {
  "error.seat.alreadyReserved":   "이미 예약된 좌석입니다.",
  "error.seat.alreadyUsing":      "이미 사용 중인 좌석이 있습니다.",
  "error.seat.notFound":          "존재하지 않는 좌석입니다.",
  "error.seat.unavailable":       "현재 이용 불가능한 좌석입니다.",
  "error.mySeat.notFound":        "현재 사용 중인 좌석이 없습니다.",
  "error.mySeat.cannotExtend":    "연장 가능한 시간이 아닙니다.",
  "error.mySeat.alreadyExtended": "이미 연장된 좌석입니다.",
};

function fallback(code: string | undefined, def: string) {
  return FALLBACK[code ?? ""] ?? def;
}

function webUnsupported<T>(msg: string): SeatActionResult<T> {
  return { success: false, message: msg };
}

// ─────────────────────────────────────────────────────────────
// reserveSeat — 선택한 좌석 예약
// seatId: getSeatRoomSeats()로 얻은 개별 좌석 id
// ─────────────────────────────────────────────────────────────
export async function reserveSeat(seatId: number): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported("웹 환경에서는 지원하지 않습니다.");
  try {
    const raw = await withSessionCheck(
      () => pyxisRequest("POST", "/api/my-seat", { seatId, homepageId: 1 }),
      "세션이 만료되었습니다. 다시 로그인해 주세요."
    );
    if (raw.needsLogin) return { success: false, message: raw.message!, needsLogin: true };
    if (raw.success) return { success: true, message: raw.message ?? "좌석 예약이 완료되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fallback(raw.code, "좌석 예약에 실패했습니다.") };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// extendSeat — 이용 시간 연장
// ─────────────────────────────────────────────────────────────
export async function extendSeat(): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported("웹 환경에서는 지원하지 않습니다.");
  try {
    const raw = await withSessionCheck(
      () => pyxisRequest("POST", "/api/my-seat/extend", { homepageId: 1 }),
      "세션이 만료되었습니다. 다시 로그인해 주세요."
    );
    if (raw.needsLogin) return { success: false, message: raw.message!, needsLogin: true };
    if (raw.success) return { success: true, message: raw.message ?? "이용 시간이 연장되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fallback(raw.code, "좌석 연장에 실패했습니다.") };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// returnSeat — 좌석 반납
// ─────────────────────────────────────────────────────────────
export async function returnSeat(): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported("웹 환경에서는 지원하지 않습니다.");
  try {
    const raw = await withSessionCheck(
      () => pyxisRequest("POST", "/api/my-seat/return", { homepageId: 1 }),
      "세션이 만료되었습니다. 다시 로그인해 주세요."
    );
    if (raw.needsLogin) return { success: false, message: raw.message!, needsLogin: true };
    if (raw.success) return { success: true, message: raw.message ?? "좌석이 반납되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fallback(raw.code, "좌석 반납에 실패했습니다.") };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// getMySeat — 현재 사용 중인 좌석 정보
// ─────────────────────────────────────────────────────────────
export async function getMySeat(): Promise<SeatActionResult<MySeatData>> {
  if (Platform.OS === "web") return webUnsupported("웹 환경에서는 지원하지 않습니다.");
  try {
    const raw = await withSessionCheck(
      () => pyxisRequest("GET", "/api/my-seat"),
      "세션이 만료되었습니다. 다시 로그인해 주세요."
    );
    if (raw.needsLogin) return { success: false, message: raw.message!, needsLogin: true };
    if (raw.success) return { success: true, message: "좌석 정보를 불러왔습니다.", data: raw.data ?? null };
    return { success: false, message: raw.message || fallback(raw.code, "좌석 정보를 불러올 수 없습니다.") };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// getSeatRoomSeats — 열람실 내 개별 좌석 목록
// seatRoomId: reading-rooms 화면의 SeatRoom.id
// ─────────────────────────────────────────────────────────────
export async function getSeatRoomSeats(seatRoomId: number): Promise<SeatActionResult<IndividualSeat[]>> {
  if (Platform.OS === "web") return webUnsupported("웹 환경에서는 지원하지 않습니다.");
  try {
    const headers = await buildAuthHeaders() as Record<string, string>;
    const res = await fetch(
      `${PYXIS_BASE}/1/seat-room-seats?seatRoomId=${seatRoomId}&homepageId=1`,
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
    const raw: PyxisBody = await res.json();

    if (!raw.success) {
      const isExpired = SESSION_EXPIRED_CODES.has(raw.code ?? "");
      return {
        success: false,
        message: isExpired ? "세션이 만료되었습니다. 다시 로그인해 주세요." : (raw.message || "좌석 정보를 불러올 수 없습니다."),
        needsLogin: isExpired,
      };
    }
    return { success: true, message: "좌석 목록을 불러왔습니다.", data: raw.data?.list ?? [] };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}
