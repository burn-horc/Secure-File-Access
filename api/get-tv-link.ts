import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "./find-account";

export default async function tvHandler(req: VercelRequest, res: VercelResponse) {
  try {
    // 🔥 create fake req/res to call your existing logic internally
    let jsonData: any = null;

    const fakeReq: any = {
      ...req,
      method: "POST",
      body: {
        passcode: "AUTO" // won't matter, your DB logic handles it
      }
    };

    const fakeRes: any = {
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        jsonData = data;
        return this;
      }
    };

    // 🔥 call your existing logic directly
    await handler(fakeReq, fakeRes);

    // ❌ if failed
    if (!jsonData?.success || !jsonData?.results) {
      return res.status(500).json({ ok: false });
    }

    // 🔥 extract valid account
    const valid = jsonData.results.find((r: any) => r?.valid);

    if (!valid || !valid.nftoken) {
      return res.status(404).json({ ok: false });
    }

    // ✅ build TV link
    const tvLink = `https://www.netflix.com/tv8?nftoken=${valid.nftoken}`;

    return res.status(200).json({
      ok: true,
      tvLink
    });

  } catch (err) {
    console.error("get-tv-link crash:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error"
    });
  }
}
