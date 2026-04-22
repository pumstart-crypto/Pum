import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  communityPostsTable,
  communityCommentsTable,
  insertCommunityPostSchema,
  insertCommunityCommentSchema,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { ALL_PNU_DEPTS } from "../data/all-pnu-depts";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

// ── All PNU departments (for community board dept browser) ──
router.get("/community/depts", (_req, res) => {
  const seen = new Set<string>();
  const depts = ALL_PNU_DEPTS.filter(d => {
    if (seen.has(d.name)) return false;
    seen.add(d.name);
    return true;
  });
  return res.json({ depts });
});

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

// ── Create post (인증 필요) ──────────────────────────────────
router.post("/community", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const parsed = insertCommunityPostSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [post] = await db.insert(communityPostsTable).values(parsed.data).returning();
    return res.status(201).json(post);
  } catch (err) {
    req.log.error({ err }, "Failed to create post");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Edit post (인증 + 본인 글만) ─────────────────────────────
router.patch("/community/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId as number;
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

    const { title, content } = req.body as { title?: string; content?: string };
    if (!title && !content) return res.status(400).json({ message: "Nothing to update" });

    const updates: Partial<{ title: string; content: string }> = {};
    if (title) updates.title = title;
    if (content) updates.content = content;

    const [post] = await db
      .update(communityPostsTable)
      .set(updates)
      .where(and(eq(communityPostsTable.id, id), eq(communityPostsTable.userId, userId)))
      .returning();

    if (!post) return res.status(404).json({ message: "글을 찾을 수 없거나 수정 권한이 없습니다." });
    return res.json(post);
  } catch (err) {
    req.log.error({ err }, "Failed to update post");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Delete post (인증 + 본인 글만) ───────────────────────────
router.delete("/community/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId as number;
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

    const [existing] = await db
      .select({ id: communityPostsTable.id, userId: communityPostsTable.userId })
      .from(communityPostsTable)
      .where(eq(communityPostsTable.id, id));

    if (!existing) return res.status(404).json({ message: "글을 찾을 수 없습니다." });
    // userId가 null인 기존 익명 글은 작성자 본인 확인 불가 → 인증된 사용자는 삭제 가능
    // userId가 설정된 글은 본인만 삭제 가능
    if (existing.userId !== null && existing.userId !== userId) {
      return res.status(403).json({ message: "삭제 권한이 없습니다." });
    }

    await db.delete(communityCommentsTable).where(eq(communityCommentsTable.postId, id));
    await db.delete(communityPostsTable).where(eq(communityPostsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete post");
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
    req.log.error({ err }, "Failed to get comments");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Create comment (인증 필요) ────────────────────────────────
router.post("/community/:id/comments", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = (req as any).userId as number;
    const parsed = insertCommunityCommentSchema.safeParse({ ...req.body, postId, userId });
    if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
    const [comment] = await db.insert(communityCommentsTable).values(parsed.data).returning();
    return res.status(201).json(comment);
  } catch (err) {
    req.log.error({ err }, "Failed to create comment");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Delete comment (인증 + 본인 댓글만) ──────────────────────
router.delete("/community/:id/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const userId = (req as any).userId as number;

    const [existing] = await db
      .select({ id: communityCommentsTable.id, userId: communityCommentsTable.userId })
      .from(communityCommentsTable)
      .where(eq(communityCommentsTable.id, commentId));

    if (!existing) return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
    if (existing.userId !== null && existing.userId !== userId) {
      return res.status(403).json({ message: "삭제 권한이 없습니다." });
    }

    await db.delete(communityCommentsTable).where(eq(communityCommentsTable.id, commentId));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete comment");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
