import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../../lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const passcode = String(req.body?.passcode ?? "").trim();

    if (!passcode) {
      return res.status(400).json({ success: false, error: "Passcode is required." });
    }

    const { data, error } = await supabase
      .from("passcodes")
      .select("id, code, is_active, expires_at")
      .eq("code", passcode)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(401).json({ success: false, error: "Incorrect passcode." });
    }

    if (data.expires_at && new Date(data.expires_at) <= new Date()) {
      return res.status(401).json({ success: false, error: "This passcode has expired." });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected server error",
    });
  }
}
