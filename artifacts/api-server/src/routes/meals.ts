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
  name: string;
}

export const RESTAURANTS: Restaurant[] = [
  { code: "PG002", building: "R001", campus: "PUSAN", name: "금정회관 학생식당" },
  { code: "PH002", building: "R004", campus: "PUSAN", name: "학생회관 식당" },
  { code: "PM002", building: "R002", campus: "PUSAN", name: "문창회관 식당" },
  { code: "PS001", building: "R003", campus: "PUSAN", name: "샛벌회관 식당" },
  { code: "PG001", building: "R001", campus: "PUSAN", name: "금정회관 교직원식당" },
];

export interface DayMenu {
  date: string;
  day: string;
  items: string[];
  menuName: string;
  price: string;
}

export interface MealRow {
  type: string;
  hours: string;
  days: DayMenu[];
}

export interface WeekMeals {
  restaurantCode: string;
  restaurantName: string;
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
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours

function extractMenuItems(li: ReturnType<typeof parse>["childNodes"][number]): { name: string; price: string; items: string[] } {
  const el = li as ReturnType<typeof parse>;
  const h3 = (el as any).querySelector?.("h3.menu-tit01");
  if (!h3) return { name: "", price: "", items: [] };

  const titleText = h3.text.replace(/\s+/g, " ").trim();
  const dashIdx = titleText.lastIndexOf("-");
  const name = dashIdx > 0 ? titleText.slice(0, dashIdx).trim() : titleText;
  const price = dashIdx > 0 ? titleText.slice(dashIdx + 1).trim() : "";

  const fullText = (el as any).innerHTML ?? "";
  const afterH3 = fullText.replace(/<h3[^>]*>.*?<\/h3>/is, "");
  const cleaned = afterH3
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

  const items = cleaned.split("\n").map(s => s.trim()).filter(Boolean);

  return { name, price, items };
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
  const prevOnclick = prevBtn?.getAttribute("onclick") ?? "";
  const nextOnclick = nextBtn?.getAttribute("onclick") ?? "";
  const prevDate = prevOnclick.match(/'(\d{4}-\d{2}-\d{2})'/)?.[1] ?? "";
  const nextDate = nextOnclick.match(/'(\d{4}-\d{2}-\d{2})'/)?.[1] ?? "";

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
      dates.push(dateDiv.text.trim().replace(/\./g, "-").replace(/-$/, ""));
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
      const allItems: string[] = [];
      let menuName = "";
      let price = "";

      for (const li of liEls) {
        const { name, price: p, items } = extractMenuItems(li as any);
        if (!menuName && name) { menuName = name; price = p; }
        allItems.push(...items);
      }

      dayMenus.push({
        date: dates[di] ?? "",
        day: days[di] ?? "",
        items: allItems,
        menuName,
        price,
      });
    }

    mealRows.push({ type, hours, days: dayMenus });
  }

  return {
    restaurantCode: restaurant.code,
    restaurantName,
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

  // Cache key: restaurant + week (use the date as-is, server returns the week containing it)
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
