const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const COOKIE_META_KEYS = new Set([
  'domain',
  'path',
  'expires',
  'expirationdate',
  'maxage',
  'secure',
  'httponly',
  'samesite',
  'hostonly',
  'storeid',
  'id',
  'url',
  'size',
  'sourceport',
  'sourcescheme',
  'priority',
  'partitionkey',
  'sameparty',
  'creation',
  'lastaccessed',
  'comment',
  'version',
]);

const DIRECT_COOKIE_FIELDS = ['cookie', 'cookieheader', 'cookiestring', 'header'];
const DEFAULT_WORKER_COUNT = 1;
const MIN_WORKER_COUNT = 1;
const MAX_WORKER_COUNT = 5;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function toCookiePair(name, value) {
  const cookieName = String(name ?? '').trim();
  if (!cookieName) return null;
  const cookieValue = String(value ?? '').replace(/[\r\n]/g, '').trim();
  return `${cookieName}=${cookieValue}`;
}

function headerFromEntries(entries) {
  const cookies = new Map();
  for (const [name, value] of entries) {
    const pair = toCookiePair(name, value);
    if (!pair) continue;
    const separatorIndex = pair.indexOf('=');
    const key = separatorIndex >= 0 ? pair.slice(0, separatorIndex) : pair;
    const val = separatorIndex >= 0 ? pair.slice(separatorIndex + 1) : '';
    cookies.set(key, val);
  }

  if (cookies.size === 0) return null;

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function headerFromCookieObjectArray(items) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const entries = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') return null;
    if (!('name' in item) || !('value' in item)) return null;
    entries.push([String(item.name ?? ''), item.value]);
  }

  return headerFromEntries(entries);
}

function extractCookieHeadersFromCookiesFieldValue(value) {
  if (typeof value === 'string') {
    const text = value.trim();
    return text && text.includes('=') ? [text] : [];
  }

  if (Array.isArray(value)) {
    const mergedCookieArray = headerFromCookieObjectArray(value);
    if (mergedCookieArray) return [mergedCookieArray];
    return value.flatMap((item) => extractCookieHeadersFromCookiesFieldValue(item));
  }

  if (!value || typeof value !== 'object') return [];

  const singleCookie = toCookiePair(value.name, value.value);
  if (singleCookie) return [singleCookie];

  return Object.values(value).flatMap((nestedValue) =>
    extractCookieHeadersFromCookiesFieldValue(nestedValue)
  );
}

function collectCookieHeadersFromCookiesFields(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectCookieHeadersFromCookiesFields(item));
  }

  if (!value || typeof value !== 'object') return [];

  const headers = [];
  if ('cookies' in value) {
    headers.push(...extractCookieHeadersFromCookiesFieldValue(value.cookies));
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === 'cookies') continue;
    headers.push(...collectCookieHeadersFromCookiesFields(nestedValue));
  }

  return headers;
}

function extractCookieHeadersFromJsonValue(value) {
  if (typeof value === 'string') {
    const text = value.trim();
    return text && text.includes('=') ? [text] : [];
  }

  if (Array.isArray(value)) {
    const mergedCookieArray = headerFromCookieObjectArray(value);
    if (mergedCookieArray) return [mergedCookieArray];
    return value.flatMap((item) => extractCookieHeadersFromJsonValue(item));
  }

  if (!value || typeof value !== 'object') return [];

  for (const field of DIRECT_COOKIE_FIELDS) {
    if (field in value) {
      const direct = extractCookieHeadersFromJsonValue(value[field]);
      if (direct.length > 0) return direct;
    }
  }

  if ('cookies' in value) {
    if (Array.isArray(value.cookies)) {
      const mergedNestedArray = headerFromCookieObjectArray(value.cookies);
      if (mergedNestedArray) return [mergedNestedArray];
    }

    const nestedCookies = extractCookieHeadersFromJsonValue(value.cookies);
    if (nestedCookies.length > 0) return nestedCookies;
  }

  const singleCookie = toCookiePair(value.name, value.value);
  if (singleCookie) return [singleCookie];

  const pairEntries = Object.entries(value).filter(([key, entryValue]) => {
    if (COOKIE_META_KEYS.has(key.toLowerCase())) return false;
    if (entryValue == null || typeof entryValue === 'object') return false;
    return key.trim().length > 0 && !/\s/.test(key);
  });

  const mapHeader = headerFromEntries(pairEntries);
  if (mapHeader) return [mapHeader];

  return Object.values(value).flatMap((entryValue) =>
    extractCookieHeadersFromJsonValue(entryValue)
  );
}

