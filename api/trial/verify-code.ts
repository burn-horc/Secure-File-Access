import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  try {
    const { code } = req.body;

    const { data, error } = await supabase
      .from("trial_codes")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (!data) {
      return res.status(401).json({ success: false, error: "Invalid trial code" });
    }

    if (data.max_uses && data.uses >= data.max_uses) {
      return res.status(403).json({ success: false, error: "Trial code expired" });
    }

    await supabase
      .from("trial_codes")
      .update({ uses: data.uses + 1 })
      .eq("id", data.id);

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
