import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { ipRateLimit } from "../../lib/rateLimit.js";
import {
  isLockedOut,
  recordFailure,
  clearFailures,
} from "../../lib/antiBruteforce.js";

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

function getAccessToken(req: VercelRequest) {
  const authorization = req.headers.authorization;

  const headerValue = Array.isArray(authorization)
    ? authorization[0]
    : authorization || "";

  const match = headerValue.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || "";
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
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
        error: "Too many failed attempts. Try again later.",
      });
    }

    const { success } = await ipRateLimit.limit(ip);

    if (!success) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please slow down.",
      });
    }

    // Verify the signed-in Supabase account
    const accessToken = getAccessToken(req);

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: "You must be logged in.",
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired login session.",
      });
    }

    const passcode = String(req.body?.passcode ?? "")
      .trim()
      

    if (!passcode) {
      await recordFailure(ip);

      return res.status(400).json({
        success: false,
        error: "Passcode is required.",
      });
    }

    // The passcode must belong to the currently signed-in user
    const { data, error } = await supabase
      .from("passcodes")
      .select(
        "id, code, user_id, is_active, expires_at, max_uses, uses"
      )
      .eq("code", passcode)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Passcode lookup error:", error);

      return res.status(500).json({
        success: false,
        error: "Unable to verify the premium code.",
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

    if (
      typeof data.max_uses === "number" &&
      typeof data.uses === "number" &&
      data.uses >= data.max_uses
    ) {
      await recordFailure(ip);

      return res.status(403).json({
        success: false,
        error: "Premium code expired.",
      });
    }

    await clearFailures(ip);

    return res.status(200).json({
      success: true,
    });
  } catch (error: any) {
    console.error("Verify passcode error:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected server error",
    });
  }
}
