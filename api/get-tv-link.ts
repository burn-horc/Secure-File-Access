import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // ✅ use absolute URL correctly
    const url = `https://${req.headers.host}/api/find-account`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({})
    });

    const text = await response.text();

    // 🔥 DEBUG: log raw response
    console.log("RAW RESPONSE:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "find-account returned HTML instead of JSON",
        raw: text.slice(0, 200)
      });
    }

    if (!data.success || !data.results) {
      return res.status(400).json({
        ok: false,
        error: "no results"
      });
    }

    const valid = data.results.find((r: any) => r?.valid);

    if (!valid) {
      return res.status(404).json({
        ok: false,
        error: "no valid account"
      });
    }

    const nftoken =
      valid.nftoken ||
      valid.nfToken ||
      valid.token;

    if (!nftoken) {
      return res.status(404).json({
        ok: false,
        error: "no token"
      });
    }

    const tvLink = `https://www.netflix.com/tv8?nftoken=${nftoken}`;

    return res.status(200).json({
      ok: true,
      tvLink
    });

  } catch (err) {
    console.error("get-tv-link error:", err);
    return res.status(500).json({
      ok: false,
      error: String(err)
    });
  }
}
