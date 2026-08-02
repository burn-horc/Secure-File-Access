import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const PASSCODE_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;

function getAccessToken(req: VercelRequest) {
  const authorization = req.headers.authorization;

  const headerValue = Array.isArray(authorization)
    ? authorization[0]
    : authorization || "";

  const match = headerValue.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || "";
}

async function getOwnedActivePasscode(
  userId: string,
  isAdminAccount: boolean
) {
  const { data, error } = await supabaseAdmin
    .from("passcodes")
    .select("id, code, expires_at, is_admin")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("is_admin", isAdminAccount)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  if (data.expires_at) {
    const expirationTime = new Date(data.expires_at).getTime();

    if (
      !Number.isFinite(expirationTime) ||
      expirationTime <= Date.now()
    ) {
      return null;
    }
  }

  return data;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");

    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
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
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired login session.",
      });
    }

    const { data: adminRow, error: adminError } =
      await supabaseAdmin
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminError) {
      console.error("Admin status lookup error:", adminError);

      return res.status(500).json({
        success: false,
        error: "Unable to check account status.",
      });
    }

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("premium, premium_until")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.error("Profile status lookup error:", profileError);

      return res.status(500).json({
        success: false,
        error: "Unable to check Premium status.",
      });
    }

    const isAdminAccount = Boolean(adminRow);

    const premiumExpirationIsActive =
      !profile?.premium_until ||
      new Date(profile.premium_until).getTime() > Date.now();

    const hasActivePremium =
      isAdminAccount ||
      Boolean(
        profile?.premium &&
          premiumExpirationIsActive
      );

    const ownedPasscode = hasActivePremium
      ? await getOwnedActivePasscode(
          user.id,
          isAdminAccount
        )
      : null;

    if (req.method === "GET") {
      return res.status(200).json({
        success: true,
        is_admin: isAdminAccount,
        has_active_premium: hasActivePremium,
        premium_until: isAdminAccount
          ? null
          : profile?.premium_until || null,
        passcode: ownedPasscode?.code || null,
        passcode_expires_at:
          ownedPasscode?.expires_at || null,
        email: user.email || null,
      });
    }

    // PATCH: change the signed-in user's own passcode
    if (!hasActivePremium) {
      return res.status(403).json({
        success: false,
        error: "An active Premium account is required.",
      });
    }

    if (!ownedPasscode) {
      return res.status(404).json({
        success: false,
        error:
          "No active passcode is attached to your account.",
      });
    }

    const newPasscode = String(
      req.body?.passcode ?? ""
    ).trim();

    if (!PASSCODE_PATTERN.test(newPasscode)) {
      return res.status(400).json({
        success: false,
        error:
          "Passcode must contain 8–32 letters, numbers, underscores, or hyphens.",
      });
    }

    if (newPasscode === ownedPasscode.code) {
      return res.status(200).json({
        success: true,
        passcode: ownedPasscode.code,
        message: "Your passcode is already using this value.",
      });
    }

    const { data: duplicate, error: duplicateError } =
      await supabaseAdmin
        .from("passcodes")
        .select("id")
        .eq("code", newPasscode)
        .neq("id", ownedPasscode.id)
        .limit(1)
        .maybeSingle();

    if (duplicateError) {
      throw new Error(duplicateError.message);
    }

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error:
          "That passcode is already being used. Please choose another.",
      });
    }

    const { data: updatedPasscode, error: updateError } =
      await supabaseAdmin
        .from("passcodes")
        .update({
          code: newPasscode,
        })
        .eq("id", ownedPasscode.id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .select("code, expires_at")
        .single();

    if (updateError) {
      if (updateError.code === "23505") {
        return res.status(409).json({
          success: false,
          error:
            "That passcode is already being used. Please choose another.",
        });
      }

      throw new Error(updateError.message);
    }

    return res.status(200).json({
      success: true,
      passcode: updatedPasscode.code,
      expires_at: updatedPasscode.expires_at,
      message: "Your Premium passcode has been updated.",
    });
  } catch (error: any) {
    console.error("Account status error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to update account information.",
    });
  }
}
