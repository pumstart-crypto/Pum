import { Router, type IRouter } from "express";

const router: IRouter = Router();

const BUS_API_BASE = "https://apis.data.go.kr/6260000/BusanBIMS";
const GEUMJEONG7_LINE_ID = "5291107000";

interface StopInfo {
  idx: number;
  name: string;
  arsno: string;
  nodeId: string;
  lat: number | null;
  lng: number | null;
  isEndPoint: boolean;
}

interface BusInfo {
  idx: number;
  stopName: string;
  carNo: string;
  lat: number;
  lng: number;
  lowFloor: boolean;
}

interface RouteData {
  lineId: string;
  lineName: string;
  stops: StopInfo[];
  buses: BusInfo[];
  fetchedAt: string;
  outboundCount: number;
  inboundCount: number;
}

interface CacheEntry {
  data: RouteData;
  fetchedAt: number;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 30 * 1000; // 30 seconds for real-time data

function parseXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`, "s"));
  return match?.[1]?.trim() ?? "";
}

async function fetchRouteData(lineId: string): Promise<RouteData> {
  const apiKey = process.env.BUS_API_KEY;
  if (!apiKey) throw new Error("BUS_API_KEY 환경변수가 설정되지 않았습니다.");

  const url = `${BUS_API_BASE}/busInfoByRouteId?serviceKey=${apiKey}&lineId=${lineId}&numOfRows=150&pageNo=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);

  const xml = await res.text();
  const resultCode = parseXml(xml, "resultCode");
  if (resultCode !== "00") {
    throw new Error(`API 오류: ${parseXml(xml, "resultMsg")}`);
  }

  const itemBlocks = xml.split("<item>").slice(1);
  const stops: StopInfo[] = [];
  const buses: BusInfo[] = [];

  for (const block of itemBlocks) {
    const idx = parseInt(parseXml(block, "bstopidx") || "0");
    const name = parseXml(block, "bstopnm");
    const arsno = parseXml(block, "arsno");
    const nodeId = parseXml(block, "nodeid");
    const latStr = parseXml(block, "lat");
    const lngStr = parseXml(block, "lin");
    const rpoint = parseXml(block, "rpoint");
    const carNo = parseXml(block, "carno");
    const lowPlate = parseXml(block, "lowplate");

    if (!name) continue;

    const lat = latStr ? parseFloat(latStr) : null;
    const lng = lngStr ? parseFloat(lngStr) : null;

    stops.push({
      idx,
      name,
      arsno,
      nodeId,
      lat: null,
      lng: null,
      isEndPoint: rpoint === "1",
    });

    if (carNo && lat !== null && lng !== null) {
      buses.push({
        idx,
        stopName: name,
        carNo,
        lat,
        lng,
        lowFloor: lowPlate === "1",
      });
    }
  }

  stops.sort((a, b) => a.idx - b.idx);
  buses.sort((a, b) => a.idx - b.idx);

  const midpoint = Math.ceil(stops.length / 2);
  const outboundBuses = buses.filter(b => b.idx <= midpoint);
  const inboundBuses = buses.filter(b => b.idx > midpoint);

  return {
    lineId,
    lineName: "금정구7",
    stops,
    buses,
    fetchedAt: new Date().toISOString(),
    outboundCount: outboundBuses.length,
    inboundCount: inboundBuses.length,
  };
}

router.get("/bus/route", async (req, res) => {
  const lineId = (req.query.lineId as string) || GEUMJEONG7_LINE_ID;
  const now = Date.now();
  const cached = cache[lineId];

  if (cached && now - cached.fetchedAt < CACHE_TTL) {
    return res.json({ ...cached.data, cached: true });
  }

  try {
    const data = await fetchRouteData(lineId);
    cache[lineId] = { data, fetchedAt: now };
    return res.json({ ...data, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (cached) return res.json({ ...cached.data, cached: true, stale: true });
    return res.status(500).json({ error: "버스 정보를 불러오지 못했습니다.", detail: message });
  }
});

// Real-time bus positions only (lightweight, 15s cache)
router.get("/bus/positions", async (req, res) => {
  const lineId = (req.query.lineId as string) || GEUMJEONG7_LINE_ID;
  const apiKey = process.env.BUS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API 키가 설정되지 않았습니다." });

  try {
    const url = `${BUS_API_BASE}/busInfoByRouteId?serviceKey=${apiKey}&lineId=${lineId}&numOfRows=150&pageNo=1`;
    const xmlRes = await fetch(url);
    const xml = await xmlRes.text();
    const itemBlocks = xml.split("<item>").slice(1);
    const buses: BusInfo[] = [];

    for (const block of itemBlocks) {
      const carNo = parseXml(block, "carno");
      if (!carNo) continue;
      const lat = parseFloat(parseXml(block, "lat"));
      const lng = parseFloat(parseXml(block, "lin"));
      if (!lat || !lng) continue;
      buses.push({
        idx: parseInt(parseXml(block, "bstopidx") || "0"),
        stopName: parseXml(block, "bstopnm"),
        carNo,
        lat,
        lng,
        lowFloor: parseXml(block, "lowplate") === "1",
      });
    }

    return res.json({ buses, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return res.status(500).json({ error: msg });
  }
});

// Arrival info for a specific stop
router.get("/bus/arrivals", async (req, res) => {
  const arsno = req.query.arsno as string;
  if (!arsno) return res.status(400).json({ error: "arsno 파라미터가 필요합니다." });

  const apiKey = process.env.BUS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API 키가 설정되지 않았습니다." });

  try {
    const url = `${BUS_API_BASE}/bitArrByArsno?serviceKey=${apiKey}&arsno=${arsno}&numOfRows=10&pageNo=1`;
    const xmlRes = await fetch(url);
    const xml = await xmlRes.text();
    const itemBlocks = xml.split("<item>").slice(1);
    const arrivals = itemBlocks.map(block => ({
      lineNo: parseXml(block, "lineno"),
      arrTime: parseXml(block, "arrtime"),
      arrCount: parseXml(block, "arrprevstationcnt"),
      lowFloor: parseXml(block, "lowplate") === "1",
    })).filter(a => a.lineNo);

    return res.json({ arsno, arrivals, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return res.status(500).json({ error: msg });
  }
});

export default router;
