import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { generateTvToken, sanitizeCode } from "../../lib/tvAuth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const code = sanitizeCode(req.body?.code);

    if (code.length !== 8) {
      return res.status(400).json({
        ok: false,
        message: "Please enter a valid 8-digit code.",
      });
    }

    // 🔍 Find session
    const { data: tvSession, error: sessionError } = await supabaseAdmin
      .from("tv_sessions")
      .select("status, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (sessionError || !tvSession) {
      return res.status(404).json({
        ok: false,
        message: "Code not found.",
      });
    }

    if (tvSession.status !== "waiting") {
      return res.status(409).json({
        ok: false,
        message: "Code already used.",
      });
    }

    if (new Date(tvSession.expires_at).getTime() < Date.now()) {
      return res.status(410).json({
        ok: false,
        message: "Code expired.",
      });
    }

    // 🔥 Generate token (NO LOGIN NEEDED)
    const tvToken = generateTvToken();

    // 🔥 Link TV
    const { error: updateError } = await supabaseAdmin
      .from("tv_sessions")
      .update({
        status: "linked",
        tv_token: tvToken,
        linked_at: new Date().toISOString(),
      })
      .eq("code", code)
      .eq("status", "waiting");

    if (updateError) {
      return res.status(500).json({
        ok: false,
        message: "Failed to link TV.",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "TV linked successfully!",
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Unexpected server error",
    });
  }
}
