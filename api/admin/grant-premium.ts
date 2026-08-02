import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";
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

function getAccessToken(req: VercelRequest) {
  const authorization = req.headers.authorization;

  const value = Array.isArray(authorization)
    ? authorization[0]
    : authorization || "";

  return (
    value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || ""
  );
}

function validateCode(code: string) {
  if (code.length < 8 || code.length > 32) {
    return "The passcode must contain 8 to 32 characters.";
  }

  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    return "Use only letters, numbers, hyphens, and underscores.";
  }

  return "";
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

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
      throw new Error(adminError.message);
    }

    if (!adminRow) {
      return res.status(403).json({
        success: false,
        error: "Admin access required.",
      });
    }

    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    const code = String(req.body?.code || "").trim();
    const unlimited = req.body?.unlimited === true;
    const expiresAtInput = req.body?.expires_at;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Customer email is required.",
      });
    }

    const codeError = validateCode(code);

    if (codeError) {
      return res.status(400).json({
        success: false,
        error: codeError,
      });
    }

    let expiresAt: string | null = null;

    if (!unlimited) {
      if (!expiresAtInput) {
        return res.status(400).json({
          success: false,
          error:
            "Choose an expiration date or select unlimited access.",
        });
      }

      const parsedExpiration = new Date(expiresAtInput);

      if (
        !Number.isFinite(parsedExpiration.getTime()) ||
        parsedExpiration.getTime() <= Date.now()
      ) {
        return res.status(400).json({
          success: false,
          error: "The expiration date must be in the future.",
        });
      }

      expiresAt = parsedExpiration.toISOString();
    }

    const { data: matchingProfiles, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, email, name, premium, premium_until"
        )
        .ilike("email", email)
        .limit(10);

    if (profileError) {
      throw new Error(profileError.message);
    }

    const targetProfile = (matchingProfiles ?? []).find(
      (profile) =>
        String(profile.email || "").toLowerCase() === email
    );

    if (!targetProfile) {
      return res.status(404).json({
        success: false,
        error:
          "No registered account was found with that email.",
      });
    }

    const { data: duplicateCode, error: duplicateError } =
      await supabaseAdmin
        .from("passcodes")
        .select("id")
        .eq("code", code)
        .maybeSingle();

    if (duplicateError) {
      throw new Error(duplicateError.message);
    }

    if (duplicateCode) {
      return res.status(409).json({
        success: false,
        error: "That passcode is already in use.",
      });
    }

    const { data: newPasscode, error: insertError } =
      await supabaseAdmin
        .from("passcodes")
        .insert({
          code,
          is_active: true,
          expires_at: expiresAt,
          max_uses: null,
          uses: 0,
          is_admin: false,
          user_id: targetProfile.id,
          checkout_session_id: null,
        })
        .select(
          "id, code, expires_at, user_id"
        )
        .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return res.status(409).json({
          success: false,
          error: "That passcode is already in use.",
        });
      }

      throw new Error(insertError.message);
    }

    const { error: profileUpdateError } =
      await supabaseAdmin
        .from("profiles")
        .update({
          premium: true,
          premium_until: expiresAt,
        })
        .eq("id", targetProfile.id);

    if (profileUpdateError) {
      await supabaseAdmin
        .from("passcodes")
        .delete()
        .eq("id", newPasscode.id);

      throw new Error(profileUpdateError.message);
    }

    const { error: deactivateError } =
      await supabaseAdmin
        .from("passcodes")
        .update({
          is_active: false,
        })
        .eq("user_id", targetProfile.id)
        .eq("is_admin", false)
        .eq("is_active", true)
        .neq("id", newPasscode.id);

    if (deactivateError) {
      await supabaseAdmin
        .from("profiles")
        .update({
          premium: targetProfile.premium,
          premium_until: targetProfile.premium_until,
        })
        .eq("id", targetProfile.id);

      await supabaseAdmin
        .from("passcodes")
        .delete()
        .eq("id", newPasscode.id);

      throw new Error(deactivateError.message);
    }

    return res.status(200).json({
      success: true,
      user: {
        user_id: targetProfile.id,
        email: targetProfile.email,
        name: targetProfile.name,
        premium_until: expiresAt,
        passcode: newPasscode.code,
      },
    });
  } catch (error: any) {
    console.error("Grant Premium error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to grant Premium access.",
    });
  }
}
