import { pgTable, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";

export const librarySessionsTable = pgTable("library_sessions", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  jsessionid: text("jsessionid").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LibrarySession = typeof librarySessionsTable.$inferSelect;
