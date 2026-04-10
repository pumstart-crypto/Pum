// 🔧 DEBUG: 테스트용 시간 고정 (null 로 바꾸면 실제 시간으로 복구)
export const DEBUG_NOW: Date | null = new Date('2026-04-09T13:00:00');

export function getNow(): Date {
  return DEBUG_NOW ? new Date(DEBUG_NOW) : new Date();
}

export function getTodayStr(): string {
  const now = getNow();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
