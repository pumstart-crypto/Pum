import { type Request, type Response, type NextFunction } from "express";
import { db, sessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { verifyToken } from "../lib/auth";

/**
 * JWT 서명 검증 + DB 세션 존재 여부 확인
 * 로그아웃 또는 만료된 세션의 토큰은 거부
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ message: "인증이 필요합니다." }); return;
  }

  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ message: "유효하지 않은 토큰입니다." }); return;
  }

  // DB 세션 유효성 확인 (로그아웃/강제 만료 처리)
  const now = new Date();
  const [session] = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, now)))
    .limit(1);

  if (!session) {
    res.status(401).json({ message: "세션이 만료되었습니다. 다시 로그인해주세요." }); return;
  }

  (req as any).userId = payload.userId;
  next();
}
