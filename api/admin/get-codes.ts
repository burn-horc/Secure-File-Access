import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from("trial_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return res.json({ ok: false });
  }

  return res.json({ ok: true, codes: data });
}
