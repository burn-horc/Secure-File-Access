import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

function normalizeResult(row: any) {
  return {
    valid: true,
    email: row.email ?? null,
    plan: row.plan ?? null,
    countryOfSignup: row.country_of_signup ?? row.countryOfSignup ?? null,
    nextBilling: row.next_billing ?? row.nextBilling ?? null,
    memberSince: row.member_since ?? row.memberSince ?? null,
    paymentMethod: row.payment_method ?? row.paymentMethod ?? null,
    phone: row.phone ?? null,
    cookieHeader: row.cookie_header ?? row.cookieHeader ?? null,
    nftokenLink: row.nftoken_link ?? row.nftokenLink ?? null,
    hasTokenLink: Boolean(row.nftoken_link ?? row.nftokenLink),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { data, error } = await supabase
      .from("trial_accounts")
      .select("*")
      .eq("is_active", true)
      .eq("is_used", false)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("trial create supabase error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "No free trial account available.",
      });
    }

    const { error: updateError } = await supabase
      .from("trial_accounts")
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (updateError) {
      console.error("trial create update error:", updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to reserve free trial account",
      });
    }

    return res.status(200).json({
      success: true,
      result: normalizeResult(data),
    });
  } catch (err) {
    console.error("trial create server error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
