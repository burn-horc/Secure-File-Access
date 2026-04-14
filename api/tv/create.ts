import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { generateTvCode } from "../../lib/tvAuth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    let code = generateTvCode();

    for (let i = 0; i < 5; i += 1) {
      const { data: existing } = await supabaseAdmin
        .from("tv_sessions")
        .select("code")
        .eq("code", code)
        .maybeSingle();

      if (!existing) break;
      code = generateTvCode();
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from("tv_sessions").insert({
      code,
      status: "waiting",
      expires_at: expiresAt,
    });

    if (error) {
      return res.status(500).json({
        ok: false,
        message: "Failed to create TV session.",
      });
    }

    return res.status(200).json({
      ok: true,
      code,
      status: "waiting",
      expiresIn: 300,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Unexpected server error",
    });
  }
}
