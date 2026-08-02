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

function isDateActive(value: string | null) {
  if (!value) return true;

  const timestamp = new Date(value).getTime();

  return (
    Number.isFinite(timestamp) &&
    timestamp > Date.now()
  );
}

function parseExpiration(
  body: any,
  required: boolean
): {
  provided: boolean;
  value: string | null;
  error: string;
} {
  const hasUnlimited = Object.prototype.hasOwnProperty.call(
    body,
    "unlimited"
  );

  const hasExpiration = Object.prototype.hasOwnProperty.call(
    body,
    "expires_at"
  );

  if (!required && !hasUnlimited && !hasExpiration) {
    return {
      provided: false,
      value: null,
      error: "",
    };
  }

  if (body?.unlimited === true) {
    return {
      provided: true,
      value: null,
      error: "",
    };
  }

  if (!body?.expires_at) {
    return {
      provided: true,
      value: null,
      error:
        "Choose an expiration date or select unlimited access.",
    };
  }

  const parsed = new Date(body.expires_at);

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getTime() <= Date.now()
  ) {
    return {
      provided: true,
      value: null,
      error: "The expiration date must be in the future.",
    };
  }

  return {
    provided: true,
    value: parsed.toISOString(),
    error: "",
  };
}

async function findProfileByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, email, name, premium, premium_until"
    )
    .ilike("email", email)
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (
    (data ?? []).find(
      (profile) =>
        String(profile.email || "").toLowerCase() === email
    ) || null
  );
}

async function listPremiumUsers(
  res: VercelResponse
) {
  const [
    { data: profiles, error: profilesError },
    { data: adminRows, error: adminRowsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(
        "id, email, name, premium, premium_until, created_at"
      )
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("admin_users")
      .select("user_id"),
  ]);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  if (adminRowsError) {
    throw new Error(adminRowsError.message);
  }

  const adminIds = new Set(
    (adminRows ?? []).map((row) => row.user_id)
  );

  const managedProfiles = (profiles ?? []).filter(
    (profile) =>
      profile.premium === true ||
      adminIds.has(profile.id)
  );

  const userIds = managedProfiles.map(
    (profile) => profile.id
  );

  if (!userIds.length) {
    return res.status(200).json({
      success: true,
      users: [],
    });
  }

  const [
    { data: passcodes, error: passcodesError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("passcodes")
      .select(
        "id, code, is_active, expires_at, created_at, max_uses, uses, is_admin, user_id, checkout_session_id"
      )
      .in("user_id", userIds)
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("premium_payments")
      .select(
        "id, user_id, status, amount_centavos, currency, paid_at, premium_until, reference_number, created_at"
      )
      .in("user_id", userIds)
      .eq("status", "paid")
      .order("created_at", { ascending: false }),
  ]);

  if (passcodesError) {
    throw new Error(passcodesError.message);
  }

  if (paymentsError) {
    throw new Error(paymentsError.message);
  }

  const users = managedProfiles.map((profile) => {
    const isAdmin = adminIds.has(profile.id);

    const userPasscodes = (passcodes ?? []).filter(
      (passcode) => passcode.user_id === profile.id
    );

    const currentPasscode =
      (isAdmin
        ? userPasscodes.find(
            (passcode) =>
              passcode.is_admin === true &&
              passcode.is_active === true
          )
        : null) ||
      userPasscodes.find(
        (passcode) =>
          passcode.is_active === true &&
          isDateActive(passcode.expires_at)
      ) ||
      userPasscodes.find(
        (passcode) => passcode.is_active === true
      ) ||
      userPasscodes[0] ||
      null;

    const latestPayment =
      (payments ?? []).find(
        (payment) => payment.user_id === profile.id
      ) || null;

    const accountIsActive =
      isAdmin ||
      Boolean(
        profile.premium &&
          isDateActive(profile.premium_until)
      );

    let source = "manual";

    if (currentPasscode?.is_admin) {
      source = "admin";
    } else if (
      currentPasscode?.checkout_session_id
    ) {
      source = "paymongo";
    }

    return {
      user_id: profile.id,
      email: profile.email,
      name: profile.name,
      is_admin: isAdmin,
      premium: profile.premium === true,
      premium_until: profile.premium_until,
      status: accountIsActive
        ? "active"
        : profile.premium
          ? "expired"
          : "inactive",
      source,
      passcode: currentPasscode
        ? {
            id: currentPasscode.id,
            code: currentPasscode.code,
            is_active: currentPasscode.is_active,
            expires_at: currentPasscode.expires_at,
            max_uses: currentPasscode.max_uses,
            uses: currentPasscode.uses,
            is_admin: currentPasscode.is_admin,
          }
        : null,
      payment: latestPayment
        ? {
            amount_centavos:
              latestPayment.amount_centavos,
            currency: latestPayment.currency,
            paid_at: latestPayment.paid_at,
            reference_number:
              latestPayment.reference_number,
          }
        : null,
    };
  });

  return res.status(200).json({
    success: true,
    users,
  });
}

async function grantPremium(
  req: VercelRequest,
  res: VercelResponse
) {
  const body = req.body || {};

  const email = String(body.email || "")
    .trim()
    .toLowerCase();

  const code = String(body.code || "").trim();
  const expiration = parseExpiration(body, true);

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

  if (expiration.error) {
    return res.status(400).json({
      success: false,
      error: expiration.error,
    });
  }

  const targetProfile = await findProfileByEmail(email);

  if (!targetProfile) {
    return res.status(404).json({
      success: false,
      error:
        "No registered account was found with that email.",
    });
  }

  const { data: duplicate } = await supabaseAdmin
    .from("passcodes")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  if (duplicate) {
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
        expires_at: expiration.value,
        max_uses: null,
        uses: 0,
        is_admin: false,
        user_id: targetProfile.id,
        checkout_session_id: null,
      })
      .select("id, code")
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
        premium_until: expiration.value,
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
    message: "Premium access granted.",
  });
}

