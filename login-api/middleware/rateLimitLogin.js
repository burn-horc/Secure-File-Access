const crypto = require("crypto");
const redis = require("../redisClient");

const WINDOW_IP = 10 * 60;      // 10 minutes
const WINDOW_FP = 10 * 60;      // 10 minutes
const WINDOW_USER = 15 * 60;    // 15 minutes

const MAX_IP = 5;
const MAX_FP = 5;
const MAX_USER = 8;

const LOCK_SECONDS = 15 * 60;   // 15 minutes

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || "unknown";
}

function buildFingerprint(rawFingerprint) {
  return sha256(String(rawFingerprint || ""));
}

async function incrementWithWindow(key, windowSeconds) {
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  const ttl = await redis.ttl(key);
  return { count, ttl };
}

async function setLock(lockKey, seconds) {
  await redis.set(lockKey, "1", "EX", seconds);
}

async function getLockTtl(lockKey) {
  const exists = await redis.exists(lockKey);

  if (!exists) return 0;

  return await redis.ttl(lockKey);
}

async function checkLoginLock(req, res, next) {
  const ip = getClientIp(req);
  const email = normalizeEmail(req.body.email);
  const fingerprint = buildFingerprint(req.body.fingerprint);

  const lockKeys = [
    `lock:ip:${ip}`,
    email ? `lock:user:${email}` : null,
    fingerprint ? `lock:fp:${fingerprint}` : null,
  ].filter(Boolean);

  let maxTtl = 0;

  for (const key of lockKeys) {
    const ttl = await getLockTtl(key);
    if (ttl > maxTtl) {
      maxTtl = ttl;
    }
  }

  if (maxTtl > 0) {
    return res.status(429).json({
      error: "Too many failed attempts. Try again later.",
      retryAfterSeconds: maxTtl,
    });
  }

  next();
}

async function recordFailedLogin(req) {
  const ip = getClientIp(req);
  const email = normalizeEmail(req.body.email);
  const fingerprint = buildFingerprint(req.body.fingerprint);

  const ipCounter = await incrementWithWindow(`fail:ip:${ip}`, WINDOW_IP);

  let fpCounter = null;
  if (fingerprint) {
    fpCounter = await incrementWithWindow(`fail:fp:${fingerprint}`, WINDOW_FP);
  }

  let userCounter = null;
  if (email) {
    userCounter = await incrementWithWindow(`fail:user:${email}`, WINDOW_USER);
  }

  if (ipCounter.count >= MAX_IP) {
    await setLock(`lock:ip:${ip}`, LOCK_SECONDS);
  }

  if (fpCounter && fpCounter.count >= MAX_FP) {
    await setLock(`lock:fp:${fingerprint}`, LOCK_SECONDS);
  }

  if (userCounter && userCounter.count >= MAX_USER) {
    await setLock(`lock:user:${email}`, LOCK_SECONDS);
  }
}

async function clearLoginFailures(req) {
  const ip = getClientIp(req);
  const email = normalizeEmail(req.body.email);
  const fingerprint = buildFingerprint(req.body.fingerprint);

  const keys = [
    `fail:ip:${ip}`,
    `lock:ip:${ip}`,
    email ? `fail:user:${email}` : null,
    email ? `lock:user:${email}` : null,
    fingerprint ? `fail:fp:${fingerprint}` : null,
    fingerprint ? `lock:fp:${fingerprint}` : null,
  ].filter(Boolean);

  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

module.exports = {
  checkLoginLock,
  recordFailedLogin,
  clearLoginFailures,
};