function parseJsonCookieInput(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      cookies: [],
      format: 'json',
      error: 'JSON input is empty. Paste a valid JSON cookie array/object.',
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    const cookiesFromCookiesFields = collectCookieHeadersFromCookiesFields(parsed)
      .map((cookie) => cookie.trim())
      .filter(Boolean);

    if (cookiesFromCookiesFields.length > 0) {
      return { cookies: cookiesFromCookiesFields, format: 'json' };
    }

    const cookies = extractCookieHeadersFromJsonValue(parsed)
      .map((cookie) => cookie.trim())
      .filter(Boolean);

    if (cookies.length === 0) {
      return {
        cookies: [],
        format: 'json',
        error: 'JSON parsed, but no cookie pairs were found.',
      };
    }

    return { cookies, format: 'json' };
  } catch {
    return {
      cookies: [],
      format: 'json',
      error: 'Invalid JSON cookie format. Paste a valid JSON cookie array/object.',
    };
  }
}

function extractNetscapeCookieRows(block) {
  const lines = block.split(/\r?\n/);
  const rows = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.includes('\t')) continue;
    if (trimmed.startsWith('#') && !trimmed.includes('HttpOnly')) continue;

    const cleanLine = trimmed.replace('#HttpOnly_', '');
    const parts = cleanLine.split('\t');

    if (parts.length >= 7) {
      const name = parts[5] ? parts[5].trim() : '';
      const value = parts[6] ? parts[6].trim().replace(/[\r\n]/g, '') : '';
      if (name && value) rows.push([name, value]);
    }
  }

  return rows;
}

function toCookieHeaderFromRows(rows) {
  if (rows.length === 0) return null;

  const cookies = new Map();
  for (const [name, value] of rows) {
    cookies.set(name, value);
  }

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function parseNetscapeCookieBlock(block) {
  const rows = extractNetscapeCookieRows(block);
  if (rows.length === 0) return [];

  const headers = [];
  let currentRows = [];
  const currentValues = new Map();
  const splitAnchorNames = new Set(['NetflixId', 'SecureNetflixId']);

  const flushCurrentRows = () => {
    const previousHeader = toCookieHeaderFromRows(currentRows);
    if (previousHeader) headers.push(previousHeader);
    currentRows = [];
    currentValues.clear();
  };

  for (const [name, value] of rows) {
    if (splitAnchorNames.has(name) && currentValues.has(name)) {
      const previousValue = currentValues.get(name);
      if (
        previousValue !== value &&
        (currentValues.has('NetflixId') || currentValues.has('SecureNetflixId'))
      ) {
        flushCurrentRows();
      }
    }

    currentRows.push([name, value]);
    currentValues.set(name, value);
  }

  flushCurrentRows();
  return headers;
}

function isCommentOnlyNetscapeBlock(block) {
  return block.split(/\r?\n/).every((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (trimmed.startsWith('#HttpOnly_')) return false;
    return trimmed.startsWith('#');
  });
}

function parseNetscapeCookieInput(input) {
  const blocks = input
    .split(/\r?\n\s*\r?\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return {
      cookies: [],
      format: 'netscape',
      error: 'Netscape input is empty. Paste at least one Netscape cookie block.',
    };
  }

  const parsedHeaders = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (isCommentOnlyNetscapeBlock(block)) continue;

    const netscapeParsed = parseNetscapeCookieBlock(block);
    if (netscapeParsed.length === 0) {
      return {
        cookies: [],
        format: 'netscape',
        error: `Invalid Netscape cookie format in block ${index + 1}. Use tab-separated Netscape rows.`,
      };
    }

    parsedHeaders.push(...netscapeParsed);
  }

  const cookies = parsedHeaders.map((cookie) => cookie.trim()).filter(Boolean);
  if (cookies.length === 0) {
    return {
      cookies: [],
      format: 'netscape',
      error: 'No cookie pairs were found in Netscape input.',
    };
  }

  return { cookies, format: 'netscape' };
}

