import { Router, type IRouter } from "express";
import { db, coursesTable } from "@workspace/db";
import { ilike, eq, inArray, and, sql, isNotNull } from "drizzle-orm";

const router: IRouter = Router();

// 앱 UI의 semester 코드 → DB semester 값 매핑
// 앱은 '여름계절'/'겨울계절'을 사용하지만 DB에는 '여름'/'겨울'로 저장됨
const SEM_CODE_MAP: Record<string, string> = {
  '여름계절': '여름',
  '겨울계절': '겨울',
};
function normalizeSem(sem: string): string {
  return SEM_CODE_MAP[sem] ?? sem;
}

router.get("/courses/departments", async (req, res) => {
  try {
    const catalogYear = req.query.catalogYear as string | undefined;
    const catalogSemester = req.query.catalogSemester as string | undefined;

    const conditions = [isNotNull(coursesTable.offeringDept)];
    if (catalogYear) conditions.push(eq(coursesTable.year, parseInt(catalogYear)));
    if (catalogSemester) conditions.push(eq(coursesTable.semester, normalizeSem(catalogSemester)));

    const rows = await db
      .selectDistinct({
        offeringCollege: coursesTable.offeringCollege,
        offeringDept: coursesTable.offeringDept,
      })
      .from(coursesTable)
      .where(and(...conditions))
      .orderBy(coursesTable.offeringCollege, coursesTable.offeringDept);

    const result = rows
      .filter(r => r.offeringDept)
      .map(r => ({ college: r.offeringCollege ?? '', dept: r.offeringDept! }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get departments");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/courses", async (req, res) => {
  try {
    const dept = req.query.dept as string | undefined;
    const catalogYear = req.query.catalogYear as string | undefined;
    const catalogSemester = req.query.catalogSemester as string | undefined;
    const gradeYear = req.query.gradeYear as string | undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const professor = req.query.professor as string | undefined;

    const conditions = [];

    if (dept) {
      conditions.push(eq(coursesTable.offeringDept, dept));
    }
    if (catalogYear) {
      conditions.push(eq(coursesTable.year, parseInt(catalogYear)));
    }
    if (catalogSemester) {
      conditions.push(eq(coursesTable.semester, normalizeSem(catalogSemester)));
    }
    if (gradeYear && gradeYear !== "전체") {
      conditions.push(
        sql`(${coursesTable.gradeYear} = ${parseInt(gradeYear)} OR ${coursesTable.gradeYear} IS NULL OR ${coursesTable.gradeYear} = 0)`
      );
    }
    if (category) {
      const cats = category.split(',').map(c => c.trim()).filter(Boolean);
      if (cats.length === 1) {
        conditions.push(eq(coursesTable.category, cats[0]));
      } else if (cats.length > 1) {
        conditions.push(inArray(coursesTable.category, cats));
      }
    }
    if (search && search.length >= 1) {
      conditions.push(ilike(coursesTable.subjectName, `%${search}%`));
    }
    if (professor && professor.length >= 1) {
      conditions.push(ilike(coursesTable.professor, `%${professor}%`));
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
