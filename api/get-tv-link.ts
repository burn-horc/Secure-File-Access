import type { VercelRequest, VercelResponse } from "@vercel/node";

// ✅ IMPORT your logic directly
import findAccountHandler from "./find-account";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 👇 fake response object to capture result
    let jsonData: any = null;

    const fakeRes: any = {
      status: () => fakeRes,
      json: (data: any) => {
        jsonData = data;
      }
    };

    // ✅ CALL your API directly (no fetch)
    await findAccountHandler(req, fakeRes);

    const data = jsonData;

    if (!data?.success || !data?.results) {
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
