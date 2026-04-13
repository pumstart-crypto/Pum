/**
 * seatManagement.ts
 *
 * 도서관 좌석 예약 · 연장 · 반납 · 이석 · 내역 · 제한현황.
 *
 * [아키텍처] — 하이브리드 프록시 방식
 * 1. 기기에서 Pyxis에 직접 로그인 (한국 IP) → 쿠키 취득
 * 2. 쿠키를 API 서버 DB에 등록 → 앱 토큰(Bearer) 발급
 * 3. 이후 모든 인증 API는 앱 토큰으로 API 서버 호출
 * 4. API 서버가 저장된 쿠키를 사용하여 Pyxis에 요청을 프록시
 * → iOS에서 수동 Cookie 헤더가 무시되는 문제 완벽 우회
 */

import { Platform } from "react-native";
import { getLibPyxisToken, getLibJsessionId } from "./schoolAuth";

// 기기에서 Pyxis 직접 호출
// - iOS NSURLSession이 JSESSIONID 쿠키 자동 처리 (로그인 시 저장됨)
// - Authorization: Bearer 헤더만 명시적으로 설정
const PYXIS_DIRECT = "https://lib.pusan.ac.kr/pyxis-api";

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
  needsLogin?: boolean;
}

export interface MySeatData {
  id: number | null;
  seat?: {
    id: number; name: string; code?: string;
    seatRoom?: {
      id: number; name: string;
      branch?: { id: number; name: string; alias?: string };
    };
  } | null;
  seatRoom?: {
    id: number; name: string;
    branch?: { id: number; name: string; alias?: string };
  } | null;
  seatId?: number | null;
  seatName?: string | null;
  roomName?: string | null;
  branchName?: string | null;
  startTime: string | null;
  endTime: string | null;
  extendableTime?: string | null;
  temporaryEndTime?: string | null;
  state: { code: string; name: string } | null;
}

export interface IndividualSeat {
  id: number;
  name: string;
  code: string;
  status: { code: string; name: string };
  isMine: boolean;
  /** Pyxis 좌석 그리드 열 위치 (0-based) */
  x?: number;
  /** Pyxis 좌석 그리드 행 위치 (0-based) */
  y?: number;
}

export interface SeatHistoryItem {
  id: number;
  seatName: string | null;
  roomName: string | null;
  branchName: string | null;
  startTime: string | null;
  endTime: string | null;
  usageMinutes: number | null;
  date: string | null;
}

export interface SeatViolation {
  id: number;
  violationType: string | null;
  restrictedUntil: string | null;
  description: string | null;
  createdAt: string | null;
}

export interface AwayStatus {
  isAway: boolean;
  awayStartTime: string | null;
  awayDeadline: string | null;
}

// ── 추출 헬퍼 ─────────────────────────────────────────────────

export function extractSeatName(data: MySeatData | null): string | null {
  if (!data) return null;
  return data.seat?.name ?? data.seatName ?? null;
}

export function extractRoomName(data: MySeatData | null): string | null {
  if (!data) return null;
  return data.seat?.seatRoom?.name ?? data.seatRoom?.name ?? data.roomName ?? null;
}

export function extractBranchName(data: MySeatData | null): string | null {
  if (!data) return null;
  return (
    data.seat?.seatRoom?.branch?.name ??
    data.seatRoom?.branch?.name ??
    data.branchName ??
    null
  );
}

