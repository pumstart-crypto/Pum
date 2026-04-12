/**
 * studySessions.ts
 * 학습 세션 기록 (좌석 반납/취소 시 저장) 및 통계 조회.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pium_study_sessions';
const MAX_RECORDS = 200;

export interface StudySession {
  id: string;
  date: string;           // YYYY-MM-DD
  startTime: string;      // HH:mm
  endTime: string;        // HH:mm
  durationMinutes: number;
  roomName: string;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function dayOfWeekShort(dateStr: string) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

async function readAll(): Promise<StudySession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StudySession[];
  } catch {
    return [];
  }
}

/** 좌석 반납/취소 시 호출 — 세션을 기록합니다 */
export async function recordStudySession(
  session: Omit<StudySession, 'id'>
): Promise<void> {
  try {
    const sessions = await readAll();
    const newSession: StudySession = { ...session, id: `${Date.now()}` };
    const updated = [newSession, ...sessions].slice(0, MAX_RECORDS);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {}
}

/** 전체 세션 목록 */
export async function getStudySessions(): Promise<StudySession[]> {
  return readAll();
}

/** 오늘 총 학습 시간(분) */
export async function getTodayMinutes(): Promise<number> {
  const today = todayStr();
  const sessions = await readAll();
  return sessions
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

/** 이번 주(최근 7일) 총 학습 시간(분) */
export async function getWeekMinutes(): Promise<number> {
  const sessions = await readAll();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return sessions
    .filter(s => new Date(s.date + 'T00:00:00').getTime() >= cutoff)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

/** 최근 7일 바 차트 데이터 */
export async function getWeeklyBarData(): Promise<
  { date: string; label: string; dayLabel: string; minutes: number }[]
> {
  const sessions = await readAll();
  const result: { date: string; label: string; dayLabel: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const minutes = sessions
      .filter(s => s.date === dateStr)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    result.push({
      date: dateStr,
      label: dateLabel(dateStr),
      dayLabel: dayOfWeekShort(dateStr),
      minutes,
    });
  }
  return result;
}

/** HH:mm 문자열 → Date 변환 (오늘 날짜 기준) */
export function parseTimeToday(timeStr: string | null | undefined): Date | null {
  if (!timeStr) return null;
  const m = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

/** 학습 시간(분)을 "Xh Ym" 포맷으로 변환 */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0분';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}
