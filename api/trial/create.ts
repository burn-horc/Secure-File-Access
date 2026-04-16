import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const GENERATE_ACCOUNT_DAILY_LIMIT = 2;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

function getClientIp(req: VercelRequest) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) {
    return realIp;
  }

  return "unknown";
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function getDailyGenerateUsage(ip: string) {
  const today = getTodayDate();

  const { data, error } = await supabase
    .from("generate_usage")
    .select("count")
    .eq("ip", ip)
    .eq("date", today)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.count ?? 0;
}

async function incrementDailyGenerateUsage(ip: string) {
  const today = getTodayDate();
  const current = await getDailyGenerateUsage(ip);

  if (current === 0) {
    const { error } = await supabase.from("generate_usage").insert({
      ip,
      date: today,
      count: 1,
    });

    if (error) throw new Error(error.message);
    return 1;
  }

  const { error } = await supabase
    .from("generate_usage")
    .update({ count: current + 1 })
    .eq("ip", ip)
    .eq("date", today);

  if (error) throw new Error(error.message);
  return current + 1;
}

async function getPasscodeAdminStatus(passcode: string) {
  if (!passcode) return false;

  const { data, error } = await supabase
    .from("passcodes")
    .select("id, code, is_admin, is_active, expires_at")
    .eq("code", passcode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return false;

  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    return false;
  }

  return data.is_admin === true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const ip = getClientIp(req);
    const passcode = String(req.body?.passcode ?? "").trim();
    const isAdmin = await getPasscodeAdminStatus(passcode);

    if (!isAdmin) {
      const todayUsage = await getDailyGenerateUsage(ip);

      if (todayUsage >= GENERATE_ACCOUNT_DAILY_LIMIT) {
        return res.status(429).json({
          success: false,
          error: "You have reached the 2 daily limit for Random Account. Try again tomorrow.",
        });
      }

      await incrementDailyGenerateUsage(ip);
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    await supabase
      .from("trial_cookies")
      .update({
        status: null,
        used_at: null,
      })
      .eq("status", "used")
      .not("used_at", "is", null)
      .lte("used_at", tenMinutesAgo);

    const { data: cookies, error } = await supabase
      .from("trial_cookies")
      .select("*")
      .is("status", null)
      .not("cookie", "is", null)
      .order("created_at", { ascending: true })
      .limit(5);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    if (!cookies || !cookies.length) {
      return res.status(404).json({
        success: false,
        error: "No free trial account available.",
      });
    }

    const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = req.headers.host;

    if (!host) {
      return res.status(500).json({
        success: false,
        error: "Missing host header",
      });
    }

    for (const row of cookies) {
      const checkRes = await fetch(`${protocol}://${host}/api/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: row.cookie,
          stream: false,
        }),
      });

      const checkData = await checkRes.json().catch(() => ({}));

      if (!checkRes.ok) continue;

      const allResults = Array.isArray(checkData?.results)
        ? checkData.results
        : checkData?.result
          ? [checkData.result]
          : [];

      const valid = allResults.find(
        (r: any) =>
          r?.valid &&
          r?.nftokenLink &&
          (r?.email || r?.plan || r?.countryOfSignup)
      );

      if (valid) {
        await supabase
          .from("trial_cookies")
          .update({
            status: "used",
            used_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        return res.status(200).json({
          success: true,
          result: valid,
          results: [valid],
          adminBypass: isAdmin,
        });
      } else {
        await supabase
          .from("trial_cookies")
          .update({
            status: "dead",
          })
          .eq("id", row.id);
      }
    }

    return res.status(404).json({
      success: false,
      error: "No usable random account found.",
    });
  } catch (err: any) {
    console.error("trial create server error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Server error",
    });
  }
}
