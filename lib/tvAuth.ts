import type { VercelRequest } from "@vercel/node";
import crypto from "crypto";

export function generateTvCode() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

export function generateTvToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function sanitizeCode(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

export function getBearerToken(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }
  return null;
}
