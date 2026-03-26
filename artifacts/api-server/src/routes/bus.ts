import { Router, type IRouter } from "express";

const router: IRouter = Router();

const BUS_API_BASE = "https://apis.data.go.kr/6260000/BusanBIMS";

// Pre-defined stops around 부산대학교
export const PNU_STOPS = [
  { id: "jangjeonyeok-down", name: "장전역", dir: "시내 방향", arsno: "11071" },
  { id: "jangjeonyeok-up", name: "장전역", dir: "부산대 방향", arsno: "11281" },
  { id: "jeonmun-down", name: "부산대학교 정문", dir: "시내 방향", arsno: "11085" },
  { id: "jeonmun-up", name: "부산대학교 정문", dir: "캠퍼스 방향", arsno: "11081" },
  { id: "pumun-down", name: "부산대학교 후문", dir: "시내 방향", arsno: "11088" },
  { id: "pumun-up", name: "부산대학교 후문", dir: "캠퍼스 방향", arsno: "11089" },
  { id: "pnustation", name: "부산대역", dir: "전체", arsno: "11082" },
] as const;

interface BusArrival {
  lineNo: string;
  lineId: string;
  busType: string;
  next: { carNo: string; min: number; stations: number; lowFloor: boolean; seat: number } | null;
  next2: { carNo: string; min: number; stations: number; lowFloor: boolean; seat: number } | null;
}

interface StopArrivals {
  arsno: string;
  stopName: string;
  arrivals: BusArrival[];
  fetchedAt: string;
}

interface CacheEntry {
  data: StopArrivals;
  fetchedAt: number;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 20 * 1000; // 20-second cache for real-time data

function parseXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`, "s"));
  return match?.[1]?.trim() ?? "";
}

async function fetchStopArrivals(arsno: string, stopName: string): Promise<StopArrivals> {
  const apiKey = process.env.BUS_API_KEY;
  if (!apiKey) throw new Error("BUS_API_KEY 환경변수가 설정되지 않았습니다.");

  const url = `${BUS_API_BASE}/bitArrByArsno?serviceKey=${apiKey}&arsno=${arsno}&numOfRows=30&pageNo=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);

  const xml = await res.text();
  const resultCode = parseXml(xml, "resultCode");
  if (resultCode !== "00") {
    throw new Error(`API 오류: ${parseXml(xml, "resultMsg")}`);
  }

  const itemBlocks = xml.split("<item>").slice(1);
  const arrivals: BusArrival[] = [];

  for (const block of itemBlocks) {
    const lineNo = parseXml(block, "lineno");
    const lineId = parseXml(block, "lineid");
    const busType = parseXml(block, "bustype");

    if (!lineNo) continue;

    // First approaching bus
    const carNo1 = parseXml(block, "carno1");
    const min1Str = parseXml(block, "min1");
    const station1Str = parseXml(block, "station1");
    const lowPlate1 = parseXml(block, "lowplate1");
    const seat1Str = parseXml(block, "seat1");

    // Second approaching bus
    const carNo2 = parseXml(block, "carno2");
    const min2Str = parseXml(block, "min2");
    const station2Str = parseXml(block, "station2");
    const lowPlate2 = parseXml(block, "lowplate2");
    const seat2Str = parseXml(block, "seat2");

    const next = carNo1 && min1Str !== ""
      ? {
          carNo: carNo1,
          min: parseInt(min1Str),
          stations: parseInt(station1Str) || 0,
          lowFloor: lowPlate1 === "1",
          seat: parseInt(seat1Str) || -1,
        }
      : null;

    const next2 = carNo2 && min2Str !== ""
      ? {
          carNo: carNo2,
          min: parseInt(min2Str),
          stations: parseInt(station2Str) || 0,
          lowFloor: lowPlate2 === "1",
          seat: parseInt(seat2Str) || -1,
        }
      : null;

    arrivals.push({ lineNo, lineId, busType, next, next2 });
  }

  // Sort: routes with live data first, then alphabetically
  arrivals.sort((a, b) => {
    const aHas = a.next !== null ? 0 : 1;
    const bHas = b.next !== null ? 0 : 1;
    if (aHas !== bHas) return aHas - bHas;
    if (a.next && b.next) return a.next.min - b.next.min;
    return a.lineNo.localeCompare(b.lineNo);
  });

  return {
    arsno,
    stopName,
    arrivals,
    fetchedAt: new Date().toISOString(),
  };
}

// GET /bus/stops - return predefined stop list
router.get("/bus/stops", (_req, res) => {
  return res.json({ stops: PNU_STOPS });
});

// GET /bus/arrivals?arsno=xxx - real-time arrivals at a stop
router.get("/bus/arrivals", async (req, res) => {
  const arsno = req.query.arsno as string;
  if (!arsno) return res.status(400).json({ error: "arsno 파라미터가 필요합니다." });

  const stopInfo = PNU_STOPS.find(s => s.arsno === arsno);
  const stopName = stopInfo ? `${stopInfo.name} (${stopInfo.dir})` : `정류소 ${arsno}`;

  const now = Date.now();
  const cached = cache[arsno];
  if (cached && now - cached.fetchedAt < CACHE_TTL) {
    return res.json({ ...cached.data, cached: true });
  }

  try {
    const data = await fetchStopArrivals(arsno, stopName);
    cache[arsno] = { data, fetchedAt: now };
    return res.json({ ...data, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (cached) return res.json({ ...cached.data, cached: true, stale: true });
    return res.status(500).json({ error: "버스 도착 정보를 불러오지 못했습니다.", detail: message });
  }
});

export default router;
