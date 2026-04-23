import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const passcode = String(req.body?.passcode || "").trim();

    if (!passcode) {
      return res.status(400).json({
        ok: false,
        error: "Passcode required"
      });
    }

    // 🔥 CHECK PASSCODE FROM YOUR EXISTING TABLE
    const { data, error } = await supabase
      .from("passcodes")
      .select("*")
      .eq("code", passcode)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return res.status(401).json({
        ok: false,
        error: "Invalid passcode"
      });
    }

    // ✅ GENERATE CODE
    const code = generateCode();

    const { error: insertError } = await supabase
      .from("trial_codes")
      .insert({ code });

    if (insertError) {
      return res.status(500).json({
        ok: false,
        error: insertError.message
      });
    }

    return res.status(200).json({
      ok: true,
      code
    });

  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}
