import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { communityPostsTable, insertCommunityPostSchema } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/community", async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const subCategory = req.query.subCategory as string | undefined;

    const conditions = [];
    if (category && category !== "전체") conditions.push(eq(communityPostsTable.category, category));
    if (subCategory && subCategory !== "전체" && subCategory !== "전체 질문") {
      conditions.push(eq(communityPostsTable.subCategory, subCategory));
    }

    const posts = await db
      .select()
      .from(communityPostsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(communityPostsTable.createdAt));

    return res.json({ posts, total: posts.length });
  } catch (err) {
    req.log.error({ err }, "Failed to get community posts");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/community", async (req, res) => {
  try {
    const parsed = insertCommunityPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
    }
    const [post] = await db.insert(communityPostsTable).values(parsed.data).returning();
    return res.status(201).json(post);
  } catch (err) {
    req.log.error({ err }, "Failed to create community post");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/community/:id/view", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db
      .update(communityPostsTable)
      .set({ views: db.$count(communityPostsTable) })
      .where(eq(communityPostsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/community/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(communityPostsTable).where(eq(communityPostsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
