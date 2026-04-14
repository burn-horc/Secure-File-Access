import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { getBearerToken } from "../../lib/tvAuth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const tvToken = getBearerToken(req);
    if (!tvToken) {
      return res.status(401).json({
        ok: false,
        message: "Missing TV token.",
      });
    }

    const { data: tvSession, error: sessionError } = await supabaseAdmin
      .from("tv_sessions")
      .select("user_id, status, expires_at")
      .eq("tv_token", tvToken)
      .maybeSingle();

    if (sessionError || !tvSession || tvSession.status !== "linked") {
      return res.status(401).json({
        ok: false,
        message: "Invalid TV session.",
      });
    }

    if (new Date(tvSession.expires_at).getTime() < Date.now()) {
      return res.status(410).json({
        ok: false,
        message: "TV session expired.",
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", tvSession.user_id)
      .maybeSingle();

    if (profileError) {
      return res.status(500).json({
        ok: false,
        message: "Failed to load account profile.",
      });
    }

    return res.status(200).json({
      ok: true,
      account: profile ?? { user_id: tvSession.user_id },
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Unexpected server error",
    });
  }
}
