import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  communityPostsTable,
  communityCommentsTable,
  insertCommunityPostSchema,
  insertCommunityCommentSchema,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

const router: IRouter = Router();

// ── List posts ──────────────────────────────
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

// ── Get single post (+ increment views) ──────
router.get("/community/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

    await db
      .update(communityPostsTable)
      .set({ views: sql`${communityPostsTable.views} + 1` })
      .where(eq(communityPostsTable.id, id));

    const [post] = await db
      .select()
      .from(communityPostsTable)
      .where(eq(communityPostsTable.id, id));

    if (!post) return res.status(404).json({ message: "Post not found" });
    return res.json(post);
  } catch (err) {
    req.log.error({ err }, "Failed to get post");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Create post ──────────────────────────────
router.post("/community", async (req, res) => {
  try {
    const parsed = insertCommunityPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [post] = await db.insert(communityPostsTable).values(parsed.data).returning();
    return res.status(201).json(post);
  } catch (err) {
    req.log.error({ err }, "Failed to create post");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Edit post ────────────────────────────────
router.patch("/community/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, content } = req.body as { title?: string; content?: string };
    if (!title && !content) return res.status(400).json({ message: "Nothing to update" });

    const updates: Partial<{ title: string; content: string }> = {};
    if (title) updates.title = title;
    if (content) updates.content = content;

    const [post] = await db
      .update(communityPostsTable)
      .set(updates)
      .where(eq(communityPostsTable.id, id))
      .returning();

    return res.json(post);
  } catch (err) {
    req.log.error({ err }, "Failed to update post");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Delete post ──────────────────────────────
router.delete("/community/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(communityCommentsTable).where(eq(communityCommentsTable.postId, id));
    await db.delete(communityPostsTable).where(eq(communityPostsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── List comments ────────────────────────────
router.get("/community/:id/comments", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const comments = await db
      .select()
      .from(communityCommentsTable)
      .where(eq(communityCommentsTable.postId, postId))
      .orderBy(communityCommentsTable.createdAt);
    return res.json({ comments, total: comments.length });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Create comment ───────────────────────────
router.post("/community/:id/comments", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const parsed = insertCommunityCommentSchema.safeParse({ ...req.body, postId });
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [comment] = await db.insert(communityCommentsTable).values(parsed.data).returning();
    return res.status(201).json(comment);
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Delete comment ───────────────────────────
router.delete("/community/:id/comments/:commentId", async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    await db.delete(communityCommentsTable).where(eq(communityCommentsTable.id, commentId));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
