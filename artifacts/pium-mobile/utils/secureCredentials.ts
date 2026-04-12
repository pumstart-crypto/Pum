/**
 * secureCredentials.ts
 *
 * 학교 포털 학번·비밀번호를 기기 내부 보안 저장소에 암호화하여 보관합니다.
 *
 * ┌─ 플랫폼별 저장 방식 ────────────────────────────────────────┐
 * │  iOS     → Keychain Services  (AES-256 + Secure Enclave)  │
 * │  Android → EncryptedSharedPreferences (AES-256-GCM)       │
 * │  Web     → 보안 저장소 미지원 — 기능 비활성화              │
 * └───────────────────────────────────────────────────────────┘
 *
 * ⚠️  이 파일에서 다루는 자격 증명은 절대 외부 네트워크로
 *      전송되거나 서버/DB에 기록되지 않습니다.
 *      오직 현재 기기의 보안 저장소에만 기록됩니다.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// ── 저장 키 상수 ──────────────────────────────────────────────
const KEY_SCHOOL_ID = "pium_school_id";
const KEY_SCHOOL_PW = "pium_school_pw";

// ── 저장 옵션 ─────────────────────────────────────────────────
// keychainAccessible: 기기 잠금 해제 후에만 접근 가능 (기본값 중 가장 엄격한 수준)
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

// ── 타입 정의 ─────────────────────────────────────────────────
export interface SchoolCredentials {
  id: string;
  password: string;
}

// ── 플랫폼 가드 ───────────────────────────────────────────────
function assertNative(fnName: string): void {
  if (Platform.OS === "web") {
    console.warn(
      `[secureCredentials] ${fnName}(): 웹 플랫폼은 보안 저장소를 지원하지 않아 동작하지 않습니다.`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// saveSchoolCredentials
// 학번(id)과 비밀번호(password)를 기기 보안 저장소에 저장합니다.
// 이미 값이 있으면 덮어씁니다.
// ─────────────────────────────────────────────────────────────
export async function saveSchoolCredentials(
  id: string,
  password: string
): Promise<void> {
  assertNative("saveSchoolCredentials");
  if (Platform.OS === "web") return;

  if (!id || !password) {
    throw new Error("학번과 비밀번호는 비어 있을 수 없습니다.");
  }

  await Promise.all([
    SecureStore.setItemAsync(KEY_SCHOOL_ID, id, STORE_OPTIONS),
    SecureStore.setItemAsync(KEY_SCHOOL_PW, password, STORE_OPTIONS),
  ]);
}

// ─────────────────────────────────────────────────────────────
// getSchoolCredentials
// 저장된 학번과 비밀번호를 불러옵니다.
// 저장된 값이 없으면 null을 반환합니다.
// ─────────────────────────────────────────────────────────────
export async function getSchoolCredentials(): Promise<SchoolCredentials | null> {
  assertNative("getSchoolCredentials");
  if (Platform.OS === "web") return null;

  const [id, password] = await Promise.all([
    SecureStore.getItemAsync(KEY_SCHOOL_ID, STORE_OPTIONS),
    SecureStore.getItemAsync(KEY_SCHOOL_PW, STORE_OPTIONS),
  ]);

  if (!id || !password) return null;

  return { id, password };
}

// ─────────────────────────────────────────────────────────────
// clearSchoolCredentials
// 저장된 학번과 비밀번호를 기기 보안 저장소에서 영구 삭제합니다.
// ─────────────────────────────────────────────────────────────
export async function clearSchoolCredentials(): Promise<void> {
  assertNative("clearSchoolCredentials");
  if (Platform.OS === "web") return;

  await Promise.all([
    SecureStore.deleteItemAsync(KEY_SCHOOL_ID, STORE_OPTIONS),
    SecureStore.deleteItemAsync(KEY_SCHOOL_PW, STORE_OPTIONS),
  ]);
}
