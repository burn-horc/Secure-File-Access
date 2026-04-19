import type { VercelRequest, VercelResponse } from "@vercel/node";

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

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        passcode
      })
    });

    const data = await response.json();

    if (!data.success || !data.results) {
      return res.status(400).json({
        ok: false,
        error: "no results"
      });
    }

    let valid = null;

for (const r of data.results) {
  if (
    r?.valid &&
    (r.nftoken || r.nfToken || r.token)
  ) {
    valid = r;
    break;
  }
}

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
    return res.status(500).json({
      ok: false,
      error: String(err)
    });
  }
}
