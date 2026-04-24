import { Router, type IRouter } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { db, usersTable, sessionsTable, communityPostsTable, communityCommentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken, verifyToken, generateOTP } from "../lib/auth";
import { sendVerificationEmail } from "../lib/email";
import { extractStudentIdInfo } from "../lib/ocr";
import { z } from "zod";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  const masked = local.length > 3 ? `${local.slice(0, 2)}***${local.slice(-1)}` : "***";
  return `${masked}@${domain}`;
}

// ── 인메모리 이메일 인증 저장소 ────────────────────────────────
// 회원가입용: email → { code, expiresAt, verified }
const emailVerifStore = new Map<string, { code: string; expiresAt: number; verified: boolean }>();
// 복구용 (아이디/비밀번호 찾기): email → { code, expiresAt }
const recoveryStore = new Map<string, { code: string; expiresAt: number }>();

// 비밀번호 재설정 토큰 (10분 유효)
const resetTokens = new Map<string, { userId: number; expiresAt: number }>();

// 주기적 정리 (매 시간)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of emailVerifStore.entries()) { if (now > v.expiresAt) emailVerifStore.delete(k); }
  for (const [k, v] of recoveryStore.entries()) { if (now > v.expiresAt) recoveryStore.delete(k); }
  for (const [k, v] of resetTokens.entries()) { if (now > v.expiresAt) resetTokens.delete(k); }
}, 60 * 60 * 1000);

// ── IP 기반 이메일 발송 제한 (IP당 하루 5회) ─────────────────
const SEND_LIMIT_PER_DAY = 5;
const sendIpMap = new Map<string, { count: number; resetAt: number }>();

function checkIpSendLimit(ip: string): { allowed: boolean } {
  const now = Date.now();
  const entry = sendIpMap.get(ip);
  if (!entry || now > entry.resetAt) {
    sendIpMap.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return { allowed: true };
  }
  if (entry.count >= SEND_LIMIT_PER_DAY) return { allowed: false };
  entry.count++;
  return { allowed: true };
}

// ── 로그인 brute-force 방어 (IP당 15분에 10회) ───────────────
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttemptMap = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttemptMap.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttemptMap.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

// ── 인증번호 검증 brute-force 방어 (이메일당 15분에 5회) ─────
const VERIFY_MAX = 5;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const verifyAttemptMap = new Map<string, { count: number; resetAt: number }>();

function checkVerifyLimit(email: string): boolean {
  const now = Date.now();
  const entry = verifyAttemptMap.get(email);
  if (!entry || now > entry.resetAt) {
    verifyAttemptMap.set(email, { count: 1, resetAt: now + VERIFY_WINDOW_MS });
    return true;
  }
  if (entry.count >= VERIFY_MAX) return false;
  entry.count++;
  return true;
}

// ── 아이디 중복 확인 ──────────────────────────────────────────
router.get("/auth/check-username", async (req, res) => {
  const { username } = req.query as { username?: string };
  if (!username) { res.status(400).json({ message: "username 필요" }); return; }
  if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) {
    res.status(400).json({ message: "아이디는 영문·숫자·밑줄(_) 4~20자리만 가능합니다.", available: false }); return;
  }
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
  res.json({ available: !existing });
});

// ── 웹메일 인증번호 발송 (회원가입) ──────────────────────────
router.post("/auth/send-verification", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "올바른 이메일 주소를 입력하세요." }); return; }

  const email = parsed.data.email.toLowerCase().trim();
  if (!email.endsWith("@pusan.ac.kr")) {
    res.status(400).json({ message: "부산대학교 웹메일(@pusan.ac.kr)만 사용할 수 있습니다." }); return;
  }

  const clientIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  if (!checkIpSendLimit(clientIp).allowed) {
    res.status(429).json({ message: "하루 최대 5회까지 인증 메일을 요청할 수 있습니다. 24시간 후 다시 시도해주세요." }); return;
  }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ message: "이미 가입된 이메일입니다." }); return;
  }

  const code = generateOTP();
  emailVerifStore.set(email, { code, expiresAt: Date.now() + 5 * 60 * 1000, verified: false });

  const isDev = process.env.NODE_ENV !== "production";
  try {
    await sendVerificationEmail(email, code);
    res.json({
      message: "인증번호를 발송했습니다. 메일함을 확인해주세요.",
      ...(isDev && { devCode: code }),
    });
  } catch (err: any) {
    req.log.error({ err: { message: err?.message, code: err?.code }, email: maskEmail(email) }, "Email send failed");
    res.status(500).json({
      message: "메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.",
      ...(isDev && { devCode: code, devError: err?.message }),
    });
  }
});

