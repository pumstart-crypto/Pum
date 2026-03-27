import { Router, type IRouter } from "express";
import multer from "multer";
import { db, usersTable, phoneVerificationsTable, sessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken, verifyToken, generateOTP, normalizePhone } from "../lib/auth";
import { sendOTP } from "../lib/sms";
import { extractStudentIdInfo } from "../lib/ocr";
import { z } from "zod";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

// ── SMS OTP 발송 ──────────────────────────────────────────────
router.post("/auth/send-otp", async (req, res) => {
  const schema = z.object({ phone: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "전화번호를 올바르게 입력하세요." }); return; }

  const phone = normalizePhone(parsed.data.phone);
  if (phone.length < 10 || phone.length > 11) {
    res.status(400).json({ message: "올바른 휴대폰 번호를 입력하세요." }); return;
  }

  // 이미 가입된 번호인지 확인
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phone));
  if (existing) {
    res.status(409).json({ message: "이미 가입된 번호입니다. 해당 번호로는 계정을 하나만 만들 수 있습니다." }); return;
  }

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분

  await db.insert(phoneVerificationsTable).values({ phone, code, expiresAt });

  try {
    await sendOTP(phone, code);
    res.json({ message: "인증번호를 발송했습니다." });
  } catch (err) {
    req.log.error({ err }, "SMS send failed");
    res.status(500).json({ message: "SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요." });
  }
});

// ── OTP 확인 ──────────────────────────────────────────────────
router.post("/auth/verify-otp", async (req, res) => {
  const schema = z.object({ phone: z.string(), code: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "잘못된 요청입니다." }); return; }

  const phone = normalizePhone(parsed.data.phone);
  const now = new Date();

  const [record] = await db
    .select()
    .from(phoneVerificationsTable)
    .where(and(
      eq(phoneVerificationsTable.phone, phone),
      eq(phoneVerificationsTable.code, parsed.data.code),
      eq(phoneVerificationsTable.verified, false),
      gt(phoneVerificationsTable.expiresAt, now),
    ))
    .orderBy(phoneVerificationsTable.createdAt)
    .limit(1);

  if (!record) {
    res.status(400).json({ message: "인증번호가 올바르지 않거나 만료되었습니다." }); return;
  }

  await db.update(phoneVerificationsTable).set({ verified: true }).where(eq(phoneVerificationsTable.id, record.id));
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
router.post("/auth/register", async (req, res) => {
  const schema = z.object({
    username: z.string().regex(/^[a-zA-Z0-9]{4,20}$/, "아이디는 영문+숫자 4-20자"),
    password: z.string().min(8, "비밀번호는 8자 이상"),
    phone: z.string(),
    name: z.string().min(1),
    studentId: z.string().min(1),
    major: z.string().min(1),
    studentIdImageBase64: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message || "입력값을 확인하세요." }); return;
  }

  const { username, password, name, studentId, major, studentIdImageBase64 } = parsed.data;
  const phone = normalizePhone(parsed.data.phone);

  // 아이디 중복
  const [existingUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
  if (existingUser) { res.status(409).json({ message: "이미 사용 중인 아이디입니다." }); return; }

  // 번호 중복
  const [existingPhone] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phone));
  if (existingPhone) { res.status(409).json({ message: "이미 가입된 번호입니다." }); return; }

  // 전화번호 인증 확인
  const [verifiedPhone] = await db
    .select()
    .from(phoneVerificationsTable)
    .where(and(eq(phoneVerificationsTable.phone, phone), eq(phoneVerificationsTable.verified, true)))
    .limit(1);
  if (!verifiedPhone) { res.status(400).json({ message: "전화번호 인증을 먼저 완료해주세요." }); return; }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    username,
    passwordHash,
    phone,
    name,
    studentId,
    major,
    isVerified: true,
    studentIdImageUrl: studentIdImageBase64 ? "verified" : null,
  }).returning();

  const token = signToken({ userId: user.id, username: user.username });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.status(201).json({
    message: "회원가입 완료",
    token,
    user: { id: user.id, username: user.username, name: user.name, studentId: user.studentId, major: user.major },
  });
});

// ── 로그인 ────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
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
    user: { id: user.id, username: user.username, name: user.name, studentId: user.studentId, major: user.major },
  });
});

// ── 내 정보 조회 (토큰) ───────────────────────────────────────
router.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ message: "인증이 필요합니다." }); return; }
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ message: "유효하지 않은 토큰입니다." }); return; }

  const [user] = await db.select({
    id: usersTable.id, username: usersTable.username,
    name: usersTable.name, studentId: usersTable.studentId,
    major: usersTable.major, phone: usersTable.phone,
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

export default router;
