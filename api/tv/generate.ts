import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cleanupOldTVSessions, generateTVCode, tvSessions } from "../../lib/tvStore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  cleanupOldTVSessions();

  const code = generateTVCode();

  tvSessions.set(code, {
    code,
    createdAt: Date.now(),
    connected: false,
    payload: null,
  });

  return res.status(200).json({
    success: true,
    code,
  });
}
