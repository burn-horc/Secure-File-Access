import { redis } from "./rateLimit";

const FAIL_WINDOW_SECONDS = 15 * 60;
const MAX_FAILS = 5;
const LOCKOUT_SECONDS = 15 * 60;

export async function isLockedOut(ip: string) {
  const lockKey = `find-account:lock:${ip}`;
  const locked = await redis.get(lockKey);
  return !!locked;
}

export async function recordFailure(ip: string) {
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

export async function clearFailures(ip: string) {
  const failKey = `find-account:fails:${ip}`;
  const lockKey = `find-account:lock:${ip}`;

  await redis.del(failKey);
  await redis.del(lockKey);
}
