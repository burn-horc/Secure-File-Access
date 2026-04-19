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

    let valid = null;

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
          (r.nftoken || r.nfToken || r.token)
      );

      if (found) {
        valid = found;
        break;
      }
    }

    if (!valid) {
      return res.status(404).json({
        ok: false,
        error: "no token available"
      });
    }

    const nftoken =
      valid.nftoken ||
      valid.nfToken ||
      valid.token;

    return res.status(200).json({
      ok: true,
      tvLink: `https://www.netflix.com/tv8?nftoken=${nftoken}`
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err)
    });
  }
}
