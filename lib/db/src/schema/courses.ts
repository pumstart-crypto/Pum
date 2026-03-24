import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coursesTable = pgTable("courses", {
  id: serial("id").primaryKey(),
  subjectName: text("subject_name").notNull(),
  subjectCode: text("subject_code"),
  section: text("section"),
  professor: text("professor"),
  timeRoom: text("time_room"),
  year: integer("year"),
  category: text("category"),
  offeringDept: text("offering_dept"),
  credits: integer("credits"),
  isOnline: boolean("is_online").default(false),
  isForeign: boolean("is_foreign").default(false),
});

export const insertCourseSchema = createInsertSchema(coursesTable).omit({ id: true });
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof coursesTable.$inferSelect;
