import { Router, Request, Response } from "express";

const router = Router();

const PYXIS_BASE = "https://lib.pusan.ac.kr/pyxis-api";
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
  "Version/18.0 Mobile/15E148 Safari/604.1";

const PUBLIC_HEADERS = {
  "User-Agent": MOBILE_UA,
  "Accept": "application/json",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Referer": "https://lib.pusan.ac.kr/facility/seat",
  "Origin": "https://lib.pusan.ac.kr",
};

function authHeaders(jsessionid: string): Record<string, string> {
  return {
    ...PUBLIC_HEADERS,
    "Cookie": `JSESSIONID=${jsessionid}`,
    "Content-Type": "application/json",
  };
}

function noAuth(res: Response): void {
  res.status(401).json({ success: false, code: "error.authentication.needLogin", message: "로그인이 필요합니다." });
}

async function proxyGet(url: string, headers: Record<string, string>, res: Response): Promise<void> {
  try {
    const upstream = await fetch(url, { headers });
    const json = await upstream.json() as any;
    res.json(json);
  } catch {
    res.status(502).json({ success: false, message: "도서관 서버 연결에 실패했습니다." });
  }
}

async function proxyPost(url: string, headers: Record<string, string>, body: object, res: Response): Promise<void> {
  try {
    const upstream = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const json = await upstream.json() as any;
    res.json(json);
  } catch {
    res.status(502).json({ success: false, message: "도서관 서버 연결에 실패했습니다." });
  }
}

async function proxyDelete(url: string, headers: Record<string, string>, res: Response): Promise<void> {
  try {
    const upstream = await fetch(url, { method: "DELETE", headers });
    const json = await upstream.json() as any;
    res.json(json);
  } catch {
    res.status(502).json({ success: false, message: "도서관 서버 연결에 실패했습니다." });
  }
}

// ── 열람실 목록 (공개) ─────────────────────────────────────────
router.get("/library/seat-rooms", async (_req: Request, res: Response): Promise<void> => {
  const branchGroupId = _req.query.branchGroupId ?? "1";
  const url = `${PYXIS_BASE}/1/seat-rooms?homepageId=1&smufMethodCode=SEAT&branchGroupId=${branchGroupId}`;
  await proxyGet(url, PUBLIC_HEADERS, res);
});

// ── 열람실 개별 좌석 목록 ──────────────────────────────────────
router.get("/library/seat-room-seats", async (req: Request, res: Response): Promise<void> => {
  const { seatRoomId, jsessionid } = req.query;
  if (!seatRoomId) { res.status(400).json({ success: false, message: "seatRoomId가 필요합니다." }); return; }
  const headers = jsessionid ? authHeaders(jsessionid as string) : PUBLIC_HEADERS;
  const url = `${PYXIS_BASE}/1/seat-room-seats?seatRoomId=${seatRoomId}&homepageId=1`;
  await proxyGet(url, headers as Record<string, string>, res);
});

// ── 학교 포털 로그인 프록시 ────────────────────────────────────
// 서버 측에서 Set-Cookie 헤더를 읽어 JSESSIONID를 추출해 반환합니다.
// 클라이언트(앱)는 이 JSESSIONID를 SecureStore에 저장하고
// 이후 모든 인증 요청의 Cookie 헤더에 직접 포함시킵니다.
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
        "Accept": "application/json, text/plain, */*",
        "User-Agent": MOBILE_UA,
        "Origin": "https://lib.pusan.ac.kr",
        "Referer": "https://lib.pusan.ac.kr/",
      },
      body: JSON.stringify({ loginId, password, homepageId: 1 }),
    });

    const setCookie = upstream.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/JSESSIONID=([^;,\s]+)/);
    const jsessionid = match?.[1] ?? null;

    const json = await upstream.json() as any;

    if (!json.success) {
      res.json({ success: false, code: json.code, message: json.message });
      return;
    }

    res.json({
      success: true,
      data: {
        userId:     json.data?.userId     ?? json.data?.loginId ?? loginId,
        userName:   json.data?.name       ?? json.data?.userName ?? null,
        jsessionid,
      },
    });
  } catch (err: any) {
    res.status(502).json({ success: false, message: `도서관 서버 연결에 실패했습니다. (${err?.message ?? "unknown"})` });
  }
});

