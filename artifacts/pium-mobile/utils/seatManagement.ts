/**
 * seatManagement.ts
 *
 * 도서관 좌석 예약 · 연장 · 반납 · 이석 · 내역 · 제한현황.
 *
 * [아키텍처]
 * 모든 Pyxis 인증 요청은 API 서버(pium api-server)를 경유합니다.
 * 이유: Pyxis 세션(JSESSIONID)이 접속 IP에 바인딩되므로,
 *       로그인한 IP(API 서버)와 이후 요청 IP(모바일 기기)가 다르면
 *       서버가 세션을 즉시 무효화합니다.
 *       → 로그인과 모든 후속 요청을 동일한 API 서버 IP로 통일합니다.
 *
 * 세션 만료 시 needsLogin: true 를 반환합니다.
 */

import { Platform } from "react-native";
import { getJsessionid } from "./schoolAuth";

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

/** 좌석 번호 추출 */
export function extractSeatName(data: MySeatData | null): string | null {
  if (!data) return null;
  return data.seat?.name ?? data.seatName ?? null;
}

/** 열람실 이름 추출 */
export function extractRoomName(data: MySeatData | null): string | null {
  if (!data) return null;
  return data.seat?.seatRoom?.name ?? data.seatRoom?.name ?? data.roomName ?? null;
}

/** 도서관(지점) 이름 추출 */
export function extractBranchName(data: MySeatData | null): string | null {
  if (!data) return null;
  return (
    data.seat?.seatRoom?.branch?.name ??
    data.seatRoom?.branch?.name ??
    data.branchName ??
    null
  );
}

/** seatRoom ID 추출 */
export function extractRoomId(data: MySeatData | null): number | null {
  if (!data) return null;
  return data.seat?.seatRoom?.id ?? data.seatRoom?.id ?? null;
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : "";
}

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

/** API 서버 경유 GET */
async function apiGet(path: string, jsessionid: string): Promise<PyxisBody> {
  const url = `${getApiBase()}${path}?jsessionid=${encodeURIComponent(jsessionid)}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  return res.json();
}

/** API 서버 경유 POST (jsessionid를 body에 포함) */
async function apiPost(path: string, jsessionid: string, extra?: object): Promise<PyxisBody> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ jsessionid, ...extra }),
  });
  return res.json();
}

/** API 서버 경유 DELETE */
async function apiDelete(path: string, jsessionid: string): Promise<PyxisBody> {
  const url = `${getApiBase()}${path}?jsessionid=${encodeURIComponent(jsessionid)}`;
  const res = await fetch(url, { method: "DELETE", headers: { "Accept": "application/json" } });
  return res.json();
}

/** JSESSIONID 가져오기 (없으면 needsLogin) */
async function resolveJsessionid(): Promise<string | null> {
  return getJsessionid();
}

function noSession(): SeatActionResult<any> {
  return { success: false, message: "로그인이 필요합니다.", needsLogin: true };
}

function webUnsupportedTyped<T>(): SeatActionResult<T> {
  return { success: false, message: "웹 환경에서는 지원하지 않습니다." };
}

// ─────────────────────────────────────────────────────────────
// getMySeat — 현재 사용 중인 좌석 정보
// ─────────────────────────────────────────────────────────────
export async function getMySeat(): Promise<SeatActionResult<MySeatData>> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const jsessionid = await resolveJsessionid();
    if (!jsessionid) return noSession();

    const raw = await apiGet("/library/my-seat", jsessionid);
    const expired = checkSessionExpired<MySeatData>(raw);
    if (expired) return expired;
    if (raw.success) return { success: true, message: "좌석 정보를 불러왔습니다.", data: raw.data ?? null };
    return { success: false, message: raw.message || fb(raw.code, "좌석 정보를 불러올 수 없습니다.") };
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
    const jsessionid = await resolveJsessionid();
    if (!jsessionid) return noSession();

    const raw = await apiPost("/library/my-seat", jsessionid, { seatId });
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
    const jsessionid = await resolveJsessionid();
    if (!jsessionid) return noSession();

    const raw = await apiPost("/library/my-seat/extend", jsessionid);
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
    const jsessionid = await resolveJsessionid();
    if (!jsessionid) return noSession();

    const raw = await apiPost("/library/my-seat/return", jsessionid);
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
    const jsessionid = await resolveJsessionid();
    if (!jsessionid) return noSession();

    const raw = await apiDelete("/library/my-seat", jsessionid);
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
// ─────────────────────────────────────────────────────────────
export async function getSeatRoomSeats(seatRoomId: number): Promise<SeatActionResult<IndividualSeat[]>> {
  if (Platform.OS === "web") return webUnsupported();
  try {
    const jsessionid = await resolveJsessionid();
    const apiBase = getApiBase();
    const url = jsessionid
      ? `${apiBase}/library/seat-room-seats?seatRoomId=${seatRoomId}&jsessionid=${encodeURIComponent(jsessionid)}`
      : `${apiBase}/library/seat-room-seats?seatRoomId=${seatRoomId}`;

    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const raw: PyxisBody = await res.json();

    if (!raw.success) {
      const expired = checkSessionExpired(raw);
      if (expired) return expired as SeatActionResult<IndividualSeat[]>;
      return { success: false, message: raw.message || "좌석 정보를 불러올 수 없습니다." };
    }
    return { success: true, message: "좌석 목록을 불러왔습니다.", data: raw.data?.list ?? [] };
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
    const jsessionid = await resolveJsessionid();
    if (!jsessionid) return noSession();

    const raw = await apiPost("/library/my-seat/away", jsessionid);
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
    const jsessionid = await resolveJsessionid();
    if (!jsessionid) return noSession();

    const raw = await apiDelete("/library/my-seat/away", jsessionid);
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
    const jsessionid = await resolveJsessionid();
    if (!jsessionid) return noSession();

    const raw = await apiGet("/library/my-seat/histories", jsessionid);
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
    const jsessionid = await resolveJsessionid();
    if (!jsessionid) return noSession();

    const raw = await apiGet("/library/my-seat/violations", jsessionid);
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
