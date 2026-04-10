import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createRequire } from "module";
import { createClient } from "@supabase/supabase-js";
import { ipRateLimit } from "../lib/rateLimit.js";
import { isLockedOut, recordFailure, clearFailures } from "../lib/antiBruteforce.js";
import crypto from "crypto";
import { checkRateLimit } from "../lib/checkRateLimit.js";

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

async function upsertCheckedCookie(row: {
  account_id?: string;
  cookie_header: string;
  plan?: string | null;
  country?: string | null;
  checked_at?: string;
  expires_at?: string | null;
  is_live: boolean;
  status: string;
}) {
  const { error } = await supabase
    .from("checked_cookies")
    .upsert(
      [
        {
          account_id: row.account_id || crypto.randomUUID(),
          cookie_header: row.cookie_header,
          plan: row.plan ?? null,
          country: row.country ?? null,
          checked_at: row.checked_at ?? new Date().toISOString(),
          expires_at: row.expires_at ?? null,
          is_live: row.is_live,
          status: row.status,
        },
      ],
      { onConflict: "cookie_header" }
    );

  if (error) {
    console.error("checked_cookies upsert error:", error.message);
  }
}

async function savePassedCheckAudits(
  results: any[],
  source: "single-check" | "bulk-check"
) {
  const checkedAt = new Date().toISOString();
  const rows = Array.isArray(results) ? results : [];

  const passed = rows.filter((r) => r?.valid);
  if (passed.length > 0) {
    const liveRows = passed.map((item) => ({
      account_id: item.accountId || crypto.randomUUID(),
      status: "passed",
      cookie_header: item.cookieHeader || null,
      plan: item.plan || null,
      country: item.countryOfSignup || null,
      checked_at: checkedAt,
      expires_at: item.nextBillingRaw || item.nextBilling || null,
    }));

    const { error: liveError } = await supabase.from("live_checks").insert(liveRows);

    if (liveError) {
      console.error("savePassedCheckAudits live_checks error:", liveError.message);
    }
  }

  for (const item of rows) {
    const cookieHeader = item?.cookieHeader;
    if (!cookieHeader) continue;

    await upsertCheckedCookie({
      account_id: item.accountId || crypto.randomUUID(),
      cookie_header: cookieHeader,
      plan: item.plan || null,
      country: item.countryOfSignup || null,
      checked_at: checkedAt,
      expires_at: item.nextBillingRaw || item.nextBilling || null,
      is_live: !!item.valid,
      status: item.valid ? "valid" : "dead",
    });
  }
}

async function saveStreamValidCookie(result: any) {
  if (!result?.cookieHeader) return;

  const checkedAt = new Date().toISOString();
  const accountId = result.accountId || crypto.randomUUID();

  const { error: liveError } = await supabase.from("live_checks").insert([
    {
      account_id: accountId,
      status: "passed",
      cookie_header: result.cookieHeader,
      plan: result.plan || null,
      country: result.countryOfSignup || null,
      checked_at: checkedAt,
      expires_at: result.nextBillingRaw || result.nextBilling || null,
    },
  ]);

  if (liveError) {
    console.error("stream live_checks insert error:", liveError.message);
  }

  await upsertCheckedCookie({
    account_id: accountId,
    cookie_header: result.cookieHeader,
    plan: result.plan || null,
    country: result.countryOfSignup || null,
    checked_at: checkedAt,
    expires_at: result.nextBillingRaw || result.nextBilling || null,
    is_live: true,
    status: "valid",
  });
}
function isRetryableFailure(result: any) {
  const reason = String(result?.reason || result?.error || "").toLowerCase();
  return (
    reason.includes("timeout") ||
    reason.includes("network") ||
    reason.includes("socket") ||
    reason.includes("econnreset") ||
    reason.includes("http 500") ||
    reason.includes("http 502") ||
    reason.includes("http 503") ||
    reason.includes("http 504")
  );
}

const require = createRequire(import.meta.url);
const originalServerHelpers = require("./original_server_helpers.cjs");