// ── 내 좌석 조회 ───────────────────────────────────────────────
router.get("/library/my-seat", async (req: Request, res: Response): Promise<void> => {
  const jsessionid = req.query.jsessionid as string | undefined;
  if (!jsessionid) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/my-seat`, authHeaders(jsessionid), res);
});

// ── 좌석 예약 ─────────────────────────────────────────────────
router.post("/library/my-seat", async (req: Request, res: Response): Promise<void> => {
  const { jsessionid, seatId } = req.body ?? {};
  if (!jsessionid) { noAuth(res); return; }
  if (!seatId) { res.status(400).json({ success: false, message: "seatId가 필요합니다." }); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat`, authHeaders(jsessionid), { seatId, homepageId: 1 }, res);
});

// ── 좌석 연장 ─────────────────────────────────────────────────
router.post("/library/my-seat/extend", async (req: Request, res: Response): Promise<void> => {
  const { jsessionid } = req.body ?? {};
  if (!jsessionid) { noAuth(res); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat/extend`, authHeaders(jsessionid), { homepageId: 1 }, res);
});

// ── 좌석 반납 ─────────────────────────────────────────────────
router.post("/library/my-seat/return", async (req: Request, res: Response): Promise<void> => {
  const { jsessionid } = req.body ?? {};
  if (!jsessionid) { noAuth(res); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat/return`, authHeaders(jsessionid), { homepageId: 1 }, res);
});

// ── 예약 취소 (배정확정 전) ────────────────────────────────────
router.delete("/library/my-seat", async (req: Request, res: Response): Promise<void> => {
  const jsessionid = req.query.jsessionid as string | undefined;
  if (!jsessionid) { noAuth(res); return; }
  await proxyDelete(`${PYXIS_BASE}/api/my-seat`, authHeaders(jsessionid), res);
});

// ── 이석 처리 ─────────────────────────────────────────────────
router.post("/library/my-seat/away", async (req: Request, res: Response): Promise<void> => {
  const { jsessionid } = req.body ?? {};
  if (!jsessionid) { noAuth(res); return; }
  await proxyPost(`${PYXIS_BASE}/api/my-seat/away`, authHeaders(jsessionid), { homepageId: 1 }, res);
});

// ── 이석 복귀 ─────────────────────────────────────────────────
router.delete("/library/my-seat/away", async (req: Request, res: Response): Promise<void> => {
  const jsessionid = req.query.jsessionid as string | undefined;
  if (!jsessionid) { noAuth(res); return; }
  await proxyDelete(`${PYXIS_BASE}/api/my-seat/away`, authHeaders(jsessionid), res);
});

// ── 이용 내역 ─────────────────────────────────────────────────
router.get("/library/my-seat/histories", async (req: Request, res: Response): Promise<void> => {
  const jsessionid = req.query.jsessionid as string | undefined;
  if (!jsessionid) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/my-seat/histories`, authHeaders(jsessionid), res);
});

// ── 이용 제한 현황 ─────────────────────────────────────────────
router.get("/library/my-seat/violations", async (req: Request, res: Response): Promise<void> => {
  const jsessionid = req.query.jsessionid as string | undefined;
  if (!jsessionid) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/my-seat/violations`, authHeaders(jsessionid), res);
});

// ── 내 정보 ───────────────────────────────────────────────────
router.get("/library/user-info", async (req: Request, res: Response): Promise<void> => {
  const jsessionid = req.query.jsessionid as string | undefined;
  if (!jsessionid) { noAuth(res); return; }
  await proxyGet(`${PYXIS_BASE}/api/user-info`, authHeaders(jsessionid), res);
});

export default router;
