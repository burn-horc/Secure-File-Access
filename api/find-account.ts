import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

async function isPasscodeValid(passcode: string) {
  const { data, error } = await supabase
    .from("passcodes")
    .select("id, code, is_active, expires_at")
    .eq("code", passcode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { ok: false, error: "Incorrect passcode." };
  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    return { ok: false, error: "This passcode has expired." };
  }
  return { ok: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const passcode = String(req.body?.passcode ?? "").trim();

    if (!passcode) {
      return res.status(400).json({ success: false, error: "Passcode is required." });
    }

    const passcodeCheck = await isPasscodeValid(passcode);
    if (!passcodeCheck.ok) {
      return res.status(401).json({ success: false, error: passcodeCheck.error });
    }

    const helpersModule: any = await import("../server/original_server_helpers.cjs");
    const helpers = helpersModule.default ?? helpersModule;
    const { getCookieHeaders, runDirectCheck } = helpers;

    const { data: cookieRows, error: cookieError } = await supabase
      .from("cookies")
      .select("*");

    if (cookieError) {
      throw new Error(cookieError.message);
    }

    if (!cookieRows || !cookieRows.length) {
      return res.status(400).json({
        success: false,
        error: "Cookie pool is empty. No cookies available yet.",
      });
    }

    const storedCookies = cookieRows
      .map((row: any) => row.cookie_header ?? row.cookieHeader ?? row.cookie ?? "")
      .filter(Boolean);

    if (!storedCookies.length) {
      return res.status(400).json({
        success: false,
        error: "No usable cookies found in database.",
      });
    }

    const parsedInput = getCookieHeaders({ input: storedCookies.join("\n") });

    if (parsedInput.error) {
      return res.status(400).json({ success: false, error: parsedInput.error });
    }

    const cookies = parsedInput.cookies;
    if (!Array.isArray(cookies) || !cookies.length) {
      return res.status(400).json({
        success: false,
        error: "No valid cookies found in the pool.",
      });
    }

    for (let i = cookies.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cookies[i], cookies[j]] = [cookies[j], cookies[i]];
    }

    const result = await runDirectCheck(cookies, 1, {
      skipNFToken: false,
      delayMs: 350,
      randomJitter: true,
      staggerMs: 0,
      onValidCookie: async () => {},
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("find-account error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected server error",
    });
  }
}