const {
  getCookieHeaders,
  normalizeWorkerCount,
  normalizeBoolean,
  runStreamedCheck,
  runDirectCheck,
} = originalServerHelpers.default ?? originalServerHelpers;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log("API /api/check invoked");
    console.log("Method:", req.method);

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const ip = getClientIp(req);

    if (await isLockedOut(ip)) {
      return res.status(429).json({
        success: false,
        error: "Too many failed attempts. Try again later.",
      });
    }

    // Global rate limit (basic protection)
const { success: basicLimit } = await ipRateLimit.limit(ip);
if (!basicLimit) {
  return res.status(429).json({
    success: false,
    error: "Too many requests. Please slow down.",
  });
}

// 🔥 Stronger check-specific limiter (for /api/check)
const { success: checkLimit } = await checkRateLimit.limit(ip);
if (!checkLimit) {
  return res.status(429).json({
    success: false,
    error: "Too many check requests. Please slow down.",
  });
}

    const body = req.body || {};
    console.log("Body keys:", Object.keys(body || {}));

    const parsedInput = getCookieHeaders(body);
    console.log("Parsed input result keys:", parsedInput ? Object.keys(parsedInput) : null);

    if (parsedInput?.error) {
      await recordFailure(ip);
      return res.status(400).json({ success: false, error: parsedInput.error });
    }

    const cookies = parsedInput?.cookies;
    console.log("Cookie count:", Array.isArray(cookies) ? cookies.length : "not-array");

    if (!Array.isArray(cookies) || cookies.length === 0) {
      await recordFailure(ip);
      return res.status(400).json({
        success: false,
        error: "No cookies were provided. Paste Netscape rows, JSON cookie data, or raw/header cookie strings.",
      });
    }

    const requestedWorkerCount = normalizeWorkerCount(body.concurrency);
    const workerCount = Math.max(1, Math.min(2, requestedWorkerCount));
    const shouldStream = body.stream === true;

    const checkOptions = {
      skipNFToken: normalizeBoolean(body.skipNFToken),
      delayMs: 500,
      randomJitter: true,
      staggerMs: 300,
      onValidCookie: async (result: any) => {
  await saveStreamValidCookie(result);
},
    };

    console.log("Worker count:", workerCount);
    console.log("Stream mode:", shouldStream);

    if (shouldStream) {
      return await runStreamedCheck(req, res, cookies, workerCount, checkOptions);
    }

    let result = await runDirectCheck(cookies, workerCount, checkOptions);

    const retriableCookies: string[] = [];
    const firstResults = Array.isArray(result?.results) ? result.results : [];

    firstResults.forEach((item: any, index: number) => {
      if (!item?.valid && isRetryableFailure(item) && cookies[index]) {
        retriableCookies.push(cookies[index]);
      }
    });

    if (retriableCookies.length > 0) {
      const retryResult = await runDirectCheck(retriableCookies, workerCount, {
        ...checkOptions,
        delayMs: 400,
        randomJitter: false,
        staggerMs: 150,
      });

      const retryResults = Array.isArray(retryResult?.results) ? retryResult.results : [];
      let retryCursor = 0;

      result.results = firstResults.map((item: any, index: number) => {
        if (!item?.valid && isRetryableFailure(item) && cookies[index]) {
          const retried = retryResults[retryCursor];
          retryCursor += 1;
          return retried || item;
        }
        return item;
      });

      const valid = result.results.filter((r: any) => r?.valid).length;
      result.stats = {
        total: result.results.length,
        valid,
        invalid: result.results.length - valid,
      };
    }

    const hasValid = Array.isArray(result?.results) && result.results.some((r: any) => r?.valid);

    if (hasValid) {
      await clearFailures(ip);
    } else {
      await recordFailure(ip);
    }

    await savePassedCheckAudits(
      result.results || [],
      cookies.length > 1 ? "bulk-check" : "single-check"
    );

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("API /api/check runtime failure:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || String(error) || "Unexpected server error",
      stack: process.env.NODE_ENV !== "production" ? error?.stack : undefined,
    });
  }
}
