import { Router, type IRouter } from "express";
import { db, coursesTable } from "@workspace/db";
import { ilike, eq, and, sql, isNotNull } from "drizzle-orm";

const router: IRouter = Router();

router.get("/courses/departments", async (req, res) => {
  try {
    const depts = await db
      .selectDistinct({ offeringDept: coursesTable.offeringDept })
      .from(coursesTable)
      .where(isNotNull(coursesTable.offeringDept))
      .orderBy(coursesTable.offeringDept);

    res.json(depts.map(d => d.offeringDept).filter(Boolean).sort());
  } catch (err) {
    req.log.error({ err }, "Failed to get departments");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/courses", async (req, res) => {
  try {
    const dept = req.query.dept as string | undefined;
    const year = req.query.year as string | undefined;
    const search = req.query.search as string | undefined;

    const conditions = [];

    if (dept) {
      conditions.push(eq(coursesTable.offeringDept, dept));
    }
    if (year && year !== "전체") {
      conditions.push(eq(coursesTable.year, parseInt(year)));
    }
    if (search && search.length >= 1) {
      conditions.push(
        sql`(${ilike(coursesTable.subjectName, `%${search}%`)} OR ${ilike(coursesTable.professor, `%${search}%`)})`
      );
    }

    const query = conditions.length > 0
      ? db.select().from(coursesTable).where(and(...conditions)).limit(200)
      : db.select().from(coursesTable).limit(200);

    const courses = await query;
    res.json(courses);
  } catch (err) {
    req.log.error({ err }, "Failed to get courses");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
