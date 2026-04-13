import { tvSessions } from "../../lib/tvStore";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const code = String(req.body?.code || "").trim();

  if (!/^\d{8}$/.test(code)) {
    return res.status(400).json({ success: false, error: "Invalid code format" });
  }

  const session = tvSessions.get(code);

  if (!session) {
    return res.status(404).json({ success: false, error: "Code not found" });
  }

  tvSessions.set(code, {
    ...session,
    connected: true,
    payload: {
      connectedAt: Date.now(),
    },
  });

  return res.status(200).json({ success: true });
}
