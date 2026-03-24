import { Router, type IRouter } from "express";
import { db, financesTable, insertFinanceSchema } from "@workspace/db";
import { eq, and, like, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/finance/summary", async (req, res) => {
  try {
    const month = req.query.month as string | undefined;

    let query = db.select().from(financesTable);
    if (month) {
      query = query.where(like(financesTable.date, `${month}%`)) as typeof query;
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

router.get("/finance", async (req, res) => {
  try {
    const month = req.query.month as string | undefined;

    let query = db.select().from(financesTable).orderBy(sql`${financesTable.date} desc`);
    if (month) {
      query = db.select().from(financesTable).where(like(financesTable.date, `${month}%`)).orderBy(sql`${financesTable.date} desc`);
    }

    const records = await query;
    res.json(records);
  } catch (err) {
    req.log.error({ err }, "Failed to get finances");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/finance", async (req, res) => {
  try {
    const data = insertFinanceSchema.parse(req.body);
    const [record] = await db.insert(financesTable).values(data).returning();
    res.status(201).json(record);
  } catch (err) {
    req.log.error({ err }, "Failed to create finance record");
    res.status(400).json({ message: "Invalid request" });
  }
});

router.delete("/finance/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(financesTable).where(eq(financesTable.id, id));
    res.json({ message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete finance record");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
