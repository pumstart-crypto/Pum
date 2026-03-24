import { Router, type IRouter } from "express";
import { db, schedulesTable, insertScheduleSchema } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/schedule", async (req, res) => {
  try {
    const schedules = await db.select().from(schedulesTable).orderBy(schedulesTable.dayOfWeek, schedulesTable.startTime);
    res.json(schedules);
  } catch (err) {
    req.log.error({ err }, "Failed to get schedules");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/schedule", async (req, res) => {
  try {
    const data = insertScheduleSchema.parse(req.body);
    const [schedule] = await db.insert(schedulesTable).values(data).returning();
    res.status(201).json(schedule);
  } catch (err) {
    req.log.error({ err }, "Failed to create schedule");
    res.status(400).json({ message: "Invalid request" });
  }
});

router.put("/schedule/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = insertScheduleSchema.parse(req.body);
    const [schedule] = await db.update(schedulesTable).set(data).where(eq(schedulesTable.id, id)).returning();
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

router.delete("/schedule/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(schedulesTable).where(eq(schedulesTable.id, id));
    res.json({ message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete schedule");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
