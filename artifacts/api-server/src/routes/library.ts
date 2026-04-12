import { Router, Request, Response } from "express";
import { db, librarySessionsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// 라이브러리 API는 캐시 없이 항상 새 응답을 반환 (ETag/304 방지)
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

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

// cookieStr은 "JSESSIONID=...; PUSAN_PYXIS3_SS=..." 형식의 완전한 쿠키 문자열
function pyxisHeaders(cookieStr: string): Record<string, string> {
  return { ...PYXIS_HEADERS, "Cookie": cookieStr };
}

// /1/api/ 경로는 Cookie 외에 Authorization: Bearer 헤더도 필요 (Angular SPA 방식)
function pyxisHeaders1Api(cookieStr: string): Record<string, string> {
  const tokenMatch = cookieStr.match(/PUSAN_PYXIS3=([^;]+)/);
  const accessToken = tokenMatch?.[1]?.trim();
  const headers: Record<string, string> = { ...PYXIS_HEADERS, "Cookie": cookieStr };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  return headers;
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

// DB의 jsessionid 컬럼은 로그인 시 수신한 모든 쿠키의 완전한 문자열을 저장
async function getCookieString(token: string): Promise<string | null> {
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

// ── 기기 로그인 후 Pyxis 세션 등록 ────────────────────────────
// 앱이 한국 IP(디바이스)에서 Pyxis에 직접 로그인한 뒤
// 획득한 쿠키 문자열을 서버 DB에 등록하고 앱 토큰을 발급합니다.
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

// ── 개별 좌석 목록 (인증 필요) ────────────────────────────────
router.get("/library/seat-room-seats", async (req: Request, res: Response): Promise<void> => {
  const { seatRoomId } = req.query;
  if (!seatRoomId) { res.status(400).json({ success: false, message: "seatRoomId가 필요합니다." }); return; }
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const cookieStr = await getCookieString(token);
  if (!cookieStr) { noAuth(res); return; }
  try {
    const upstream = await fetch(
      `${PYXIS_BASE}/1/api/seat-room-seats?seatRoomId=${seatRoomId}&homepageId=1`,
      { headers: pyxisHeaders1Api(cookieStr) },
    );
    const json = await upstream.json() as any;
    console.log("[DEBUG seat-room-seats] code:", json?.code, "success:", json?.success, "seats:", Array.isArray(json?.data?.list) ? json.data.list.length : json?.data?.list);
    res.json(json);
  } catch (e: any) {
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
    // 브라우저처럼 사전에 PUSAN_PYXIS3_SS UUID 세팅 (Pyxis Angular 앱 초기화 동작 모방)
    const sessionUuid = crypto.randomUUID();

    const upstream = await fetch(`${PYXIS_BASE}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": MOBILE_UA,
        "Origin": "https://lib.pusan.ac.kr",
        "Referer": "https://lib.pusan.ac.kr/facility/seat",
        "Cookie": `PUSAN_PYXIS3_SS=${sessionUuid}`,
      },
      body: JSON.stringify({ loginId, password, homepageId: 1 }),
      redirect: "follow",
    });

    const json = await upstream.json() as any;

    if (!json.success) {
      res.json({ success: false, code: json.code, message: json.message });
      return;
    }

    // 응답에서 모든 Set-Cookie 헤더를 파싱하여 완전한 쿠키 문자열 구성
    const allSetCookies = (upstream.headers as any).getSetCookie?.() as string[] ?? [];
    const cookieMap: Record<string, string> = {
      "PUSAN_PYXIS3_SS": sessionUuid, // 로그인 전 세팅한 세션 UUID 포함
    };

    for (const cookie of allSetCookies) {
      const match = cookie.match(/^([^=]+)=([^;]*)/);
      if (match) {
        const name = match[1].trim();
        const value = match[2].trim();
        if (value) cookieMap[name] = value;
      }
    }

    const jsessionid = cookieMap["JSESSIONID"] ?? null;
    console.log("[DEBUG login] Set-Cookie 개수:", allSetCookies.length);
    console.log("[DEBUG login] 캡처된 쿠키 키:", Object.keys(cookieMap).join(", "));
    console.log("[DEBUG login] JSESSIONID 존재:", !!jsessionid);
    if (!jsessionid) {
      res.status(502).json({ success: false, message: "도서관 서버에서 세션을 발급받지 못했습니다." });
      return;
    }

    // Angular 앱처럼 accessToken을 PUSAN_PYXIS3 쿠키로 설정
    // (Angular 앱은 login 성공 후 document.cookie로 PUSAN_PYXIS3=accessToken 세팅)
    const accessToken = json.data?.accessToken;
    if (accessToken) {
      cookieMap["PUSAN_PYXIS3"] = accessToken;
    }

    // 모든 쿠키를 하나의 문자열로 저장 (이후 요청에서 그대로 Cookie 헤더로 사용)
    const fullCookieString = Object.entries(cookieMap)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    console.log("[DEBUG login] 저장할 쿠키 키:", Object.keys(cookieMap).join(", "));

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.insert(librarySessionsTable).values({
      token,
      jsessionid: fullCookieString, // 전체 쿠키 문자열 저장
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
  const cookieStr = await getCookieString(token);
  if (!cookieStr) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/my-seat`, cookieStr, res);
});

// ── 좌석 예약 ─────────────────────────────────────────────────
router.post("/library/my-seat", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const cookieStr = await getCookieString(token);
  if (!cookieStr) { noAuth(res); return; }
  const { seatId } = req.body ?? {};
  if (!seatId) { res.status(400).json({ success: false, message: "seatId가 필요합니다." }); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat`, cookieStr, { seatId, homepageId: 1 }, res);
});

// ── 좌석 연장 ─────────────────────────────────────────────────
router.post("/library/my-seat/extend", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const cookieStr = await getCookieString(token);
  if (!cookieStr) { noAuth(res); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat/extend`, cookieStr, { homepageId: 1 }, res);
});

// ── 좌석 반납 ─────────────────────────────────────────────────
router.post("/library/my-seat/return", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const cookieStr = await getCookieString(token);
  if (!cookieStr) { noAuth(res); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat/return`, cookieStr, { homepageId: 1 }, res);
});

// ── 예약 취소 (배정확정 전) ────────────────────────────────────
router.delete("/library/my-seat", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const cookieStr = await getCookieString(token);
  if (!cookieStr) { noAuth(res); return; }
  await proxyDelete(`${PYXIS_BASE}/api/my-seat`, cookieStr, res);
});

// ── 이석 처리 ─────────────────────────────────────────────────
router.post("/library/my-seat/away", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const cookieStr = await getCookieString(token);
  if (!cookieStr) { noAuth(res); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat/away`, cookieStr, { homepageId: 1 }, res);
});

// ── 이석 복귀 ─────────────────────────────────────────────────
router.delete("/library/my-seat/away", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const cookieStr = await getCookieString(token);
  if (!cookieStr) { noAuth(res); return; }
  await proxyDelete(`${PYXIS_BASE}/api/my-seat/away`, cookieStr, res);
});

// ── 이용 내역 ─────────────────────────────────────────────────
router.get("/library/my-seat/histories", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const cookieStr = await getCookieString(token);
  if (!cookieStr) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/my-seat/histories`, cookieStr, res);
});

// ── 이용 제한 현황 ─────────────────────────────────────────────
router.get("/library/my-seat/violations", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const cookieStr = await getCookieString(token);
  if (!cookieStr) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/my-seat/violations`, cookieStr, res);
});

// ── 내 정보 ───────────────────────────────────────────────────
router.get("/library/user-info", async (req: Request, res: Response): Promise<void> => {
  const token = extractToken(req);
  if (!token) { noAuth(res); return; }
  const cookieStr = await getCookieString(token);
  if (!cookieStr) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/user-info`, cookieStr, res);
});

export default router;
