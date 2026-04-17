import { Router, Request, Response } from "express";
import { db, librarySessionsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const KOREA_PROXY = process.env.KOREA_PROXY_URL ?? "http://223.130.142.144:3000";
const PYXIS_BASE = "https://lib.pusan.ac.kr/pyxis-api";

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
  "Version/18.0 Mobile/15E148 Safari/604.1";

const PYXIS_HEADERS: Record<string, string> = {
  "User-Agent": MOBILE_UA,
  "Accept": "application/json",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Referer": "https://lib.pusan.ac.kr/facility/seat",
  "Origin": "https://lib.pusan.ac.kr",
  "Content-Type": "application/json",
};

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function noAuth(res: Response): void {
  res.status(401).json({ success: false, code: "error.authentication.needLogin", message: "로그인이 필요합니다." });
}

async function cleanupExpiredSessions(): Promise<void> {
  try {
    await db.delete(librarySessionsTable).where(lt(librarySessionsTable.expiresAt, new Date()));
  } catch {}
}

// jsessionid 컬럼에 한국 프록시 proxyToken을 저장
async function getProxyToken(token: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(librarySessionsTable)
    .where(eq(librarySessionsTable.token, token));
  if (!rows.length) return null;
  const session = rows[0];
  if (session.expiresAt < new Date()) {
    await db.delete(librarySessionsTable).where(eq(librarySessionsTable.token, token));
    return null;
  }
  return session.jsessionid;
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return (req.query.token as string) ?? null;
}

// ── 한국 프록시 경유 helper ─────────────────────────────────────
async function proxyGet(path: string, proxyToken: string, res: Response): Promise<void> {
  try {
    const upstream = await fetch(`${KOREA_PROXY}${path}`, {
      headers: { "X-Proxy-Token": proxyToken },
      signal: AbortSignal.timeout(10_000),
    });
    const json = await upstream.json() as any;
    res.json(json);
  } catch (e: any) {
    res.status(503).json({ success: false, message: `도서관 서버 연결에 실패했습니다. (${e?.message ?? "unknown"})` });
  }
}

async function proxyPost(path: string, proxyToken: string, body: object, res: Response): Promise<void> {
  try {
    const upstream = await fetch(`${KOREA_PROXY}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Proxy-Token": proxyToken },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const json = await upstream.json() as any;
    res.json(json);
  } catch (e: any) {
    res.status(503).json({ success: false, message: `도서관 서버 연결에 실패했습니다. (${e?.message ?? "unknown"})` });
  }
}

async function proxyDelete(path: string, proxyToken: string, res: Response): Promise<void> {
  try {
    const upstream = await fetch(`${KOREA_PROXY}${path}`, {
      method: "DELETE",
      headers: { "X-Proxy-Token": proxyToken },
      signal: AbortSignal.timeout(10_000),
    });
    const json = await upstream.json() as any;
    res.json(json);
  } catch (e: any) {
    res.status(503).json({ success: false, message: `도서관 서버 연결에 실패했습니다. (${e?.message ?? "unknown"})` });
  }
}

setInterval(cleanupExpiredSessions, 30 * 60 * 1000);

// ── 기기 로그인 후 Pyxis 세션 등록 (레거시 호환) ──────────────
router.post("/library/register-session", async (req: Request, res: Response): Promise<void> => {
  const { cookieString, userId, userName } = req.body ?? {};
  if (!cookieString) {
    res.status(400).json({ success: false, message: "cookieString이 필요합니다." });
    return;
  }
  try {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.insert(librarySessionsTable).values({
      token,
      jsessionid: cookieString,
      userId: userId ?? "unknown",
      userName: userName ?? null,
      expiresAt,
    });
    res.json({ success: true, data: { token } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `세션 등록 실패: ${err?.message ?? "unknown"}` });
  }
});

// ── 열람실 목록 (공개, Pyxis 직접 — IP 제한 없음) ──────────────
router.get("/library/seat-rooms", async (req: Request, res: Response): Promise<void> => {
  const branchGroupId = req.query.branchGroupId ?? "1";
  try {
    const url = `${PYXIS_BASE}/1/seat-rooms?homepageId=1&smufMethodCode=SEAT&branchGroupId=${branchGroupId}`;
    const upstream = await fetch(url, { headers: PYXIS_HEADERS });
    const json = await upstream.json();
    res.json(json);
  } catch {
    res.status(503).json({ success: false, message: "도서관 서버 연결에 실패했습니다." });
  }
});

// ── 개별 좌석 목록 (한국 프록시 경유) ─────────────────────────
router.get("/library/seat-room-seats", async (req: Request, res: Response): Promise<void> => {
  const { seatRoomId } = req.query;
  if (!seatRoomId) { res.status(400).json({ success: false, message: "seatRoomId가 필요합니다." }); return; }
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const proxyToken = await getProxyToken(token);
  if (!proxyToken) { noAuth(res); return; }
  await proxyGet(`/seat-room-seats?seatRoomId=${seatRoomId}`, proxyToken, res);
});

// ── 로그인 (한국 프록시 경유) ──────────────────────────────────
router.post("/library/login", async (req: Request, res: Response): Promise<void> => {
  const { loginId, password } = req.body ?? {};
  if (!loginId || !password) {
    res.status(400).json({ success: false, code: "input.empty", message: "학번과 비밀번호를 입력해 주세요." });
    return;
  }

  try {
    const loginRes = await fetch(`${KOREA_PROXY}/proxy-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password }),
      signal: AbortSignal.timeout(20_000),
    });

    let json: any;
    try {
      json = await loginRes.json();
    } catch {
      res.status(503).json({
        success: false,
        code: "error.library.blocked",
        message: "도서관 서버 응답을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }

    if (!json.success || !json.proxyToken) {
      res.status(loginRes.status >= 500 ? 503 : 401).json({
        success: false,
        code: json.code ?? "error.authentication.failed",
        message: json.message ?? "도서관 로그인에 실패했습니다.",
      });
      return;
    }

    // 한국 프록시가 jsessionid 존재 여부만으로 success를 판단하므로
    // Pyxis 실제 응답(loginBody)을 직접 검증
    const pyxisBody = json.loginBody;
    if (pyxisBody && pyxisBody.success === false) {
      res.status(401).json({
        success: false,
        code: pyxisBody.code ?? "error.authentication.failed",
        message: pyxisBody.message ?? "학번 또는 비밀번호가 올바르지 않습니다.",
      });
      return;
    }

    const userId = json.userId
      ?? pyxisBody?.data?.userId
      ?? pyxisBody?.data?.loginId
      ?? loginId;
    const userName = json.userName
      ?? pyxisBody?.data?.name
      ?? pyxisBody?.data?.userName
      ?? null;

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.insert(librarySessionsTable).values({
      token,
      jsessionid: json.proxyToken,
      userId,
      userName,
      expiresAt,
    });

    console.log("[library/login] OK userId=", userId, "userName=", userName);

    res.json({
      success: true,
      data: {
        token,
        pyxisToken: json.proxyToken,
        userId,
        userName,
      },
    });
  } catch (err: any) {
    res.status(503).json({ success: false, message: `도서관 서버 연결에 실패했습니다. (${err?.message ?? "unknown"})` });
  }
});

