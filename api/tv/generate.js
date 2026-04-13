import { tvSessions } from "../../lib/tvStore";

function makeCode() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export default function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const code = makeCode();

  tvSessions.set(code, {
    connected: false,
    createdAt: Date.now(),
    payload: null,
  });

  return res.status(200).json({ success: true, code });
}
