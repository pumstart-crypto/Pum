import { Router, type IRouter } from "express";
import { db, schedulesTable, insertScheduleSchema } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

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
