import { supabaseAdmin } from "../../lib/supabaseAdmin";

function sanitizeCode(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      message: "Method not allowed",
    });
  }

  try {
    const code = sanitizeCode(req.query?.code);

    if (code.length !== 8) {
      return res.status(400).json({
        ok: false,
        message: "Invalid TV code.",
      });
    }

    const { data: session, error } = await supabaseAdmin
      .from("tv_sessions")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!session) {
      return res.status(404).json({
        ok: false,
        message: "TV session not found.",
      });
    }

    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      return res.status(410).json({
        ok: false,
        message: "TV code expired.",
      });
    }

    if (session.status === "linked" && session.tv_token) {
      return res.status(200).json({
        ok: true,
        status: "linked",
        tvToken: session.tv_token,
      });
    }

    return res.status(200).json({
      ok: true,
      status: "waiting",
    });
  } catch (error) {
    console.error("tv status error:", error);

    return res.status(500).json({
      ok: false,
      message: "Internal server error.",
    });
  }
}
