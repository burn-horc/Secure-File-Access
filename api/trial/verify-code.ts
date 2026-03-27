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
    const { code } = req.body || {};

    if (!code || !String(code).trim()) {
      return res.status(400).json({ success: false, error: "Code is required" });
    }

    const { data, error } = await supabase
      .from("trial_codes")
      .select("*")
      .eq("code", String(code).trim())
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("trial verify supabase error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (!data) {
      return res.status(401).json({ success: false, error: "Invalid code" });
    }

    if (data.max_uses && data.uses >= data.max_uses) {
      return res.status(403).json({ success: false, error: "Code expired" });
    }

    const { error: updateError } = await supabase
      .from("trial_codes")
      .update({ uses: (data.uses || 0) + 1 })
      .eq("id", data.id);

    if (updateError) {
      console.error("trial verify update error:", updateError);
      return res.status(500).json({ success: false, error: "Failed to update trial code usage" });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("trial verify server error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
