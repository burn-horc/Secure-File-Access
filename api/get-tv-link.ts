import type { VercelRequest, VercelResponse } from "@vercel/node";

function extractNFToken(value: string) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.searchParams.get("nftoken");
  } catch {
    // fallback: maybe it's already a raw token
    if (value.length > 50 && !value.includes("http")) {
      return value;
    }
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { passcode } = req.body || {};

    if (!passcode) {
      return res.status(400).json({
        ok: false,
        error: "Missing passcode"
      });
    }

    const url = `https://${req.headers.host}/api/find-account`;

    let valid = null;

    // 🔥 try multiple times to get a working account
    for (let i = 0; i < 10; i++) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passcode })
      });

      const data = await response.json();

      if (!data.success || !data.results) continue;

      const found = data.results.find(
        (r: any) =>
          r?.valid &&
          (r.nftoken || r.nfToken || r.token || r.nftokenLink)
      );

      if (found) {
        valid = found;
        break;
      }
    }

    if (!valid) {
      return res.status(404).json({
        ok: false,
        error: "no account available"
      });
    }

    // 🔑 extract token properly
    const raw =
      valid.nftoken ||
      valid.nfToken ||
      valid.token ||
      valid.nftokenLink;

    const nftoken = extractNFToken(raw);

    if (!nftoken) {
      return res.status(500).json({
        ok: false,
        error: "failed to extract nftoken"
      });
    }

    // ✅ FINAL FIX: use /tv (NOT /tv8)
    const tvLink = `https://www.netflix.com/tv?nftoken=${nftoken}`;

    return res.status(200).json({
      ok: true,
      tvLink
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err)
    });
  }
}
