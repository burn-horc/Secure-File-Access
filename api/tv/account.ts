import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    // 🔥 Extract TV token
    const authHeader = req.headers.authorization || "";
    const tvToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!tvToken) {
      return res.status(401).json({
        ok: false,
        message: "Missing TV token.",
      });
    }

    // 🔥 Find TV session
    const { data: session, error } = await supabaseAdmin
      .from("tv_sessions")
      .select("status")
      .eq("tv_token", tvToken)
      .maybeSingle();

    if (error || !session) {
      return res.status(404).json({
        ok: false,
        message: "Invalid TV session.",
      });
    }

    if (session.status !== "linked") {
      return res.status(403).json({
        ok: false,
        message: "TV not linked.",
      });
    }

    // 🔥 NO LOGIN → return mock account
    return res.status(200).json({
      ok: true,
      account: {
        id: "tv-user",
        display_name: "Connected User",
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Unexpected server error",
    });
  }
}
