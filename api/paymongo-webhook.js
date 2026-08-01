import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function getSignatureParts(signatureHeader) {
  return Object.fromEntries(
    String(signatureHeader || "")
      .split(",")
      .map((part) => {
        const separatorIndex = part.indexOf("=");

        if (separatorIndex === -1) {
          return [part.trim(), ""];
        }

        return [
          part.slice(0, separatorIndex).trim(),
          part.slice(separatorIndex + 1).trim(),
        ];
      })
  );
}

function signaturesMatch(actual, expected) {
  if (!actual || !expected) return false;

  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function extractWebhook(event) {
  const modern = event?.data;

  if (modern?.data && typeof modern?.type === "string") {
    return {
      type: modern.type,
      livemode: modern.livemode,
      createdAt: modern.created_at,
      checkoutSession: modern.data,
    };
  }

  const legacy = event?.data?.attributes;

  return {
    type: legacy?.type,
    livemode: legacy?.livemode,
    createdAt: legacy?.created_at,
    checkoutSession: legacy?.data,
  };
}

function parsePayMongoDate(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const date = new Date(Number(value) * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function generatePremiumPasscode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(10);

  const characters = Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length]
  ).join("");

  return `PREM-${characters.slice(0, 5)}-${characters.slice(5)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getOrCreatePasscode(
  supabaseAdmin,
  { userId, checkoutSessionId, premiumUntil }
) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("passcodes")
    .select("id, code, user_id, expires_at")
    .eq("checkout_session_id", checkoutSessionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    if (existing.user_id !== userId) {
      throw new Error("Passcode ownership mismatch.");
    }

    const { error: refreshError } = await supabaseAdmin
      .from("passcodes")
      .update({
        is_active: true,
        expires_at: premiumUntil,
        max_uses: null,
      })
      .eq("id", existing.id);

    if (refreshError) {
      throw new Error(refreshError.message);
    }

    return existing.code;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generatePremiumPasscode();

    const { data, error } = await supabaseAdmin
      .from("passcodes")
      .insert({
        code,
        user_id: userId,
        checkout_session_id: checkoutSessionId,
        is_active: true,
        expires_at: premiumUntil,
        uses: 0,
        max_uses: null,
      })
      .select("code")
      .single();

    if (!error && data?.code) {
      return data.code;
    }

    if (error?.code === "23505") {
      const { data: duplicateCheckout } = await supabaseAdmin
        .from("passcodes")
        .select("code, user_id")
        .eq("checkout_session_id", checkoutSessionId)
        .maybeSingle();

      if (duplicateCheckout?.user_id === userId) {
        return duplicateCheckout.code;
      }

      continue;
    }

    throw new Error(
      error?.message || "Unable to create Premium passcode."
    );
  }

  throw new Error("Unable to generate a unique Premium passcode.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    const configuredLivemode = process.env.PAYMONGO_LIVEMODE;

    if (
      !webhookSecret ||
      !["true", "false"].includes(configuredLivemode)
    ) {
      console.error(
        "PayMongo webhook environment variables are incomplete."
      );

      return res.status(500).json({
        error: "Webhook is not configured.",
      });
    }

    const rawBodyBuffer = await readRawBody(req);
    const rawBody = rawBodyBuffer.toString("utf8");

    const signatureParts = getSignatureParts(
      req.headers["paymongo-signature"]
    );

    const timestamp = signatureParts.t;

    if (!timestamp) {
      return res.status(401).json({
        error: "Missing PayMongo signature.",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const providedSignature =
      configuredLivemode === "true"
        ? signatureParts.li
        : signatureParts.te;

    if (!signaturesMatch(providedSignature, expectedSignature)) {
      return res.status(401).json({
        error: "Invalid PayMongo signature.",
      });
    }

    const timestampSeconds = Number(timestamp);

    if (
      !Number.isFinite(timestampSeconds) ||
      Math.abs(Date.now() / 1000 - timestampSeconds) > 10 * 60
    ) {
      return res.status(401).json({
        error: "Expired webhook signature.",
      });
    }

    const event = JSON.parse(rawBody);
    const webhook = extractWebhook(event);

    if (webhook.type !== "checkout_session.payment.paid") {
      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    const expectedLivemode = configuredLivemode === "true";

    if (
      typeof webhook.livemode !== "boolean" ||
      webhook.livemode !== expectedLivemode
    ) {
      return res.status(401).json({
        error: "Webhook mode mismatch.",
      });
    }

    const checkoutSession = webhook.checkoutSession;
    const checkoutSessionId = checkoutSession?.id;
    const checkoutAttributes = checkoutSession?.attributes || {};
    const metadata = checkoutAttributes.metadata || {};

    const referenceNumber =
      checkoutAttributes.reference_number;

    const userId = metadata.user_id;

    const paymentCandidates = [
      ...(Array.isArray(checkoutAttributes.payments)
        ? checkoutAttributes.payments
        : []),

      ...(Array.isArray(
        checkoutAttributes.payment_intent?.attributes?.payments
      )
        ? checkoutAttributes.payment_intent.attributes.payments
        : []),
    ];

    const payment = paymentCandidates.find(
      (item) => item?.attributes?.status === "paid"
    );

    const paymentAttributes = payment?.attributes || {};
    const paymentId = payment?.id;

    if (
      !checkoutSessionId ||
      !referenceNumber ||
      !userId ||
      metadata.plan !== "premium-30-days" ||
      !paymentId
    ) {
      console.error("Incomplete paid checkout webhook.");

      return res.status(400).json({
        error: "Invalid checkout information.",
      });
    }

    const expectedAmount = Number(
      process.env.PREMIUM_PRICE_CENTAVOS
    );

    const paidAmount = Number(paymentAttributes.amount);

    if (
      !Number.isInteger(expectedAmount) ||
      paidAmount !== expectedAmount ||
      paymentAttributes.currency !== "PHP"
    ) {
      console.error("Paid checkout amount mismatch.", {
        checkoutSessionId,
        paidAmount,
        currency: paymentAttributes.currency,
      });

      return res.status(400).json({
        error: "Payment amount mismatch.",
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: purchase, error: purchaseError } =
      await supabaseAdmin
        .from("premium_payments")
        .select(
          "checkout_session_id, reference_number, user_id, status, amount_centavos, currency, premium_until, email_sent_at"
        )
        .eq("checkout_session_id", checkoutSessionId)
        .maybeSingle();

    if (purchaseError) {
      throw new Error(purchaseError.message);
    }

    if (
      !purchase ||
      purchase.user_id !== userId ||
      purchase.reference_number !== referenceNumber ||
      purchase.amount_centavos !== expectedAmount ||
      purchase.currency !== "PHP"
    ) {
      return res.status(400).json({
        error: "Unknown Premium purchase.",
      });
    }

    const paidAt =
      parsePayMongoDate(paymentAttributes.paid_at) ||
      parsePayMongoDate(webhook.createdAt) ||
      new Date();

    let premiumUntil = purchase.premium_until;

    if (!premiumUntil) {
      const { data: profile, error: profileReadError } =
        await supabaseAdmin
          .from("profiles")
          .select("id, premium_until")
          .eq("id", userId)
          .maybeSingle();

      if (profileReadError) {
        throw new Error(profileReadError.message);
      }

      if (!profile) {
        throw new Error("The customer profile does not exist.");
      }

      const currentExpiry = profile.premium_until
        ? new Date(profile.premium_until)
        : null;

      const baseTime = Math.max(
        paidAt.getTime(),
        currentExpiry && !Number.isNaN(currentExpiry.getTime())
          ? currentExpiry.getTime()
          : 0
      );

      premiumUntil = new Date(
        baseTime + 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { error: processingError } = await supabaseAdmin
        .from("premium_payments")
        .update({
          status: "processing",
          payment_id: paymentId,
          paid_at: paidAt.toISOString(),
          premium_until: premiumUntil,
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_session_id", checkoutSessionId);

      if (processingError) {
        throw new Error(processingError.message);
      }
    }

    const { data: updatedProfile, error: profileUpdateError } =
      await supabaseAdmin
        .from("profiles")
        .update({
          premium: true,
          premium_until: premiumUntil,
        })
        .eq("id", userId)
        .select("id")
        .maybeSingle();

    if (profileUpdateError) {
      throw new Error(profileUpdateError.message);
    }

    if (!updatedProfile) {
      throw new Error(
        "Premium profile update matched no user."
      );
    }

    const premiumPasscode = await getOrCreatePasscode(
      supabaseAdmin,
      {
        userId,
        checkoutSessionId,
        premiumUntil,
      }
    );

    const { error: paidStatusError } = await supabaseAdmin
      .from("premium_payments")
      .update({
        status: "paid",
        payment_id: paymentId,
        paid_at: paidAt.toISOString(),
        premium_until: premiumUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_session_id", checkoutSessionId);

    if (paidStatusError) {
      throw new Error(paidStatusError.message);
    }

    const { data: authUserData, error: authUserError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (authUserError || !authUserData?.user?.email) {
      throw new Error(
        "Unable to find the customer email address."
      );
    }

    const customer = authUserData.user;
    const customerEmail = customer.email;

    const customerName =
      customer.user_metadata?.full_name ||
      customer.user_metadata?.name ||
      customerEmail.split("@")[0];

    const { data: latestPurchase, error: latestPurchaseError } =
      await supabaseAdmin
        .from("premium_payments")
        .select("email_sent_at")
        .eq("checkout_session_id", checkoutSessionId)
        .single();

    if (latestPurchaseError) {
      throw new Error(latestPurchaseError.message);
    }

    if (!latestPurchase.email_sent_at) {
      const resendApiKey = process.env.RESEND_API_KEY;
      const emailFrom = process.env.EMAIL_FROM;
      const appUrl = process.env.APP_URL;

      if (!resendApiKey || !emailFrom || !appUrl) {
        throw new Error(
          "Custom email environment variables are missing."
        );
      }

      const expiryText = new Intl.DateTimeFormat("en-PH", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(premiumUntil));

      const amountText = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
      }).format(expectedAmount / 100);

      const premiumUrl = new URL(
        "/premium",
        appUrl
      ).toString();

      const emailResponse = await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key":
              `premium-activation/${checkoutSessionId}`,
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [customerEmail],
            subject:
              "Payment confirmed — your Premium access is active",

            text: [
              `Hi ${customerName},`,
              "",
              "Your payment was successful and your 30-day Premium access is now active.",
              `Premium passcode: ${premiumPasscode}`,
              `Valid until: ${expiryText}`,
              `Amount paid: ${amountText}`,
              `Reference: ${referenceNumber}`,
              "",
              `Open Premium: ${premiumUrl}`,
              "",
              "Keep your passcode private.",
            ].join("\n"),

            html: `
              <div style="background:#0b0b0b;padding:32px;font-family:Arial,sans-serif;color:#f5f5f5">
                <div style="max-width:560px;margin:0 auto;background:#161616;border:1px solid #2b2b2b;border-radius:16px;padding:32px">
                  <h1 style="margin:0 0 16px;color:#ffffff">
                    Premium activated
                  </h1>

                  <p>Hi ${escapeHtml(customerName)},</p>

                  <p>
                    Your payment was successful and your
                    30-day Premium access is now active.
                  </p>

                  <div style="margin:24px 0;padding:20px;background:#090909;border:1px solid #e50914;border-radius:12px;text-align:center">
                    <div style="font-size:12px;color:#aaaaaa;margin-bottom:8px">
                      YOUR PREMIUM PASSCODE
                    </div>

                    <div style="font-size:24px;font-weight:700;letter-spacing:2px;color:#ffffff">
                      ${escapeHtml(premiumPasscode)}
                    </div>
                  </div>

                  <p>
                    <strong>Valid until:</strong>
                    ${escapeHtml(expiryText)}
                  </p>

                  <p>
                    <strong>Amount paid:</strong>
                    ${escapeHtml(amountText)}
                  </p>

                  <p>
                    <strong>Reference:</strong>
                    ${escapeHtml(referenceNumber)}
                  </p>

                  <p style="margin:28px 0">
                    <a
                      href="${escapeHtml(premiumUrl)}"
                      style="display:inline-block;background:#e50914;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700"
                    >
                      Open Premium
                    </a>
                  </p>

                  <p style="font-size:13px;color:#aaaaaa">
                    Keep your passcode private. It remains valid
                    until your Premium access expires.
                  </p>
                </div>
              </div>
            `,
          }),
        }
      );

      const emailData = await emailResponse.json();

      if (!emailResponse.ok) {
        throw new Error(
          emailData?.message ||
            "Unable to send activation email."
        );
      }

      const { error: emailMarkError } = await supabaseAdmin
        .from("premium_payments")
        .update({
          email_id: emailData?.id || null,
          email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_session_id", checkoutSessionId);

      if (emailMarkError) {
        throw new Error(emailMarkError.message);
      }
    }

    console.log("Premium purchase fulfilled:", {
      checkoutSessionId,
      userId,
      premiumUntil,
    });

    return res.status(200).json({
      received: true,
      premium_activated: true,
    });
  } catch (error) {
    console.error("PayMongo webhook error:", error);

    return res.status(500).json({
      error: "Webhook processing failed.",
    });
  }
}
