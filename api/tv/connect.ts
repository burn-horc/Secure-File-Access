import type { VercelRequest, VercelResponse } from "@vercel/node";

declare global {
  // eslint-disable-next-line no-var
  var tvStore: Map<string, { status: "waiting" | "connected"; result: any; createdAt: number }> | undefined;
}

const store =
  global.tvStore ||
  new Map<string, { status: "waiting" | "connected"; result: any; createdAt: number }>();

global.tvStore = store;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const code = String(req.body?.code || "").trim();

  if (!/^\d{8}$/.test(code)) {
    return res.status(400).json({
      success: false,
      error: "Invalid 8-digit code",
    });
  }

  const entry = store.get(code);

  if (!entry) {
    return res.status(404).json({
      success: false,
      error: "Code not found",
    });
  }

  entry.status = "connected";
  entry.result = {
    connectedAt: new Date().toISOString(),
    message: "TV paired successfully",
  };

  store.set(code, entry);

  return res.status(200).json({
    success: true,
    message: "Connected",
  });
}
