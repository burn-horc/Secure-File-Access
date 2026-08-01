import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const authorization = String(req.headers.authorization || "");
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const accessToken = match?.[1]?.trim();

    if (!accessToken) {
      return res.status(401).json({
        error: "You must be logged in.",
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({
        error: "Invalid or expired login session.",
      });
    }

    if (!user.email) {
      return res.status(400).json({
        error: "Your account does not have an email address.",
      });
    }

    const amount = Number(process.env.PREMIUM_PRICE_CENTAVOS);
    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
    const appUrl = process.env.APP_URL;

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(500).json({
        error: "Premium price is not configured correctly.",
      });
    }

    if (!paymongoSecretKey || !appUrl) {
      return res.status(500).json({
        error: "Payment configuration is incomplete.",
      });
    }

    const referenceNumber = `premium-${crypto.randomUUID()}`;

    const successUrl = new URL("/premium", appUrl);
    successUrl.searchParams.set("payment", "processing");
    successUrl.searchParams.set("reference", referenceNumber);

    const cancelUrl = new URL("/premium", appUrl);
    cancelUrl.searchParams.set("payment", "cancelled");

    const customerName = String(
      user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email.split("@")[0]
    ).slice(0, 255);

    const paymongoResponse = await fetch(
      "https://api.paymongo.com/v2/checkout_sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${paymongoSecretKey}:`
          ).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            attributes: {
              billing: {
                name: customerName,
                email: user.email,
              },

              line_items: [
                {
                  name: "Premium Access",
                  description: "30 days of premium website access",
                  amount,
                  currency: "PHP",
                  quantity: 1,
                },
              ],

              payment_method_types: ["qrph"],

              success_url: successUrl.toString(),
              cancel_url: cancelUrl.toString(),

              reference_number: referenceNumber,
              send_email_receipt: true,

              metadata: {
                user_id: user.id,
                user_email: user.email,
                plan: "premium-30-days",
                reference_number: referenceNumber,
              },
            },
          },
        }),
      }
    );

    const paymongoData = await paymongoResponse.json();

    if (!paymongoResponse.ok) {
      console.error("PayMongo checkout error:", paymongoData);

      return res.status(paymongoResponse.status).json({
        error:
          paymongoData?.errors?.[0]?.detail ||
          paymongoData?.errors?.[0]?.code ||
          "Unable to create PayMongo checkout.",
      });
    }

    const checkoutSessionId = paymongoData?.data?.id;
    const checkoutUrl =
      paymongoData?.data?.attributes?.checkout_url;

    if (!checkoutSessionId || !checkoutUrl) {
      return res.status(500).json({
        error: "PayMongo returned an incomplete checkout session.",
      });
    }

    const { error: paymentInsertError } = await supabaseAdmin
      .from("premium_payments")
      .insert({
        checkout_session_id: checkoutSessionId,
        reference_number: referenceNumber,
        user_id: user.id,
        plan: "premium-30-days",
        status: "pending",
        amount_centavos: amount,
        currency: "PHP",
      });

    if (paymentInsertError) {
      console.error(
        "Pending payment insert error:",
        paymentInsertError
      );

      return res.status(500).json({
        error: "Unable to save the pending payment.",
      });
    }

    return res.status(200).json({
      checkout_url: checkoutUrl,
      reference_number: referenceNumber,
    });
  } catch (error) {
    console.error("Checkout creation error:", error);

    return res.status(500).json({
      error: "Something went wrong while starting payment.",
    });
  }
}
