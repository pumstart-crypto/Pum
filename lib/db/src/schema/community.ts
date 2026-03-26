import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const communityPostsTable = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  images: text("images").array(),
  author: text("author").notNull().default("익명"),
  views: integer("views").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommunityPostSchema = createInsertSchema(communityPostsTable).omit({ id: true, createdAt: true, views: true });
export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;
export type CommunityPost = typeof communityPostsTable.$inferSelect;
