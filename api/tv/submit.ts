import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { getBearerToken, sanitizeCode } from "../../lib/tvAuth.js";

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

    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.status(401).json({
        ok: false,
        message: "Missing session.",
      });
    }

    const supabaseUserClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({
        ok: false,
        message: "Invalid session.",
      });
    }

    const { data: tvSession, error: sessionError } = await supabaseAdmin
      .from("tv_sessions")
      .select("code, status, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (sessionError || !tvSession) {
      return res.status(404).json({
        ok: false,
        message: "Code not found.",
      });
    }

    if (new Date(tvSession.expires_at).getTime() < Date.now()) {
      return res.status(410).json({
        ok: false,
        message: "Code expired.",
      });
    }

    if (tvSession.status === "linked") {
      return res.status(409).json({
        ok: false,
        message: "Code already used.",
      });
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("checked_cookies")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accountError || !account) {
      return res.status(500).json({
        ok: false,
        message: "No available account.",
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("tv_sessions")
      .update({
        status: "linked",
        account_cookie: account.cookie_header,
        linked_at: new Date().toISOString(),
        linked_user_id: user.id,
      })
      .eq("code", code);

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
