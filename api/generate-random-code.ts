import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SECRET_PASSCODE = "HDSzRCv052496*"; // 🔥 your passcode

function generateCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // ❌ only allow POST
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { passcode } = req.body || {};

    // ❌ missing passcode
    if (!passcode) {
      return res.json({ ok: false, error: "Passcode required" });
    }

    // ❌ wrong passcode
    if (passcode !== SECRET_PASSCODE) {
      return res.json({ ok: false, error: "Invalid passcode" });
    }

    const code = generateCode();

    const { error } = await supabase
      .from("trial_codes")
      .insert({ code });

    if (error) {
      console.error("SUPABASE ERROR:", error);
      return res.json({
        ok: false,
        error: error.message || "Database error",
      });
    }

    // ✅ SUCCESS (this is what your frontend needs)
    return res.status(200).json({
      ok: true,
      code,
    });

  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Server error",
    });
  }
}
