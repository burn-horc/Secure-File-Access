import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function getSignatureParts(signatureHeader) {
  return Object.fromEntries(
    signatureHeader.split(",").map((part) => {
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

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("PAYMONGO_WEBHOOK_SECRET is missing.");

      return res.status(500).json({
        error: "Webhook is not configured.",
      });
    }

    const rawBodyBuffer = await readRawBody(req);
    const rawBody = rawBodyBuffer.toString("utf8");

    const signatureHeader =
      req.headers["paymongo-signature"] || "";

    const signatureParts = getSignatureParts(signatureHeader);
    const timestamp = signatureParts.t;
    const testSignature = signatureParts.te;

    if (!timestamp || !testSignature) {
      return res.status(401).json({
        error: "Missing PayMongo test signature.",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    if (!signaturesMatch(testSignature, expectedSignature)) {
      return res.status(401).json({
        error: "Invalid PayMongo signature.",
      });
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.data?.attributes?.type;

    if (eventType !== "checkout_session.payment.paid") {
      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    const checkoutSession = event?.data?.attributes?.data;
    const metadata = checkoutSession?.attributes?.metadata || {};

    const userId = metadata.user_id;
    const plan = metadata.plan;

    if (!userId || plan !== "premium-30-days") {
      console.error("Invalid checkout metadata:", metadata);

      return res.status(400).json({
        error: "Invalid checkout metadata.",
      });
    }

    // Use the PayMongo event time so repeated webhook deliveries
    // do not repeatedly extend the membership.
    const eventCreatedAt = Number(event?.data?.attributes?.created_at);

    const paidAt =
      Number.isFinite(eventCreatedAt) && eventCreatedAt > 0
        ? new Date(eventCreatedAt * 1000)
        : new Date();

    const premiumUntil = new Date(
      paidAt.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        premium: true,
        premium_until: premiumUntil,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Supabase premium update error:", updateError);

      return res.status(500).json({
        error: "Unable to activate premium membership.",
      });
    }

    console.log("Premium membership activated:", {
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
