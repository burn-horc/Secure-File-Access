import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { ipRateLimit } from "../../lib/rateLimit.js";
import { isLockedOut, recordFailure, clearFailures } from "../../lib/antiBruteforce.js";

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

function getClientIp(req: VercelRequest) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) {
    return realIp;
  }

  return "unknown";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log("verify-passcode method:", req.method);

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const ip = getClientIp(req);

    if (await isLockedOut(ip)) {
      return res.status(429).json({
        success: false,
        error: "Too many failed attempts. Try again in 60 minutes! Nice try diddy 😂.",
      });
    }

    const { success } = await ipRateLimit.limit(ip);
    if (!success) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please slow down.",
      });
    }

    const passcode = String(req.body?.passcode ?? "").trim();
    console.log("verify-passcode received:", passcode ? "[present]" : "[missing]");

    if (!passcode) {
      await recordFailure(ip);
      return res.status(400).json({
        success: false,
        error: "Passcode is required.",
      });
    }

    const { data, error } = await supabase
      .from("passcodes")
      .select("id, code, is_active, expires_at, max_uses, uses")
      .eq("code", passcode)
      .eq("is_active", true)
      .maybeSingle();

    console.log("supabase data:", data);
    console.log("supabase error:", error);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    if (!data) {
      await recordFailure(ip);
      return res.status(401).json({
        success: false,
        error: "Incorrect passcode.",
      });
    }

    if (data.expires_at && new Date(data.expires_at) <= new Date()) {
      await recordFailure(ip);
      return res.status(401).json({
        success: false,
        error: "This passcode has expired.",
      });
    }

    if (data.max_uses && (data.uses || 0) >= data.max_uses) {
      await recordFailure(ip);
      return res.status(403).json({
        success: false,
        error: "Premium code expired",
      });
    }

    const { error: updateError } = await supabase
      .from("passcodes")
      .update({ uses: (data.uses || 0) + 1 })
      .eq("id", data.id);

    if (updateError) {
      console.error("premium verify update error:", updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to update premium code usage",
      });
    }

    await clearFailures(ip);

    return res.status(200).json({
      success: true,
    });
  } catch (error: any) {
    console.error("verify-passcode crash:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected server error",
    });
  }
}
