import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cleanupOldTVSessions, tvSessions } from "../../../lib/tvStore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  cleanupOldTVSessions();

  const code = String(req.query.code || "").trim();

  if (!/^\d{8}$/.test(code)) {
    return res.status(400).json({ success: false, error: "Invalid code format" });
  }

  const session = tvSessions.get(code);

  if (!session) {
    return res.status(404).json({ success: false, error: "Code not found" });
  }

  return res.status(200).json({
    success: true,
    status: session.connected ? "connected" : "waiting",
    result: session.payload || null,
  });
}