async function updatePremium(
  req: VercelRequest,
  res: VercelResponse
) {
  const body = req.body || {};
  const userId = String(body.user_id || "").trim();

  const hasNewCode =
    typeof body.code === "string" &&
    body.code.trim().length > 0;

  const newCode = hasNewCode
    ? body.code.trim()
    : "";

  const expiration = parseExpiration(body, false);

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "User ID is required.",
    });
  }

  if (!hasNewCode && !expiration.provided) {
    return res.status(400).json({
      success: false,
      error: "No changes were provided.",
    });
  }

  if (expiration.error) {
    return res.status(400).json({
      success: false,
      error: expiration.error,
    });
  }

  const { data: targetProfile, error: profileError } =
    await supabaseAdmin
      .from("profiles")
      .select(
        "id, premium, premium_until"
      )
      .eq("id", userId)
      .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!targetProfile) {
    return res.status(404).json({
      success: false,
      error: "User account was not found.",
    });
  }

  const { data: targetAdmin, error: targetAdminError } =
    await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

  if (targetAdminError) {
    throw new Error(targetAdminError.message);
  }

  if (targetAdmin && expiration.provided) {
    return res.status(400).json({
      success: false,
      error:
        "The administrator account expiration cannot be changed.",
    });
  }

  let passcodeId = body.passcode_id;

  if (hasNewCode) {
    const codeError = validateCode(newCode);

    if (codeError) {
      return res.status(400).json({
        success: false,
        error: codeError,
      });
    }

    if (!passcodeId) {
      return res.status(400).json({
        success: false,
        error: "Passcode ID is required.",
      });
    }

    const { data: ownedPasscode, error: ownedError } =
      await supabaseAdmin
        .from("passcodes")
        .select("id")
        .eq("id", passcodeId)
        .eq("user_id", userId)
        .maybeSingle();

    if (ownedError) {
      throw new Error(ownedError.message);
    }

    if (!ownedPasscode) {
      return res.status(404).json({
        success: false,
        error: "Passcode was not found.",
      });
    }

    const { data: duplicate, error: duplicateError } =
      await supabaseAdmin
        .from("passcodes")
        .select("id")
        .eq("code", newCode)
        .maybeSingle();

    if (duplicateError) {
      throw new Error(duplicateError.message);
    }

    if (
      duplicate &&
      String(duplicate.id) !== String(passcodeId)
    ) {
      return res.status(409).json({
        success: false,
        error: "That passcode is already in use.",
      });
    }
  }

  if (expiration.provided) {
    const { error: updateProfileError } =
      await supabaseAdmin
        .from("profiles")
        .update({
          premium: true,
          premium_until: expiration.value,
        })
        .eq("id", userId);

    if (updateProfileError) {
      throw new Error(updateProfileError.message);
    }

    const { error: updateExpiryError } =
      await supabaseAdmin
        .from("passcodes")
        .update({
          expires_at: expiration.value,
        })
        .eq("user_id", userId)
        .eq("is_admin", false)
        .eq("is_active", true);

    if (updateExpiryError) {
      await supabaseAdmin
        .from("profiles")
        .update({
          premium: targetProfile.premium,
          premium_until:
            targetProfile.premium_until,
        })
        .eq("id", userId);

      throw new Error(updateExpiryError.message);
    }
  }

  if (hasNewCode) {
    const { error: updateCodeError } =
      await supabaseAdmin
        .from("passcodes")
        .update({
          code: newCode,
        })
        .eq("id", passcodeId)
        .eq("user_id", userId);

    if (updateCodeError) {
      if (updateCodeError.code === "23505") {
        return res.status(409).json({
          success: false,
          error: "That passcode is already in use.",
        });
      }

      throw new Error(updateCodeError.message);
    }
  }

  return res.status(200).json({
    success: true,
    message: "Premium account updated.",
  });
}

async function revokePremium(
  req: VercelRequest,
  res: VercelResponse
) {
  const queryUserId = Array.isArray(req.query.user_id)
    ? req.query.user_id[0]
    : req.query.user_id;

  const userId = String(
    queryUserId || req.body?.user_id || ""
  ).trim();

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "User ID is required.",
    });
  }

  const { data: targetAdmin, error: adminError } =
    await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

  if (adminError) {
    throw new Error(adminError.message);
  }

  if (targetAdmin) {
    return res.status(400).json({
      success: false,
      error: "The administrator account cannot be revoked.",
    });
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      premium: false,
      premium_until: null,
    })
    .eq("id", userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: passcodeError } = await supabaseAdmin
    .from("passcodes")
    .update({
      is_active: false,
    })
    .eq("user_id", userId)
    .eq("is_admin", false)
    .eq("is_active", true);

  if (passcodeError) {
    throw new Error(passcodeError.message);
  }

  return res.status(200).json({
    success: true,
    message: "Premium access revoked.",
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Allow",
    "GET, POST, PATCH, DELETE"
  );

  try {
    if (
      req.method !== "GET" &&
      req.method !== "POST" &&
      req.method !== "PATCH" &&
      req.method !== "DELETE"
    ) {
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

    if (req.method === "GET") {
      return await listPremiumUsers(res);
    }

    if (req.method === "POST") {
      return await grantPremium(req, res);
    }

    if (req.method === "PATCH") {
      return await updatePremium(req, res);
    }

    return await revokePremium(req, res);
  } catch (error: any) {
    console.error("Admin Premium API error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to manage Premium users.",
    });
  }
}
