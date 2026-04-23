import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SECRET_PASSCODE = "123456"; // 🔥 change this

function generateCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  const { passcode } = req.body;

  if (passcode !== SECRET_PASSCODE) {
    return res.json({ ok: false, error: "Invalid passcode" });
  }

  const code = generateCode();

  const { error } = await supabase
    .from("trial_codes") // 🔥 your table
    .insert({ code });

  if (error) {
    console.error(error);
    return res.json({ ok: false, error: "DB error" });
  }

  return res.json({ ok: true, code });
}
