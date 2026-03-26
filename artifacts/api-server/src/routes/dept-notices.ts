import { Router, type IRouter } from "express";
import { parse } from "node-html-parser";
import { DEPT_LINKS } from "../data/dept-links";

const router: IRouter = Router();

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9",
};
const MAX_PAGES = 20;
const CUTOFF_DATE = "2026-01-01";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface DeptNotice {
  id: string;
  title: string;
  date: string;
  writer: string;
  views: number;
  isNew: boolean;
  url: string;
}

interface BoardMeta {
  baseUrl: string;
  siteId: string;
  boardId: string;
}

interface BoardCache {
  data: DeptNotice[];
  fetchedAt: number;
}

const boardMetaCache: Record<string, BoardMeta> = {};
const dataCache: Record<string, BoardCache> = {};

async function discoverBoard(subviewUrl: string): Promise<BoardMeta> {
  if (boardMetaCache[subviewUrl]) return boardMetaCache[subviewUrl];

  const res = await fetch(subviewUrl, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${subviewUrl}`);
  const html = await res.text();

  const base = new URL(subviewUrl);
  const baseUrl = base.origin;

  const match = html.match(/action="\/bbs\/([^/]+)\/(\d+)\/artclList\.do"/);
  if (!match) throw new Error(`Cannot find board config in ${subviewUrl}`);

  const meta: BoardMeta = { baseUrl, siteId: match[1], boardId: match[2] };
  boardMetaCache[subviewUrl] = meta;
  return meta;
}

async function fetchBoardPage(meta: BoardMeta, page: number): Promise<DeptNotice[]> {
  const listUrl = `${meta.baseUrl}/bbs/${meta.siteId}/${meta.boardId}/artclList.do?page=${page}`;
  const res = await fetch(listUrl, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching page ${page}`);

  const html = await res.text();
  const root = parse(html);
  const rows = root.querySelectorAll("tbody tr");
  const items: DeptNotice[] = [];

  for (const row of rows) {
    const anchor = row.querySelector("td.td-title a") ?? row.querySelector("td a");
    if (!anchor) continue;

    const href = anchor.getAttribute("href") ?? "";
    const idMatch = href.match(/\/(\d+)\/artclView\.do/);
    if (!idMatch) continue;

    const id = idMatch[1];
    const titleEl = anchor.querySelector("strong") ?? anchor;
    const title = titleEl.text.replace(/\s+/g, " ").trim();
    const isNew = !!anchor.querySelector(".new");

    const dateTd = row.querySelector("td.td-date");
    const writerTd = row.querySelector("td.td-write");
    const viewTd = row.querySelector("td.td-access");

    const rawDate = dateTd?.text.trim() ?? "";
    const date = rawDate.replace(/\./g, "-").replace(/-$/, "");
    const writer = writerTd?.text.replace(/\s+/g, " ").trim() ?? "";
    const views = parseInt(viewTd?.text.trim() ?? "0", 10) || 0;

    const fullUrl = href.startsWith("http") ? href : `${meta.baseUrl}${href}`;
    items.push({ id, title, date, writer, views, isNew, url: fullUrl });
  }

  return items;
}

async function fetchDeptBoard(subviewUrl: string): Promise<DeptNotice[]> {
  const meta = await discoverBoard(subviewUrl);
  const seen = new Set<string>();
  const items: DeptNotice[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageItems = await fetchBoardPage(meta, page);
    if (pageItems.length === 0) break;

    let hitCutoff = false;
    for (const item of pageItems) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      if (item.date && item.date < CUTOFF_DATE) { hitCutoff = true; continue; }
      items.push(item);
    }
    if (hitCutoff) break;
  }
  return items;
}

router.get("/dept-notices", async (req, res) => {
  const deptName = (req.query.dept as string) ?? "";
  const type = (req.query.type as string) === "jobs" ? "jobs" : "notice";

  if (!deptName) {
    return res.status(400).json({ error: "dept 파라미터가 필요합니다." });
  }

  const links = DEPT_LINKS[deptName];
  if (!links) {
    return res.status(404).json({ error: `지원하지 않는 학과입니다: ${deptName}` });
  }

  const subviewUrl = type === "jobs" ? links.jobs : links.notice;
  if (!subviewUrl) {
    if (type === "jobs") {
      return res.json({ notices: [], total: 0, noJobsBoard: true });
    }
    return res.status(404).json({ error: "해당 게시판 링크가 없습니다." });
  }

  const cacheKey = `${deptName}::${type}`;
  const now = Date.now();
  const cached = dataCache[cacheKey];

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return res.json({ notices: cached.data, total: cached.data.length, fetchedAt: new Date(cached.fetchedAt).toISOString(), cached: true });
  }

  try {
    const notices = await fetchDeptBoard(subviewUrl);
    dataCache[cacheKey] = { data: notices, fetchedAt: now };
    return res.json({ notices, total: notices.length, fetchedAt: new Date(now).toISOString(), cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (cached) {
      return res.json({ notices: cached.data, total: cached.data.length, fetchedAt: new Date(cached.fetchedAt).toISOString(), cached: true, stale: true });
    }
    return res.status(500).json({ error: "학과 공지사항을 가져오지 못했습니다.", detail: message });
  }
});

router.get("/dept-list", (_req, res) => {
  const depts = Object.entries(DEPT_LINKS).map(([name, links]) => ({
    name,
    hasNotice: !!links.notice,
    hasJobs: !!links.jobs,
  }));
  return res.json({ depts });
});

export default router;
