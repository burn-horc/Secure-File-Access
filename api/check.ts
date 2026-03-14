import type { VercelRequest, VercelResponse } from "@vercel/node";
const originalServerHelpers: any = require("../server/original_server_helpers.cjs");

const {
  getCookieHeaders,
  normalizeWorkerCount,
  normalizeBoolean,
  runStreamedCheck,
  runDirectCheck,
} = originalServerHelpers;

async function autoSaveCookie(_cookieHeader: string): Promise<void> {
  // Temporarily disabled on Vercel until storage.ts is fixed
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const parsedInput = getCookieHeaders(body);
    const requestedWorkerCount = normalizeWorkerCount(body.concurrency);

    const checkOptions = {
      skipNFToken: normalizeBoolean(body.skipNFToken),
      delayMs: 1200,
      randomJitter: true,
      staggerMs: 800,
      onValidCookie: autoSaveCookie,
    };

    if (parsedInput.error) {
      return res.status(400).json({ success: false, error: parsedInput.error });
    }

    const cookies = parsedInput.cookies;
    if (!Array.isArray(cookies) || cookies.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No cookies were provided. Paste Netscape rows, JSON cookie data, or raw/header cookie strings.",
      });
    }

    const workerCount = Math.max(1, Math.min(1, requestedWorkerCount));

    if (body.stream === true) {
      await runStreamedCheck(req as any, res as any, cookies, workerCount, checkOptions);
      return;
    }

    const result = await runDirectCheck(cookies, workerCount, checkOptions);
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return res.status(500).json({ success: false, error: message });
  }
}
