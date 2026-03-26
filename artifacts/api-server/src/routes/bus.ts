import { Router, type IRouter } from "express";

const router: IRouter = Router();

const BUS_API_BASE = "https://apis.data.go.kr/6260000/BusanBIMS";
const GEUMJEONG7_LINE_ID = "5291107000";
const MIDPOINT_IDX = 14; // 부산대경암체육관 = turnaround stop

interface StopInfo {
  idx: number;
  name: string;
  arsno: string;
  nodeId: string;
  isEndPoint: boolean;
}

interface BusOnRoute {
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
  buses: BusOnRoute[];
  fetchedAt: string;
  outboundCount: number;
  inboundCount: number;
  cached?: boolean;
  stale?: boolean;
}

interface CacheEntry {
  data: RouteData;
  fetchedAt: number;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 10 * 1000; // 10 seconds

function parseXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`, "s"));
  return match?.[1]?.trim() ?? "";
}

async function fetchRouteData(lineId: string): Promise<RouteData> {
  const apiKey = process.env.BUS_API_KEY;
  if (!apiKey) throw new Error("BUS_API_KEY 환경변수가 설정되지 않았습니다.");

  // NOTE: parameter must be lowercase 'lineid', not 'lineId'
  const url = `${BUS_API_BASE}/busInfoByRouteId?serviceKey=${apiKey}&lineid=${lineId}&numOfRows=150&pageNo=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);

  const xml = await res.text();
  const resultCode = parseXml(xml, "resultCode");
  if (resultCode !== "00") {
    throw new Error(`API 오류: ${parseXml(xml, "resultMsg")}`);
  }

  const itemBlocks = xml.split("<item>").slice(1);
  const stops: StopInfo[] = [];
  const buses: BusOnRoute[] = [];

  for (const block of itemBlocks) {
    const idx = parseInt(parseXml(block, "bstopidx") || "0");
    const name = parseXml(block, "bstopnm");
    const arsno = parseXml(block, "arsno");
    const nodeId = parseXml(block, "nodeid");
    const rpoint = parseXml(block, "rpoint");
    const carNo = parseXml(block, "carno");
    const latStr = parseXml(block, "lat");
    const lngStr = parseXml(block, "lin");
    const lowPlate = parseXml(block, "lowplate");

    if (!name) continue;

    stops.push({
      idx,
      name,
      arsno,
      nodeId,
      isEndPoint: rpoint === "1",
    });

    const lat = latStr ? parseFloat(latStr) : null;
    const lng = lngStr ? parseFloat(lngStr) : null;

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

  const outboundBuses = buses.filter(b => b.idx <= MIDPOINT_IDX);
  const inboundBuses = buses.filter(b => b.idx > MIDPOINT_IDX);

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

export default router;
