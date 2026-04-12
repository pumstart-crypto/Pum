/**
 * favoriteSeat.ts
 * 마지막으로 예약한 좌석을 로컬에 저장하여 빠른 재예약에 활용합니다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pium_favorite_seat';

export interface FavoriteSeat {
  seatId: number;
  seatName: string;
  roomId: number;
  roomName: string;
  branchName: string;
  savedAt: number;
}

export async function saveFavoriteSeat(seat: Omit<FavoriteSeat, 'savedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...seat, savedAt: Date.now() }));
  } catch {}
}

export async function getFavoriteSeat(): Promise<FavoriteSeat | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FavoriteSeat;
  } catch {
    return null;
  }
}

export async function clearFavoriteSeat(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}