export function extractRoomId(data: MySeatData | null): number | null {
  if (!data) return null;
  return data.seat?.seatRoom?.id ?? data.seatRoom?.id ?? null;
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────

function webUnsupported<T>(): SeatActionResult<T> {
  return { success: false, message: "웹 환경에서는 지원하지 않습니다." };
}

interface PyxisBody {
  success: boolean;
  code?: string;
  message?: string;
  data?: any;
}

function checkSessionExpired<T = unknown>(raw: PyxisBody): SeatActionResult<T> | null {
  if (!raw.success && SESSION_EXPIRED_CODES.has(raw.code ?? "")) {
    return { success: false, message: "세션이 만료되었습니다. 다시 로그인해 주세요.", needsLogin: true };
  }
  return null;
}

const FALLBACK: Record<string, string> = {
  "error.seat.alreadyReserved":    "이미 예약된 좌석입니다.",
  "error.seat.alreadyUsing":       "이미 사용 중인 좌석이 있습니다.",
  "error.seat.notFound":           "존재하지 않는 좌석입니다.",
  "error.seat.unavailable":        "현재 이용 불가능한 좌석입니다.",
  "error.mySeat.notFound":         "현재 사용 중인 좌석이 없습니다.",
  "error.mySeat.cannotExtend":     "연장 가능한 시간이 아닙니다.",
  "error.mySeat.alreadyExtended":  "이미 연장된 좌석입니다.",
  "error.mySeat.away.alreadyAway": "이미 이석 처리된 상태입니다.",
  "error.mySeat.away.notAway":     "이석 상태가 아닙니다.",
  "error.mySeat.away.expired":     "이석 가능 시간이 초과되었습니다.",
};

function fb(code: string | undefined, def: string): string {
  return FALLBACK[code ?? ""] ?? def;
}

function noSession(): SeatActionResult<any> {
  return { success: false, message: "로그인이 필요합니다.", needsLogin: true };
}

/** Pyxis 직접 호출 공통 헤더
 * - Authorization: Bearer (명시적)
 * - Cookie: JSESSIONID + PUSAN_PYXIS3 (XHR로 추출해 SecureStore에 저장된 값)
 * - React Native XHR/fetch는 브라우저와 달리 Cookie 헤더를 직접 설정 가능 */
async function pyxisHeaders(token: string): Promise<HeadersInit> {
  const jsessionid = await getLibJsessionId();
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
    "Origin": "https://lib.pusan.ac.kr",
    "Referer": "https://lib.pusan.ac.kr/facility/seat",
  };
  if (jsessionid) {
    headers["Cookie"] = `JSESSIONID=${jsessionid}; PUSAN_PYXIS3=${token}`;
  }
  return headers;
}

