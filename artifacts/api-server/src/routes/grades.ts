import { Router, type IRouter } from "express";
import { db, gradesTable, insertGradeSchema } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/grades", async (req, res) => {
  try {
    const grades = await db.select().from(gradesTable).orderBy(asc(gradesTable.year), asc(gradesTable.semester));
    res.json(grades);
  } catch (err) {
    req.log.error({ err }, "Failed to get grades");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/grades", async (req, res) => {
  try {
    const parsed = insertGradeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const [grade] = await db.insert(gradesTable).values(parsed.data).returning();
    res.status(201).json(grade);
  } catch (err) {
    req.log.error({ err }, "Failed to create grade");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/grades/:id", async (req, res) => {
  try {
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
      .where(eq(gradesTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update grade");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/grades/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(gradesTable).where(eq(gradesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete grade");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
