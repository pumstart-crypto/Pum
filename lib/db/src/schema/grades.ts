import { pgTable, serial, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gradesTable = pgTable("grades", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  semester: text("semester").notNull(),
  subjectName: text("subject_name").notNull(),
  credits: real("credits").notNull().default(3),
  grade: text("grade").notNull(),
  category: text("category").notNull().default("일반선택"),
  isRetake: boolean("is_retake").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGradeSchema = createInsertSchema(gradesTable).omit({ id: true, createdAt: true });
export type InsertGrade = z.infer<typeof insertGradeSchema>;
export type Grade = typeof gradesTable.$inferSelect;
