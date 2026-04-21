import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { passcode } = req.body || {};

    if (!passcode) {
      return res.status(400).json({
        ok: false,
        error: "Missing passcode"
      });
    }

    const url = `https://${req.headers.host}/api/find-account`;

    let nftoken: string | null = null;

    for (let i = 0; i < 10; i++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode })
        });

        const data = await response.json();

        console.log("DEBUG FIND ACCOUNT:", data);

        const results = data?.results || [];

        const found = results.find(
          (r: any) =>
            r?.valid &&
            (r.nftoken || r.nfToken || r.token)
        );

        if (found) {
          nftoken =
            found.nftoken ||
            found.nfToken ||
            found.token;
          break;
        }

      } catch (e) {
        console.log("Loop error:", e);
      }
    }

    if (!nftoken) {
      return res.status(404).json({
        ok: false,
        error: "No account available"
      });
    }

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
