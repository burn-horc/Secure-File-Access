// api/recheck-unknowns.ts – WORKING VERSION
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const originalServerHelpers = require("./original_server_helpers.cjs");
const { runDirectCheck } = originalServerHelpers.default ?? originalServerHelpers;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow POST or GET for manual trigger
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    // 1. Fetch all unknown Premium cookies
    const { data: cookies, error } = await supabase
      .from("checked_cookies")
      .select("id, cookie_header, country, plan")
      .eq("plan", "Premium")
      .eq("status", "unknown")
      .not("cookie_header", "is", null)
      .not("cookie_header", "eq", "")
      .limit(100);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!cookies || cookies.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "No unknown cookies found",
        total: 0 
      });
    }

    console.log(`📦 Found ${cookies.length} unknown cookies to re-check`);

    let checked = 0;
    let valid = 0;
    let invalid = 0;
    let errors = 0;

    // 2. Check each cookie directly
    for (const cookie of cookies) {
      try {
        // ✅ Direct check – no API call needed!
        const result = await runDirectCheck([cookie.cookie_header], 1, {
          skipNFToken: false,
          delayMs: 0,
          randomJitter: false,
          staggerMs: 0,
          onValidCookie: async () => {},
        });

        const results = Array.isArray(result?.results) ? result.results : [];
        const isValid = results.find((r: any) => r?.valid) !== undefined;

        // 3. Update status
        await supabase
          .from("checked_cookies")
          .update({
            status: isValid ? "active" : "expired",
            checked_at: new Date().toISOString(),
            plan: results[0]?.plan || cookie.plan,
            country: results[0]?.countryOfSignup || cookie.country,
          })
          .eq("id", cookie.id);

        if (isValid) {
          valid++;
        } else {
          invalid++;
        }

        checked++;
        console.log(`✅ Checked ${checked}/${cookies.length} (${isValid ? 'VALID' : 'INVALID'})`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        errors++;
        console.error(`❌ Error checking cookie ${cookie.id}:`, err);
        
        // Mark as error so it gets re-checked later
        await supabase
          .from("checked_cookies")
          .update({
            status: "unknown",
          })
          .eq("id", cookie.id);
      }
    }

    return res.status(200).json({
      success: true,
      total: cookies.length,
      checked,
      valid,
      invalid,
      errors,
      message: `Re-checked ${checked} unknown cookies. ${valid} valid, ${invalid} invalid, ${errors} errors.`
    });

  } catch (err: any) {
    console.error("Re-check error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Server error"
    });
  }
}