/** Pyxis GET (기기 직접) — 타임아웃 15초 */
async function pyxisGet(path: string, token: string): Promise<PyxisBody> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${PYXIS_DIRECT}${path}`, {
      signal: controller.signal,
      headers: await pyxisHeaders(token),
    });
    return res.json();
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** Pyxis POST (기기 직접) — 타임아웃 15초 */
async function pyxisPost(path: string, token: string, body?: object): Promise<PyxisBody> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const h = await pyxisHeaders(token);
    const res = await fetch(`${PYXIS_DIRECT}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: { ...h as Record<string, string>, "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    return res.json();
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** Pyxis DELETE (기기 직접) — 타임아웃 15초 */
async function pyxisDelete(path: string, token: string): Promise<PyxisBody> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${PYXIS_DIRECT}${path}`, {
      method: "DELETE",
      signal: controller.signal,
      headers: await pyxisHeaders(token),
    });
    return res.json();
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// ─────────────────────────────────────────────────────────────
// getMySeat — 현재 사용 중인 좌석 정보
// ─────────────────────────────────────────────────────────────
export async function getMySeat(): Promise<SeatActionResult<MySeatData>> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibPyxisToken();
    if (!token) return noSession();
    const raw = await pyxisGet("/api/my-seat", token);
    const expired = checkSessionExpired<MySeatData>(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: "좌석 정보를 불러왔습니다.", data: raw.data ?? undefined };
    const code = raw.code ?? "";
    if (code === "error.mySeat.notFound") {
      return { success: true, message: "현재 예약된 좌석이 없습니다.", data: undefined };
    }
    return { success: false, message: raw.message || fb(code, "좌석 정보를 불러올 수 없습니다.") };
  } catch (e: any) {
    if (e?.message === "timeout") return { success: false, message: "서버 응답 시간이 초과되었습니다." };
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// reserveSeat — 좌석 예약
// ─────────────────────────────────────────────────────────────
export async function reserveSeat(seatId: number): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibPyxisToken();
    if (!token) return noSession();
    const raw = await pyxisPost("/api/my-seat", token, { seatId });
    const expired = checkSessionExpired(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "좌석 예약이 완료되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fb(raw.code, "좌석 예약에 실패했습니다.") };
  } catch (e: any) {
    if (e?.message === "timeout") return { success: false, message: "서버 응답 시간이 초과되었습니다." };
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// extendSeat — 이용 시간 연장
// ─────────────────────────────────────────────────────────────
export async function extendSeat(): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibPyxisToken();
    if (!token) return noSession();
    const raw = await pyxisPost("/api/my-seat/extend", token);
    const expired = checkSessionExpired(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "이용 시간이 연장되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fb(raw.code, "좌석 연장에 실패했습니다.") };
  } catch (e: any) {
    if (e?.message === "timeout") return { success: false, message: "서버 응답 시간이 초과되었습니다." };
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// returnSeat — 좌석 반납
// ─────────────────────────────────────────────────────────────
export async function returnSeat(): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibPyxisToken();
    if (!token) return noSession();
    const raw = await pyxisPost("/api/my-seat/return", token);
    const expired = checkSessionExpired(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "좌석이 반납되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fb(raw.code, "좌석 반납에 실패했습니다.") };
  } catch (e: any) {
    if (e?.message === "timeout") return { success: false, message: "서버 응답 시간이 초과되었습니다." };
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// cancelSeat — 예약 취소 (배정확정 전)
// ─────────────────────────────────────────────────────────────
export async function cancelSeat(): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibPyxisToken();
    if (!token) return noSession();
    const raw = await pyxisDelete("/api/my-seat", token);
    const expired = checkSessionExpired(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "예약이 취소되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fb(raw.code, "예약 취소에 실패했습니다.") };
  } catch (e: any) {
    if (e?.message === "timeout") return { success: false, message: "서버 응답 시간이 초과되었습니다." };
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// getSeatRoomSeats — 열람실 내 개별 좌석 목록
//
// Pyxis /1/api/ 엔드포인트: JSESSIONID(자동 쿠키) + Bearer 토큰 필요
// → 기기 직접 호출 (iOS HTTPCookieStorage가 JSESSIONID 자동 첨부)
// ─────────────────────────────────────────────────────────────
export async function getSeatRoomSeats(seatRoomId: number): Promise<SeatActionResult<IndividualSeat[]>> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibPyxisToken();
    if (!token) return noSession();

    let raw: PyxisBody;
    try {
      raw = await pyxisGet(`/1/api/seat-room-seats?seatRoomId=${seatRoomId}&homepageId=1`, token);
    } catch (e: any) {
      if (e?.message === "timeout") {
        return { success: false, message: "도서관 서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요." };
      }
      throw e;
    }

    console.log(`[getSeatRoomSeats] roomId=${seatRoomId} success=${raw.success} code=${raw.code ?? ""} msg=${raw.message ?? ""}`);

    if (!raw.success) {
      const expired = checkSessionExpired(raw);
      if (expired) return expired as SeatActionResult<IndividualSeat[]>;
      return { success: false, message: raw.message || "좌석 정보를 불러올 수 없습니다." };
    }

    // Pyxis 응답 포맷: { data: { list: [...] } } 또는 { data: [...] } 모두 처리
    const rawList: any[] = Array.isArray(raw.data?.list)
      ? raw.data.list
      : Array.isArray(raw.data)
      ? raw.data
      : [];

    const list: IndividualSeat[] = rawList.map((s: any) => ({
      id: s.id,
      name: s.name ?? "",
      code: s.code ?? s.name ?? "",
      status: s.status ?? { code: "", name: "" },
      isMine: s.isMine ?? false,
      x: typeof s.x === "number" ? s.x
        : typeof s.col === "number" ? s.col
        : typeof s.column === "number" ? s.column
        : typeof s.xpos === "number" ? s.xpos
        : undefined,
      y: typeof s.y === "number" ? s.y
        : typeof s.row === "number" ? s.row
        : typeof s.ypos === "number" ? s.ypos
        : undefined,
    }));
    return { success: true, message: "좌석 목록을 불러왔습니다.", data: list };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// setAway — 이석 처리
// ─────────────────────────────────────────────────────────────
export async function setAway(): Promise<SeatActionResult<AwayStatus>> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibPyxisToken();
    if (!token) return noSession();
    const raw = await pyxisPost("/api/my-seat/away", token);
    const expired = checkSessionExpired<AwayStatus>(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "이석 처리되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fb(raw.code, "이석 처리에 실패했습니다.") };
  } catch (e: any) {
    if (e?.message === "timeout") return { success: false, message: "서버 응답 시간이 초과되었습니다." };
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// returnFromAway — 이석 복귀
// ─────────────────────────────────────────────────────────────
export async function returnFromAway(): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibPyxisToken();
    if (!token) return noSession();
    const raw = await pyxisDelete("/api/my-seat/away", token);
    const expired = checkSessionExpired(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "이석 복귀 처리되었습니다." };
    return { success: false, message: raw.message || fb(raw.code, "이석 복귀에 실패했습니다.") };
  } catch (e: any) {
    if (e?.message === "timeout") return { success: false, message: "서버 응답 시간이 초과되었습니다." };
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// getMySeatHistories — 좌석 이용 내역
// ─────────────────────────────────────────────────────────────
export async function getMySeatHistories(): Promise<SeatActionResult<SeatHistoryItem[]>> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibPyxisToken();
    if (!token) return noSession();
    const raw = await pyxisGet("/api/my-seat/histories", token);
    const expired = checkSessionExpired<SeatHistoryItem[]>(raw);
    if (expired) return expired;
    if (raw.success) {
      const list: SeatHistoryItem[] = (raw.data?.list ?? raw.data ?? []).map((item: any) => ({
        id: item.id,
        seatName: item.seat?.name ?? item.seatName ?? null,
        roomName: item.seat?.seatRoom?.name ?? item.seatRoom?.name ?? item.roomName ?? null,
        branchName: item.seat?.seatRoom?.branch?.name ?? item.branchName ?? null,
        startTime: item.startTime ?? null,
        endTime: item.endTime ?? null,
        usageMinutes: item.usageMinutes ?? null,
        date: item.date ?? null,
      }));
      return { success: true, message: "이용 내역을 불러왔습니다.", data: list };
    }
    return { success: false, message: raw.message || "이용 내역을 불러올 수 없습니다." };
  } catch (e: any) {
    if (e?.message === "timeout") return { success: false, message: "서버 응답 시간이 초과되었습니다." };
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// getMySeatViolations — 이용 제한 현황
// ─────────────────────────────────────────────────────────────
export async function getMySeatViolations(): Promise<SeatActionResult<SeatViolation[]>> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibPyxisToken();
    if (!token) return noSession();
    const raw = await pyxisGet("/api/my-seat/violations", token);
    const expired = checkSessionExpired<SeatViolation[]>(raw);
    if (expired) return expired;
    if (raw.success) {
      const list: SeatViolation[] = (raw.data?.list ?? raw.data ?? []).map((item: any) => ({
        id: item.id,
        violationType: item.violationType ?? item.type ?? null,
        restrictedUntil: item.restrictedUntil ?? item.endDate ?? null,
        description: item.description ?? item.reason ?? null,
        createdAt: item.createdAt ?? item.date ?? null,
      }));
      return { success: true, message: "이용 제한 현황을 불러왔습니다.", data: list };
    }
    return { success: false, message: raw.message || "이용 제한 현황을 불러올 수 없습니다." };
  } catch (e: any) {
    if (e?.message === "timeout") return { success: false, message: "서버 응답 시간이 초과되었습니다." };
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}
