import { Router, type IRouter } from "express";
import { parse } from "node-html-parser";

const router: IRouter = Router();

const BASE_URL = "https://www.pusan.ac.kr/kor/CMS/MenuMgr/menuListOnBuilding.do?mCode=MN202";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Content-Type": "application/x-www-form-urlencoded",
  "Referer": BASE_URL,
};

export interface Restaurant {
  code: string;
  building: string;
  campus: string;
  campusLabel: string;
  name: string;
}

export const RESTAURANTS: Restaurant[] = [
  { code: "PG002", building: "R001", campus: "PUSAN",   campusLabel: "부산", name: "금정회관 학생식당" },
  { code: "PH002", building: "R004", campus: "PUSAN",   campusLabel: "부산", name: "학생회관 식당" },
  { code: "PG001", building: "R001", campus: "PUSAN",   campusLabel: "부산", name: "금정회관 교직원식당" },
  { code: "M001",  building: "R005", campus: "MIRYANG", campusLabel: "밀양", name: "학생회관 학생식당" },
  { code: "M002",  building: "R005", campus: "MIRYANG", campusLabel: "밀양", name: "학생회관 교직원식당" },
  { code: "Y001",  building: "R006", campus: "YANGSAN", campusLabel: "양산", name: "편의동 식당" },
];

export interface SubMenu {
  name: string;
  price: string;
  items: string[];
  isCheapBreakfast: boolean;
}

export interface DayMenu {
  date: string;
  day: string;
  subMenus: SubMenu[];
}

export interface MealRow {
  type: string;
  hours: string;
  days: DayMenu[];
}

export interface WeekMeals {
  restaurantCode: string;
  restaurantName: string;
  campus: string;
  campusLabel: string;
  weekLabel: string;
  dates: string[];
  days: string[];
  mealRows: MealRow[];
  prevDate: string;
  nextDate: string;
  fetchedAt: string;
}

interface CacheEntry {
  data: WeekMeals;
  fetchedAt: number;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 3 * 60 * 60 * 1000;

function parseMenuTitle(titleText: string): { name: string; price: string; isCheapBreakfast: boolean } {
  const text = titleText.replace(/\s+/g, " ").trim();
  const lastDash = text.lastIndexOf("-");
  const name = lastDash > 0 ? text.slice(0, lastDash).trim() : text;
  const price = lastDash > 0 ? text.slice(lastDash + 1).trim() : "";
  const isCheapBreakfast = text.includes("천원의아침") || text.includes("천원의 아침");
  return { name, price, isCheapBreakfast };
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "");
}

function parseLiElement(liEl: any): SubMenu | null {
  const h3 = liEl.querySelector?.("h3.menu-tit01, h3.menu-tit03");
  if (!h3) return null;

  const { name, price, isCheapBreakfast } = parseMenuTitle(h3.text);
  const fullHtml: string = liEl.innerHTML ?? "";
  const afterH3 = fullHtml.replace(/<h3[^>]*>[\s\S]*?<\/h3>/i, "");
  const rawText = htmlToText(afterH3);
  const items = rawText.split("\n").map((s: string) => s.trim()).filter(Boolean);

  return { name, price, items, isCheapBreakfast };
}

async function fetchWeekMeals(restaurant: Restaurant, date: string): Promise<WeekMeals> {
  const body = new URLSearchParams({
    campus_gb: restaurant.campus,
    building_gb: restaurant.building,
    restaurant_code: restaurant.code,
    menu_date: date,
  }).toString();

  const res = await fetch(BASE_URL, { method: "POST", headers: HEADERS, body });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const root = parse(html);

  const navi = root.querySelector("div.menu-navi");
  const weekLabel = navi?.querySelector("span.loca")?.text.trim() ?? "";
  const restaurantName = navi?.querySelector("span.term")?.text.trim() ?? restaurant.name;

  const prevBtn = navi?.querySelector("button.prev");
  const nextBtn = navi?.querySelector("button.next");
  const prevDate = (prevBtn?.getAttribute("onclick") ?? "").match(/'(\d{4}-\d{2}-\d{2})'/)?.[1] ?? "";
  const nextDate = (nextBtn?.getAttribute("onclick") ?? "").match(/'(\d{4}-\d{2}-\d{2})'/)?.[1] ?? "";

  const table = root.querySelector("table.menu-tbl");
  if (!table) throw new Error("메뉴 테이블을 찾을 수 없습니다");

  const headerCells = table.querySelectorAll("thead th");
  const dates: string[] = [];
  const days: string[] = [];
  for (const th of headerCells) {
    const dayDiv = th.querySelector("div.day");
    const dateDiv = th.querySelector("div.date");
    if (dayDiv && dateDiv) {
      days.push(dayDiv.text.trim());
      const rawDate = dateDiv.text.trim().replace(/\./g, "-").replace(/-$/, "");
      dates.push(rawDate);
    }
  }

  const bodyRows = table.querySelectorAll("tbody tr");
  const mealRows: MealRow[] = [];

  for (const row of bodyRows) {
    const rowHeader = row.querySelector("th[scope=row]");
    if (!rowHeader) continue;

    const rowText = rowHeader.innerText.replace(/\s+/g, " ").trim();
    const parts = rowText.split(/\s+/);
    const type = parts[0] ?? "";
    const hours = parts.slice(1).join(" ").replace(/~/g, "~");

    const tds = row.querySelectorAll("td");
    const dayMenus: DayMenu[] = [];

    for (let di = 0; di < tds.length; di++) {
      const td = tds[di];
      const liEls = td.querySelectorAll("li");
      const subMenus: SubMenu[] = [];

      for (const li of liEls) {
        const subMenu = parseLiElement(li as any);
        if (subMenu) subMenus.push(subMenu);
      }

      dayMenus.push({
        date: dates[di] ?? "",
        day: days[di] ?? "",
        subMenus,
      });
    }

    mealRows.push({ type, hours, days: dayMenus });
  }

  return {
    restaurantCode: restaurant.code,
    restaurantName: restaurantName.trim(),
    campus: restaurant.campus,
    campusLabel: restaurant.campusLabel,
    weekLabel,
    dates,
    days,
    mealRows,
    prevDate,
    nextDate,
    fetchedAt: new Date().toISOString(),
  };
}

router.get("/meals", async (req, res) => {
  const restaurantCode = (req.query.restaurant as string) || "PG002";
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

  const restaurant = RESTAURANTS.find(r => r.code === restaurantCode) ?? RESTAURANTS[0];

  const cacheKey = `${restaurantCode}_${date}`;
  const now = Date.now();
  const cached = cache[cacheKey];
  if (cached && now - cached.fetchedAt < CACHE_TTL) {
    return res.json({ ...cached.data, cached: true });
  }

  try {
    const data = await fetchWeekMeals(restaurant, date);
    cache[cacheKey] = { data, fetchedAt: now };
    return res.json({ ...data, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (cached) return res.json({ ...cached.data, cached: true, stale: true });
    return res.status(500).json({ error: "식단 정보를 불러오지 못했습니다.", detail: message });
  }
});

router.get("/meals/restaurants", (_req, res) => {
  res.json(RESTAURANTS);
});

export default router;