function extractCookieHeaderCandidatesFromTextLine(line) {
  const trimmed = String(line ?? '').trim();
  if (!trimmed) return [];

  const cookieFieldMatch = trimmed.match(/\|\s*cookie\s*=\s*(.+)$/i);
  if (cookieFieldMatch?.[1]) {
    return [cookieFieldMatch[1].trim()];
  }

  return trimmed
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function normalizeCookieHeaderFromText(value) {
  if (typeof value !== 'string') return '';

  const entries = [];
  for (const token of value.split(';')) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const name = trimmed.slice(0, separatorIndex).trim();
    if (!name || COOKIE_META_KEYS.has(name.toLowerCase())) continue;

    const cookieValue = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/[\r\n]/g, '');
    if (!cookieValue) continue;

    entries.push([name, cookieValue]);
  }

  return headerFromEntries(entries) || '';
}

function parseCookieHeaderInput(input) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      cookies: [],
      format: 'header',
      error: 'Raw cookie input is empty. Paste at least one cookie header string.',
    };
  }

  const parsedHeaders = [];
  for (const line of lines) {
    const candidates = extractCookieHeaderCandidatesFromTextLine(line);
    for (const candidate of candidates) {
      const normalized = normalizeCookieHeaderFromText(candidate);
      if (normalized) {
        parsedHeaders.push(normalized);
      }
    }
  }

  const cookies = Array.from(new Set(parsedHeaders.map((cookie) => cookie.trim()).filter(Boolean)));
  if (cookies.length === 0) {
    return {
      cookies: [],
      format: 'header',
      error:
        'Invalid raw/header cookie format. Paste name=value pairs separated by semicolons.',
    };
  }

  return { cookies, format: 'header' };
}

function parseCookieInput(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      cookies: [],
      error:
        'No cookies were provided. Paste Netscape rows, JSON cookie data, or raw/header cookie strings.',
    };
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJsonCookieInput(trimmed);
  }

  if (trimmed.includes('\t')) {
    return parseNetscapeCookieInput(trimmed);
  }

  return parseCookieHeaderInput(trimmed);
}

function getCookieHeaders(body) {
  if (typeof body.input === 'string') {
    return parseCookieInput(body.input);
  }

  if (Array.isArray(body.cookies)) {
    const cookiesFromCookiesFields = body.cookies
      .flatMap((cookie) => collectCookieHeadersFromCookiesFields(cookie))
      .map((cookie) => cookie.trim())
      .filter(Boolean);

    if (cookiesFromCookiesFields.length > 0) {
      return { cookies: cookiesFromCookiesFields, format: 'json' };
    }

    const mergedCookieArray = headerFromCookieObjectArray(body.cookies);
    if (mergedCookieArray) {
      return { cookies: [mergedCookieArray], format: 'json' };
    }

    const cookies = body.cookies
      .flatMap((cookie) => extractCookieHeadersFromJsonValue(cookie))
      .map((cookie) => cookie.trim())
      .filter(Boolean);

    if (cookies.length > 0) {
      return { cookies, format: 'json' };
    }

    return {
      cookies: [],
      format: 'json',
      error: 'Invalid JSON cookie payload. No cookie pairs were found.',
    };
  }

  return {
    cookies: [],
    error:
      'No cookies were provided. Paste Netscape rows, JSON cookie data, or raw/header cookie strings.',
  };
}

