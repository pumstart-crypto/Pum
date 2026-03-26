import { Router, type IRouter } from "express";
import { parse } from "node-html-parser";

const router: IRouter = Router();

const IE_BASE = "https://ie.pusan.ac.kr";
const BOARDS = {
  notice: { id: "182", label: "공지사항" },
  jobs:   { id: "660", label: "취업정보" },
};
const FETCH_PAGES = 3;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

interface DeptNotice {
  id: string;
  title: string;
  date: string;
  writer: string;
  views: number;
  isNew: boolean;
  url: string;
}

interface BoardCache {
  data: DeptNotice[];
  fetchedAt: number;
}

const cache: Record<string, BoardCache> = {};
const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchBoardPage(boardId: string, page: number): Promise<DeptNotice[]> {
  const url = `${IE_BASE}/bbs/ie/${boardId}/artclList.do?page=${page}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const root = parse(html);
  const rows = root.querySelectorAll("tbody tr");
  const items: DeptNotice[] = [];

  for (const row of rows) {
    const titleTd = row.querySelector("td.td-title");
    if (!titleTd) continue;

    const anchor = titleTd.querySelector("a");
    if (!anchor) continue;

    const href = anchor.getAttribute("href") ?? "";
    const idMatch = href.match(/\/(\d+)\/artclView\.do/);
    if (!idMatch) continue;

    const id = idMatch[1];
    const titleEl = anchor.querySelector("strong");
    const title = (titleEl?.text ?? anchor.text).replace(/\s+/g, " ").trim();
    const isNew = !!anchor.querySelector(".new");

    const dateTd = row.querySelector("td.td-date");
    const writerTd = row.querySelector("td.td-write");
    const viewTd = row.querySelector("td.td-access");

    const date = dateTd?.text.trim().replace(/\./g, "-").replace(/-$/, "") ?? "";
    const writer = writerTd?.text.replace(/\s+/g, " ").trim() ?? "";
    const views = parseInt(viewTd?.text.trim() ?? "0", 10) || 0;
    const fullUrl = `${IE_BASE}${href}`;

    items.push({ id, title, date, writer, views, isNew, url: fullUrl });
  }

  return items;
}

async function fetchBoard(type: "notice" | "jobs"): Promise<DeptNotice[]> {
  const boardId = BOARDS[type].id;
  const pages = Array.from({ length: FETCH_PAGES }, (_, i) => i + 1);
  const results = await Promise.all(pages.map((p) => fetchBoardPage(boardId, p)));

  const seen = new Set<string>();
  const items: DeptNotice[] = [];
  for (const page of results) {
    for (const item of page) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
      }
    }
  }
  return items;
}

router.get("/dept-notices", async (req, res) => {
  const type = (req.query.type as string) === "jobs" ? "jobs" : "notice";
  const now = Date.now();
  const cached = cache[type];

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return res.json({ notices: cached.data, total: cached.data.length, fetchedAt: new Date(cached.fetchedAt).toISOString(), cached: true });
  }

  try {
    const notices = await fetchBoard(type);
    cache[type] = { data: notices, fetchedAt: now };
    return res.json({ notices, total: notices.length, fetchedAt: new Date(now).toISOString(), cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (cached) {
      return res.json({ notices: cached.data, total: cached.data.length, fetchedAt: new Date(cached.fetchedAt).toISOString(), cached: true, stale: true });
    }
    return res.status(500).json({ error: "학과 공지사항을 가져오지 못했습니다.", detail: message });
  }
});

export default router;
