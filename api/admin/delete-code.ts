import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { id } = req.body;

  if (!id) return res.json({ ok: false });

  const { error } = await supabase
    .from("trial_codes")
    .delete()
    .eq("id", id);

  if (error) {
    return res.json({ ok: false });
  }

  return res.json({ ok: true });
}
