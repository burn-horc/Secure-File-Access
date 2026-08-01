import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function getAccessToken(req: VercelRequest) {
  const authorization = req.headers.authorization;

  const headerValue = Array.isArray(authorization)
    ? authorization[0]
    : authorization || "";

  const match = headerValue.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || "";
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const accessToken = getAccessToken(req);

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: "You must be logged in.",
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired login session.",
      });
    }

    const { data: adminRow, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error("Admin status lookup error:", adminError);

      return res.status(500).json({
        success: false,
        error: "Unable to check account status.",
      });
    }

    return res.status(200).json({
      success: true,
      is_admin: Boolean(adminRow),
    });
  } catch (error: any) {
    console.error("Account status error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to check account status.",
    });
  }
}
