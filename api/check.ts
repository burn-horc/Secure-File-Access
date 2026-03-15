import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createRequire } from "module";
import { createClient } from "@supabase/supabase-js";

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

async function savePassedCheckAudits(
  results: any[],
  source: "single-check" | "bulk-check"
) {
  const passed = (results || []).filter((r) => r?.valid);
  if (!passed.length) return;

  const rows = passed.map((item) => ({
    status: "passed",
    source,
    plan: item.plan || null,
    country: item.countryOfSignup || null,
    checked_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("live_checks").insert(rows);

  if (error) {
    console.error("savePassedCheckAudits error:", error.message);
  }
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

    const body = req.body || {};
    console.log("Body keys:", Object.keys(body || {}));

    const parsedInput = getCookieHeaders(body);
    console.log("Parsed input result keys:", parsedInput ? Object.keys(parsedInput) : null);

    if (parsedInput?.error) {
      return res.status(400).json({ success: false, error: parsedInput.error });
    }

    const cookies = parsedInput?.cookies;
    console.log("Cookie count:", Array.isArray(cookies) ? cookies.length : "not-array");

    if (!Array.isArray(cookies) || cookies.length === 0) {
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

  // slow requests slightly so they don't fail instantly
  delayMs: 500,

  // randomize delay to avoid rate limits
  randomJitter: true,

  // small stagger between workers
  staggerMs: 300,

  onValidCookie: async (_cookieHeader: string) => {},
};

    console.log("Worker count:", workerCount);
    console.log("Stream mode:", shouldStream);

    if (shouldStream) {
      console.log("About to run runStreamedCheck");
      return await runStreamedCheck(req, res, cookies, workerCount, checkOptions);
    }

    console.log("About to run runDirectCheck");
    let result = await runDirectCheck(cookies, workerCount, checkOptions);

const retriableCookies: string[] = [];
const firstResults = Array.isArray(result?.results) ? result.results : [];

firstResults.forEach((item: any, index: number) => {
  if (!item?.valid && isRetryableFailure(item) && cookies[index]) {
    retriableCookies.push(cookies[index]);
  }
});

if (retriableCookies.length > 0) {
  console.log("Retrying temporary failures:", retriableCookies.length);

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

    console.log("runDirectCheck finished");
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
