import type { VercelRequest, VercelResponse } from "@vercel/node";

const originalServerHelpers: any = require("../server/original_server_helpers.cjs");

const {
  getCookieHeaders,
  normalizeWorkerCount,
  normalizeBoolean,
  runDirectCheck,
} = originalServerHelpers;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log("API /api/check invoked");
    console.log("Method:", req.method);

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const body = req.body || {};
    console.log("Body keys:", Object.keys(body || {}));

    const parsedInput = getCookieHeaders(body);
    console.log("Parsed input result keys:", parsedInput ? Object.keys(parsedInput) : null);

    const requestedWorkerCount = normalizeWorkerCount(body.concurrency);

    const checkOptions = {
      skipNFToken: normalizeBoolean(body.skipNFToken),
      delayMs: 1200,
      randomJitter: true,
      staggerMs: 800,
      onValidCookie: async (_cookieHeader: string) => {},
    };

    if (parsedInput?.error) {
      return res.status(400).json({ success: false, error: parsedInput.error });
    }

    const cookies = parsedInput?.cookies;
    console.log("Cookie count:", Array.isArray(cookies) ? cookies.length : "not-array");

    if (!Array.isArray(cookies) || cookies.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No cookies were provided. Paste Netscape rows, JSON cookie data, or raw/header cookie strings.",
      });
    }

    const workerCount = Math.max(1, Math.min(1, requestedWorkerCount));
    console.log("Worker count:", workerCount);
    console.log("About to run runDirectCheck");

    const result = await runDirectCheck(cookies, workerCount, checkOptions);

    console.log("runDirectCheck finished");
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("API /api/check runtime failure:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || String(error) || "Unexpected server error",
      stack: process.env.NODE_ENV !== "production" ? error?.stack : undefined,
    });
  }
}
