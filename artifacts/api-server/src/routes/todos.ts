import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, todosTable, insertTodoSchema } from "@workspace/db";
import { eq, and, asc, desc } from "drizzle-orm";
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

router.get("/todos", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const todos = await db.select().from(todosTable)
      .where(eq(todosTable.userId, userId))
      .orderBy(asc(todosTable.completed), desc(todosTable.createdAt));
    res.json(todos);
  } catch (err) {
    req.log.error({ err }, "Failed to get todos");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/todos", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const parsed = insertTodoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input" });
    }
    const [todo] = await db.insert(todosTable).values({ ...parsed.data, userId }).returning();
    res.status(201).json(todo);
  } catch (err) {
    req.log.error({ err }, "Failed to create todo");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/todos/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id);
    const { completed, title, dueDate, courseName } = req.body;
    const [updated] = await db
      .update(todosTable)
      .set({
        ...(completed !== undefined && { completed }),
        ...(title && { title }),
        ...(dueDate !== undefined && { dueDate }),
        ...(courseName !== undefined && { courseName }),
      })
      .where(and(eq(todosTable.id, id), eq(todosTable.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update todo");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/todos/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id);
    await db.delete(todosTable).where(and(eq(todosTable.id, id), eq(todosTable.userId, userId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete todo");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
