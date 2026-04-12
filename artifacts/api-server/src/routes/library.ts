import { Router, Request, Response } from "express";
import { db, librarySessionsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

const PYXIS_BASE = "https://lib.pusan.ac.kr/pyxis-api";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

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

function pyxisHeaders(jsessionid: string): Record<string, string> {
  return { ...PYXIS_HEADERS, "Cookie": `JSESSIONID=${jsessionid}` };
}

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

async function getJsessionid(token: string): Promise<string | null> {
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

async function proxyGet(url: string, jsessionid: string, res: Response): Promise<void> {
  try {
    const upstream = await fetch(url, { headers: pyxisHeaders(jsessionid) });
    const json = await upstream.json() as any;
    res.json(json);
  } catch {
    res.status(502).json({ success: false, message: "도서관 서버 연결에 실패했습니다." });
  }
}

async function proxyPost(url: string, jsessionid: string, body: object, res: Response): Promise<void> {
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: pyxisHeaders(jsessionid),
      body: JSON.stringify(body),
    });
    const json = await upstream.json() as any;
    res.json(json);
  } catch {
    res.status(502).json({ success: false, message: "도서관 서버 연결에 실패했습니다." });
  }
}

async function proxyDelete(url: string, jsessionid: string, res: Response): Promise<void> {
  try {
    const upstream = await fetch(url, { method: "DELETE", headers: pyxisHeaders(jsessionid) });
    const json = await upstream.json() as any;
    res.json(json);
  } catch {
    res.status(502).json({ success: false, message: "도서관 서버 연결에 실패했습니다." });
  }
}

setInterval(cleanupExpiredSessions, 30 * 60 * 1000);

// ── 열람실 목록 (공개) ─────────────────────────────────────────
router.get("/library/seat-rooms", async (req: Request, res: Response): Promise<void> => {
  const branchGroupId = req.query.branchGroupId ?? "1";
  try {
    const url = `${PYXIS_BASE}/1/seat-rooms?homepageId=1&smufMethodCode=SEAT&branchGroupId=${branchGroupId}`;
    const upstream = await fetch(url, { headers: PYXIS_HEADERS });
    const json = await upstream.json();
    res.json(json);
  } catch {
    res.status(502).json({ success: false, message: "도서관 서버 연결에 실패했습니다." });
  }
});

// ── 개별 좌석 목록 ─────────────────────────────────────────────
router.get("/library/seat-room-seats", async (req: Request, res: Response): Promise<void> => {
  const { seatRoomId } = req.query;
  if (!seatRoomId) { res.status(400).json({ success: false, message: "seatRoomId가 필요합니다." }); return; }

  const token = extractToken(req);
  let jsessionid: string | null = null;
  if (token) jsessionid = await getJsessionid(token);

  try {
    const url = `${PYXIS_BASE}/1/seat-room-seats?seatRoomId=${seatRoomId}&homepageId=1`;
    const headers = jsessionid ? pyxisHeaders(jsessionid) : PYXIS_HEADERS;
    const upstream = await fetch(url, { headers });
    const json = await upstream.json();
    res.json(json);
  } catch {
    res.status(502).json({ success: false, message: "도서관 서버 연결에 실패했습니다." });
  }
});

