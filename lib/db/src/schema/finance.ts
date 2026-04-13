import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const financesTable = pgTable("finances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFinanceSchema = createInsertSchema(financesTable).omit({ id: true, createdAt: true, userId: true });
export type InsertFinance = z.infer<typeof insertFinanceSchema>;
export type Finance = typeof financesTable.$inferSelect;
