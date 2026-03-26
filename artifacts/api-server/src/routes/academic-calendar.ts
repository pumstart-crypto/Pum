import { Router, type IRouter } from "express";

const router: IRouter = Router();

const ACADEMIC_EVENTS = [
  { id: "1", title: "1학기 개강", startDate: "2025-03-03", category: "행사", color: "#3B82F6" },
  { id: "2", title: "수강정정 기간", startDate: "2025-03-03", endDate: "2025-03-07", category: "수강신청", color: "#8B5CF6" },
  { id: "3", title: "학부 중간고사", startDate: "2025-04-14", endDate: "2025-04-18", category: "시험", color: "#EF4444" },
  { id: "4", title: "어린이날 (공휴일)", startDate: "2025-05-05", category: "행사", color: "#10B981" },
  { id: "5", title: "석가탄신일 (공휴일)", startDate: "2025-05-12", category: "행사", color: "#10B981" },
  { id: "6", title: "학부 기말고사", startDate: "2025-06-16", endDate: "2025-06-20", category: "시험", color: "#EF4444" },
  { id: "7", title: "1학기 종강", startDate: "2025-06-20", category: "행사", color: "#3B82F6" },
  { id: "8", title: "1학기 성적 발표", startDate: "2025-07-04", category: "성적", color: "#F59E0B" },
  { id: "9", title: "하계방학", startDate: "2025-06-21", endDate: "2025-08-31", category: "방학", color: "#10B981" },
  { id: "10", title: "2학기 수강신청", startDate: "2025-07-14", endDate: "2025-07-18", category: "수강신청", color: "#8B5CF6" },
  { id: "11", title: "2학기 개강", startDate: "2025-09-01", category: "행사", color: "#3B82F6" },
  { id: "12", title: "추석 연휴", startDate: "2025-10-06", endDate: "2025-10-09", category: "행사", color: "#10B981" },
  { id: "13", title: "학부 중간고사", startDate: "2025-10-13", endDate: "2025-10-17", category: "시험", color: "#EF4444" },
  { id: "14", title: "학부 기말고사", startDate: "2025-12-15", endDate: "2025-12-19", category: "시험", color: "#EF4444" },
  { id: "15", title: "2학기 종강", startDate: "2025-12-19", category: "행사", color: "#3B82F6" },
  { id: "16", title: "2학기 성적 발표", startDate: "2026-01-09", category: "성적", color: "#F59E0B" },
  { id: "17", title: "동계방학", startDate: "2025-12-20", endDate: "2026-02-28", category: "방학", color: "#10B981" },
  { id: "18", title: "1학기 수강신청", startDate: "2026-01-12", endDate: "2026-01-16", category: "수강신청", color: "#8B5CF6" },
  { id: "19", title: "졸업식", startDate: "2026-02-20", category: "행사", color: "#F59E0B" },
  { id: "20", title: "1학기 개강", startDate: "2026-03-02", category: "행사", color: "#3B82F6" },
];

router.get("/schedule/academic", (_req, res) => {
  res.json({ events: ACADEMIC_EVENTS });
});

export default router;
