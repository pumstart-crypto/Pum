import { Router, type IRouter } from "express";
import { db, todosTable, insertTodoSchema } from "@workspace/db";
import { eq, asc, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/todos", async (req, res) => {
  try {
    const todos = await db.select().from(todosTable).orderBy(asc(todosTable.completed), desc(todosTable.createdAt));
    res.json(todos);
  } catch (err) {
    req.log.error({ err }, "Failed to get todos");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/todos", async (req, res) => {
  try {
    const parsed = insertTodoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input" });
    }
    const [todo] = await db.insert(todosTable).values(parsed.data).returning();
    res.status(201).json(todo);
  } catch (err) {
    req.log.error({ err }, "Failed to create todo");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/todos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { completed, title, dueDate } = req.body;
    const [updated] = await db
      .update(todosTable)
      .set({ ...(completed !== undefined && { completed }), ...(title && { title }), ...(dueDate !== undefined && { dueDate }) })
      .where(eq(todosTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update todo");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/todos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(todosTable).where(eq(todosTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete todo");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
