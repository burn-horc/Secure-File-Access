import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./rateLimit.js";

export const checkRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
  prefix: "ratelimit:check",
});
