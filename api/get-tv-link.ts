import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // call your existing API (same domain)
    const baseUrl = `https://${req.headers.host}`;

    const response = await fetch(`${baseUrl}/api/find-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}) // no passcode for now
    });

    const data = await response.json();

    if (!data.success || !data.results) {
      return res.status(400).json({ ok: false });
    }

    const valid = data.results.find((r: any) => r?.valid);

    if (!valid) {
      return res.status(404).json({ ok: false });
    }

    const nftoken =
      valid.nftoken ||
      valid.nfToken ||
      valid.token;

    if (!nftoken) {
      return res.status(404).json({ ok: false });
    }

    const tvLink = `https://www.netflix.com/tv8?nftoken=${nftoken}`;

    return res.status(200).json({
      ok: true,
      tvLink
    });

  } catch (err) {
    console.error("get-tv-link error:", err);
    return res.status(500).json({ ok: false });
  }
}
