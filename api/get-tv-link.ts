import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const require = createRequire(import.meta.url);
const helpers = require("./original_server_helpers.cjs");

const { getCookieHeaders, runDirectCheck } =
  helpers.default ?? helpers;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 🔥 get cookies
    const { data: cookieRows, error } = await supabase
      .from("cookies")
      .select("cookie");

    if (error || !cookieRows?.length) {
      return res.status(400).json({ ok: false });
    }

    const storedCookies = cookieRows.map((r: any) => r.cookie).filter(Boolean);

    const parsed = getCookieHeaders({
      input: storedCookies.join("\n"),
    });

    if (parsed.error) {
      return res.status(400).json({ ok: false });
    }

    const cookies = parsed.cookies;

    // 🔥 try cookies
    for (const cookie of cookies) {
      const result = await runDirectCheck([cookie], 1, {
        skipNFToken: false,
        delayMs: 0,
      });

      console.log("RESULT:", JSON.stringify(result, null, 2));

const valid = result?.results?.find((r: any) => r?.valid);

      if (valid?.nftoken) {
        const tvLink = `https://www.netflix.com/tv8?nftoken=${valid.nftoken}`;

        return res.status(200).json({
          ok: true,
          tvLink,
        });
      }
    }

    return res.status(404).json({ ok: false });

  } catch (err) {
    console.error("TV LINK ERROR:", err);
    return res.status(500).json({ ok: false });
  }
}
