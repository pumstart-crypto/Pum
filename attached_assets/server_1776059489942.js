const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// ── 세션 캐시 ──────────────────────────────────────────────
// key: "loginId:password" (Base64 원본)
// value: { jsessionid, accessToken, expiresAt }
const sessionCache = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30분

// 만료된 세션 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of sessionCache) {
    if (now > val.expiresAt) sessionCache.delete(key);
  }
}, 5 * 60 * 1000);

// ── Pyxis 로그인 ───────────────────────────────────────────
async function pyxisLogin(loginId, password) {
  const cacheKey = `${loginId}:${password}`;
  const cached = sessionCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { jsessionid: cached.jsessionid, accessToken: cached.accessToken };
  }

  // 1) POST 로그인 — redirect: manual로 302에서 멈춰서 Set-Cookie 캡처
  const loginRes = await fetch(
    "https://lib.pusan.ac.kr/pyxis-api/api/login",
    {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password }),
    }
  );

  // 2) Set-Cookie에서 JSESSIONID 추출
  //    Node 18+ fetch는 set-cookie를 getSetCookie()로 접근
  let jsessionid = null;

  if (typeof loginRes.headers.getSetCookie === "function") {
    // Node 18.14+
    const cookies = loginRes.headers.getSetCookie();
    for (const c of cookies) {
      const match = c.match(/JSESSIONID=([^;]+)/);
      if (match) { jsessionid = match[1]; break; }
    }
  } else {
    // fallback: raw set-cookie 헤더
    const raw = loginRes.headers.get("set-cookie") || "";
    const match = raw.match(/JSESSIONID=([^;]+)/);
    if (match) jsessionid = match[1];
  }

  // 3) accessToken 추출
  //    302면 리다이렉트 대상을 수동으로 따라감
  //    200이면 바로 body에서 추출
  let accessToken = null;

  if (loginRes.status >= 300 && loginRes.status < 400) {
    // 리다이렉트 응답 — body가 있으면 거기서 토큰 추출 시도
    try {
      const body = await loginRes.json();
      accessToken = body.data?.accessToken || body.accessToken || null;
    } catch {
      // body 없으면 리다이렉트 따라가기
    }

    if (!accessToken) {
      const location = loginRes.headers.get("location");
      if (location) {
        const base = "https://lib.pusan.ac.kr";
        const redirectUrl = location.startsWith("http")
          ? location
          : base + location;

        const followRes = await fetch(redirectUrl, {
          headers: jsessionid
            ? { Cookie: `JSESSIONID=${jsessionid}` }
            : {},
        });
        try {
          const body = await followRes.json();
          accessToken = body.data?.accessToken || body.accessToken || null;
        } catch {}
      }
    }
  } else {
    // 200 직접 응답
    try {
      const body = await loginRes.json();
      accessToken = body.data?.accessToken || body.accessToken || null;

      // 200 응답에도 Set-Cookie가 있을 수 있음
      if (!jsessionid) {
        if (typeof loginRes.headers.getSetCookie === "function") {
          for (const c of loginRes.headers.getSetCookie()) {
            const m = c.match(/JSESSIONID=([^;]+)/);
            if (m) { jsessionid = m[1]; break; }
          }
        }
      }
    } catch {}
  }

  if (!accessToken) {
    throw new Error("accessToken 추출 실패 — 로그인 응답을 확인하세요");
  }

  // 4) 캐시 저장
  const session = {
    jsessionid,
    accessToken,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessionCache.set(cacheKey, session);

  return { jsessionid, accessToken };
}

// ── 인증 헤더 파싱 ─────────────────────────────────────────
function parseAuth(authHeader) {
  if (!authHeader) return null;

  // "Bearer base64encoded" 형태
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Base64 디코딩 시도 → "loginId:password"
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    if (decoded.includes(":")) {
      const [loginId, ...rest] = decoded.split(":");
      return { loginId, password: rest.join(":") };
    }
  } catch {}

  // 그냥 "loginId:password" 평문인 경우
  if (token.includes(":")) {
    const [loginId, ...rest] = token.split(":");
    return { loginId, password: rest.join(":") };
  }

  return null;
}

