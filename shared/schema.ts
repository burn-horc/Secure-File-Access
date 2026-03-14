import { users } from "./models/auth";
import { boolean, integer, pgTable, primaryKey, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod";

export const settings = pgTable("settings", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: varchar("value", { length: 1000 }).notNull(),
});

export const passcodes = pgTable("passcodes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export type Passcode = typeof passcodes.$inferSelect;

export const generateUsage = pgTable("generate_usage", {
  ip: varchar("ip", { length: 64 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  count: integer("count").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.ip, table.date] }),
]);

export const abuseLog = pgTable("abuse_log", {
  id: serial("id").primaryKey(),
  ip: varchar("ip", { length: 64 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  userAgent: text("user_agent").notNull().default(""),
  allowed: boolean("allowed").notNull(),
  dailyCount: integer("daily_count").notNull().default(0),
});

export const cookieStorage = pgTable("cookie_storage", {
  id: serial("id").primaryKey(),
  cookieHeader: text("cookie_header").notNull().unique(),
  savedAt: timestamp("saved_at").notNull().defaultNow(),
});

export const checkRequestSchema = z.object({
  input: z.string().optional(),
  cookies: z.any().optional(),
  concurrency: z.union([z.number(), z.string()]).optional(),
  skipNFToken: z.union([z.boolean(), z.string()]).optional(),
  stream: z.boolean().optional(),
});

export type CheckRequest = z.infer<typeof checkRequestSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
