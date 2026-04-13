import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, financesTable, insertFinanceSchema } from "@workspace/db";
import { eq, and, like, sql } from "drizzle-orm";
import { verifyToken } from "../lib/auth";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ message: "인증이 필요합니다." }); return; }
  const payload = verifyToken(auth.slice(7));
  if (!payload) { res.status(401).json({ message: "유효하지 않은 토큰입니다." }); return; }
  (req as any).userId = payload.userId;
  next();
}

router.get("/finance/summary", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const month = req.query.month as string | undefined;

    let query = db.select().from(financesTable).where(eq(financesTable.userId, userId));
    if (month) {
      query = db.select().from(financesTable).where(and(eq(financesTable.userId, userId), like(financesTable.date, `${month}%`))) as typeof query;
    }

    const records = await query;
    const totalIncome = records.filter(r => r.type === "income").reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = records.filter(r => r.type === "expense").reduce((sum, r) => sum + r.amount, 0);

    res.json({
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      month: month || new Date().toISOString().slice(0, 7),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get finance summary");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/finance", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const month = req.query.month as string | undefined;

    let query = db.select().from(financesTable)
      .where(eq(financesTable.userId, userId))
      .orderBy(sql`${financesTable.date} desc`);
    if (month) {
      query = db.select().from(financesTable)
        .where(and(eq(financesTable.userId, userId), like(financesTable.date, `${month}%`)))
        .orderBy(sql`${financesTable.date} desc`) as typeof query;
    }

    const records = await query;
    res.json(records);
  } catch (err) {
    req.log.error({ err }, "Failed to get finances");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/finance", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const data = insertFinanceSchema.parse(req.body);
    const [record] = await db.insert(financesTable).values({ ...data, userId }).returning();
    res.status(201).json(record);
  } catch (err) {
    req.log.error({ err }, "Failed to create finance record");
    res.status(400).json({ message: "Invalid request" });
  }
});

router.delete("/finance/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id);
    await db.delete(financesTable).where(and(eq(financesTable.id, id), eq(financesTable.userId, userId)));
    res.json({ message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete finance record");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
