import { useState } from "react";

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

const STORAGE_KEY = "campus_life_profile";

const DEFAULT_PROFILE: UserProfile = {
  name: "홍길동",
  department: "산업공학과",
  major: "산업공학전공",
  studentId: "202312345",
  grade: "1",
  doubleMajor: "",
  minor: "",
  avatarColor: "#00427D",
};

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveProfile(profile: UserProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updates };
      saveProfile(next);
      return next;
    });
  };

  return { profile, updateProfile };
}

export { DEFAULT_PROFILE };
