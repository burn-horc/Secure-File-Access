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

  const headerValue = Array.isArray(authorization)
    ? authorization[0]
    : authorization || "";

  const match = headerValue.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || "";
}

function isDateActive(value: string | null) {
  if (!value) return true;

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "GET") {
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

    const { data: requestingAdmin, error: adminCheckError } =
      await supabaseAdmin
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminCheckError) {
      throw new Error(adminCheckError.message);
    }

    if (!requestingAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required.",
      });
    }

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
  } catch (error: any) {
    console.error("Admin premium users error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load Premium users.",
    });
  }
}
