import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, gradesTable, insertGradeSchema } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
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

router.get("/grades", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const grades = await db.select().from(gradesTable)
      .where(eq(gradesTable.userId, userId))
      .orderBy(asc(gradesTable.year), asc(gradesTable.semester));
    res.json(grades);
  } catch (err) {
    req.log.error({ err }, "Failed to get grades");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/grades", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const parsed = insertGradeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const [grade] = await db.insert(gradesTable).values({ ...parsed.data, userId }).returning();
    res.status(201).json(grade);
  } catch (err) {
    req.log.error({ err }, "Failed to create grade");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/grades/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id);
    const { subjectName, credits, grade, year, semester, category, isRetake } = req.body;
    const [updated] = await db
      .update(gradesTable)
      .set({
        ...(subjectName && { subjectName }),
        ...(credits !== undefined && { credits }),
        ...(grade && { grade }),
        ...(year !== undefined && { year }),
        ...(semester && { semester }),
        ...(category && { category }),
        ...(isRetake !== undefined && { isRetake }),
      })
      .where(eq(gradesTable.id, id) && eq(gradesTable.userId, userId) as any)
      .returning();
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update grade");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/grades/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id);
    await db.delete(gradesTable).where(eq(gradesTable.id, id) && eq(gradesTable.userId, userId) as any);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete grade");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
