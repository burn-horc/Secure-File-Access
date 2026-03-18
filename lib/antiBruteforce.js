import { redis } from "./rateLimit.js";

const FAIL_WINDOW_SECONDS = 15 * 60;
const MAX_FAILS = 10;
const LOCKOUT_SECONDS = 60 * 60;

export async function isLockedOut(ip) {
  const lockKey = `find-account:lock:${ip}`;
  const locked = await redis.get(lockKey);
  return !!locked;
}

export async function recordFailure(ip) {
  const failKey = `find-account:fails:${ip}`;
  const lockKey = `find-account:lock:${ip}`;

  const fails = await redis.incr(failKey);

  if (fails === 1) {
    await redis.expire(failKey, FAIL_WINDOW_SECONDS);
  }

  if (fails >= MAX_FAILS) {
    await redis.set(lockKey, "1", { ex: LOCKOUT_SECONDS });
  }

  return fails;
}

export async function clearFailures(ip) {
  const failKey = `find-account:fails:${ip}`;
  const lockKey = `find-account:lock:${ip}`;

  await redis.del(failKey);
  await redis.del(lockKey);
}