// ── 로그아웃 ───────────────────────────────────────────────────
router.post("/library/logout", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (token) {
    try {
      await db.delete(librarySessionsTable).where(eq(librarySessionsTable.token, token));
    } catch {}
  }
  res.json({ success: true });
});

// ── 내 좌석 조회 ───────────────────────────────────────────────
router.get("/library/my-seat", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const proxyToken = await getProxyToken(token);
  if (!proxyToken) { noAuth(res); return; }
  await proxyGet("/my-seat", proxyToken, res);
});

// ── 좌석 예약 ─────────────────────────────────────────────────
router.post("/library/my-seat", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const proxyToken = await getProxyToken(token);
  if (!proxyToken) { noAuth(res); return; }
  const { seatId } = req.body ?? {};
  if (!seatId) { res.status(400).json({ success: false, message: "seatId가 필요합니다." }); return; }
  await proxyPost("/my-seat", proxyToken, { seatId, homepageId: 1 }, res);
});

// ── 좌석 연장 ─────────────────────────────────────────────────
router.post("/library/my-seat/extend", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const proxyToken = await getProxyToken(token);
  if (!proxyToken) { noAuth(res); return; }
  await proxyPost("/my-seat/extend", proxyToken, { homepageId: 1 }, res);
});

// ── 좌석 반납 ─────────────────────────────────────────────────
router.post("/library/my-seat/return", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const proxyToken = await getProxyToken(token);
  if (!proxyToken) { noAuth(res); return; }
  await proxyPost("/my-seat/return", proxyToken, { homepageId: 1 }, res);
});

// ── 예약 취소 ─────────────────────────────────────────────────
router.delete("/library/my-seat", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const proxyToken = await getProxyToken(token);
  if (!proxyToken) { noAuth(res); return; }
  await proxyDelete("/my-seat", proxyToken, res);
});

// ── 이석 처리 ─────────────────────────────────────────────────
router.post("/library/my-seat/away", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const proxyToken = await getProxyToken(token);
  if (!proxyToken) { noAuth(res); return; }
  await proxyPost("/my-seat/away", proxyToken, { homepageId: 1 }, res);
});

// ── 이석 복귀 ─────────────────────────────────────────────────
router.delete("/library/my-seat/away", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const proxyToken = await getProxyToken(token);
  if (!proxyToken) { noAuth(res); return; }
  await proxyDelete("/my-seat/away", proxyToken, res);
});

// ── 이용 내역 ─────────────────────────────────────────────────
router.get("/library/my-seat/histories", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const proxyToken = await getProxyToken(token);
  if (!proxyToken) { noAuth(res); return; }
  await proxyGet("/my-seat/histories", proxyToken, res);
});

// ── 이용 제한 현황 ─────────────────────────────────────────────
router.get("/library/my-seat/violations", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const proxyToken = await getProxyToken(token);
  if (!proxyToken) { noAuth(res); return; }
  await proxyGet("/my-seat/violations", proxyToken, res);
});

// ── 내 정보 ───────────────────────────────────────────────────
router.get("/library/user-info", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const proxyToken = await getProxyToken(token);
  if (!proxyToken) { noAuth(res); return; }
  await proxyGet("/user-info", proxyToken, res);
});

export default router;
