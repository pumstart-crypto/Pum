import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, schedulesTable, insertScheduleSchema } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "../lib/auth";

const router: IRouter = Router();

// ── 인증 미들웨어 ──────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ message: "인증이 필요합니다." });
    return;
  }
  const payload = verifyToken(auth.slice(7));
  if (!payload) {
    res.status(401).json({ message: "유효하지 않은 토큰입니다." });
    return;
  }
  (req as any).userId = payload.userId;
  next();
}

// ── GET /schedule ──────────────────────────────────────────────
router.get("/schedule", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const schedules = await db
      .select()
      .from(schedulesTable)
      .where(eq(schedulesTable.userId, userId))
      .orderBy(schedulesTable.dayOfWeek, schedulesTable.startTime);
    res.json(schedules);
  } catch (err) {
    req.log.error({ err }, "Failed to get schedules");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /schedule ─────────────────────────────────────────────
router.post("/schedule", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const data = insertScheduleSchema.parse({ ...req.body, userId });
    const [schedule] = await db.insert(schedulesTable).values(data).returning();
    res.status(201).json(schedule);
  } catch (err) {
    req.log.error({ err }, "Failed to create schedule");
    res.status(400).json({ message: "Invalid request" });
  }
});

// ── PUT /schedule/:id ──────────────────────────────────────────
router.put("/schedule/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id);
    const data = insertScheduleSchema.parse({ ...req.body, userId });
    const [schedule] = await db
      .update(schedulesTable)
      .set(data)
      .where(and(eq(schedulesTable.id, id), eq(schedulesTable.userId, userId)))
      .returning();
    if (!schedule) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(schedule);
  } catch (err) {
    req.log.error({ err }, "Failed to update schedule");
    res.status(400).json({ message: "Invalid request" });
  }
});

// ── DELETE /schedule/:id ───────────────────────────────────────
router.delete("/schedule/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id);
    await db
      .delete(schedulesTable)
      .where(and(eq(schedulesTable.id, id), eq(schedulesTable.userId, userId)));
    res.json({ message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete schedule");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