// ── 메인 엔드포인트 ────────────────────────────────────────
app.get("/seat-room-seats", async (req, res) => {
  try {
    // 1) 파라미터 검증
    const seatRoomId = req.query.seatRoomId;
    if (!seatRoomId) {
      return res.status(400).json({ error: "seatRoomId 파라미터 필요" });
    }

    // 2) 인증 정보 파싱
    const creds = parseAuth(req.headers.authorization);
    if (!creds) {
      return res.status(401).json({
        error: "Authorization 헤더 필요",
        format: "Bearer base64(loginId:password)",
      });
    }

    // 3) Pyxis 로그인 (캐시 히트 시 즉시 반환)
    const { jsessionid, accessToken } = await pyxisLogin(
      creds.loginId,
      creds.password
    );

    // 4) 좌석 조회 요청
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (jsessionid) {
      headers.Cookie = `JSESSIONID=${jsessionid}`;
    }

    const seatsUrl =
      `https://lib.pusan.ac.kr/pyxis-api/1/api/seat-room-seats` +
      `?seatRoomId=${seatRoomId}&homepageId=1`;

    const seatsRes = await fetch(seatsUrl, { headers });

    // 5) 응답이 JSON이 아닐 수 있으므로 안전하게 처리
    const contentType = seatsRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await seatsRes.json();

      // needLogin이 나오면 캐시된 세션 무효화 후 재시도 1회
      if (data?.code === "error.authentication.needLogin") {
        const cacheKey = `${creds.loginId}:${creds.password}`;
        sessionCache.delete(cacheKey);

        const fresh = await pyxisLogin(creds.loginId, creds.password);
        const retryHeaders = {
          Authorization: `Bearer ${fresh.accessToken}`,
        };
        if (fresh.jsessionid) {
          retryHeaders.Cookie = `JSESSIONID=${fresh.jsessionid}`;
        }

        const retryRes = await fetch(seatsUrl, { headers: retryHeaders });
        const retryData = await retryRes.json();
        return res.json(retryData);
      }

      return res.json(data);
    } else {
      const text = await seatsRes.text();
      return res.status(seatsRes.status).send(text);
    }
  } catch (err) {
    console.error("[ERROR]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 헬스체크 ───────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    sessions: sessionCache.size,
    uptime: process.uptime(),
  });
});

// ── 열람실 목록 (편의용) ───────────────────────────────────
app.get("/rooms", (req, res) => {
  res.json([
    { id: 2,  name: "새벽누리-미디어존" },
    { id: 3,  name: "새벽누리-열람존" },
    { id: 69, name: "1열람실" },
    { id: 7,  name: "새벽별당[24h]-A" },
    { id: 8,  name: "새벽별당[24h]-B" },
    { id: 9,  name: "2열람실-A" },
    { id: 10, name: "2열람실-B" },
    { id: 11, name: "2열람실-C" },
    { id: 12, name: "2열람실-D" },
    { id: 21, name: "나무열람실" },
    { id: 20, name: "숲열람실" },
    { id: 15, name: "3열람실-A" },
    { id: 16, name: "3열람실-B" },
    { id: 17, name: "3열람실-C" },
    { id: 18, name: "3열람실-D" },
    { id: 13, name: "노트북열람실-A" },
    { id: 14, name: "노트북열람실-B" },
    { id: 19, name: "대학원캐럴실" },
    { id: 22, name: "아카데미아-열람실" },
    { id: 23, name: "아카데미아-캐럴실-A" },
    { id: 24, name: "아카데미아-캐럴실-B" },
    { id: 25, name: "행림별당" },
    { id: 26, name: "미르마루" },
    { id: 27, name: "집중열람실" },
  ]);
});

// ── 서버 시작 ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PNU Seat Proxy running on port ${PORT}`);
});
