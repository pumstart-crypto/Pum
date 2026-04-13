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
import { getLibApiToken, getLibPyxisToken } from "./schoolAuth";

// Pyxis 직접 호출 (기기 IP = 한국 IP, Cookie 불필요)
const PYXIS_DIRECT = "https://lib.pusan.ac.kr/pyxis-api";

// 모든 인증 API 호출은 API 서버를 경유합니다.
const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

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

/** API 서버 인증 헤더 */
function apiHeaders(token: string): HeadersInit {
  return {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}

/** API 서버 GET */
async function apiGet(path: string, token: string): Promise<PyxisBody> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Accept": "application/json", "Authorization": `Bearer ${token}` },
  });
  return res.json();
}

/** API 서버 POST */
async function apiPost(path: string, token: string, body?: object): Promise<PyxisBody> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: apiHeaders(token),
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

/** API 서버 DELETE */
async function apiDelete(path: string, token: string): Promise<PyxisBody> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { "Accept": "application/json", "Authorization": `Bearer ${token}` },
  });
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// getMySeat — 현재 사용 중인 좌석 정보
// ─────────────────────────────────────────────────────────────
export async function getMySeat(): Promise<SeatActionResult<MySeatData>> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibApiToken();
    if (!token) return noSession();
    const raw = await apiGet("/library/my-seat", token);
    const expired = checkSessionExpired<MySeatData>(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: "좌석 정보를 불러왔습니다.", data: raw.data ?? undefined };
    const code = raw.code ?? "";
    if (code === "error.mySeat.notFound") {
      return { success: true, message: "현재 예약된 좌석이 없습니다.", data: undefined };
    }
    return { success: false, message: raw.message || fb(code, "좌석 정보를 불러올 수 없습니다.") };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// reserveSeat — 좌석 예약
// ─────────────────────────────────────────────────────────────
export async function reserveSeat(seatId: number): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibApiToken();
    if (!token) return noSession();
    const raw = await apiPost("/library/my-seat", token, { seatId });
    const expired = checkSessionExpired(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "좌석 예약이 완료되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fb(raw.code, "좌석 예약에 실패했습니다.") };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// extendSeat — 이용 시간 연장
// ─────────────────────────────────────────────────────────────
export async function extendSeat(): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibApiToken();
    if (!token) return noSession();
    const raw = await apiPost("/library/my-seat/extend", token);
    const expired = checkSessionExpired(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "이용 시간이 연장되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fb(raw.code, "좌석 연장에 실패했습니다.") };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// returnSeat — 좌석 반납
// ─────────────────────────────────────────────────────────────
export async function returnSeat(): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibApiToken();
    if (!token) return noSession();
    const raw = await apiPost("/library/my-seat/return", token);
    const expired = checkSessionExpired(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "좌석이 반납되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fb(raw.code, "좌석 반납에 실패했습니다.") };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// cancelSeat — 예약 취소 (배정확정 전)
// ─────────────────────────────────────────────────────────────
export async function cancelSeat(): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibApiToken();
    if (!token) return noSession();
    const raw = await apiDelete("/library/my-seat", token);
    const expired = checkSessionExpired(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "예약이 취소되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fb(raw.code, "예약 취소에 실패했습니다.") };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// getSeatRoomSeats — 열람실 내 개별 좌석 목록
//
// ★ Pyxis /1/api/ 엔드포인트는 서버 IP(해외 IP)에서는 항상 needsLogin 반환.
//   → 기기(한국 IP)에서 직접 호출 + Authorization: Bearer 헤더만 사용.
//   → iOS는 Cookie 헤더만 차단하고 Authorization 헤더는 허용.
// ─────────────────────────────────────────────────────────────
export async function getSeatRoomSeats(seatRoomId: number): Promise<SeatActionResult<IndividualSeat[]>> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const pyxisToken = await getLibPyxisToken();
    const apiToken = await getLibApiToken();

    if (!pyxisToken && !apiToken) return noSession();

    let raw: PyxisBody;

    if (pyxisToken) {
      // 기기에서 Pyxis에 직접 GET (한국 IP 보장, Bearer 헤더만 사용)
      // 10초 타임아웃
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const resp = await fetch(
          `${PYXIS_DIRECT}/1/api/seat-room-seats?seatRoomId=${seatRoomId}&homepageId=1`,
          {
            signal: controller.signal,
            headers: {
              "Accept": "application/json",
              "Authorization": `Bearer ${pyxisToken}`,
              "Referer": "https://lib.pusan.ac.kr/facility/seat",
              "Origin": "https://lib.pusan.ac.kr",
            },
          }
        );
        raw = await resp.json();
      } catch (fetchErr: any) {
        if (fetchErr?.name === "AbortError") {
          return { success: false, message: "도서관 서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요." };
        }
        throw fetchErr;
      } finally {
        clearTimeout(timeout);
      }
    } else {
      // pyxisToken 없음 → API 서버 경유 fallback (미국 IP라 needsLogin 가능성 있음)
      const resp = await fetch(
        `${API_BASE}/library/seat-room-seats?seatRoomId=${seatRoomId}`,
        { headers: { "Accept": "application/json", "Authorization": `Bearer ${apiToken}` } }
      );
      raw = await resp.json();
    }

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
    const token = await getLibApiToken();
    if (!token) return noSession();
    const raw = await apiPost("/library/my-seat/away", token);
    const expired = checkSessionExpired<AwayStatus>(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "이석 처리되었습니다.", data: raw.data };
    return { success: false, message: raw.message || fb(raw.code, "이석 처리에 실패했습니다.") };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// returnFromAway — 이석 복귀
// ─────────────────────────────────────────────────────────────
export async function returnFromAway(): Promise<SeatActionResult> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibApiToken();
    if (!token) return noSession();
    const raw = await apiDelete("/library/my-seat/away", token);
    const expired = checkSessionExpired(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: raw.message ?? "이석 복귀 처리되었습니다." };
    return { success: false, message: raw.message || fb(raw.code, "이석 복귀에 실패했습니다.") };
  } catch (e: any) {
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// getMySeatHistories — 좌석 이용 내역
// ─────────────────────────────────────────────────────────────
export async function getMySeatHistories(): Promise<SeatActionResult<SeatHistoryItem[]>> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibApiToken();
    if (!token) return noSession();
    const raw = await apiGet("/library/my-seat/histories", token);
    const expired = checkSessionExpired<SeatHistoryItem[]>(raw);
    if (expired) return expired;
    if (raw.success) {
      const list: SeatHistoryItem[] = (raw.data?.list ?? []).map((item: any) => ({
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
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}

// ─────────────────────────────────────────────────────────────
// getMySeatViolations — 이용 제한 현황
// ─────────────────────────────────────────────────────────────
export async function getMySeatViolations(): Promise<SeatActionResult<SeatViolation[]>> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const token = await getLibApiToken();
    if (!token) return noSession();
    const raw = await apiGet("/library/my-seat/violations", token);
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
    return { success: false, message: `네트워크 오류: ${e?.message ?? "알 수 없는 오류"}` };
  }
}
