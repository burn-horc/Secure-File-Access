import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    // 🔥 1. Extract TV token
    const authHeader = req.headers.authorization || "";
    const tvToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!tvToken) {
      return res.status(401).json({
        ok: false,
        message: "Missing TV token.",
      });
    }

    // 🔥 2. Find TV session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("tv_sessions")
      .select("user_id, status")
      .eq("tv_token", tvToken)
      .maybeSingle();

    if (sessionError || !session) {
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

    // 🔥 3. Fetch user (FROM SUPABASE AUTH)
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(session.user_id);

    if (userError || !userData?.user) {
      return res.status(404).json({
        ok: false,
        message: "User not found.",
      });
    }

    const user = userData.user;

    // 🔥 4. Return safe account data
    return res.status(200).json({
      ok: true,
      account: {
        id: user.id,
        email: user.email,
        display_name:
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Unexpected server error",
    });
  }
}
