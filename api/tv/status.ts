import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { sanitizeCode } from "../../lib/tvAuth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const code = sanitizeCode(req.query.code);
    if (code.length !== 8) {
      return res.status(400).json({
        ok: false,
        message: "Invalid code.",
      });
    }

    const { data: tvSession, error } = await supabaseAdmin
      .from("tv_sessions")
      .select("status, expires_at, tv_token")
      .eq("code", code)
      .maybeSingle();

    if (error || !tvSession) {
      return res.status(404).json({
        ok: false,
        message: "Code not found.",
      });
    }

    if (new Date(tvSession.expires_at).getTime() < Date.now()) {
      return res.status(410).json({
        ok: false,
        message: "Code expired.",
        status: "expired",
      });
    }

    return res.status(200).json({
      ok: true,
      status: tvSession.status,
      tvToken: tvSession.status === "linked" ? tvSession.tv_token : null,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Unexpected server error",
    });
  }
}
