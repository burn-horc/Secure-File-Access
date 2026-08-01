import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase server environment variables are missing."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const authorization = String(
      req.headers.authorization || ""
    );

    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const accessToken = match?.[1]?.trim();

    const reference = Array.isArray(req.query.reference)
      ? req.query.reference[0]
      : req.query.reference;

    if (!accessToken) {
      return res.status(401).json({
        error: "You must be logged in.",
      });
    }

    if (!reference || typeof reference !== "string") {
      return res.status(400).json({
        error: "Payment reference is required.",
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({
        error: "Invalid login session.",
      });
    }

    const { data: payment, error: paymentError } =
      await supabaseAdmin
        .from("premium_payments")
        .select(
          "checkout_session_id, status, reference_number, premium_until, email_sent_at"
        )
        .eq("reference_number", reference)
        .eq("user_id", user.id)
        .maybeSingle();

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    if (!payment) {
      return res.status(404).json({
        error: "Payment was not found.",
      });
    }

    if (payment.status !== "paid") {
      return res.status(200).json({
        status: payment.status,
      });
    }

    const { data: passcode, error: passcodeError } =
      await supabaseAdmin
        .from("passcodes")
        .select("code, expires_at")
        .eq(
          "checkout_session_id",
          payment.checkout_session_id
        )
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

    if (passcodeError) {
      throw new Error(passcodeError.message);
    }

    if (!passcode) {
      return res.status(200).json({
        status: "processing",
      });
    }

    return res.status(200).json({
      status: "paid",
      premium_until: payment.premium_until,
      passcode: passcode.code,
      email_sent: Boolean(payment.email_sent_at),
    });
  } catch (error) {
    console.error("Payment status error:", error);

    return res.status(500).json({
      error: "Unable to check payment status.",
    });
  }
}
