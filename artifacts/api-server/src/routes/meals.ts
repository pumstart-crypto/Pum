import { Router, type IRouter } from "express";
import { parse } from "node-html-parser";

const router: IRouter = Router();

interface Menu {
  name: string;
  price: string;
  items: string[];
}

interface MealType {
  type: string;
  menus: Menu[];
}

interface Cafeteria {
  name: string;
  hours: string[];
  isFaculty: boolean;
  meals: MealType[];
}

interface MealsData {
  date: string;
  cafeterias: Cafeteria[];
  fetchedAt: string;
}

let cache: { data: MealsData; day: string } | null = null;

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

function parseNamePrice(raw: string): { name: string; price: string } {
  const parts = raw.trim().split(/[-–]\s*(?=\d)/);
  if (parts.length >= 2) {
    const name = parts[0].trim();
    const price = raw.slice(name.length + 1).trim();
    return { name, price };
  }
  return { name: raw.trim(), price: "" };
}

async function fetchMeals(): Promise<MealsData> {
  const response = await fetch("https://m.pusan.ac.kr/ko/meals", {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CampusLife/1.0)",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const root = parse(html);

  // Get date
  const dateH4 = root.querySelector("h4");
  const date = dateH4?.text.trim() || new Date().toLocaleDateString("ko-KR");

  // Parse cafeterias - both student and faculty lists
  const cafeteriaEls = root.querySelectorAll("div.student_list, div.faculty_list");
  const cafeterias: Cafeteria[] = [];

  for (const el of cafeteriaEls) {
    const name = el.querySelector("h5.title")?.text.trim();
    if (!name) continue;

    const isFaculty = el.classList.contains("faculty_list");
    const hours = el.querySelectorAll("span.part").map((s) => s.text.trim());

    const mealItems = el.querySelectorAll("li.item");
    const meals: MealType[] = [];

    for (const item of mealItems) {
      const mealTypeName = item.querySelector(".icon strong")?.text.trim();
      if (!mealTypeName) continue;

      const context = item.querySelector(".context");
      if (!context) continue;

      const isEmpty = !!context.querySelector("p.empty");
      const menus: Menu[] = [];

      if (!isEmpty) {
        // Find all blue_text strong elements (meal names/prices)
        const html = context.innerHTML;
        const menuMatches = [...html.matchAll(/<strong class="blue_text">([^<]+)<\/strong>\s*<p><span>([\s\S]*?)<\/span><\/p>/g)];
        for (const m of menuMatches) {
          const rawName = m[1].replace(/&amp;/g, "&").trim();
          const { name: menuName, price } = parseNamePrice(rawName);
          const itemsRaw = m[2].replace(/&amp;/g, "&").trim();
          const items = itemsRaw.split("\n").map((s) => s.trim()).filter(Boolean);
          menus.push({ name: menuName, price, items });
        }
      }

      meals.push({ type: mealTypeName, menus });
    }

    if (meals.length > 0) {
      cafeterias.push({ name, hours, isFaculty, meals });
    }
  }

  return { date, cafeterias, fetchedAt: new Date().toISOString() };
}

router.get("/meals", async (req, res) => {
  try {
    const todayKey = getTodayKey();

    if (cache && cache.day === todayKey) {
      return res.json(cache.data);
    }

    const data = await fetchMeals();
    cache = { data, day: todayKey };
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch meals");
    res.status(500).json({ message: "식단 정보를 불러오지 못했습니다." });
  }
});

export default router;