// ── 인증번호 확인 (회원가입) ──────────────────────────────────
router.post("/auth/verify-code", async (req, res) => {
  const schema = z.object({ email: z.string().email(), code: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "잘못된 요청입니다." }); return; }

  const email = parsed.data.email.toLowerCase().trim();

  if (!checkVerifyLimit(email)) {
    res.status(429).json({ message: "인증 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요." }); return;
  }

  const record = emailVerifStore.get(email);
  if (!record || Date.now() > record.expiresAt) {
    res.status(400).json({ message: "인증번호가 만료되었습니다. 다시 발송해주세요." }); return;
  }
  if (record.code !== parsed.data.code) {
    res.status(400).json({ message: "인증번호가 올바르지 않습니다." }); return;
  }

  emailVerifStore.set(email, { ...record, verified: true });
  res.json({ message: "인증 완료", verified: true });
});

// ── 학생증 OCR ────────────────────────────────────────────────
router.post("/auth/verify-student-id", upload.single("image"), async (req, res) => {
  if (!req.file) { res.status(400).json({ message: "이미지를 업로드하세요." }); return; }
  const base64 = req.file.buffer.toString("base64");
  const mimeType = req.file.mimetype || "image/jpeg";
  try {
    const info = await extractStudentIdInfo(base64, mimeType);
    if (!info.isValid) {
      res.status(400).json({ message: info.reason || "유효한 부산대학교 학생증이 아닙니다.", info }); return;
    }
    res.json({ message: "학생증 인증 성공", info });
  } catch (err) {
    req.log.error({ err }, "OCR failed");
    res.status(500).json({ message: "학생증 분석에 실패했습니다. 이미지를 다시 확인해주세요." });
  }
});

// ── 회원가입 ──────────────────────────────────────────────────
router.post("/auth/register", upload.single("studentIdImage"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "학생증 사진을 첨부해주세요." }); return;
  }

  const schema = z.object({
    username: z.string().regex(/^[a-zA-Z0-9_]{4,20}$/, "아이디는 영문·숫자·밑줄 4-20자"),
    password: z.string().min(8, "비밀번호는 8자 이상"),
    email: z.string().email(),
    name: z.string().min(1),
    studentId: z.string().min(1),
    major: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message || "입력값을 확인하세요." }); return;
  }

  const { username, password, name, studentId, major } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();

  if (!email.endsWith("@pusan.ac.kr")) {
    res.status(400).json({ message: "부산대학교 웹메일(@pusan.ac.kr)만 사용할 수 있습니다." }); return;
  }

  const [existingUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
  if (existingUser) { res.status(409).json({ message: "이미 사용 중인 아이디입니다." }); return; }

  const [existingEmail] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existingEmail) { res.status(409).json({ message: "이미 가입된 이메일입니다." }); return; }

  // 이메일 인증 확인
  const verif = emailVerifStore.get(email);
  if (!verif?.verified) {
    res.status(400).json({ message: "이메일 인증을 먼저 완료해주세요." }); return;
  }

  // 학생증 OCR
  let ocrCollege = "";
  try {
    const base64 = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";
    const info = await extractStudentIdInfo(base64, mimeType);
    if (!info.isValid) {
      res.status(400).json({ message: info.reason || "유효한 부산대학교 학생증이 아닙니다." }); return;
    }
    ocrCollege = info.college || "";
  } catch (err) {
    req.log.error({ err }, "OCR failed during register");
    res.status(500).json({ message: "학생증 분석에 실패했습니다. 다시 시도해주세요." }); return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    username,
    passwordHash,
    email,
    name,
    studentId,
    major,
    college: ocrCollege || null,
    isVerified: true,
    studentIdImageUrl: "verified",
  }).returning();

  emailVerifStore.delete(email);

  const token = signToken({ userId: user.id, username: user.username });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.status(201).json({
    message: "회원가입 완료",
    token,
    user: { id: user.id, username: user.username, name: user.name, studentId: user.studentId, major: user.major, college: user.college },
  });
});