// ── 로그인 ─────────────────────────────────────────────────────
// Pyxis 세션(JSESSIONID)은 접속 IP에 바인딩됩니다.
// 로그인 요청을 API 서버에서 대행(Proxy)하여 이후 모든 요청과 동일 IP를 보장합니다.
// JSESSIONID는 서버 DB에만 보관하고, 앱에는 세션 토큰만 반환합니다.
router.post("/library/login", async (req: Request, res: Response): Promise<void> => {
  const { loginId, password } = req.body ?? {};
  if (!loginId || !password) {
    res.status(400).json({ success: false, code: "input.empty", message: "학번과 비밀번호를 입력해 주세요." });
    return;
  }

  try {
    const upstream = await fetch(`${PYXIS_BASE}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": MOBILE_UA,
        "Origin": "https://lib.pusan.ac.kr",
        "Referer": "https://lib.pusan.ac.kr/",
      },
      body: JSON.stringify({ loginId, password, homepageId: 1 }),
      redirect: "follow",
    });

    const setCookie = upstream.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/JSESSIONID=([^;,\s]+)/);
    const jsessionid = match?.[1] ?? null;

    const json = await upstream.json() as any;

    if (!json.success) {
      res.json({ success: false, code: json.code, message: json.message });
      return;
    }

    if (!jsessionid) {
      res.status(502).json({ success: false, message: "도서관 서버에서 세션을 발급받지 못했습니다." });
      return;
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.insert(librarySessionsTable).values({
      token,
      jsessionid,
      userId: json.data?.userId ?? json.data?.loginId ?? loginId,
      userName: json.data?.name ?? json.data?.userName ?? null,
      expiresAt,
    });

    res.json({
      success: true,
      data: {
        token,
        userId: json.data?.userId ?? json.data?.loginId ?? loginId,
        userName: json.data?.name ?? json.data?.userName ?? null,
      },
    });
  } catch (err: any) {
    res.status(502).json({ success: false, message: `도서관 서버 연결에 실패했습니다. (${err?.message ?? "unknown"})` });
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
  const jsessionid = await getJsessionid(token);
  if (!jsessionid) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/my-seat`, jsessionid, res);
});

// ── 좌석 예약 ─────────────────────────────────────────────────
router.post("/library/my-seat", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const jsessionid = await getJsessionid(token);
  if (!jsessionid) { noAuth(res); return; }
  const { seatId } = req.body ?? {};
  if (!seatId) { res.status(400).json({ success: false, message: "seatId가 필요합니다." }); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat`, jsessionid, { seatId, homepageId: 1 }, res);
});

// ── 좌석 연장 ─────────────────────────────────────────────────
router.post("/library/my-seat/extend", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const jsessionid = await getJsessionid(token);
  if (!jsessionid) { noAuth(res); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat/extend`, jsessionid, { homepageId: 1 }, res);
});

// ── 좌석 반납 ─────────────────────────────────────────────────
router.post("/library/my-seat/return", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const jsessionid = await getJsessionid(token);
  if (!jsessionid) { noAuth(res); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat/return`, jsessionid, { homepageId: 1 }, res);
});

// ── 예약 취소 (배정확정 전) ────────────────────────────────────
router.delete("/library/my-seat", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const jsessionid = await getJsessionid(token);
  if (!jsessionid) { noAuth(res); return; }
  await proxyDelete(`${PYXIS_BASE}/api/my-seat`, jsessionid, res);
});

// ── 이석 처리 ─────────────────────────────────────────────────
router.post("/library/my-seat/away", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const jsessionid = await getJsessionid(token);
  if (!jsessionid) { noAuth(res); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat/away`, jsessionid, { homepageId: 1 }, res);
});

// ── 이석 복귀 ─────────────────────────────────────────────────
router.delete("/library/my-seat/away", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const jsessionid = await getJsessionid(token);
  if (!jsessionid) { noAuth(res); return; }
  await proxyDelete(`${PYXIS_BASE}/api/my-seat/away`, jsessionid, res);
});

// ── 이용 내역 ─────────────────────────────────────────────────
router.get("/library/my-seat/histories", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const jsessionid = await getJsessionid(token);
  if (!jsessionid) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/my-seat/histories`, jsessionid, res);
});

// ── 이용 제한 현황 ─────────────────────────────────────────────
router.get("/library/my-seat/violations", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const jsessionid = await getJsessionid(token);
  if (!jsessionid) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/my-seat/violations`, jsessionid, res);
});

// ── 내 정보 ───────────────────────────────────────────────────
router.get("/library/user-info", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const jsessionid = await getJsessionid(token);
  if (!jsessionid) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/user-info`, jsessionid, res);
});

export default router;