function normalizeWorkerCount(value) {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;

  if (!Number.isFinite(parsed)) return DEFAULT_WORKER_COUNT;

  const wholeValue = Math.trunc(parsed);
  return Math.min(MAX_WORKER_COUNT, Math.max(MIN_WORKER_COUNT, wholeValue));
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return false;
}

function normalizeTextField(value) {
  return String(value ?? '').trim();
}

function normalizeCookieHeaderCandidate(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/[\r\n]+/g, ' ').trim();
  if (!normalized || !normalized.includes('=')) return '';
  return normalized;
}

function buildNfTokenLinkFromToken(token) {
  const normalized = normalizeTextField(token);
  if (!normalized) return '';
  return `https://netflix.com/?nftoken=${normalized}`;
}

function normalizeNfTokenLink(link) {
  const normalizedLink = normalizeTextField(link);
  if (!normalizedLink) return '';

  const tokenMatch = normalizedLink.match(/[?&]nftoken=([^&#]+)/i);
  if (tokenMatch?.[1]) {
    let tokenValue = tokenMatch[1];
    try {
      tokenValue = decodeURIComponent(tokenValue);
    } catch {}
    return buildNfTokenLinkFromToken(tokenValue);
  }

  if (normalizedLink.includes('/account?')) {
    return normalizedLink.replace('/account?', '/?');
  }

  return normalizedLink;
}

function resolveNfTokenLinkFromRow(row) {
  const token = normalizeTextField(row?.nftoken);
  if (token) {
    return buildNfTokenLinkFromToken(token);
  }

  const normalizedProvidedLink = normalizeNfTokenLink(row?.nftokenLink);
  return normalizedProvidedLink || '';
}

function sanitizeCheckerResultForClient(result, cookieHeader) {
  const source = result && typeof result === 'object' ? result : {};
  const resolvedTokenLink = resolveNfTokenLinkFromRow(source);
  const normalizedCookieHeader =
    normalizeCookieHeaderCandidate(cookieHeader) ||
    normalizeCookieHeaderCandidate(source?.cookieHeader) ||
    null;
  const { nftoken, nftokenLink: ignoredNftokenLink, ...safeFields } = source;
  void nftoken;
  void ignoredNftokenLink;

  return {
    ...safeFields,
    nftokenLink: resolvedTokenLink || null,
    hasTokenLink: Boolean(resolvedTokenLink),
    cookieHeader: normalizedCookieHeader,
  };
}

async function saveCheckedCookie(result, cookieHeader) {
  const payload = {
    cookie_header: normalizeCookieHeaderCandidate(cookieHeader) || null,
    plan: normalizeTextField(result?.plan) || null,
    country: normalizeTextField(result?.countryOfSignup) || null,
    is_live: result?.valid === true,
    status: result?.valid === true ? 'live' : 'dead',
    checked_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('checked_cookies')
      .upsert(payload, { onConflict: 'cookie_header' });

    if (error) {
      console.error('[supabase] save error:', error);
    }
  } catch (error) {
    console.error('[supabase] save exception:', error);
  }
}

function writeSseEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

const NetflixAccountChecker = require('./netflix_checker.cjs');

async function runStreamedCheck(req, res, cookies, workerCount, checkOptions = {}) {
  let clientDisconnected = false;

  res.on('close', () => {
    clientDisconnected = true;
  });

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (eventName, payload) => {
    if (clientDisconnected || res.writableEnded) return;
    writeSseEvent(res, eventName, payload);
  };

  try {
    const checker = new NetflixAccountChecker();
    const totalCookies = cookies.length;
    const workers = Math.max(1, Math.min(workerCount, totalCookies));
    let valid = 0;
    let processed = 0;
    let nextIndex = 0;

    send('start', { total: totalCookies, workers });

    const runWorker = async (workerIndex) => {
      if (checkOptions.staggerMs > 0 && workerIndex > 0) {
        await new Promise(resolve => setTimeout(resolve, workerIndex * checkOptions.staggerMs));
      }

      while (true) {
        if (clientDisconnected) return;

        const index = nextIndex;
        nextIndex += 1;

        if (index >= totalCookies) return;

        const cookie = cookies[index];
        let result;

        const t0 = Date.now();
        try {
          result = await checker.checkCookie(cookie, checkOptions);
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unexpected checker error';
          result = { valid: false, reason };
        }

        if (clientDisconnected) return;

        if (!result.valid && checkOptions.retryOnFastFail && (Date.now() - t0) < 400) {
          await new Promise(resolve => setTimeout(resolve, 2500));
          if (clientDisconnected) return;
          try {
            result = await checker.checkCookie(cookie, checkOptions);
          } catch (error) {
            const reason = error instanceof Error ? error.message : 'Unexpected checker error';
            result = { valid: false, reason };
          }
          if (clientDisconnected) return;
        }

        if (checkOptions.delayMs > 0) {
          const actualDelay = checkOptions.randomJitter
            ? Math.floor(checkOptions.delayMs * (0.6 + Math.random() * 0.9))
            : checkOptions.delayMs;
          await new Promise(resolve => setTimeout(resolve, actualDelay));
        }

        if (clientDisconnected) return;

                const resultWithCookie = sanitizeCheckerResultForClient(result, cookie);

        await saveCheckedCookie(resultWithCookie, cookie);

        if (resultWithCookie.valid) {
          valid += 1;
          if (resultWithCookie.cookieHeader && typeof checkOptions.onValidCookie === 'function') {
            console.log('[auto-save] valid cookie found in streamed check, invoking save callback');
            try { await checkOptions.onValidCookie(resultWithCookie.cookieHeader); } catch (err) { console.error('[auto-save] callback error:', err); }
          } else if (resultWithCookie.valid) {
            console.log('[auto-save] valid result but cookieHeader is empty/null — cannot save');
          }
        }
        processed += 1;

        send('result', {
          index,
          total: totalCookies,
          result: resultWithCookie,
          stats: {
            total: processed,
            valid,
            invalid: processed - valid,
          },
        });
      }
    };

    await Promise.all(Array.from({ length: workers }, (_, i) => runWorker(i)));

    if (!clientDisconnected) {
      send('done', {
        stats: {
          total: totalCookies,
          valid,
          invalid: totalCookies - valid,
        },
      });
    }

    if (!res.writableEnded) {
      res.end();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected stream error';

    if (!clientDisconnected) {
      send('error', { error: message });
    }

    if (!res.writableEnded) {
      res.end();
    }
  }
}

async function runDirectCheck(cookies, workerCount, checkOptions = {}) {
  const checker = new NetflixAccountChecker();
  const results = new Array(cookies.length);
  const workers = Math.max(1, Math.min(workerCount, cookies.length));
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;

        if (index >= cookies.length) return;

        const cookie = cookies[index];
        let result;

        try {
          result = await checker.checkCookie(cookie, checkOptions);
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unexpected checker error';
          result = { valid: false, reason };
        }

        if (checkOptions.delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, checkOptions.delayMs));
        }

                const resultWithCookie = sanitizeCheckerResultForClient(result, cookie);
        results[index] = resultWithCookie;

        await saveCheckedCookie(resultWithCookie, cookie);

        if (results[index] && results[index].valid && results[index].cookieHeader && typeof checkOptions.onValidCookie === 'function') {
          try { await checkOptions.onValidCookie(results[index].cookieHeader); } catch (_) {}
        }
      }
    })
  );

  const orderedResults = results.filter(Boolean);
  const valid = orderedResults.filter((result) => result.valid).length;

  return {
    success: true,
    results: orderedResults,
    stats: {
      total: orderedResults.length,
      valid,
      invalid: orderedResults.length - valid,
    },
  };
}

module.exports = {
  getCookieHeaders,
  normalizeWorkerCount,
  normalizeBoolean,
  runStreamedCheck,
  runDirectCheck
};
