// api/recheck-unknowns.ts – SIMPLE & RELIABLE
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
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    // Step 1: Get count of unknown cookies
    const { count, error: countError } = await supabase
      .from("checked_cookies")
      .select("id", { count: "exact", head: true })
      .eq("plan", "Premium")
      .eq("status", "unknown");

    if (countError) {
      return res.status(500).json({ success: false, error: countError.message });
    }

    if (count === 0) {
      return res.status(200).json({
        success: true,
        message: "✅ No unknown cookies found. Pool is clean!",
        total: 0,
      });
    }

    // Step 2: Reset unknown cookies to be re-checked (set checked_at to NULL)
    // This will make your find-account.ts pick them up
    const { error: updateError } = await supabase
      .from("checked_cookies")
      .update({ 
        checked_at: null,
        // Keep status as 'unknown' - your system already checks these
      })
      .eq("plan", "Premium")
      .eq("status", "unknown");

    if (updateError) {
      return res.status(500).json({ 
        success: false, 
        error: updateError.message 
      });
    }

    return res.status(200).json({
      success: true,
      message: `✅ Reset ${count} unknown cookies. They will be re-checked on next scan.`,
      total: count,
      suggestion: "Click 'Find Account' to start re-checking them.",
    });

  } catch (err: any) {
    console.error("Re-check error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Server error",
    });
  }
}
