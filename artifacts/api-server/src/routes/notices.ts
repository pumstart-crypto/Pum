import { Router, type IRouter } from "express";
import { parse } from "node-html-parser";

const router: IRouter = Router();

const NOTICE_URL = "https://www.pusan.ac.kr/kor/CMS/Board/Board.do";
const TOTAL_PAGES = 6;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

interface Notice {
  id: string;
  title: string;
  date: string;
  writer: string;
  views: number;
  isPinned: boolean;
  url: string;
}

interface NoticesCache {
  data: Notice[];
  fetchedAt: number;
}

let cache: NoticesCache | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchPage(page: number): Promise<Notice[]> {
  const url = `${NOTICE_URL}?robot=Y&mCode=MN095&mgr_seq=3&page=${page}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);

  const html = await res.text();
  const root = parse(html);
  const rows = root.querySelectorAll("tbody tr");
  const notices: Notice[] = [];

  for (const row of rows) {
    const isPinned = row.classList.contains("isnotice");
    const subjectTd = row.querySelector("td.subject");
    if (!subjectTd) continue;

    const anchor = subjectTd.querySelector("a");
    if (!anchor) continue;

    const href = anchor.getAttribute("href") ?? "";
    const boardSeqMatch = href.match(/board_seq=(\d+)/);
    if (!boardSeqMatch) continue;

    const id = boardSeqMatch[1];
    const titleEl = anchor.querySelector("strong");
    const title = (titleEl?.text ?? anchor.text).replace(/\s+/g, " ").trim();

    const dateTd = row.querySelector("td.date");
    const writerTd = row.querySelector("td.writer");
    const cntTd = row.querySelector("td.cnt");

    const date = dateTd?.text.trim() ?? "";
    const writer = writerTd?.text.trim() ?? "";
    const views = parseInt(cntTd?.text.trim() ?? "0", 10) || 0;
    const fullUrl = `${NOTICE_URL}?mCode=MN095&mgr_seq=3&mode=view&board_seq=${id}`;

    notices.push({ id, title, date, writer, views, isPinned, url: fullUrl });
  }

  return notices;
}

async function fetchAllNotices(): Promise<Notice[]> {
  const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
  const results = await Promise.all(pages.map(fetchPage));

  const seen = new Set<string>();
  const pinned: Notice[] = [];
  const regular: Notice[] = [];

  for (const pageNotices of results) {
    for (const notice of pageNotices) {
      if (seen.has(notice.id)) continue;
      seen.add(notice.id);

      if (notice.isPinned) {
        pinned.push(notice);
      } else {
        regular.push(notice);
      }
    }
  }

  regular.sort((a, b) => b.date.localeCompare(a.date));

  return [...pinned, ...regular];
}

// Warm up cache on server start
(async () => {
  try {
    const notices = await fetchAllNotices();
    cache = { data: notices, fetchedAt: Date.now() };
  } catch {}
})();

router.get("/notices", async (_req, res) => {
  try {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      return res.json({
        notices: cache.data,
        total: cache.data.length,
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
        cached: true,
      });
    }

    const notices = await fetchAllNotices();
    cache = { data: notices, fetchedAt: now };

    return res.json({
      notices,
      total: notices.length,
      fetchedAt: new Date(now).toISOString(),
      cached: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (cache) {
      return res.json({
        notices: cache.data,
        total: cache.data.length,
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
        cached: true,
        stale: true,
      });
    }
    return res.status(500).json({ error: "공지사항을 가져오지 못했습니다.", detail: message });
  }
});

export default router;
