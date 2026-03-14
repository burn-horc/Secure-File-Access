import { type User, type InsertUser } from "@shared/schema";
import { settings, passcodes, generateUsage, abuseLog, cookieStorage, type Passcode } from "../shared/schema";
import { db } from "./db";
import { eq, sql, ne, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export type AbuseEntry = {
  ip: string;
  timestamp: string;
  userAgent: string;
  allowed: boolean;
  dailyCount: number;
};

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  listPasscodes(): Promise<Passcode[]>;
  createPasscode(code: string, expiresAt: Date | null): Promise<Passcode>;
  deletePasscode(id: number): Promise<void>;
  findValidPasscode(code: string): Promise<Passcode | null>;
  countPasscodes(): Promise<number>;
  getGenerateUsage(ip: string, date: string): Promise<number>;
  incrementGenerateUsage(ip: string, date: string): Promise<number>;
  pruneOldGenerateUsage(today: string): Promise<void>;
  appendAbuseEntry(entry: AbuseEntry): Promise<void>;
  getAbuseLog(): Promise<AbuseEntry[]>;
  clearAbuseLog(): Promise<void>;
  saveCookie(cookieHeader: string): Promise<void>;
  getCookies(): Promise<string[]>;
  countCookies(): Promise<number>;
  deleteCookie(cookieHeader: string): Promise<void>;
  clearAllCookies(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getSetting(key: string): Promise<string | null> {
    const rows = await db.select().from(settings).where(eq(settings.key, key));
    return rows[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }

  async listPasscodes(): Promise<Passcode[]> {
    return db.select().from(passcodes).orderBy(sql`${passcodes.createdAt} desc`);
  }

  async countPasscodes(): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)` }).from(passcodes);
    return Number(rows[0]?.count ?? 0);
  }

  async createPasscode(code: string, expiresAt: Date | null): Promise<Passcode> {
    const rows = await db
      .insert(passcodes)
      .values({ code, expiresAt })
      .returning();
    return rows[0];
  }

  async deletePasscode(id: number): Promise<void> {
    await db.delete(passcodes).where(eq(passcodes.id, id));
  }

  async findValidPasscode(code: string): Promise<Passcode | null> {
    const rows = await db
      .select()
      .from(passcodes)
      .where(
        sql`${passcodes.code} = ${code} AND (${passcodes.expiresAt} IS NULL OR ${passcodes.expiresAt} > NOW())`
      );
    return rows[0] ?? null;
  }

  async getGenerateUsage(ip: string, date: string): Promise<number> {
    const rows = await db
      .select({ count: generateUsage.count })
      .from(generateUsage)
      .where(sql`${generateUsage.ip} = ${ip} AND ${generateUsage.date} = ${date}`);
    return rows[0]?.count ?? 0;
  }

  async incrementGenerateUsage(ip: string, date: string): Promise<number> {
    const rows = await db
      .insert(generateUsage)
      .values({ ip, date, count: 1 })
      .onConflictDoUpdate({
        target: [generateUsage.ip, generateUsage.date],
        set: { count: sql`${generateUsage.count} + 1` },
      })
      .returning({ count: generateUsage.count });
    return rows[0]?.count ?? 1;
  }

  async pruneOldGenerateUsage(today: string): Promise<void> {
    await db.delete(generateUsage).where(ne(generateUsage.date, today));
  }

  async appendAbuseEntry(entry: AbuseEntry): Promise<void> {
    await db.insert(abuseLog).values({
      ip: entry.ip,
      userAgent: entry.userAgent,
      allowed: entry.allowed,
      dailyCount: entry.dailyCount,
    });
    // Keep only the newest 1000 rows
    await db.execute(
      sql`DELETE FROM abuse_log WHERE id NOT IN (SELECT id FROM abuse_log ORDER BY id DESC LIMIT 1000)`
    );
  }

  async getAbuseLog(): Promise<AbuseEntry[]> {
    const rows = await db
      .select()
      .from(abuseLog)
      .orderBy(desc(abuseLog.id))
      .limit(1000);
    return rows.map((r) => ({
      ip: r.ip,
      timestamp: r.timestamp.toISOString(),
      userAgent: r.userAgent,
      allowed: r.allowed,
      dailyCount: r.dailyCount,
    }));
  }

  async clearAbuseLog(): Promise<void> {
    await db.delete(abuseLog);
  }

  async saveCookie(cookieHeader: string): Promise<void> {
    await db
      .insert(cookieStorage)
      .values({ cookieHeader: cookieHeader.trim() })
      .onConflictDoNothing();
  }

  async getCookies(): Promise<string[]> {
    const rows = await db
      .select({ cookieHeader: cookieStorage.cookieHeader })
      .from(cookieStorage)
      .orderBy(desc(cookieStorage.savedAt));
    return rows.map((r) => r.cookieHeader);
  }

  async countCookies(): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)` }).from(cookieStorage);
    return Number(rows[0]?.count ?? 0);
  }

  async deleteCookie(cookieHeader: string): Promise<void> {
    await db.delete(cookieStorage).where(eq(cookieStorage.cookieHeader, cookieHeader.trim()));
  }

  async clearAllCookies(): Promise<void> {
    await db.delete(cookieStorage);
  }
}

export const storage = new MemStorage();
