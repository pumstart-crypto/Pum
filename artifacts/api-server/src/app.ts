import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("etag", false);
app.set("trust proxy", 1); // Replit 프록시의 X-Forwarded-For 신뢰 → IP별 Rate Limit 정확히 작동

// ── 보안 헤더 (helmet) ────────────────────────────────────────
app.use(helmet());

// ── CORS: Replit 도메인만 허용 ────────────────────────────────
const ALLOWED_ORIGINS = (process.env["ALLOWED_ORIGINS"] ?? "").split(",").map(s => s.trim()).filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // 앱 자체 요청(origin 없음) 또는 허용 목록이면 통과
      if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// ── 전역 Rate Limit (IP당 1분 150회) ─────────────────────────
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 150,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
  }),
);

// ── 요청 로거 ─────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

export default app;