// ── 로그인 ────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  const clientIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  if (!checkLoginRateLimit(clientIp)) {
    res.status(429).json({ message: "로그인 시도 횟수가 너무 많습니다. 15분 후 다시 시도해주세요." }); return;
  }

  const schema = z.object({ username: z.string(), password: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "아이디와 비밀번호를 입력하세요." }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, parsed.data.username));
  if (!user) { res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }); return; }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) { res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }); return; }

  const token = signToken({ userId: user.id, username: user.username });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, studentId: user.studentId, major: user.major, college: user.college },
  });
});

// ── 내 정보 조회 ──────────────────────────────────────────────
router.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ message: "인증이 필요합니다." }); return; }
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ message: "유효하지 않은 토큰입니다." }); return; }

  const [user] = await db.select({
    id: usersTable.id, username: usersTable.username,
    name: usersTable.name, studentId: usersTable.studentId,
    major: usersTable.major, college: usersTable.college, email: usersTable.email,
  }).from(usersTable).where(eq(usersTable.id, payload.userId));

  if (!user) { res.status(401).json({ message: "사용자를 찾을 수 없습니다." }); return; }
  res.json({ user });
});

// ── 로그아웃 ──────────────────────────────────────────────────
router.post("/auth/logout", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.json({ message: "로그아웃 되었습니다." });
});

// ── 회원 탈퇴 ──────────────────────────────────────────────────
router.delete("/auth/withdraw", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ message: "인증이 필요합니다." }); return; }
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ message: "유효하지 않은 토큰입니다." }); return; }

  const userId = payload.userId;

  // cascade가 없는 커뮤니티 데이터 명시적 삭제
  await db.delete(communityCommentsTable).where(eq(communityCommentsTable.userId, userId));
  await db.delete(communityPostsTable).where(eq(communityPostsTable.userId, userId));

  // users 레코드 삭제 → sessions/grades/schedule/todos/notifications 모두 cascade 삭제
  await db.delete(usersTable).where(eq(usersTable.id, userId));

  res.json({ message: "회원 탈퇴가 완료되었습니다." });
});

// ── 복구용 이메일 발송 헬퍼 ──────────────────────────────────
async function sendRecoveryCode(email: string): Promise<{ code: string; emailError?: unknown }> {
  const code = generateOTP();
  recoveryStore.set(email, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
  try {
    await sendVerificationEmail(email, code, true);
    return { code };
  } catch (emailError) {
    return { code, emailError };
  }
}

// ── 아이디 찾기: 인증 메일 발송 ──────────────────────────────
router.post("/auth/find-id/send-verification", async (req, res) => {
  const schema = z.object({ name: z.string().min(1), email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "이름과 이메일을 올바르게 입력하세요." }); return; }

  const email = parsed.data.email.toLowerCase().trim();
  const [user] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.name, parsed.data.name), eq(usersTable.email, email)));
  if (!user) { res.status(404).json({ message: "입력하신 정보와 일치하는 계정이 없습니다." }); return; }

  const { code, emailError } = await sendRecoveryCode(email);
  const isDev = process.env.NODE_ENV !== "production";
  if (emailError) {
    req.log.error({ err: emailError, email: maskEmail(email) }, "find-id email failed");
    if (isDev) { res.json({ message: "메일 발송 실패 (개발모드)", devCode: code }); return; }
    res.status(500).json({ message: "메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요." }); return;
  }
  res.json({ message: "인증번호를 발송했습니다.", ...(isDev && { devCode: code }) });
});

