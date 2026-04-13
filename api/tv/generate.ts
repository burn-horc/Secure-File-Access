import type { VercelRequest, VercelResponse } from "@vercel/node";

const sessions = new Map();

function generateCode() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const code = generateCode();

  sessions.set(code, {
    status: "waiting",
    createdAt: Date.now(),
  });

  res.status(200).json({ code });
}
