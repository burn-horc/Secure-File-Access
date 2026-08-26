// api/recheck-unknowns.ts – ONE-TIME SCRIPT
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
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
      return res.status(500).json({ error: error.message });
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

    // 2. Check each cookie
    for (const cookie of cookies) {
      try {
        // Call your existing check API
        const checkRes = await fetch(`${process.env.VERCEL_URL}/api/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: cookie.cookie_header,
            stream: false,
          }),
        });

        const data = await checkRes.json().catch(() => ({}));
        const result = data?.results?.[0];
        const isValid = result?.valid === true;

        // 3. Update status
        await supabase
          .from("checked_cookies")
          .update({
            status: isValid ? "active" : "expired",
            checked_at: new Date().toISOString(),
            plan: result?.plan || cookie.plan,
            country: result?.countryOfSignup || cookie.country,
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
