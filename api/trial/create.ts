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
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    await supabase
      .from("trial_cookies")
      .update({
        status: null,
        used_at: null,
      })
      .eq("status", "used")
      .not("used_at", "is", null)
      .lte("used_at", tenMinutesAgo);

    const { data, error } = await supabase
      .from("trial_cookies")
      .select("*")
      .is("status", null)
      .not("cookie", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("trial create supabase error:", error);
      return res.status(500).json({ success: false, error: error.message || "Database error" });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: "No free trial account available." });
    }

    const { error: updateError } = await supabase
      .from("trial_cookies")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (updateError) {
      console.error("trial create update error:", updateError);
      return res.status(500).json({ success: false, error: updateError.message || "Failed to update trial account" });
    }

    const result = {
      valid: true,
      email: data.Email || "",
      plan: data.Plan || "",
      countryOfSignup: data.Country || "",
      nextBilling: data["Next Billing"] || "",
      memberSince: data["Member Si"] || "",
      paymentMethod: data.Payment || "",
      phone: data.Phone || "",
      cookieHeader: data.cookie || "",
      nftokenLink: "",
    };

    return res.status(200).json({
      success: true,
      result,
      results: [result],
    });
  } catch (err) {
    console.error("trial create server error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