// ── 아이디 찾기: 코드 확인 + 아이디 반환 ─────────────────────
router.post("/auth/find-id/verify", async (req, res) => {
  const schema = z.object({ name: z.string().min(1), email: z.string().email(), code: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "잘못된 요청입니다." }); return; }

  const email = parsed.data.email.toLowerCase().trim();
  const record = recoveryStore.get(email);
  if (!record || Date.now() > record.expiresAt || record.code !== parsed.data.code) {
    res.status(400).json({ message: "인증번호가 올바르지 않거나 만료되었습니다." }); return;
  }

  const [user] = await db.select({ username: usersTable.username }).from(usersTable)
    .where(and(eq(usersTable.name, parsed.data.name), eq(usersTable.email, email)));
  if (!user) { res.status(404).json({ message: "일치하는 계정이 없습니다." }); return; }

  recoveryStore.delete(email);
  res.json({ username: user.username });
});

// ── 비밀번호 찾기: 인증 메일 발송 ───────────────────────────
router.post("/auth/find-password/send-verification", async (req, res) => {
  const schema = z.object({ name: z.string().min(1), username: z.string().min(1), email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "모든 항목을 올바르게 입력하세요." }); return; }

  const email = parsed.data.email.toLowerCase().trim();
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(and(
    eq(usersTable.name, parsed.data.name),
    eq(usersTable.username, parsed.data.username),
    eq(usersTable.email, email),
  ));
  if (!user) { res.status(404).json({ message: "입력하신 정보와 일치하는 계정이 없습니다." }); return; }

  const { code, emailError } = await sendRecoveryCode(email);
  const isDev = process.env.NODE_ENV !== "production";
  if (emailError) {
    req.log.error({ err: emailError, email: maskEmail(email) }, "find-password email failed");
    if (isDev) { res.json({ message: "메일 발송 실패 (개발모드)", devCode: code }); return; }
    res.status(500).json({ message: "메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요." }); return;
  }
  res.json({ message: "인증번호를 발송했습니다.", ...(isDev && { devCode: code }) });
});

// ── 비밀번호 찾기: 코드 확인 + 재설정 토큰 발급 ─────────────
router.post("/auth/find-password/verify", async (req, res) => {
  const schema = z.object({ name: z.string().min(1), username: z.string().min(1), email: z.string().email(), code: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "잘못된 요청입니다." }); return; }

  const email = parsed.data.email.toLowerCase().trim();
  const record = recoveryStore.get(email);
  if (!record || Date.now() > record.expiresAt || record.code !== parsed.data.code) {
    res.status(400).json({ message: "인증번호가 올바르지 않거나 만료되었습니다." }); return;
  }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(and(
    eq(usersTable.name, parsed.data.name),
    eq(usersTable.username, parsed.data.username),
    eq(usersTable.email, email),
  ));
  if (!user) { res.status(404).json({ message: "일치하는 계정이 없습니다." }); return; }

  recoveryStore.delete(email);
  const resetToken = randomUUID();
  resetTokens.set(resetToken, { userId: user.id, expiresAt: Date.now() + 10 * 60 * 1000 });
  res.json({ resetToken });
});

// ── 비밀번호 재설정 ──────────────────────────────────────────
router.post("/auth/reset-password", async (req, res) => {
  const schema = z.object({ resetToken: z.string().uuid(), newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: parsed.error.errors[0]?.message || "잘못된 요청입니다." }); return; }

  const tokenData = resetTokens.get(parsed.data.resetToken);
  if (!tokenData || Date.now() > tokenData.expiresAt) {
    res.status(400).json({ message: "인증이 만료되었습니다. 처음부터 다시 시도해주세요." }); return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, tokenData.userId));
  resetTokens.delete(parsed.data.resetToken);
  res.json({ message: "비밀번호가 변경되었습니다." });
});

export default router;
