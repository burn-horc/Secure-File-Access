import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// 🔥 same env as your main backend
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // ✅ 1. get active passcode automatically
    const { data: passcodeRow } = await supabase
      .from("passcodes")
      .select("code")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!passcodeRow?.code) {
      return res.status(400).json({
        ok: false,
        error: "No active passcode",
      });
    }

    // ✅ 2. call your EXISTING endpoint (do NOT rewrite logic)
    const baseUrl =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/find-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ passcode: passcodeRow.code }),
    });

    const data = await response.json();

    // ✅ 3. extract valid result
    if (!data.success || !data.results) {
      return res.status(500).json({ ok: false });
    }

    const valid = data.results.find((r: any) => r?.valid);

    if (!valid || !valid.nftoken) {
      return res.status(404).json({ ok: false });
    }

    const tvLink = `https://www.netflix.com/tv8?nftoken=${valid.nftoken}`;

    return res.status(200).json({
      ok: true,
      tvLink,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
}
