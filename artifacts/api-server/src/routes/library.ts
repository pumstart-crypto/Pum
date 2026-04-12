import { Router } from "express";

const router = Router();

const PYXIS_BASE = "https://lib.pusan.ac.kr/pyxis-api/1";
const PYXIS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/146.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Referer": "https://lib.pusan.ac.kr/facility/seat",
};

router.get("/library/seat-rooms", async (req, res) => {
  try {
    const branchGroupId = req.query.branchGroupId ?? "1";
    const url = `${PYXIS_BASE}/seat-rooms?homepageId=1&smufMethodCode=SEAT&branchGroupId=${branchGroupId}`;
    const upstream = await fetch(url, { headers: PYXIS_HEADERS });
    const json = await upstream.json() as any;
    res.json(json);
  } catch (err) {
    res.status(502).json({ success: false, message: "도서관 서버 연결에 실패했습니다." });
  }
});

export default router;
