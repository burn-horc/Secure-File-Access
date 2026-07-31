import { createClient } from "@supabase/supabase-js";

const supabaseServer = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    // Verify the currently signed-in Supabase user
    const authorization = req.headers.authorization || "";
    const accessToken = authorization.replace("Bearer ", "");

    if (!accessToken) {
      return res.status(401).json({
        error: "You must be logged in.",
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseServer.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({
        error: "Invalid or expired login session.",
      });
    }

    const amount = Number(process.env.PREMIUM_PRICE_CENTAVOS);

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(500).json({
        error: "Premium price is not configured correctly.",
      });
    }

    const referenceNumber = `premium-${user.id}-${Date.now()}`;

    const paymongoResponse = await fetch(
      "https://api.paymongo.com/v2/checkout_sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.PAYMONGO_SECRET_KEY}:`
          ).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            attributes: {
              line_items: [
                {
                  name: "Premium Access",
                  description: "Access to premium website features",
                  amount,
                  currency: "PHP",
                  quantity: 1,
                },
              ],

              // Remove methods that are not enabled in your PayMongo account
              payment_method_types: ["gcash", "card", "qrph"],

              success_url: `${process.env.APP_URL}/premium?payment=success`,
              cancel_url: `${process.env.APP_URL}/premium?payment=cancelled`,

              reference_number: referenceNumber,
              send_email_receipt: true,

              metadata: {
  user_id: user.id,
  user_email: user.email || "",
  plan: "premium-30-days",
},
            },
          },
        }),
      }
    );

    const paymongoData = await paymongoResponse.json();

    if (!paymongoResponse.ok) {
      console.error("PayMongo error:", paymongoData);

      return res.status(paymongoResponse.status).json({
        error:
          paymongoData?.errors?.[0]?.detail ||
          paymongoData?.errors?.[0]?.code ||
          "Unable to create PayMongo checkout.",
      });
    }

    const checkoutUrl =
      paymongoData?.data?.attributes?.checkout_url;

    if (!checkoutUrl) {
      return res.status(500).json({
        error: "PayMongo did not return a checkout URL.",
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
