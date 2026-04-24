import { Router, type IRouter } from "express";
import { db, notificationsTable, pushTokensTable, notificationSettingsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const notifs = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    res.json(notifs);
  } catch (err) {
    req.log.error({ err }, "Failed to get notifications");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)));
    res.json({ count: result[0]?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to get unread count");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id);
    await db.update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark notification read");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    await db.update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, userId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark all read");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/notifications/push-token", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ message: "Token required" });
    await db.insert(pushTokensTable)
      .values({ userId, token, platform: platform || "ios" })
      .onConflictDoUpdate({ target: pushTokensTable.token, set: { userId } });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to register push token");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/notifications/settings", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const [row] = await db.select().from(notificationSettingsTable)
      .where(eq(notificationSettingsTable.userId, userId));
    res.json(row?.settings ?? {});
  } catch (err) {
    req.log.error({ err }, "Failed to get notification settings");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/notifications/settings", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const settings = req.body;
    await db.insert(notificationSettingsTable)
      .values({ userId, settings })
      .onConflictDoUpdate({
        target: notificationSettingsTable.userId,
        set: { settings, updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save notification settings");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
