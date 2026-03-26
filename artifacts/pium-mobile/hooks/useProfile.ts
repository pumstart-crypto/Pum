import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'campus_life_profile';

export interface UserProfile {
  name: string;
  department: string;
  major: string;
  studentId: string;
  grade: string;
  doubleMajor: string;
  minor: string;
  avatarColor: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  department: '',
  major: '',
  studentId: '',
  grade: '1',
  doubleMajor: '',
  minor: '',
  avatarColor: '#00427D',
};

export async function loadProfileAsync(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfileAsync(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function useProfile(initial: UserProfile = DEFAULT_PROFILE) {
  const [profile, setProfile] = useState<UserProfile>(initial);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates };
      saveProfileAsync(next);
      return next;
    });
  }, []);

  return { profile, setProfile, updateProfile };
}
