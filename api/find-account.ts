import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "./supabase";

// @ts-ignore
const originalServerHelpers: any = await import("../server/original_server_helpers.cjs");
const {
  getCookieHeaders,
  runDirectCheck,
} = originalServerHelpers.default ?? originalServerHelpers;

async function isPasscodeValid(passcode: string) {
  const { data, error } = await supabase
    .from("passcodes")
    .select("id, code, is_active, expires_at")
    .eq("code", passcode)
    .eq("is_active", true)
    .maybeSingle();

  console.log("passcode query error:", error);
  console.log("passcode query found:", !!data);

  if (error) throw new Error(error.message);
  if (!data) return { ok: false, error: "Incorrect passcode." };

  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    return { ok: false, error: "This passcode has expired." };
  }

  return { ok: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log("find-account method:", req.method);

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const passcode = String(req.body?.passcode ?? "").trim();
    console.log("find-account passcode present:", !!passcode);

    if (!passcode) {
      return res.status(400).json({ success: false, error: "Passcode is required." });
    }

    const passcodeCheck = await isPasscodeValid(passcode);
    if (!passcodeCheck.ok) {
      return res.status(401).json({ success: false, error: passcodeCheck.error });
    }

    const { data: cookieRows, error: cookieError } = await supabase
      .from("cookies")
      .select("cookie_header")
      .order("id", { ascending: false });

    console.log("cookie query error:", cookieError);
    console.log("cookie row count:", cookieRows?.length ?? 0);

    if (cookieError) {
      return res.status(500).json({
        success: false,
        error: cookieError.message,
      });
    }

    const storedCookies = (cookieRows ?? [])
      .map((row: any) => row.cookie_header)
      .filter(Boolean);

    console.log("storedCookies count:", storedCookies.length);

    if (!storedCookies.length) {
      return res.status(400).json({
        success: false,
        error: "Cookie pool is empty. No cookies available yet.",
      });
    }

    const parsedInput = getCookieHeaders({ input: storedCookies.join("\n") });
    console.log("parsedInput error:", parsedInput?.error ?? null);
    console.log("parsed cookie count:", Array.isArray(parsedInput?.cookies) ? parsedInput.cookies.length : 0);

    if (parsedInput.error) {
      return res.status(400).json({
        success: false,
        error: parsedInput.error,
      });
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

    console.log("starting runDirectCheck with cookies:", cookies.length);

    const result = await runDirectCheck(cookies, 1, {
      skipNFToken: false,
      delayMs: 350,
      randomJitter: true,
      staggerMs: 0,
      onValidCookie: async () => {},
    });

    console.log("runDirectCheck success");

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("find-account crash:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected server error",
    });
  }
}
